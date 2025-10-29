import Fastify from 'fastify';
import { Client, LocalAuth, RemoteAuth, Message, GroupChat, GroupNotification, MessageMedia, Reaction, MessageAck, Call, Contact, GroupParticipant } from 'whatsapp-web.js';
import type { ClientOptions } from 'whatsapp-web.js';
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
import { loadEncryptionMaterials } from './crypto/dataKeyProvider';
import { createRemoteAuthStore } from './remoteAuthStore';
import type { RedisRemoteAuthStore } from './remoteAuthStore';

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

      on(): void {}

      quit(): Promise<void> {
        return Promise.resolve();
      }
    }

    return new InMemoryRedis() as unknown as Redis;
  }
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

const redis = createRedisConnection();
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

interface RemoteAuthContext {
  store: RedisRemoteAuthStore;
  sessionName: string;
  sessionExists: boolean;
}

interface AuthResolution {
  strategy: LocalAuth | RemoteAuth;
  remote?: RemoteAuthContext;
}

async function resolveAuthStrategy(redisInstance: Redis): Promise<AuthResolution> {
  if (config.wa.authStrategy === 'remote') {
    if (config.wa.remoteAuth.store !== 'redis') {
      throw new Error(`Unsupported RemoteAuth store "${config.wa.remoteAuth.store}". Only Redis is supported.`);
    }
    const materials = await loadEncryptionMaterials(config.wa.remoteAuth, logger);
    const store = createRemoteAuthStore({
      redis: redisInstance,
      logger,
      prefix: `remoteauth:v1:${config.wa.remoteAuth.clientId}`,
      materials,
      clientId: config.wa.remoteAuth.clientId,
    });
    const sessionName = config.wa.remoteAuth.clientId ? `RemoteAuth-${config.wa.remoteAuth.clientId}` : 'RemoteAuth';
    const sessionExists = await store.sessionExists({ session: sessionName });
    logger.info({ clientId: config.wa.remoteAuth.clientId, sessionExists }, 'Initialising RemoteAuth strategy');
    const strategy = new RemoteAuth({
      clientId: config.wa.remoteAuth.clientId,
      dataPath: config.wa.remoteAuth.dataPath,
      store,
      backupSyncIntervalMs: config.wa.remoteAuth.backupIntervalMs,
    });
    return {
      strategy,
      remote: {
        store,
        sessionName,
        sessionExists,
      },
    };
  }
  logger.info('Initialising LocalAuth strategy');
  return { strategy: new LocalAuth({ dataPath: './data/session' }) };
}
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
const maskPhone = (phone?: string): string => {
  if (!phone) return '';
  if (phone.length <= 4) return phone;
  return `****${phone.slice(-4)}`;
};
const DEFAULT_PAIRING_CODE_TIMEOUT_MS = 120000;

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

  const authResolution = await resolveAuthStrategy(redis);
  const clientOptions: ClientOptions = {
    puppeteer: {
      headless: config.wa.headless,
      args: config.wa.puppeteerArgs,
    },
    authStrategy: authResolution.strategy,
  };

  const remotePhone = config.wa.remoteAuth.phoneNumber;
  if (!config.wa.remoteAuth.autoPair) {
    logger.info('RemoteAuth auto pairing disabled; a QR code will be displayed for first-time linking.');
  }
  let remoteSessionActive = authResolution.remote?.sessionExists ?? false;
  const shouldRequestPhonePairing = Boolean(
    authResolution.remote &&
    remotePhone &&
    !remoteSessionActive &&
    config.wa.remoteAuth.autoPair
  );
  if (shouldRequestPhonePairing && remotePhone) {
    logger.info({ phoneNumber: maskPhone(remotePhone) }, 'Auto pairing enabled; open WhatsApp > Linked Devices on the target device before continuing.');
  }
  if (shouldRequestPhonePairing && remotePhone) {
    clientOptions.pairWithPhoneNumber = {
      phoneNumber: remotePhone,
      showNotification: true,
      intervalMs: 180000,
    };
  }

  const client = new Client(clientOptions);
  const pairingTimeoutMs = config.wa.remoteAuth.pairingDelayMs > 0
    ? config.wa.remoteAuth.pairingDelayMs
    : DEFAULT_PAIRING_CODE_TIMEOUT_MS;
  let allowQrOutput = !shouldRequestPhonePairing;
  let qrSuppressedLogged = false;
  let cachedQr: string | null = null;
  let pairingCodeDelivered = false;
  let pairingFallbackTimer: NodeJS.Timeout | null = null;

  const cancelPairingFallback = () => {
    if (pairingFallbackTimer) {
      clearTimeout(pairingFallbackTimer);
      pairingFallbackTimer = null;
    }
  };

  const emitQr = (qr: string, source: 'live' | 'cached') => {
    if (config.wa.qrTerminal) {
      QRCode.generate(qr, { small: false });
      process.stdout.write('\nOpen WhatsApp > Linked Devices > Link a Device and scan the QR code above.\n');
    }
    metrics.waQrCodesGenerated.inc();
    logger.info({ source }, 'WhatsApp QR code ready for scanning');
  };

  const replayCachedQr = () => {
    if (!cachedQr) {
      logger.warn('QR fallback requested but no cached QR available; restart wa-client to render a new code.');
      return;
    }
    emitQr(cachedQr, 'cached');
  };

  client.on('qr', (qr: string) => {
    cachedQr = qr;
    if (!allowQrOutput) {
      if (!qrSuppressedLogged) {
        qrSuppressedLogged = true;
        logger.info({ phoneNumber: maskPhone(remotePhone) }, 'QR code generated but suppressed while requesting phone-number pairing.');
      }
      return;
    }
    emitQr(qr, 'live');
  });

  if (authResolution.remote) {
    client.on('remote_session_saved', () => {
      remoteSessionActive = true;
      cancelPairingFallback();
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'RemoteAuth session synchronized');
    });
    if (remotePhone) {
      client.on('code', code => {
        pairingCodeDelivered = true;
        cancelPairingFallback();
        logger.info({ pairingCode: code, phoneNumber: maskPhone(remotePhone) }, 'Enter this pairing code in WhatsApp > Linked devices > Link with phone number.');
        if (config.wa.qrTerminal) {
          process.stdout.write(`\nWhatsApp pairing code for ${maskPhone(remotePhone)}: ${code}\nOpen WhatsApp > Linked devices > Link with phone number and enter this code.\n`);
        }
      });
    }
    if (!remoteSessionActive) {
      if (!remotePhone) {
        allowQrOutput = true;
        logger.warn('RemoteAuth session not found and WA_REMOTE_AUTH_PHONE_NUMBER is unset; falling back to QR pairing.');
      } else {
        logger.info({ clientId: config.wa.remoteAuth.clientId, phoneNumber: maskPhone(remotePhone) }, 'RemoteAuth session not found; awaiting phone-number pairing code from WhatsApp.');
      }
    } else {
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'RemoteAuth session found; reusing existing credentials.');
    }
  }

  client.on('ready', async () => {
    logger.info('WhatsApp client ready');
    cancelPairingFallback();
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
    cancelPairingFallback();
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
      const body = msg.body || '';

      const baseRecord = {
        chatId,
        messageId,
        senderId: sender,
        senderIdHash: senderHash,
        timestamp: timestampMs,
        body,
      } as const;

      const urls = extractUrls(body);
      metrics.ingestionRate.inc();
      metrics.urlsPerMessage.observe(urls.length);

      if (config.wa.consentOnJoin) {
        const consentStatus = await getConsentStatus(chatId);
        if (consentStatus !== 'granted') {
          metrics.waMessagesDropped.labels('consent_pending').inc();
          await messageStore.recordMessageCreate({ ...baseRecord, normalizedUrls: [], urlHashes: [] });
          return;
        }
      }

      if (urls.length === 0) {
        metrics.waMessagesDropped.labels('no_url').inc();
        await messageStore.recordMessageCreate({ ...baseRecord, normalizedUrls: [], urlHashes: [] });
        return;
      }
      metrics.waMessagesWithUrls.labels(chatType).inc(urls.length);
      if (!chat.isGroup) {
        metrics.waMessagesDropped.labels('non_group').inc();
        await messageStore.recordMessageCreate({ ...baseRecord, normalizedUrls: [], urlHashes: [] });
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
      await messageStore.recordMessageCreate({
        ...baseRecord,
        normalizedUrls,
        urlHashes,
      });
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
      const notificationType = notification.type as unknown as string;
      const eventType = notificationType === 'promote' ? 'admin_promote' : 'admin_demote';
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
      if (notificationType === 'promote' && recipients.length > 0) {
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
        await chat.sendMessage(lines.join(' '), { mentions: recipients as unknown as any });
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

  if (shouldRequestPhonePairing && remotePhone) {
    pairingFallbackTimer = setTimeout(() => {
      if (!pairingCodeDelivered && !remoteSessionActive) {
        allowQrOutput = true;
        metrics.waSessionReconnects.labels('pairing_code_timeout').inc();
        logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing code not received within timeout; enabling QR fallback.');
        replayCachedQr();
      }
    }, pairingTimeoutMs);
  }

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
  const participants = (gc as any).participants as Array<GroupParticipant> || [];
  const senderId = msg.author || (msg.fromMe && botWid ? botWid : undefined);
  const sender = senderId ? participants.find((p) => p.id._serialized === senderId) : undefined;
  const isSelfCommand = msg.fromMe || (botWid !== null && senderId === botWid);
  if (!isSelfCommand && !sender?.isAdmin && !sender?.isSuperAdmin) return;

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
