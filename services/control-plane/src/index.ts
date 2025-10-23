import Fastify from 'fastify';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { register, metrics, config, logger, assertControlPlaneToken, normalizeUrl, urlHash, assertEssentialConfig, isForbiddenHostname } from '@wbscanner/shared';
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

function normalizeOriginHeader(value: unknown): string | null {
  const header = Array.isArray(value) ? value[0] : value;
  if (typeof header !== 'string' || !header.trim()) {
    return null;
  }
  try {
    const parsed = new URL(header);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function createCsrfHook(expectedToken: string, allowedOrigins: Set<string>) {
  return function csrfHook(req: any, reply: any, done: any) {
    if (['GET', 'HEAD', 'OPTIONS'].includes((req.method || '').toUpperCase())) {
      done();
      return;
    }

    const tokenHeader = req.headers['x-csrf-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (typeof token !== 'string' || token !== expectedToken) {
      reply.code(403).send({ error: 'csrf_invalid' });
      return;
    }

    const origin = normalizeOriginHeader(req.headers['origin']);
    const referer = normalizeOriginHeader(req.headers['referer']);
    const originsToValidate = [origin, referer].filter((value): value is string => Boolean(value));
    const hasAllowedOrigins = originsToValidate.every((value) => {
      if (allowedOrigins.size === 0) {
        return true;
      }
      return allowedOrigins.has(value);
    });

    if (!hasAllowedOrigins) {
      reply.code(403).send({ error: 'origin_not_allowed' });
      return;
    }

    done();
  };
}

function createSecurityHeadersHook() {
  return function securityHeaders(_req: any, reply: any, payload: unknown, done: any) {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    done(null, payload);
  };
}

const chatIdSchema = z.string().regex(/^[A-Za-z0-9@._:\-]{3,256}$/);
const rescanSchema = z.object({ url: z.string().trim().min(1) });
const overrideSchema = z.object({
  url_hash: z.string().regex(/^[0-9a-f]{64}$/).optional().nullable(),
  pattern: z.string().max(255).optional().nullable(),
  status: z.string().trim().min(1).max(32),
  scope: z.string().trim().min(1).max(32).optional().default('global'),
  scope_id: z.string().trim().max(255).optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
  expires_at: z.string().trim().max(64).optional().nullable(),
});
const artifactParamsSchema = z.object({
  urlHash: z.string().regex(/^[0-9a-f]{64}$/),
  type: z.enum(['screenshot', 'dom']),
});
export interface BuildOptions {
  pgClient?: PgClient;
  redisClient?: Redis;
  queue?: Queue;
}

export async function buildServer(options: BuildOptions = {}) {
  assertEssentialConfig('control-plane');
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

  const csrfToken = config.controlPlane.csrfToken;
  const allowedOrigins = new Set(config.controlPlane.allowedOrigins);

  app.addHook('onSend', createSecurityHeadersHook());

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/metrics', async (_req, reply) => { reply.header('Content-Type', register.contentType); return register.metrics(); });

  app.addHook('preHandler', createAuthHook(requiredToken));
  app.addHook('preHandler', createCsrfHook(csrfToken, allowedOrigins));

  app.get('/status', async () => {
    const { rows } = await pgClient.query('SELECT COUNT(*) AS scans, SUM((verdict = $1)::int) AS malicious FROM scans', ['malicious']);
    return { scans: Number(rows[0].scans), malicious: Number(rows[0].malicious || 0) };
  });

  app.post('/overrides', async (req, reply) => {
    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid_payload' });
      return;
    }

    const body = parsed.data;
    const normalized = {
      url_hash: body.url_hash ?? null,
      pattern: body.pattern?.trim() ? body.pattern.trim() : null,
      status: body.status.trim(),
      scope: body.scope?.trim() || 'global',
      scope_id: body.scope_id?.trim() ? body.scope_id.trim() : null,
      reason: body.reason?.trim() ? body.reason.trim() : null,
      expires_at: body.expires_at?.trim() ? body.expires_at.trim() : null,
    } as const;

    await pgClient.query(
      `INSERT INTO overrides (url_hash, pattern, status, scope, scope_id, created_by, reason, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [normalized.url_hash, normalized.pattern, normalized.status, normalized.scope, normalized.scope_id, 'admin', normalized.reason, normalized.expires_at]
    );
    reply.code(201).send({ ok: true });
  });

  app.get('/overrides', async () => {
    const { rows } = await pgClient.query('SELECT * FROM overrides ORDER BY created_at DESC LIMIT 100');
    return rows;
  });

  app.post('/groups/:chatId/mute', async (req, reply) => {
    const chatIdResult = chatIdSchema.safeParse((req.params as any).chatId);
    if (!chatIdResult.success) {
      reply.code(400).send({ error: 'invalid_chat_id' });
      return;
    }
    const chatId = chatIdResult.data;
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await pgClient.query('UPDATE groups SET muted_until=$1 WHERE chat_id=$2', [until, chatId]);
    reply.send({ ok: true, muted_until: until });
  });

  app.post('/groups/:chatId/unmute', async (req, reply) => {
    const chatIdResult = chatIdSchema.safeParse((req.params as any).chatId);
    if (!chatIdResult.success) {
      reply.code(400).send({ error: 'invalid_chat_id' });
      return;
    }
    const chatId = chatIdResult.data;
    await pgClient.query('UPDATE groups SET muted_until=NULL WHERE chat_id=$1', [chatId]);
    reply.send({ ok: true });
  });

  app.post('/rescan', async (req, reply) => {
    const parsed = rescanSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid_payload' });
      return;
    }
    const normalized = normalizeUrl(parsed.data.url);
    if (!normalized) {
      reply.code(400).send({ error: 'invalid_url' });
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalized);
    } catch {
      reply.code(400).send({ error: 'invalid_url' });
      return;
    }
    if (await isForbiddenHostname(parsedUrl.hostname)) {
      reply.code(400).send({ error: 'disallowed_host' });
      return;
    }
    if (parsedUrl.port) {
      const port = Number.parseInt(parsedUrl.port, 10);
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        reply.code(400).send({ error: 'invalid_port' });
        return;
      }
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
    const job = await queue.add(
      'rescan',
      { url: normalized, urlHash: hash },
      { removeOnComplete: true, removeOnFail: 100, priority: 1 }
    );
    metrics.rescanRequests.labels('control-plane').inc();
    reply.send({ ok: true, urlHash: hash, jobId: job.id });
  });

  function isWithinArtifactRoot(resolvedPath: string): boolean {
    const relative = path.relative(artifactRoot, resolvedPath);
    if (!relative) return true;
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  app.get('/scans/:urlHash/urlscan-artifacts/:type', async (req, reply) => {
    const paramsResult = artifactParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      reply.code(400).send({ error: 'invalid_request' });
      return;
    }
    const { urlHash: hash, type } = paramsResult.data;

    const column = type === 'screenshot' ? 'urlscan_screenshot_path' : 'urlscan_dom_path';
    const { rows } = await pgClient.query(
      `SELECT ${column} FROM scans WHERE url_hash=$1 LIMIT 1`,
      [hash]
    );
    const filePath = rows[0]?.[column as 'urlscan_screenshot_path' | 'urlscan_dom_path'];
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
      } catch (error: any) {
        if (error?.code === 'ENOENT') {
          reply.code(404).send({ error: 'screenshot_not_found' });
        } else {
          reply.code(500).send({ error: 'artifact_unavailable' });
        }
        return;
      }
      const stream = createReadStream(resolvedPath);
      reply.header('Content-Disposition', `attachment; filename="screenshot-${hash.slice(0, 16)}.png"`);
      reply.header('Content-Type', 'image/png');
      reply.send(stream);
      return;
    }

    try {
      const html = await fs.readFile(resolvedPath, 'utf8');
      reply.header('Content-Type', 'text/html; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="dom-${hash.slice(0, 16)}.html"`);
      reply.header('Content-Security-Policy', "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; sandbox");
      reply.send(html);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        reply.code(404).send({ error: 'dom_not_found' });
      } else {
        reply.code(500).send({ error: 'artifact_unavailable' });
      }
    }
  });

  if (process.env.NODE_ENV !== 'test') {
    setInterval(async () => {
      try {
        await pgClient.query("DELETE FROM scans WHERE last_seen_at < now() - interval '30 days'");
        await pgClient.query("DELETE FROM messages WHERE posted_at < now() - interval '30 days'");
      } catch (e) {
        logger.error({ err: e }, 'purge job failed');
      }
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
  main().catch(err => {
    logger.error({ err }, 'Fatal in control-plane');
    process.exit(1);
  });
}
