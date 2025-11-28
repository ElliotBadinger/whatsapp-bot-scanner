import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { register, metrics, config, logger, assertControlPlaneToken, normalizeUrl, urlHash, assertEssentialConfig } from '@wbscanner/shared';
import { getSharedConnection } from './database.js';

const artifactRoot = path.resolve(process.env.URLSCAN_ARTIFACT_DIR || 'storage/urlscan-artifacts');

let sharedRedis: Redis | null = null;
let sharedQueue: Queue | null = null;

function createRedisConnection(): Redis {
  if (process.env.NODE_ENV === 'test') {
    class InMemoryRedis {
      private store = new Map<string, string>();
      private ttlStore = new Map<string, number>();
      private setStore = new Map<string, Set<string>>();
      private hashStore = new Map<string, Map<string, string>>();
      private listStore = new Map<string, string[]>();

      async get(key: string): Promise<string | null> {
        return this.store.get(key) ?? null;
      }

      async set(key: string, value: string, mode?: string, ttlArg?: number, nxArg?: string): Promise<'OK' | null> {
        if (mode === 'EX') {
          const ttlSeconds = typeof ttlArg === 'number' ? ttlArg : 0;
          if (nxArg === 'NX' && this.store.has(key)) {
            return null;
          }
          this.store.set(key, value);
          if (ttlSeconds > 0) {
            this.ttlStore.set(key, ttlSeconds);
          } else {
            this.ttlStore.delete(key);
          }
          return 'OK';
        }
        this.store.set(key, value);
        this.ttlStore.delete(key);
        return 'OK';
      }

      async del(key: string): Promise<number> {
        const existed = this.store.delete(key);
        this.ttlStore.delete(key);
        this.setStore.delete(key);
        this.hashStore.delete(key);
        this.listStore.delete(key);
        return existed ? 1 : 0;
      }

      async ttl(key: string): Promise<number> {
        return this.ttlStore.get(key) ?? -1;
      }

      async expire(key: string, seconds: number): Promise<number> {
        if (seconds > 0) {
          this.ttlStore.set(key, seconds);
          return 1;
        }
        this.ttlStore.delete(key);
        return 0;
      }

      async sadd(key: string, member: string): Promise<number> {
        const set = this.setStore.get(key) ?? new Set<string>();
        set.add(member);
        this.setStore.set(key, set);
        return set.size;
      }

      async srem(key: string, member: string): Promise<number> {
        const set = this.setStore.get(key);
        if (!set) return 0;
        const existed = set.delete(member);
        if (set.size === 0) this.setStore.delete(key);
        return existed ? 1 : 0;
      }

      async scard(key: string): Promise<number> {
        return this.setStore.get(key)?.size ?? 0;
      }

      async hset(key: string, field: string, value: string): Promise<number> {
        const hash = this.hashStore.get(key) ?? new Map<string, string>();
        const existed = hash.has(field) ? 0 : 1;
        hash.set(field, value);
        this.hashStore.set(key, hash);
        return existed;
      }

      async hdel(key: string, field: string): Promise<number> {
        const hash = this.hashStore.get(key);
        if (!hash) return 0;
        const removed = hash.delete(field) ? 1 : 0;
        if (hash.size === 0) this.hashStore.delete(key);
        return removed;
      }

      async hkeys(key: string): Promise<string[]> {
        return Array.from(this.hashStore.get(key)?.keys() ?? []);
      }

      async lpush(key: string, value: string): Promise<number> {
        const list = this.listStore.get(key) ?? [];
        list.unshift(value);
        this.listStore.set(key, list);
        return list.length;
      }

      async ltrim(key: string, start: number, stop: number): Promise<void> {
        const list = this.listStore.get(key);
        if (!list) return;
        const normalizedStop = stop < 0 ? list.length + stop : stop;
        const trimmed = list.slice(start, normalizedStop + 1);
        this.listStore.set(key, trimmed);
      }

      async lrange(key: string, start: number, stop: number): Promise<string[]> {
        const list = this.listStore.get(key) ?? [];
        const normalizedStop = stop < 0 ? list.length + stop : stop;
        return list.slice(start, normalizedStop + 1);
      }

      on(): void {
        // intentionally no-op: event subscriptions are not required for in-memory Redis used in tests
        // NOSONAR
      }

      quit(): Promise<void> {
        return Promise.resolve();
      }
    }

    return new InMemoryRedis() as unknown as Redis;
  }
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

function getSharedRedis(): Redis {
  if (!sharedRedis) {
    sharedRedis = createRedisConnection();
  }
  return sharedRedis;
}

function getSharedQueue(): Queue {
  if (!sharedQueue) {
    sharedQueue = new Queue(config.queues.scanRequest, { connection: getSharedRedis() });
  }
  return sharedQueue;
}

function createAuthHook(expectedToken: string) {
  return function authHook(req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
    const hdr = req.headers['authorization'] || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : hdr;
    if (token !== expectedToken) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    done();
  };
}

export interface BuildOptions {
  dbClient?: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  redisClient?: Redis;
  queue?: Queue;
}

export async function buildServer(options: BuildOptions = {}) {
  assertEssentialConfig('control-plane');
  const requiredToken = assertControlPlaneToken();
  const dbClient = options.dbClient ?? getSharedConnection();
  const ownsClient = !options.dbClient;
  const redisClient = options.redisClient ?? getSharedRedis();
  const queue = options.queue ?? getSharedQueue();

  const app = Fastify();

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/metrics', async (_req, reply) => { reply.header('Content-Type', register.contentType); return register.metrics(); });

  app.addHook('preHandler', createAuthHook(requiredToken));

  app.get('/status', async () => {
    const { rows } = await dbClient.query('SELECT COUNT(*) AS scans, SUM(CASE WHEN verdict = ? THEN 1 ELSE 0 END) AS malicious FROM scans', ['malicious']);
    const stats = rows[0] as { scans: number | string; malicious: number | string };
    return { scans: Number(stats.scans), malicious: Number(stats.malicious || 0) };
  });

  interface OverrideBody {
    url_hash?: string;
    pattern?: string;
    status: string;
    scope?: string;
    scope_id?: string;
    reason?: string;
    expires_at?: string;
  }

  app.post('/overrides', async (req, reply) => {
    const body = req.body as OverrideBody;
    await dbClient.query(`INSERT INTO overrides (url_hash, pattern, status, scope, scope_id, created_by, reason, expires_at)
      VALUES (?,?,?,?,?,?,?,?)`, [body.url_hash || null, body.pattern || null, body.status, body.scope || 'global', body.scope_id || null, 'admin', body.reason || null, body.expires_at || null]);
    reply.code(201).send({ ok: true });
  });

  app.get('/overrides', async () => {
    const { rows } = await dbClient.query('SELECT * FROM overrides ORDER BY created_at DESC LIMIT 100');
    return rows;
  });

  app.post('/groups/:chatId/mute', async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await dbClient.query('UPDATE groups SET muted_until=? WHERE chat_id=?', [until, chatId]);
    reply.send({ ok: true, muted_until: until });
  });

  app.post('/groups/:chatId/unmute', async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    await dbClient.query('UPDATE groups SET muted_until=NULL WHERE chat_id=?', [chatId]);
    reply.send({ ok: true });
  });

  app.post('/rescan', async (req, reply) => {
    const { url } = req.body as { url?: string };
    if (!url) {
      reply.code(400).send({ error: 'url_required' });
      return;
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      reply.code(400).send({ error: 'invalid_url' });
      return;
    }
    const hash = urlHash(normalized);
    const keys = [
      `scan:${hash}`,
      `url:verdict:${hash}`,
      `url:analysis:${hash}:vt`,
      `url:analysis:${hash}:gsb`,
      `url:analysis:${hash}:whois`,
      `url:analysis:${hash}:phishtank`,
      `url:analysis:${hash}:urlhaus`,
      `url:shortener:${hash}`,
    ];
    await Promise.all(keys.map((key) => redisClient.del(key)));

    const { rows: messageRows } = await dbClient.query(
      'SELECT chat_id, message_id FROM messages WHERE url_hash=? ORDER BY posted_at DESC LIMIT 1',
      [hash]
    );
    const latestMessage = messageRows[0] as { chat_id?: string; message_id?: string } | undefined;

    const rescanJob = {
      url: normalized,
      urlHash: hash,
      rescan: true,
      priority: 1,
      ...(latestMessage?.chat_id && latestMessage?.message_id
        ? { chatId: latestMessage.chat_id, messageId: latestMessage.message_id }
        : {}),
    };

    const job = await queue.add('rescan', rescanJob, {
      removeOnComplete: true,
      removeOnFail: 100,
      priority: 1,
    });
    metrics.rescanRequests.labels('control-plane').inc();
    reply.send({ ok: true, urlHash: hash, jobId: job.id });
  });

  function isWithinArtifactRoot(resolvedPath: string): boolean {
    const relative = path.relative(artifactRoot, resolvedPath);
    if (!relative) return true;
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  app.get('/scans/:urlHash/urlscan-artifacts/:type', async (req, reply) => {
    const { urlHash: hash, type } = req.params as { urlHash: string; type: string };
    if (type !== 'screenshot' && type !== 'dom') {
      reply.code(400).send({ error: 'invalid_artifact_type' });
      return;
    }

    const column = type === 'screenshot' ? 'urlscan_screenshot_path' : 'urlscan_dom_path';
    const { rows } = await dbClient.query(
      `SELECT ${column} FROM scans WHERE url_hash=? LIMIT 1`,
      [hash]
    );
    const record = rows[0] as Record<string, string> | undefined;
    const filePath = record?.[column];
    if (!filePath) {
      reply.code(404).send({ error: `${type}_not_found` });
      return;
    }

    const resolvedPath = path.resolve(filePath);
    if (!isWithinArtifactRoot(resolvedPath)) {
      reply.code(403).send({ error: 'access_denied' });
      return;
    }

    if (type === 'screenshot') {
      try {
        await fs.access(resolvedPath);
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code === 'ENOENT') {
          reply.code(404).send({ error: 'screenshot_not_found' });
        } else {
          reply.code(500).send({ error: 'artifact_unavailable' });
        }
        return;
      }
      const stream = createReadStream(resolvedPath);
      reply.header('Content-Type', 'image/png');
      reply.send(stream);
      return;
    }

    try {
      const html = await fs.readFile(resolvedPath, 'utf8');
      reply.header('Content-Type', 'text/html; charset=utf-8');
      reply.send(html);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code === 'ENOENT') {
        reply.code(404).send({ error: 'dom_not_found' });
      } else {
        reply.code(500).send({ error: 'artifact_unavailable' });
      }
    }
  });

  if (process.env.NODE_ENV !== 'test') {
    setInterval(async () => {
      try {
        await dbClient.query("DELETE FROM scans WHERE last_seen_at < datetime('now', '-30 days')");
        await dbClient.query("DELETE FROM messages WHERE posted_at < datetime('now', '-30 days')");
      } catch (e) { logger.error(e, 'purge job failed'); }
    }, 24 * 60 * 60 * 1000);
  }

  return { app, dbClient, ownsClient };
}

async function main() {
  assertControlPlaneToken();
  const { app } = await buildServer();
  await app.listen({ host: '0.0.0.0', port: config.controlPlane.port });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => { logger.error(err, 'Fatal in control-plane'); process.exit(1); });
}
