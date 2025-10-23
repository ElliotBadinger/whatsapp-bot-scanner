import Fastify from 'fastify';
import { Client, LocalAuth, Message, GroupChat } from 'whatsapp-web.js';
import QRCode from 'qrcode-terminal';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { config, logger, extractUrls, normalizeUrl, urlHash, metrics, register, assertControlPlaneToken, assertEssentialConfig } from '@wbscanner/shared';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createGlobalTokenBucket, GLOBAL_TOKEN_BUCKET_ID } from './limiters';

const redis = new Redis(config.redisUrl);
const scanRequestQueue = new Queue(config.queues.scanRequest, { connection: redis });

const globalLimiter = createGlobalTokenBucket(redis, config.wa.globalRatePerHour, config.wa.globalTokenBucketKey);
const groupLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_cooldown',
  points: 1,
  duration: config.wa.perGroupCooldownSeconds
});
const groupHourlyLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_hour',
  points: config.wa.perGroupHourlyLimit,
  duration: 3600,
});

const processedKey = (chatId: string, messageId: string, urlH: string) => `processed:${chatId}:${messageId}:${urlH}`;

async function main() {
  assertEssentialConfig('wa-client');
  assertControlPlaneToken();
  const app = Fastify();
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  const client = new Client({
    puppeteer: { headless: config.wa.headless },
    authStrategy: new LocalAuth({ dataPath: './data/session' })
  });

  client.on('qr', qr => { if (config.wa.qrTerminal) QRCode.generate(qr, { small: true }); });
  client.on('ready', () => logger.info('WhatsApp client ready'));
  client.on('auth_failure', (m) => logger.error({ m }, 'Auth failure'));
  client.on('disconnected', (r) => logger.warn({ r }, 'Disconnected'));

  client.on('message_create', async (msg: Message) => {
    try {
      if (!msg.from) return;
      // Admin commands
      if ((msg.body || '').startsWith('!scanner')) {
        await handleAdminCommand(client, msg);
        return;
      }
      const urls = extractUrls((msg.body || ''));
      metrics.ingestionRate.inc();
      metrics.urlsPerMessage.observe(urls.length);
      if (urls.length === 0) return;
      const chat = await msg.getChat();
      if (!chat.isGroup) return; // Only groups per spec

      for (const raw of urls) {
        const norm = normalizeUrl(raw);
        if (!norm) continue;
        const h = urlHash(norm);
        const idem = processedKey(chat.id._serialized, msg.id.id || msg.id._serialized, h);
        const already = await redis.set(idem, '1', 'EX', 60 * 60 * 24 * 7, 'NX');
        if (already === null) continue; // duplicate

        try { await globalLimiter.consume(GLOBAL_TOKEN_BUCKET_ID); } catch { continue; }

        const jobOpts: JobsOptions = { removeOnComplete: true, removeOnFail: 1000, attempts: 2, backoff: { type: 'exponential', delay: 1000 } };
        await scanRequestQueue.add('scan', {
          chatId: chat.id._serialized,
          messageId: msg.id.id || msg.id._serialized,
          senderIdHash: sha256(msg.author || msg.from),
          url: norm,
          timestamp: Date.now()
        }, jobOpts);
      }
    } catch (e) { logger.error(e); }
  });

  // Consume verdicts
  new Worker(config.queues.scanVerdict, async (job) => {
    const { chatId, messageId, verdict, reasons, url, urlHash } = job.data;
    const chat = await client.getChatById(chatId);
    const delay = Math.floor(800 + Math.random() * 1200);
    setTimeout(async () => {
      // Per-group cooldown and duplicate suppression
      try {
        await groupLimiter.consume(chatId);
        await groupHourlyLimiter.consume(chatId);
      } catch {
        return;
      }
      const key = `verdict:${chatId}:${urlHash}`;
      const nx = await redis.set(key, '1', 'EX', 3600, 'NX');
      if (nx === null) return;
      const msg = formatGroupVerdict(verdict, reasons, url);
      await chat.sendMessage(msg, { quotedMessageId: messageId }).catch(() => undefined);
    }, delay);
  }, { connection: redis });

  await client.initialize();
  await app.listen({ host: '0.0.0.0', port: 3000 });
}

function sha256(s: string) { return createHash('sha256').update(s).digest('hex'); }

function redactDomain(u: string) {
  try { const url = new URL(u); return url.hostname.replace(/\./g, '[.]'); } catch { return u; }
}

export function formatGroupVerdict(verdict: string, reasons: string[], url: string) {
  const level = verdict.toUpperCase();
  const domain = redactDomain(url);
  let advice = 'Use caution.';
  if (verdict === 'malicious') advice = 'Do NOT open.';
  if (verdict === 'benign') advice = 'Looks okay, stay vigilant.';
  const reasonsStr = reasons.slice(0,3).join('; ');
  return `Link scan: ${level}\nDomain: ${domain}\n${advice}${reasonsStr ? `\nWhy: ${reasonsStr}` : ''}`;
}

export async function handleAdminCommand(client: Client, msg: Message) {
  const chat = await msg.getChat();
  if (!(chat as GroupChat).isGroup) return;
  const gc = chat as GroupChat;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participants = (gc as any).participants as Array<{ id: { _serialized: string }, isAdmin: boolean, isSuperAdmin: boolean }> || [];
  const sender = participants.find((p) => p.id._serialized === (msg.author || msg.from));
  if (!sender?.isAdmin && !sender?.isSuperAdmin) return;

  const parts = (msg.body || '').trim().split(/\s+/);
  const cmd = parts[1];
  if (!cmd) return;
  const base = process.env.CONTROL_PLANE_BASE || 'http://control-plane:8080';
  const token = assertControlPlaneToken();

  if (cmd === 'mute') {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chat.id._serialized)}/mute`, { method: 'POST', headers: { 'authorization': `Bearer ${token}` } }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner muted for 60 minutes.' : 'Mute failed.');
  } else if (cmd === 'unmute') {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chat.id._serialized)}/unmute`, { method: 'POST', headers: { 'authorization': `Bearer ${token}` } }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner unmuted.' : 'Unmute failed.');
  } else if (cmd === 'status') {
    const resp = await fetch(`${base}/status`, { headers: { 'authorization': `Bearer ${token}` } }).catch(() => null);
    const json = resp && resp.ok ? await resp.json() : {};
    await chat.sendMessage(`Scanner status: scans=${json.scans||0}, malicious=${json.malicious||0}`);
  } else if (cmd === 'rescan' && parts[2]) {
    const rescanUrl = parts[2];
    const resp = await fetch(`${base}/rescan`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
