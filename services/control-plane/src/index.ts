import Fastify from 'fastify';
import { register, metrics, config, logger } from '@wbscanner/shared';
import Redis from 'ioredis';
import { Client as PgClient } from 'pg';

const redis = new Redis(config.redisUrl);
const pg = new PgClient({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.db,
  user: config.postgres.user,
  password: config.postgres.password
});

function authHook(req: any, reply: any, done: any) {
  const hdr = req.headers['authorization'] || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : hdr;
  if (token !== config.controlPlane.token) {
    reply.code(401).send({ error: 'unauthorized' });
    return;
  }
  done();
}

async function main() {
  await pg.connect();
  const app = Fastify();

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/metrics', async (_req, reply) => { reply.header('Content-Type', register.contentType); return register.metrics(); });

  app.addHook('preHandler', authHook);

  app.get('/status', async () => {
    const { rows } = await pg.query('SELECT COUNT(*) AS scans, SUM((verdict = $1)::int) AS malicious FROM scans', ['malicious']);
    return { scans: Number(rows[0].scans), malicious: Number(rows[0].malicious || 0) };
  });

  app.post('/overrides', async (req, reply) => {
    const body = req.body as any;
    await pg.query(`INSERT INTO overrides (url_hash, pattern, status, scope, scope_id, created_by, reason, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [body.url_hash || null, body.pattern || null, body.status, body.scope || 'global', body.scope_id || null, 'admin', body.reason || null, body.expires_at || null]);
    reply.code(201).send({ ok: true });
  });

  app.get('/overrides', async () => {
    const { rows } = await pg.query('SELECT * FROM overrides ORDER BY created_at DESC LIMIT 100');
    return rows;
  });

  app.post('/groups/:chatId/mute', async (req, reply) => {
    const { chatId } = req.params as any;
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await pg.query('UPDATE groups SET muted_until=$1 WHERE chat_id=$2', [until, chatId]);
    reply.send({ ok: true, muted_until: until });
  });

  app.post('/groups/:chatId/unmute', async (req, reply) => {
    const { chatId } = req.params as any;
    await pg.query('UPDATE groups SET muted_until=NULL WHERE chat_id=$1', [chatId]);
    reply.send({ ok: true });
  });

  app.post('/rescan', async (req, reply) => {
    reply.send({ ok: true }); // placeholder – orchestration via Redis could be added
  });

  await app.listen({ host: '0.0.0.0', port: config.controlPlane.port });

  // Retention purge (30 days default)
  const retentionDays = 30;
  setInterval(async () => {
    try {
      await pg.query("DELETE FROM scans WHERE last_seen_at < now() - interval '30 days'");
      await pg.query("DELETE FROM messages WHERE posted_at < now() - interval '30 days'");
    } catch (e) { logger.error(e, 'purge job failed'); }
  }, 24 * 60 * 60 * 1000);
}

main().catch(err => { logger.error(err, 'Fatal in control-plane'); process.exit(1); });
