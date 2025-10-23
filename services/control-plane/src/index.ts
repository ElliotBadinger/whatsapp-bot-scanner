import Fastify from 'fastify';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { register, metrics, config, logger, assertControlPlaneToken, normalizeUrl, urlHash } from '@wbscanner/shared';
import { Client as PgClient } from 'pg';

const artifactRoot = path.resolve(process.env.URLSCAN_ARTIFACT_DIR || 'storage/urlscan-artifacts');
const redis = new Redis(config.redisUrl);
const rescanQueue = new Queue(config.queues.scanRequest, { connection: redis });

function createAuthHook(expectedToken: string) {
  return function authHook(req: any, reply: any, done: any) {
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
  pgClient?: PgClient;
  redisClient?: Redis;
  queue?: Queue;
}

export async function buildServer(options: BuildOptions = {}) {
  const requiredToken = assertControlPlaneToken();
  const pgClient = options.pgClient ?? new PgClient({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.db,
    user: config.postgres.user,
    password: config.postgres.password
  });
  const ownsClient = !options.pgClient;
  if (ownsClient) await pgClient.connect();
  const redisClient = options.redisClient ?? redis;
  const queue = options.queue ?? rescanQueue;

  const app = Fastify();

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/metrics', async (_req, reply) => { reply.header('Content-Type', register.contentType); return register.metrics(); });

  app.addHook('preHandler', createAuthHook(requiredToken));

  app.get('/status', async () => {
    const { rows } = await pgClient.query('SELECT COUNT(*) AS scans, SUM((verdict = $1)::int) AS malicious FROM scans', ['malicious']);
    return { scans: Number(rows[0].scans), malicious: Number(rows[0].malicious || 0) };
  });

  app.post('/overrides', async (req, reply) => {
    const body = req.body as any;
    await pgClient.query(`INSERT INTO overrides (url_hash, pattern, status, scope, scope_id, created_by, reason, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [body.url_hash || null, body.pattern || null, body.status, body.scope || 'global', body.scope_id || null, 'admin', body.reason || null, body.expires_at || null]);
    reply.code(201).send({ ok: true });
  });

  app.get('/overrides', async () => {
    const { rows } = await pgClient.query('SELECT * FROM overrides ORDER BY created_at DESC LIMIT 100');
    return rows;
  });

  app.post('/groups/:chatId/mute', async (req, reply) => {
    const { chatId } = req.params as any;
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await pgClient.query('UPDATE groups SET muted_until=$1 WHERE chat_id=$2', [until, chatId]);
    reply.send({ ok: true, muted_until: until });
  });

  app.post('/groups/:chatId/unmute', async (req, reply) => {
    const { chatId } = req.params as any;
    await pgClient.query('UPDATE groups SET muted_until=NULL WHERE chat_id=$1', [chatId]);
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
    await queue.add('rescan', { url: normalized, urlHash: hash, priority: 10 }, { removeOnComplete: true, removeOnFail: 100 });
    metrics.rescanRequests.labels('control-plane').inc();
    reply.send({ ok: true, message: 'Cache invalidated, rescan queued', urlHash: hash });
  });

  app.get('/scans/:urlHash/urlscan-artifacts/:artifactType', async (req, reply) => {
    const { artifactType } = req.params as { artifactType: string };
    if (artifactType === 'screenshot') {
      reply.redirect(307, `/artifacts/${(req.params as { urlHash: string }).urlHash}/screenshot`);
      return;
    }
    if (artifactType === 'dom') {
      reply.redirect(307, `/artifacts/${(req.params as { urlHash: string }).urlHash}/dom`);
      return;
    }
    reply.code(400).send({ error: 'unsupported_artifact_type' });
  });

  app.get('/artifacts/:urlHash/screenshot', async (req, reply) => {
    const { urlHash: hash } = req.params as { urlHash: string };
    const { rows } = await pgClient.query(
      'SELECT urlscan_screenshot_path FROM scans WHERE url_hash=$1 LIMIT 1',
      [hash]
    );
    const filePath = rows[0]?.urlscan_screenshot_path;
    if (!filePath) {
      reply.code(404).send({ error: 'screenshot_not_found' });
      return;
    }
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(artifactRoot)) {
      reply.code(403).send({ error: 'access_denied' });
      return;
    }
    try {
      await fs.access(resolvedPath);
    } catch {
      reply.code(404).send({ error: 'screenshot_not_found' });
      return;
    }
    const stream = createReadStream(resolvedPath);
    reply.header('Content-Type', 'image/png');
    reply.send(stream);
  });

  app.get('/artifacts/:urlHash/dom', async (req, reply) => {
    const { urlHash: hash } = req.params as { urlHash: string };
    const { rows } = await pgClient.query(
      'SELECT urlscan_dom_path FROM scans WHERE url_hash=$1 LIMIT 1',
      [hash]
    );
    const filePath = rows[0]?.urlscan_dom_path;
    if (!filePath) {
      reply.code(404).send({ error: 'dom_not_found' });
      return;
    }
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(artifactRoot)) {
      reply.code(403).send({ error: 'access_denied' });
      return;
    }
    try {
      const html = await fs.readFile(resolvedPath, 'utf8');
      reply.type('text/html').send(html);
    } catch {
      reply.code(500).send({ error: 'artifact_unavailable' });
    }
  });

  if (process.env.NODE_ENV !== 'test') {
    setInterval(async () => {
      try {
        await pgClient.query("DELETE FROM scans WHERE last_seen_at < now() - interval '30 days'");
        await pgClient.query("DELETE FROM messages WHERE posted_at < now() - interval '30 days'");
      } catch (e) { logger.error(e, 'purge job failed'); }
    }, 24 * 60 * 60 * 1000);
  }

  return { app, pgClient, ownsClient };
}

async function main() {
  assertControlPlaneToken();
  const { app } = await buildServer();
  await app.listen({ host: '0.0.0.0', port: config.controlPlane.port });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => { logger.error(err, 'Fatal in control-plane'); process.exit(1); });
}
