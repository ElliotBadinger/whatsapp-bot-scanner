import Fastify from 'fastify';
import { Client, LocalAuth, Message, GroupChat } from 'whatsapp-web.js';
import QRCode from 'qrcode-terminal';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import {
  config,
  logger,
  extractUrls,
  normalizeUrl,
  urlHash,
  metrics,
  register,
  assertControlPlaneToken,
  assertEssentialConfig,
  waSessionStatusGauge,
  isForbiddenHostname,
} from '@wbscanner/shared';
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

const SAFE_CONTROL_PLANE_DEFAULT = 'http://control-plane:8080';

function sanitizeLogValue(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 256);
}

function resolveControlPlaneBase(): string {
  const candidate = (process.env.CONTROL_PLANE_BASE || SAFE_CONTROL_PLANE_DEFAULT).trim();
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return SAFE_CONTROL_PLANE_DEFAULT;
  }
}

async function isUrlAllowedForScanning(normalized: string): Promise<boolean> {
  try {
    const parsed = new URL(normalized);
    if (await isForbiddenHostname(parsed.hostname)) {
      return false;
    }
    if (parsed.port) {
      const port = Number.parseInt(parsed.port, 10);
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

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

  client.on('qr', qr => {
    if (config.wa.qrTerminal) QRCode.generate(qr, { small: true });
    metrics.waQrCodesGenerated.inc();
  });
  client.on('ready', () => {
    logger.info('WhatsApp client ready');
    waSessionStatusGauge.labels('ready').set(1);
    waSessionStatusGauge.labels('disconnected').set(0);
    metrics.waSessionReconnects.labels('ready').inc();
  });
  client.on('auth_failure', (m) => {
    logger.error({ m }, 'Auth failure');
    waSessionStatusGauge.labels('ready').set(0);
    metrics.waSessionReconnects.labels('auth_failure').inc();
  });
  client.on('disconnected', (r) => {
    logger.warn({ r }, 'Disconnected');
    waSessionStatusGauge.labels('ready').set(0);
    waSessionStatusGauge.labels('disconnected').set(1);
    metrics.waSessionReconnects.labels('disconnected').inc();
  });

  client.on('message_create', async (msg: Message) => {
    try {
      if (!msg.from) return;
      const chat = await msg.getChat();
      const chatType = (chat as GroupChat).isGroup ? 'group' : 'direct';
      metrics.waMessagesReceived.labels(chatType).inc();
      // Admin commands
      if ((msg.body || '').startsWith('!scanner')) {
        await handleAdminCommand(client, msg, chat as GroupChat);
        return;
      }
      const urls = extractUrls((msg.body || ''));
      metrics.ingestionRate.inc();
      metrics.urlsPerMessage.observe(urls.length);
      if (urls.length === 0) {
        metrics.waMessagesDropped.labels('no_url').inc();
        return;
      }
      metrics.waMessagesWithUrls.labels(chatType).inc(urls.length);
      if (!chat.isGroup) {
        metrics.waMessagesDropped.labels('non_group').inc();
        return; // Only groups per spec
      }

      for (const raw of urls) {
        const norm = normalizeUrl(raw);
        if (!norm) {
          metrics.waMessagesDropped.labels('invalid_url').inc();
          continue;
        }

        if (!(await isUrlAllowedForScanning(norm))) {
          metrics.waMessagesDropped.labels('blocked_internal_host').inc();
          logger.warn({ chatId: sanitizeLogValue(chat.id._serialized) }, 'Dropped URL due to disallowed host');
          continue;
        }

        const h = urlHash(norm);
        const idem = processedKey(chat.id._serialized, msg.id.id || msg.id._serialized, h);
        const already = await redis.set(idem, '1', 'EX', 60 * 60 * 24 * 7, 'NX');
        if (already === null) {
          metrics.waMessagesDropped.labels('duplicate').inc();
          continue; // duplicate
        }

        try {
          await globalLimiter.consume(GLOBAL_TOKEN_BUCKET_ID);
        } catch {
          metrics.waMessagesDropped.labels('rate_limited_global').inc();
          continue;
        }

        const jobOpts: JobsOptions = { removeOnComplete: true, removeOnFail: 1000, attempts: 2, backoff: { type: 'exponential', delay: 1000 } };
        await scanRequestQueue.add('scan', {
          chatId: chat.id._serialized,
          messageId: msg.id.id || msg.id._serialized,
          senderIdHash: sha256(msg.author || msg.from),
          url: norm,
          timestamp: Date.now()
        }, jobOpts);
      }
    } catch (e) {
      logger.error({ err: e, chatId: sanitizeLogValue((msg as any)?.from) }, 'Failed to process incoming WhatsApp message');
    }
  });

  // Consume verdicts
  new Worker(config.queues.scanVerdict, async (job) => {
    const queueName = config.queues.scanVerdict;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const { chatId, messageId, verdict, reasons, url, urlHash, decidedAt } = job.data as {
      chatId: string;
      messageId: string;
      verdict: string;
      reasons: string[];
      url: string;
      urlHash: string;
      decidedAt?: number;
    };
    try {
      const chat = await client.getChatById(chatId);
      const delay = Math.floor(800 + Math.random() * 1200);
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          let delivered = false;
          try {
            try {
              await groupLimiter.consume(chatId);
              await groupHourlyLimiter.consume(chatId);
            } catch {
              metrics.waMessagesDropped.labels('verdict_rate_limited').inc();
              return;
            }
            const key = `verdict:${chatId}:${urlHash}`;
            const nx = await redis.set(key, '1', 'EX', 3600, 'NX');
            if (nx === null) {
              metrics.waMessagesDropped.labels('verdict_duplicate').inc();
              return;
            }
            const text = formatGroupVerdict(verdict, reasons, url);
            try {
              await chat.sendMessage(text, { quotedMessageId: messageId });
              delivered = true;
            } catch (err) {
              metrics.waVerdictFailures.inc();
              logger.warn({ err }, 'Failed to send verdict message');
            }
          } finally {
            if (delivered) {
              metrics.waVerdictsSent.inc();
            }
            const verdictLatencySeconds = Math.max(0, (Date.now() - (decidedAt ?? started)) / 1000);
            metrics.waVerdictLatency.observe(verdictLatencySeconds);
            const processingSeconds = (Date.now() - started) / 1000;
            metrics.queueProcessingDuration.labels(queueName).observe(processingSeconds);
            metrics.queueCompleted.labels(queueName).inc();
            if (job.attemptsMade > 0) {
              metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
            }
            resolve();
          }
        }, delay);
      });
    } catch (err) {
      metrics.queueFailures.labels(queueName).inc();
      metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
      throw err;
    }
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

export async function handleAdminCommand(client: Client, msg: Message, existingChat?: GroupChat) {
  const chat = existingChat ?? (await msg.getChat());
  if (!(chat as GroupChat).isGroup) return;
  const gc = chat as GroupChat;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participants = (gc as any).participants as Array<{ id: { _serialized: string }, isAdmin: boolean, isSuperAdmin: boolean }> || [];
  const sender = participants.find((p) => p.id._serialized === (msg.author || msg.from));
  if (!sender?.isAdmin && !sender?.isSuperAdmin) return;

  const parts = (msg.body || '').trim().split(/\s+/);
  const cmd = parts[1];
  if (!cmd) return;
  const base = resolveControlPlaneBase();
  const token = assertControlPlaneToken();
  const csrfToken = config.controlPlane.csrfToken;
  const authHeaders = {
    authorization: `Bearer ${token}`,
    'x-csrf-token': csrfToken,
  } as const;

  if (cmd === 'mute') {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chat.id._serialized)}/mute`, { method: 'POST', headers: authHeaders }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner muted for 60 minutes.' : 'Mute failed.');
  } else if (cmd === 'unmute') {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chat.id._serialized)}/unmute`, { method: 'POST', headers: authHeaders }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner unmuted.' : 'Unmute failed.');
  } else if (cmd === 'status') {
    const resp = await fetch(`${base}/status`, { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
    const json = resp && resp.ok ? await resp.json() : {};
    await chat.sendMessage(`Scanner status: scans=${json.scans||0}, malicious=${json.malicious||0}`);
  } else if (cmd === 'rescan' && parts[2]) {
    const rescanUrl = parts[2];
    const resp = await fetch(`${base}/rescan`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    if (resp && resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data?.ok && data.urlHash && data.jobId) {
        await chat.sendMessage(`Rescan queued. hash=${data.urlHash} job=${data.jobId}`);
      } else {
        await chat.sendMessage('Rescan queued, awaiting confirmation.');
      }
    } else {
      await chat.sendMessage('Rescan failed.');
    }
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status|rescan <url>');
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error({ err }, 'Fatal in wa-client');
    process.exit(1);
  });
}
