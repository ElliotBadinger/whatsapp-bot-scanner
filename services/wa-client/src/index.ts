import Fastify from 'fastify';
import { Client, LocalAuth, Message, GroupChat, GroupNotification, MessageMedia, Reaction, MessageAck, Call, Contact } from 'whatsapp-web.js';
import QRCode from 'qrcode-terminal';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import path from 'node:path';
import { readFileSync } from 'node:fs';
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
import { MessageStore, VerdictContext, VerdictAttemptPayload } from './message-store';
import { GroupStore } from './group-store';

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
const governanceLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_governance',
  points: Math.max(1, config.wa.governanceInterventionsPerHour),
  duration: 3600,
});
const membershipGroupLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_membership_auto',
  points: Math.max(1, config.wa.membershipAutoApprovePerHour),
  duration: 3600,
});
const membershipGlobalLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'membership_global',
  points: Math.max(1, config.wa.membershipGlobalHourlyLimit),
  duration: 3600,
});
const messageStore = new MessageStore(redis, config.wa.messageLineageTtlSeconds);
const groupStore = new GroupStore(redis, config.wa.messageLineageTtlSeconds);

const processedKey = (chatId: string, messageId: string, urlH: string) => `processed:${chatId}:${messageId}:${urlH}`;

const consentStatusKey = (chatId: string) => `wa:consent:status:${chatId}`;
const consentPendingSetKey = 'wa:consent:pending';
const membershipPendingKey = (chatId: string) => `wa:membership:pending:${chatId}`;
const VERDICT_ACK_TARGET = 2;

const ackWatchers = new Map<string, NodeJS.Timeout>();
let currentWaState: string | null = null;
let botWid: string | null = null;

function contextKey(context: VerdictContext): string {
  return `${context.chatId}:${context.messageId}:${context.urlHash}`;
}

function loadConsentTemplate(): string {
  const candidates = [
    path.resolve(process.cwd(), 'docs/CONSENT.md'),
    path.resolve(__dirname, '../../docs/CONSENT.md'),
    path.resolve(__dirname, '../../../docs/CONSENT.md'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, 'utf8');
      if (raw.trim().length > 0) {
        return raw.trim();
      }
    } catch {
      // ignore missing file candidates
    }
  }
  return [
    'Hello! This group uses automated link scanning for safety.',
    'Links shared here are checked against security sources and verdicts are posted in reply.',
    'We store only normalized links, chat ID, message ID, and a hashed sender identifier for 30 days.',
    'Admins can opt out at any time with !scanner mute.',
    'By continuing to use this group you consent to automated link scanning. Thank you!'
  ].join('\n');
}

const consentTemplate = loadConsentTemplate();

async function refreshConsentGauge(): Promise<void> {
  try {
    const pending = await redis.scard(consentPendingSetKey);
    metrics.waConsentGauge.set(pending);
  } catch (err) {
    logger.warn({ err }, 'Failed to refresh consent gauge');
  }
}

async function markConsentPending(chatId: string): Promise<void> {
  await redis.set(consentStatusKey(chatId), 'pending', 'EX', config.wa.messageLineageTtlSeconds);
  await redis.sadd(consentPendingSetKey, chatId);
  metrics.waGovernanceActions.labels('consent_pending').inc();
  await refreshConsentGauge();
}

async function markConsentGranted(chatId: string): Promise<void> {
  await redis.set(consentStatusKey(chatId), 'granted', 'EX', config.wa.messageLineageTtlSeconds);
  await redis.srem(consentPendingSetKey, chatId);
  metrics.waGovernanceActions.labels('consent_granted').inc();
  await refreshConsentGauge();
}

async function clearConsentState(chatId: string): Promise<void> {
  await redis.del(consentStatusKey(chatId));
  await redis.srem(consentPendingSetKey, chatId);
  await refreshConsentGauge();
}

async function getConsentStatus(chatId: string): Promise<'pending' | 'granted' | null> {
  const status = await redis.get(consentStatusKey(chatId));
  if (status === 'pending' || status === 'granted') {
    return status;
  }
  return null;
}

async function addPendingMembership(chatId: string, requesterId: string, timestamp: number): Promise<void> {
  await redis.hset(membershipPendingKey(chatId), requesterId, String(timestamp));
}

async function removePendingMembership(chatId: string, requesterId: string): Promise<void> {
  await redis.hdel(membershipPendingKey(chatId), requesterId);
}

async function listPendingMemberships(chatId: string): Promise<string[]> {
  const entries = await redis.hkeys(membershipPendingKey(chatId));
  return entries;
}

interface VerdictJobData {
  chatId: string;
  messageId: string;
  verdict: string;
  reasons: string[];
  url: string;
  urlHash: string;
  decidedAt?: number;
  redirectChain?: string[];
  shortener?: { provider: string; chain: string[] } | null;
}

async function collectVerdictMedia(job: VerdictJobData): Promise<Array<{ media: MessageMedia; type: 'screenshot' | 'ioc' }>> {
  if (!config.features.attachMediaToVerdicts) {
    return [];
  }
  const attachments: Array<{ media: MessageMedia; type: 'screenshot' | 'ioc' }> = [];
  const base = resolveControlPlaneBase();
  const token = assertControlPlaneToken();

  try {
    const resp = await fetch(`${base}/scans/${job.urlHash}/urlscan-artifacts/screenshot`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (buffer.length > 0) {
        const media = new MessageMedia('image/png', buffer.toString('base64'), `screenshot-${job.urlHash.slice(0, 8)}.png`);
        attachments.push({ media, type: 'screenshot' });
      }
    }
  } catch (err) {
    logger.warn({ err, urlHash: job.urlHash }, 'Failed to fetch screenshot attachment');
  }

  const lines: string[] = [];
  lines.push(`URL: ${job.url}`);
  lines.push(`Verdict: ${job.verdict}`);
  if (job.reasons.length > 0) {
    lines.push('Reasons:');
    for (const reason of job.reasons) {
      lines.push(`- ${reason}`);
    }
  }
  if (job.redirectChain && job.redirectChain.length > 0) {
    lines.push('Redirect chain:');
    for (const hop of job.redirectChain) {
      lines.push(`- ${hop}`);
    }
  }
  if (job.shortener?.chain && job.shortener.chain.length > 0) {
    lines.push(`Shortener expansion (${job.shortener.provider ?? 'unknown'}):`);
    for (const hop of job.shortener.chain) {
      lines.push(`- ${hop}`);
    }
  }

  const textPayload = lines.join('\n');
  if (textPayload.trim().length > 0) {
    const data = Buffer.from(textPayload, 'utf8').toString('base64');
    const media = new MessageMedia('text/plain', data, `scan-${job.urlHash.slice(0, 8)}.txt`);
    attachments.push({ media, type: 'ioc' });
  }

  return attachments;
}

async function deliverVerdictMessage(
  client: Client,
  job: VerdictJobData,
  context: VerdictContext,
  isRetry = false
): Promise<boolean> {
  let targetMessage: Message | null = null;
  try {
    targetMessage = await client.getMessageById(job.messageId);
  } catch (err) {
    logger.warn({ err, messageId: job.messageId }, 'Failed to hydrate original message by id');
  }

  let chat: GroupChat | null = null;
  try {
    if (targetMessage) {
      chat = await targetMessage.getChat() as GroupChat;
    } else {
      chat = await client.getChatById(job.chatId) as GroupChat;
    }
  } catch (err) {
    logger.warn({ err, chatId: job.chatId }, 'Unable to load chat for verdict delivery');
    return false;
  }

  const verdictText = formatGroupVerdict(job.verdict, job.reasons, job.url);
  let reply: Message | null = null;
  try {
    if (targetMessage) {
      reply = await targetMessage.reply(verdictText);
    } else {
      try {
        reply = await chat.sendMessage(verdictText, { quotedMessageId: job.messageId });
      } catch (err) {
        logger.warn({ err, chatId: job.chatId, messageId: job.messageId }, 'Failed to quote verdict message, retrying without quote');
        reply = await chat.sendMessage(verdictText);
      }
    }
  } catch (err) {
    metrics.waVerdictFailures.inc();
    logger.warn({ err, chatId: job.chatId, messageId: job.messageId }, 'Failed to send verdict message');
    await messageStore.markVerdictStatus(context, 'failed');
    return false;
  }

  const ack = typeof reply?.ack === 'number' ? reply?.ack : null;
  const attachments = await collectVerdictMedia(job);
  const attachmentMeta = attachments.length > 0 ? {
    screenshot: attachments.some((item) => item.type === 'screenshot'),
    ioc: attachments.some((item) => item.type === 'ioc'),
  } : undefined;

  await messageStore.registerVerdictAttempt({
    chatId: job.chatId,
    messageId: job.messageId,
    url: job.url,
    urlHash: job.urlHash,
    verdict: job.verdict,
    reasons: job.reasons,
    decidedAt: job.decidedAt,
    verdictMessageId: reply?.id?._serialized || reply?.id?.id,
    ack,
    attachments: attachmentMeta,
    redirectChain: job.redirectChain,
    shortener: job.shortener ?? null,
  });

  if (job.verdict === 'malicious' && targetMessage) {
    targetMessage.react('⚠️').catch((err) => {
      logger.warn({ err }, 'Failed to add reaction to malicious message');
    });
  }

  for (const attachment of attachments) {
    try {
      if (targetMessage) {
        await targetMessage.reply(attachment.media, undefined, {
          sendMediaAsDocument: attachment.type === 'ioc',
        });
      } else {
        await chat.sendMessage(attachment.media, {
          sendMediaAsDocument: attachment.type === 'ioc',
        });
      }
      metrics.waVerdictAttachmentsSent.labels(attachment.type).inc();
    } catch (err) {
      logger.warn({ err, type: attachment.type }, 'Failed to send verdict attachment');
    }
  }

  metrics.waVerdictsSent.inc();

  if (reply?.id?._serialized) {
    const retryFn = async () => { await deliverVerdictMessage(client, job, context, true); };
    await scheduleAckWatch(context, retryFn);
  }

  if (isRetry) {
    logger.info({ job, verdictMessageId: reply?.id?._serialized }, 'Retried verdict delivery');
  }
  return true;
}

async function clearAckWatchForContext(context: VerdictContext): Promise<void> {
  const key = contextKey(context);
  const existing = ackWatchers.get(key);
  if (existing) {
    clearTimeout(existing);
    ackWatchers.delete(key);
  }
  try {
    await messageStore.removePendingAckContext(context);
  } catch (err) {
    logger.warn({ err, context }, 'Failed to clear ack context from store');
  }
}

async function scheduleAckWatch(context: VerdictContext, retry: () => Promise<void>): Promise<void> {
  const key = contextKey(context);
  const timeoutSeconds = Math.max(5, config.wa.verdictAckTimeoutSeconds);
  await clearAckWatchForContext(context);
  const handle = setTimeout(async () => {
    ackWatchers.delete(key);
    try {
      const verdict = await messageStore.getVerdictRecord(context);
      if (!verdict) {
        await messageStore.removePendingAckContext(context).catch(() => undefined);
        return;
      }
      const currentAck = verdict.ack ?? 0;
      if (currentAck >= VERDICT_ACK_TARGET) {
        await messageStore.removePendingAckContext(context).catch(() => undefined);
        return;
      }
      metrics.waVerdictAckTimeouts.labels('timeout').inc();
      if (verdict.attemptCount >= config.wa.verdictMaxRetries) {
        await messageStore.markVerdictStatus(context, 'failed');
        metrics.waVerdictRetryAttempts.labels('failed').inc();
        logger.warn({ context }, 'Max verdict retry attempts reached');
        await messageStore.removePendingAckContext(context).catch(() => undefined);
        return;
      }
      await messageStore.markVerdictStatus(context, 'retrying');
      metrics.waVerdictRetryAttempts.labels('retry').inc();
      await retry();
    } catch (err) {
      logger.error({ err, context }, 'Ack timeout handler failed');
    }
  }, timeoutSeconds * 1000);
  ackWatchers.set(key, handle);
  try {
    await messageStore.addPendingAckContext(context);
  } catch (err) {
    logger.warn({ err, context }, 'Failed to persist pending ack context');
  }
}

async function rehydrateAckWatchers(client: Client): Promise<void> {
  try {
    const contexts = await messageStore.listPendingAckContexts(100);
    for (const context of contexts) {
      try {
        const record = await messageStore.getRecord(context.chatId, context.messageId);
        if (!record) {
          await messageStore.removePendingAckContext(context);
          continue;
        }
        const verdict = record.verdicts?.[context.urlHash];
        if (!verdict) {
          await messageStore.removePendingAckContext(context);
          continue;
        }
        const ackValue = verdict.ack ?? 0;
        if (ackValue >= VERDICT_ACK_TARGET || verdict.status === 'retracted' || verdict.status === 'failed') {
          await messageStore.removePendingAckContext(context);
          continue;
        }
        const job: VerdictJobData = {
          chatId: context.chatId,
          messageId: context.messageId,
          verdict: verdict.verdict,
          reasons: verdict.reasons,
          url: verdict.url,
          urlHash: verdict.urlHash,
          decidedAt: verdict.decidedAt,
          redirectChain: verdict.redirectChain,
          shortener: verdict.shortener ?? null,
        };
        await scheduleAckWatch(context, async () => {
          await deliverVerdictMessage(client, job, context, true);
        });
      } catch (err) {
        logger.warn({ err, context }, 'Failed to rehydrate ack watcher for context');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to list pending ack contexts for rehydration');
  }
}

const SAFE_CONTROL_PLANE_DEFAULT = 'http://control-plane:8080';

function sanitizeLogValue(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 256);
}

function updateSessionStateGauge(state: string): void {
  if (currentWaState) {
    metrics.waSessionState.labels(currentWaState).set(0);
  }
  currentWaState = state;
  metrics.waSessionState.labels(state).set(1);
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

  await refreshConsentGauge();

  const client = new Client({
    puppeteer: { headless: config.wa.headless },
    authStrategy: new LocalAuth({ dataPath: './data/session' })
  });

  client.on('qr', qr => {
    if (config.wa.qrTerminal) QRCode.generate(qr, { small: true });
    metrics.waQrCodesGenerated.inc();
  });
  client.on('ready', async () => {
    logger.info('WhatsApp client ready');
    waSessionStatusGauge.labels('ready').set(1);
    waSessionStatusGauge.labels('disconnected').set(0);
    metrics.waSessionReconnects.labels('ready').inc();
    updateSessionStateGauge('ready');
    botWid = client.info?.wid?._serialized || null;
    try {
      await rehydrateAckWatchers(client);
    } catch (err) {
      logger.warn({ err }, 'Failed to rehydrate ack watchers on ready');
    }
  });
  client.on('auth_failure', (m) => {
    logger.error({ m }, 'Auth failure');
    waSessionStatusGauge.labels('ready').set(0);
    metrics.waSessionReconnects.labels('auth_failure').inc();
  });
  client.on('change_state', (state) => {
    const label = typeof state === 'string' ? state.toLowerCase() : 'unknown';
    metrics.waSessionReconnects.labels(`state_${label}`).inc();
    updateSessionStateGauge(String(state));
    logger.info({ state }, 'WhatsApp client state change');
  });
  client.on('disconnected', (r) => {
    logger.warn({ r }, 'Disconnected');
    waSessionStatusGauge.labels('ready').set(0);
    waSessionStatusGauge.labels('disconnected').set(1);
    metrics.waSessionReconnects.labels('disconnected').inc();
    updateSessionStateGauge('disconnected');
  });
  client.on('incoming_call', async (call: Call) => {
    metrics.waIncomingCalls.labels('received').inc();
    try {
      await call.reject();
      metrics.waIncomingCalls.labels('rejected').inc();
    } catch (err) {
      metrics.waIncomingCalls.labels('reject_error').inc();
      logger.warn({ err }, 'Failed to reject incoming call');
    }
    try {
      await groupStore.recordEvent({
        chatId: call.from || 'unknown',
        type: 'incoming_call',
        timestamp: Date.now(),
        actorId: call.from,
        metadata: { isGroup: call.isGroup, isVideo: call.isVideo },
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to record incoming call event');
    }
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
      const chatId = chat.id._serialized;
      const messageId = msg.id._serialized || msg.id.id;
      const sender = msg.author || msg.from;
      const senderHash = sha256(sender);
      const timestampMs = typeof msg.timestamp === 'number' ? msg.timestamp * 1000 : Date.now();

      await messageStore.recordMessageCreate({
        chatId,
        messageId,
        senderId: sender,
        senderIdHash: senderHash,
        timestamp: timestampMs,
        body: msg.body || '',
        normalizedUrls: [],
        urlHashes: [],
      });

      if (config.wa.consentOnJoin) {
        const consentStatus = await getConsentStatus(chatId);
        if (consentStatus !== 'granted') {
          metrics.waMessagesDropped.labels('consent_pending').inc();
          return;
        }
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

      const normalizedUrls: string[] = [];
      const urlHashes: string[] = [];
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
        const idem = processedKey(chatId, messageId, h);
        const already = await redis.set(idem, '1', 'EX', 60 * 60 * 24 * 7, 'NX');
        if (already === null) {
          metrics.waMessagesDropped.labels('duplicate').inc();
          continue; // duplicate
        }

        normalizedUrls.push(norm);
        urlHashes.push(h);

        try {
          await globalLimiter.consume(GLOBAL_TOKEN_BUCKET_ID);
        } catch {
          metrics.waMessagesDropped.labels('rate_limited_global').inc();
          continue;
        }

        const jobOpts: JobsOptions = { removeOnComplete: true, removeOnFail: 1000, attempts: 2, backoff: { type: 'exponential', delay: 1000 } };
        await scanRequestQueue.add('scan', {
          chatId,
          messageId,
          senderIdHash: senderHash,
          url: norm,
          timestamp: Date.now()
        }, jobOpts);
      }
      if (normalizedUrls.length > 0) {
        await messageStore.recordMessageCreate({
          chatId,
          messageId,
          senderId: sender,
          senderIdHash: senderHash,
          timestamp: timestampMs,
          body: msg.body || '',
          normalizedUrls,
          urlHashes,
        });
      }
    } catch (e) {
      logger.error({ err: e, chatId: sanitizeLogValue((msg as any)?.from) }, 'Failed to process incoming WhatsApp message');
    }
  });

  client.on('message_edit', async (msg: Message) => {
    try {
      const chat = await msg.getChat();
      if (!(chat as GroupChat).isGroup) {
        return;
      }
      const chatId = chat.id._serialized;
      const messageId = msg.id._serialized || msg.id.id;
      const existing = await messageStore.getRecord(chatId, messageId);
      const previousHashes = existing?.urlHashes ?? [];
      const urls = extractUrls(msg.body || '');
      const normalizedUrls: string[] = [];
      const urlHashes: string[] = [];
      for (const raw of urls) {
        const norm = normalizeUrl(raw);
        if (!norm) {
          continue;
        }
        normalizedUrls.push(norm);
        urlHashes.push(urlHash(norm));
      }
      await messageStore.appendEdit(chatId, messageId, {
        body: msg.body || '',
        normalizedUrls,
        urlHashes,
        timestamp: Date.now(),
      });
      metrics.waMessageEdits.labels('processed').inc();

      const senderHash = sha256(msg.author || msg.from || chatId);
      const newHashes = new Set(urlHashes);
      for (let i = 0; i < normalizedUrls.length; i += 1) {
        const norm = normalizedUrls[i];
        const hash = urlHashes[i];
        if (previousHashes.includes(hash)) {
          continue;
        }
        const idem = processedKey(chatId, messageId, hash);
        const already = await redis.set(idem, '1', 'EX', 60 * 60 * 24 * 7, 'NX');
        if (already === null) {
          continue;
        }
        try {
          await globalLimiter.consume(GLOBAL_TOKEN_BUCKET_ID);
        } catch {
          metrics.waMessagesDropped.labels('rate_limited_global').inc();
          continue;
        }
        const jobOpts: JobsOptions = { removeOnComplete: true, removeOnFail: 1000, attempts: 2, backoff: { type: 'exponential', delay: 1000 } };
        await scanRequestQueue.add('scan', {
          chatId,
          messageId,
          senderIdHash: senderHash,
          url: norm,
          timestamp: Date.now(),
        }, jobOpts);
        metrics.waMessageEdits.labels('new_url').inc();
      }

      for (const removed of previousHashes.filter((hash) => !newHashes.has(hash))) {
        const context: VerdictContext = { chatId, messageId, urlHash: removed };
        const verdict = await messageStore.getVerdictRecord(context);
        if (verdict && verdict.status !== 'retracted') {
          await messageStore.markVerdictStatus(context, 'retracted');
          metrics.waMessageEdits.labels('retracted').inc();
          await clearAckWatchForContext(context);
          try {
            await msg.reply('Automated scan verdict withdrawn due to message edit.');
          } catch (err) {
            logger.warn({ err }, 'Failed to send verdict retraction after edit');
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process message edit');
    }
  });

  client.on('message_revoke_everyone', async (msg: Message, revoked?: Message) => {
    try {
      const original = revoked ?? msg;
      const chat = await original.getChat();
      if (!(chat as GroupChat).isGroup) {
        return;
      }
      const chatId = chat.id._serialized;
      const messageId = original.id._serialized || original.id.id;
      await messageStore.recordRevocation(chatId, messageId, 'everyone', Date.now());
      metrics.waMessageRevocations.labels('everyone').inc();
      const record = await messageStore.getRecord(chatId, messageId);
      if (record) {
        let retracted = false;
        for (const hash of Object.keys(record.verdicts)) {
          const context: VerdictContext = { chatId, messageId, urlHash: hash };
          const verdict = await messageStore.getVerdictRecord(context);
          if (verdict && verdict.status !== 'retracted') {
            await messageStore.markVerdictStatus(context, 'retracted');
            await clearAckWatchForContext(context);
            retracted = true;
          }
        }
        if (retracted) {
          try {
            await chat.sendMessage('Previously flagged content was removed. Automated verdict withdrawn.');
          } catch (err) {
            logger.warn({ err }, 'Failed to announce verdict retraction after revoke');
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle message revoke for everyone');
    }
  });

  client.on('message_revoke_me', async (msg: Message) => {
    try {
      const chat = await msg.getChat();
      const chatId = chat.id._serialized;
      const messageId = msg.id._serialized || msg.id.id;
      await messageStore.recordRevocation(chatId, messageId, 'me', Date.now());
      metrics.waMessageRevocations.labels('me').inc();
    } catch (err) {
      logger.warn({ err }, 'Failed to record self message revoke');
    }
  });

  client.on('message_reaction', async (reaction: Reaction) => {
    try {
      const messageId = (reaction.msgId as any)?._serialized || reaction.msgId?.id;
      if (!messageId) return;
      const message = await client.getMessageById(messageId);
      if (!message) return;
      const chat = await message.getChat();
      if (!(chat as GroupChat).isGroup) {
        return;
      }
      const chatId = chat.id._serialized;
      await messageStore.recordReaction(chatId, messageId, {
        reaction: reaction.reaction || '',
        senderId: reaction.senderId || 'unknown',
        timestamp: (reaction.timestamp || Math.floor(Date.now() / 1000)) * 1000,
      });
      const emoji = (reaction.reaction || '').trim();
      const label = emoji && emoji.length <= 2 ? emoji : 'other';
      metrics.waMessageReactions.labels(label).inc();
    } catch (err) {
      logger.warn({ err }, 'Failed to process message reaction');
    }
  });

  client.on('message_ack', async (message: Message, ack: MessageAck) => {
    try {
      const verdictMessageId = message.id._serialized || message.id.id;
      if (!verdictMessageId) return;
      const context = await messageStore.getVerdictMapping(verdictMessageId);
      if (!context) return;
      const ackNumber = typeof ack === 'number' ? ack : Number(ack);
      const timestamp = Date.now();
      const result = await messageStore.updateVerdictAck(context, Number.isFinite(ackNumber) ? ackNumber : null, timestamp);
      if (!result) return;
      const { verdict, previousAck } = result;
      metrics.waVerdictAckTransitions.labels(String(previousAck ?? -1), String(ackNumber ?? -1)).inc();
      if (ackNumber === -1) {
        metrics.waVerdictAckTimeouts.labels('error').inc();
        await messageStore.markVerdictStatus(context, 'failed');
        await clearAckWatchForContext(context);
        return;
      }
      if ((ackNumber ?? 0) >= VERDICT_ACK_TARGET) {
        await clearAckWatchForContext(context);
        await messageStore.markVerdictStatus(context, 'sent');
      }
      logger.debug({ context, ack: ackNumber, verdictAckHistory: verdict.ackHistory }, 'Updated verdict ack state');
    } catch (err) {
      logger.warn({ err }, 'Failed to process verdict ack event');
    }
  });

  client.on('group_join', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      try {
        await governanceLimiter.consume(chatId);
      } catch {
        metrics.waGovernanceRateLimited.labels('group_join').inc();
        return;
      }
      metrics.waGroupEvents.labels('join').inc();
      metrics.waGovernanceActions.labels('group_join').inc();
      const toggled = await chat.setMessagesAdminsOnly(true).catch((err) => {
        logger.warn({ err, chatId }, 'Failed to restrict messages to admins only');
        return false;
      });
      if (config.wa.consentOnJoin) {
        await markConsentPending(chatId);
        metrics.waGroupEvents.labels('consent_pending').inc();
        await groupStore.recordEvent({
          chatId,
          type: 'consent_pending',
          timestamp: Date.now(),
          actorId: notification.author,
          recipients: notification.recipientIds,
          metadata: { reason: 'group_join' },
        });
      } else {
        await markConsentGranted(chatId);
        metrics.waGroupEvents.labels('consent_granted').inc();
        await groupStore.recordEvent({
          chatId,
          type: 'consent_granted',
          timestamp: Date.now(),
          actorId: notification.author,
          recipients: notification.recipientIds,
          metadata: { reason: 'group_join' },
        });
      }
      try {
        await chat.sendMessage(consentTemplate);
      } catch (err) {
        logger.warn({ err, chatId }, 'Failed to send consent message on join');
      }
      if (!config.wa.consentOnJoin && toggled) {
        await chat.setMessagesAdminsOnly(false).catch(() => undefined);
      }
      await groupStore.recordEvent({
        chatId,
        type: 'join',
        timestamp: Date.now(),
        actorId: notification.author,
        recipients: notification.recipientIds,
        metadata: { adminsOnly: toggled === true, consentRequired: config.wa.consentOnJoin },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to handle group join notification');
    }
  });

  client.on('group_membership_request', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      const requesterId = notification.author;
      if (!requesterId) {
        return;
      }
      metrics.waGroupEvents.labels('membership_request').inc();
      await groupStore.recordEvent({
        chatId,
        type: 'membership_request',
        timestamp: Date.now(),
        actorId: requesterId,
        recipients: notification.recipientIds,
        metadata: { requestTimestamp: notification.timestamp },
      });
      try {
        await membershipGroupLimiter.consume(chatId);
        await membershipGlobalLimiter.consume('global');
      } catch {
        metrics.waGovernanceRateLimited.labels('membership_auto').inc();
        await addPendingMembership(chatId, requesterId, Date.now());
        metrics.waMembershipApprovals.labels('rate_limited').inc();
        await groupStore.recordEvent({
          chatId,
          type: 'membership_pending',
          timestamp: Date.now(),
          actorId: requesterId,
          metadata: { reason: 'rate_limited' },
        });
        try {
          await chat.sendMessage(`Membership request from ${requesterId} queued for admin review. Use !scanner approve ${requesterId} to override.`);
        } catch (err) {
          logger.warn({ err, chatId }, 'Failed to notify group about pending membership request');
        }
        return;
      }

      try {
        await client.approveGroupMembershipRequests(chatId, { requesterIds: [requesterId], sleep: null });
        metrics.waMembershipApprovals.labels('auto').inc();
        metrics.waGovernanceActions.labels('membership_auto').inc();
        await removePendingMembership(chatId, requesterId);
        await groupStore.recordEvent({
          chatId,
          type: 'membership_auto',
          timestamp: Date.now(),
          actorId: requesterId,
        });
        try {
          await chat.sendMessage(`Automatically approved membership request from ${requesterId}.`);
        } catch (err) {
          logger.warn({ err, chatId }, 'Failed to announce auto-approved membership');
        }
      } catch (err) {
        logger.warn({ err, chatId, requesterId }, 'Auto approval failed, storing for manual review');
        metrics.waMembershipApprovals.labels('error').inc();
        await addPendingMembership(chatId, requesterId, Date.now());
        await groupStore.recordEvent({
          chatId,
          type: 'membership_error',
          timestamp: Date.now(),
          actorId: requesterId,
          metadata: { reason: 'auto_approval_failed' },
        });
        try {
          await chat.sendMessage(`Could not auto-approve ${requesterId}. An admin may run !scanner approve ${requesterId} to proceed.`);
        } catch (sendErr) {
          logger.warn({ err: sendErr, chatId }, 'Failed to notify admin about membership approval failure');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process membership request');
    }
  });

  client.on('group_leave', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      const recipients = (notification.recipientIds && notification.recipientIds.length > 0)
        ? notification.recipientIds
        : (notification.author ? [notification.author] : []);
      const normalizedType = notification.type === 'remove' ? 'leave_remove' : 'leave';
      metrics.waGroupEvents.labels(normalizedType).inc();
      for (const member of recipients) {
        await removePendingMembership(chatId, member).catch(() => undefined);
      }
      const includesBot = !!botWid && recipients.includes(botWid);
      if (includesBot) {
        await clearConsentState(chatId);
        metrics.waGroupEvents.labels('bot_removed').inc();
        await groupStore.recordEvent({
          chatId,
          type: 'bot_removed',
          timestamp: Date.now(),
          actorId: notification.author,
          recipients,
          metadata: { originalType: notification.type },
        });
      }
      await groupStore.recordEvent({
        chatId,
        type: normalizedType,
        timestamp: Date.now(),
        actorId: notification.author,
        recipients,
        metadata: { includesBot },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to process group leave notification');
    }
  });

  client.on('group_admin_changed', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      const eventType = notification.type === 'promote' ? 'admin_promote' : 'admin_demote';
      metrics.waGroupEvents.labels(eventType).inc();
      const recipients = await notification.getRecipients().catch(() => [] as Contact[]);
      await groupStore.recordEvent({
        chatId,
        type: eventType,
        timestamp: Date.now(),
        actorId: notification.author,
        recipients: notification.recipientIds,
        metadata: { body: notification.body },
      });
      if (notification.type === 'promote' && recipients.length > 0) {
        try {
          await governanceLimiter.consume(chatId);
        } catch {
          metrics.waGovernanceRateLimited.labels('admin_change').inc();
          return;
        }
        const consentStatus = config.wa.consentOnJoin ? await getConsentStatus(chatId) : 'granted';
        const mentionText = recipients.map((contact) => `@${contact.id?.user || contact.id?._serialized || 'member'}`).join(' ');
        const lines = [`${mentionText} promoted to admin.`];
        if (consentStatus !== 'granted') {
          lines.push('This group is still awaiting consent. Please review and run !scanner consent when ready.');
          await chat.setMessagesAdminsOnly(true).catch(() => undefined);
        }
        await chat.sendMessage(lines.join(' '), { mentions: recipients });
        metrics.waGovernanceActions.labels('admin_prompt').inc();
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process admin change notification');
    }
  });

  client.on('group_update', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      const subtype = notification.type || 'unknown';
      const map: Record<string, string> = {
        subject: 'update_subject',
        description: 'update_description',
        picture: 'update_picture',
        announce: 'update_announce',
        restrict: 'update_restrict',
      };
      const eventType = map[subtype] ?? `update_${subtype}`;
      metrics.waGroupEvents.labels(eventType).inc();
      await groupStore.recordEvent({
        chatId,
        type: eventType,
        timestamp: Date.now(),
        actorId: notification.author,
        recipients: notification.recipientIds,
        details: notification.body,
        metadata: { subtype },
      });
      if (subtype === 'announce' && config.wa.consentOnJoin) {
        const consentStatus = await getConsentStatus(chatId);
        if (consentStatus === 'pending') {
          await chat.setMessagesAdminsOnly(true).catch(() => undefined);
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process group update notification');
    }
  });

  // Consume verdicts
  new Worker(config.queues.scanVerdict, async (job) => {
    const queueName = config.queues.scanVerdict;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const data = job.data as VerdictJobData & { decidedAt?: number; redirectChain?: string[]; shortener?: { provider: string; chain: string[] } | null };
    const payload: VerdictJobData = {
      chatId: data.chatId,
      messageId: data.messageId,
      verdict: data.verdict,
      reasons: data.reasons,
      url: data.url,
      urlHash: data.urlHash,
      decidedAt: data.decidedAt,
      redirectChain: data.redirectChain,
      shortener: data.shortener ?? null,
    };
    try {
      const delay = Math.floor(800 + Math.random() * 1200);
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            try {
              await groupLimiter.consume(payload.chatId);
              await groupHourlyLimiter.consume(payload.chatId);
            } catch {
              metrics.waMessagesDropped.labels('verdict_rate_limited').inc();
              return;
            }
            const key = `verdict:${payload.chatId}:${payload.urlHash}`;
            const nx = await redis.set(key, '1', 'EX', 3600, 'NX');
            if (nx === null) {
              metrics.waMessagesDropped.labels('verdict_duplicate').inc();
              return;
            }
            const context: VerdictContext = {
              chatId: payload.chatId,
              messageId: payload.messageId,
              urlHash: payload.urlHash,
            };
            await deliverVerdictMessage(client, payload, context);
          } finally {
            const verdictLatencySeconds = Math.max(0, (Date.now() - (payload.decidedAt ?? started)) / 1000);
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
  } else if (cmd === 'consent') {
    if (!config.wa.consentOnJoin) {
      await chat.sendMessage('Consent enforcement is currently disabled.');
      return;
    }
    await markConsentGranted(chat.id._serialized);
    await gc.setMessagesAdminsOnly(false).catch(() => undefined);
    await chat.sendMessage('Consent recorded. Automated scanning enabled for this group.');
    metrics.waGroupEvents.labels('consent_granted').inc();
    await groupStore.recordEvent({
      chatId: chat.id._serialized,
      type: 'consent_granted',
      timestamp: Date.now(),
      actorId: msg.author || msg.from,
      metadata: { source: 'command' },
    });
  } else if (cmd === 'consentstatus') {
    const status = await getConsentStatus(chat.id._serialized) ?? 'none';
    await chat.sendMessage(`Consent status: ${status}`);
  } else if (cmd === 'approve') {
    const target = parts[2];
    if (!target) {
      const pending = await listPendingMemberships(chat.id._serialized);
      if (pending.length === 0) {
        await chat.sendMessage('No pending membership requests recorded.');
      } else {
        await chat.sendMessage(`Pending membership requests: ${pending.join(', ')}`);
      }
      return;
    }
    try {
      await client.approveGroupMembershipRequests(chat.id._serialized, { requesterIds: [target], sleep: null });
      await removePendingMembership(chat.id._serialized, target);
      metrics.waMembershipApprovals.labels('override').inc();
      metrics.waGovernanceActions.labels('membership_override').inc();
      metrics.waGroupEvents.labels('membership_override').inc();
      await groupStore.recordEvent({
        chatId: chat.id._serialized,
        type: 'membership_override',
        timestamp: Date.now(),
        actorId: msg.author || msg.from,
        recipients: [target],
      });
      await chat.sendMessage(`Approved membership request for ${target}.`);
    } catch (err) {
      metrics.waMembershipApprovals.labels('error').inc();
      logger.warn({ err, target }, 'Failed to approve membership via override');
      await chat.sendMessage(`Unable to approve ${target}. Check logs for details.`);
    }
  } else if (cmd === 'governance') {
    const limit = Number.isFinite(Number(parts[2])) ? Math.max(1, Math.min(25, Number(parts[2]))) : 10;
    const events = await groupStore.listRecentEvents(chat.id._serialized, limit);
    if (events.length === 0) {
      await chat.sendMessage('No recent governance events recorded.');
      return;
    }
    const lines = events.map((event) => {
      const timestamp = new Date(event.timestamp).toISOString();
      const recipients = (event.recipients && event.recipients.length > 0) ? ` -> ${event.recipients.join(', ')}` : '';
      const detail = event.details ? ` :: ${event.details}` : '';
      return `- ${timestamp} [${event.type}] ${event.actorId ?? 'unknown'}${recipients}${detail}`;
    });
    await chat.sendMessage(`Recent governance events:\n${lines.join('\n')}`);
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status|rescan <url>|consent|consentstatus|approve [memberId]|governance [limit]');
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error({ err }, 'Fatal in wa-client');
    process.exit(1);
  });
}
