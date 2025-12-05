import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
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
  isPrivateHostname,
  ScanRequestSchema,
  createRedisConnection,
} from '@wbscanner/shared';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createGlobalTokenBucket, GLOBAL_TOKEN_BUCKET_ID } from './limiters';
import { MessageStore, VerdictContext } from './message-store';
import { GroupStore } from './group-store';
import { loadEncryptionMaterials } from './crypto/dataKeyProvider';
import { createRemoteAuthStore } from './remoteAuthStore';
import type { RedisRemoteAuthStore } from './remoteAuthStore';
import { forceRemoteSessionReset, ensureRemoteSessionDirectories } from './session/cleanup';
import { describeSession, isSessionReady, type SessionSnapshot } from './session/guards';
import { enrichEvaluationError } from './session/errors';
import { safeGetGroupChatById } from './utils/chatLookup';
import { handleSelfMessageRevoke } from './handlers/selfRevoke';
import { PairingOrchestrator } from './pairingOrchestrator';
import { SessionManager } from './session/sessionManager';

const redis = createRedisConnection();
const scanRequestQueue = new Queue(config.queues.scanRequest, { connection: redis });
const sessionManager = new SessionManager(redis, logger);

const pairingCodeCacheKey = (phone: string) => `wa:pairing:code:${phone}`;
const pairingAttemptKey = (phone: string) => `wa:pairing:last_attempt:${phone}`;

async function cachePairingCode(phone: string, code: string): Promise<void> {
  try {
    const payload = JSON.stringify({ code, storedAt: Date.now() });
    const ttlSeconds = Math.max(1, Math.ceil(PHONE_PAIRING_CODE_TTL_MS / 1000));
    await redis.set(pairingCodeCacheKey(phone), payload, 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to cache pairing code.');
  }
}

async function getCachedPairingCode(phone: string): Promise<{ code: string; storedAt: number } | null> {
  try {
    const raw = await redis.get(pairingCodeCacheKey(phone));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; storedAt?: unknown };
    if (typeof parsed.code === 'string' && typeof parsed.storedAt === 'number') {
      return { code: parsed.code, storedAt: parsed.storedAt };
    }
    return null;
  } catch (err) {
    logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to read cached pairing code.');
    return null;
  }
}

async function recordPairingAttempt(phone: string, timestamp: number): Promise<void> {
  try {
    const ttlSeconds = 600;
    await redis.set(pairingAttemptKey(phone), String(timestamp), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to record pairing attempt.');
  }
}

async function getLastPairingAttempt(phone: string): Promise<number | null> {
  try {
    const raw = await redis.get(pairingAttemptKey(phone));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (err) {
    logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to read last pairing attempt.');
    return null;
  }
}

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
    let sessionExists = await store.sessionExists({ session: sessionName });
    if (sessionExists && config.wa.remoteAuth.forceNewSession) {
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'Force-new-session enabled; backing up and removing stored RemoteAuth session');

      // Soft delete: Rename the key instead of deleting it
      const backupKey = `${store.key(sessionName)}:backup:${Date.now()}`;
      try {
        await redisInstance.rename(store.key(sessionName), backupKey);
        logger.info({ backupKey }, 'Previous session backed up.');
      } catch (err) {
        logger.warn({ err }, 'Failed to backup session during force-new-session reset; proceeding with deletion.');
        await forceRemoteSessionReset({
          deleteRemoteSession: (name: string) => store.delete({ session: name }),
          sessionName,
          dataPath: config.wa.remoteAuth.dataPath || './data/remote-session',
          logger,
        });
      }

      sessionExists = false;
      process.env.WA_REMOTE_AUTH_FORCE_NEW_SESSION = 'false';
      config.wa.remoteAuth.forceNewSession = false;
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'Force-new-session flag cleared after cleanup.');
    }
    await ensureRemoteSessionDirectories(config.wa.remoteAuth.dataPath || './data/remote-session', logger);
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
const DEFAULT_PAIRING_CODE_TIMEOUT_MS = 160000;
const FORCE_PHONE_PAIRING = config.wa.remoteAuth.disableQrFallback || config.wa.remoteAuth.autoPair;
const CONFIGURED_MAX_PAIRING_RETRIES = Math.max(1, config.wa.remoteAuth.maxPairingRetries ?? 5);
const MAX_PAIRING_CODE_RETRIES = FORCE_PHONE_PAIRING ? 10 : CONFIGURED_MAX_PAIRING_RETRIES; // Cap forced retries to 10 to prevent infinite loops
const PAIRING_RETRY_DELAY_MS = Math.max(1000, config.wa.remoteAuth.pairingRetryDelayMs ?? 15000);
const PHONE_PAIRING_CODE_TTL_MS = 160000;

interface PairingCodeWindow {
  AuthStore?: {
    PairingCodeLinkUtils?: unknown;
    AppState?: { state?: string };
  };
  codeInterval?: ReturnType<typeof setInterval> | number;
  onCodeReceivedEvent?: (codeValue: string) => void;
}

interface PairingCodeUtils {
  setPairingType?: (mode: string) => void;
  initializeAltDeviceLinking?: () => Promise<void>;
  startAltLinkingFlow?: (phoneNumber: string, showNotification: boolean) => Promise<string>;
}

type PageHandle = {
  evaluate: (
    pageFn: (phoneNumber: string, showNotification: boolean, intervalMs: number) => Promise<unknown>,
    phoneNumber: string | undefined,
    showNotification: boolean,
    intervalMs: number
  ) => Promise<unknown>;
};

const ackWatchers = new Map<string, NodeJS.Timeout>();
let currentWaState: string | null = null;
let botWid: string | null = null;
let pairingOrchestrator: import('./pairingOrchestrator').PairingOrchestrator | null = null;
let remotePhone: string | undefined = undefined;

function snapshotSession(): SessionSnapshot {
  return { state: currentWaState, wid: botWid };
}

function hydrateParticipantList(chat: GroupChat): Promise<GroupParticipant[]> {
  const maybeParticipants = (chat as unknown as { participants?: GroupParticipant[] }).participants;
  if (maybeParticipants && maybeParticipants.length > 0) {
    return Promise.resolve(maybeParticipants);
  }
  const fetchParticipants = (chat as unknown as { fetchParticipants?: () => Promise<GroupParticipant[]> }).fetchParticipants;
  if (typeof fetchParticipants === 'function') {
    return fetchParticipants().catch(() => maybeParticipants ?? []);
  }
  return Promise.resolve(maybeParticipants ?? []);
}

function expandWidVariants(id: string | undefined): string[] {
  if (!id) return [];
  if (!id.includes('@')) return [id];
  const [user, domain] = id.split('@');
  if (domain === 'c.us') {
    return [id, `${user}@lid`];
  }
  if (domain === 'lid') {
    return [id, `${user}@c.us`];
  }
  return [id];
}

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
  degradedMode?: { providers: Array<{ name: string; reason: string }> } | null;
  isCorrection?: boolean;
}

async function collectVerdictMedia(job: VerdictJobData): Promise<Array<{ media: MessageMedia; type: 'screenshot' | 'ioc' }>> {
  if (!config.features.attachMediaToVerdicts) {
    return [];
  }

  const attachments: Array<{ media: MessageMedia; type: 'screenshot' | 'ioc' }> = [];

  // Collect screenshot attachment
  const screenshotAttachment = await collectScreenshotAttachment(job);
  if (screenshotAttachment) {
    attachments.push(screenshotAttachment);
  }

  // Collect IOC (Indicators of Compromise) attachment
  const iocAttachment = createIocAttachment(job);
  if (iocAttachment) {
    attachments.push(iocAttachment);
  }

  return attachments;
}

async function collectScreenshotAttachment(job: VerdictJobData): Promise<{ media: MessageMedia; type: 'screenshot' } | null> {
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
        return { media, type: 'screenshot' };
      }
    }
  } catch (err) {
    logger.warn({ err, urlHash: job.urlHash }, 'Failed to fetch screenshot attachment');
  }

  return null;
}

function createIocAttachment(job: VerdictJobData): { media: MessageMedia; type: 'ioc' } | null {
  const lines = buildIocTextLines(job);
  const textPayload = lines.join('\n');

  if (textPayload.trim().length === 0) {
    return null;
  }

  const data = Buffer.from(textPayload, 'utf8').toString('base64');
  const media = new MessageMedia('text/plain', data, `scan-${job.urlHash.slice(0, 8)}.txt`);
  return { media, type: 'ioc' };
}

function buildIocTextLines(job: VerdictJobData): string[] {
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

  return lines;
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

  const snapshot = snapshotSession();
  if (!isSessionReady(snapshot)) {
    logger.debug({ job, session: describeSession(snapshot) }, 'Skipping verdict delivery because session is not ready');
    return false;
  }

  let chat: GroupChat | null = null;
  try {
    if (targetMessage) {
      chat = await targetMessage.getChat().catch((err) => {
        throw enrichEvaluationError(err, {
          operation: 'deliverVerdictMessage:getChat',
          chatId: (targetMessage.id as unknown as { remote?: string })?.remote ?? job.chatId,
          messageId: targetMessage.id?._serialized,
          snapshot,
        });
      }) as GroupChat;
    } else {
      chat = await safeGetGroupChatById({
        client,
        chatId: job.chatId,
        snapshot,
        logger,
      });
    }
  } catch (err) {
    logger.warn({ err, chatId: job.chatId }, 'Unable to load chat for verdict delivery');
    return false;
  }

  if (!chat) {
    return false;
  }

  if (!isRetry && job.degradedMode?.providers?.length) {
    const lines = [
      '⚠️ Scanner degraded: external intelligence providers are unavailable.',
      ...job.degradedMode.providers.map((provider) => `- ${provider.name}: ${provider.reason}`),
      'Verdicts rely on cached data and heuristics until providers recover.',
    ];
    const message = lines.join('\n');
    try {
      await chat.sendMessage(message);
      metrics.waGroupEvents.labels('scanner_degraded').inc();
    } catch (err) {
      logger.warn({ err, chatId: job.chatId }, 'Failed to send degraded mode notification');
    }
    await groupStore.recordEvent({
      chatId: job.chatId,
      type: 'scanner_degraded',
      timestamp: Date.now(),
      details: JSON.stringify(job.degradedMode.providers),
    }).catch((err) => {
      logger.warn({ err, chatId: job.chatId }, 'Failed to record degraded mode event');
    });
  }

  // Handle Correction: Edit or Delete Previous Verdict Message
  if (job.isCorrection) {
    try {
      // Retrieve the previous verdict message ID from the message store
      const previousVerdictRecord = await messageStore.getVerdictRecord(context);
      if (previousVerdictRecord?.verdictMessageId) {
        try {
          const previousVerdictMessage = await client.getMessageById(previousVerdictRecord.verdictMessageId);
          if (previousVerdictMessage) {
            // Try to delete the previous benign verdict message
            await previousVerdictMessage.delete(true);
            logger.info({ originalMessageId: job.messageId, verdictMessageId: previousVerdictRecord.verdictMessageId }, 'Deleted previous benign verdict message');
            metrics.waMessageEdits.labels('correction_delete').inc();
          }
        } catch (err) {
          logger.warn({ err, verdictMessageId: previousVerdictRecord.verdictMessageId }, 'Failed to delete previous verdict message, will send correction as new message');
        }
      }
    } catch (err) {
      logger.warn({ err, context }, 'Failed to retrieve previous verdict for correction editing');
    }
  }

  const baseVerdictText = formatGroupVerdict(job.verdict, job.reasons, job.url);
  const verdictText = job.isCorrection
    ? `⚠️ CORRECTION: The link above has been re-evaluated as MALICIOUS.\n\n${baseVerdictText}`
    : baseVerdictText;

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
    degradedProviders: job.degradedMode?.providers ?? null,
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
    validateUrlProtocol(parsed);
    return normalizeUrlString(parsed);
  } catch {
    return SAFE_CONTROL_PLANE_DEFAULT;
  }
}

function validateUrlProtocol(parsed: URL): void {
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('invalid protocol');
  }
}

function normalizeUrlString(parsed: URL): string {
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

async function isUrlAllowedForScanning(normalized: string): Promise<boolean> {
  try {
    const parsed = new URL(normalized);
    if (await isPrivateHostname(parsed.hostname)) {
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
async function initializeWhatsAppWithRetry(client: Client, maxAttempts = 5): Promise<void> {
  let attempt = 0;
  const baseDelay = 2000; // 2 seconds
  const maxDelay = 30000; // 30 seconds

  while (attempt < maxAttempts) {
    attempt++;
    try {
      logger.info({ attempt, maxAttempts }, 'Initializing WhatsApp client...');
      await client.initialize();
      logger.info({ attempt }, 'WhatsApp client initialized successfully');
      return;
    } catch (err) {
      const isRetryable = err instanceof Error && (
        err.message.includes('timeout') ||
        err.message.includes('connection') ||
        err.message.includes('network') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('EAI_AGAIN')
      );

      if (!isRetryable) {
        logger.error({ err, attempt }, 'Non-retryable error during WhatsApp initialization');
        throw err;
      }

      if (attempt >= maxAttempts) {
        logger.error({ err, attempt }, 'Max retry attempts reached for WhatsApp initialization');
        throw err;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.random() * 1000; // Add up to 1 second jitter
      const totalDelay = delay + jitter;

      logger.warn({
        err,
        attempt,
        maxAttempts,
        nextRetryIn: Math.round(totalDelay / 1000),
        retryReason: 'network_or_timeout'
      }, 'WhatsApp initialization failed, retrying with exponential backoff');

      metrics.waSessionReconnects.labels('init_retry').inc();

      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
}

async function main() {
  assertEssentialConfig('wa-client');
  assertControlPlaneToken();

  // Validate Redis connectivity before starting
  try {
    await redis.ping();
    logger.info('Redis connectivity validated');
  } catch (err) {
    logger.error({ err }, 'Redis connectivity check failed during startup');
    // Don't throw, let healthcheck handle it so container doesn't crash loop immediately
    // throw new Error('Redis is required but unreachable');
  }

  const app = Fastify();
  app.get('/healthz', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check Redis connectivity
      await redis.ping();
      return { ok: true, redis: 'connected' };
    } catch (err) {
      logger.warn({ err }, 'Health check failed - Redis connectivity issue');
      reply.code(503);
      return { ok: false, redis: 'disconnected', error: 'Redis unreachable' };
    }
  });
  app.get('/metrics', async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  app.post('/pair', async (req: FastifyRequest<{ Body: { force?: boolean } }>, reply: FastifyReply) => {
    const numbers = remotePhoneNumbers;
    if (numbers.length === 0) {
      return reply.code(400).send({ error: 'No phone numbers configured' });
    }

    // Handle forced retry - clear rate limit state
    if (req.body?.force && pairingOrchestrator) {
      logger.info('Force flag received. Clearing rate limit state...');
      // We need to clear the state for all configured numbers since we don't know which one is active in the orchestrator context easily here
      // But typically there's only one active.
      // Accessing private storage or using a helper would be better, but direct Redis access is fine here given we know the key pattern.
      for (const phone of numbers) {
        await redis.del(`wa:pairing:next_attempt:${phone}`);
      }
      // Also reset the orchestrator's internal memory state if possible, or just rely on it re-reading from storage (which it does on init, but maybe not on every check?)
      // The orchestrator checks storage.get() in canSchedule/schedule logic if we implemented it that way.
      // Actually, looking at PairingOrchestrator, it loads state on init. We might need to force it to reload or just rely on the fact that we are bypassing the check here?
      // Wait, the check below `pairingOrchestrator.getStatus()` might use internal state.

      // Let's reset the orchestrator state if exposed, or just recreate it? Recreating is heavy.
      // If we clear Redis, the next time orchestrator tries to save/load it might be fine, but `nextAllowedAttemptAt` is in memory.
      // We need a way to tell orchestrator to reset.
      // For now, let's assume restarting the service + clearing Redis is the clean way, OR we add a method to orchestrator.
      // But since we can't easily modify orchestrator instance from here without casting, let's just clear Redis and hope the user restarts OR we implement a reset method.

      // Actually, if the user sends force=true, we should probably just ignore the rate limit check below.
    }

    // Check rate limiting via orchestrator if available
    if (pairingOrchestrator && !req.body?.force) {
      const status = pairingOrchestrator.getStatus();
      if (status.rateLimited && status.nextAttemptIn > 0) {
        return reply.code(429).send({ error: 'Rate limited', nextAttemptIn: status.nextAttemptIn });
      }

      // Reset auto-refresh counter so loop can resume if needed
      consecutiveAutoRefreshes = 0;
    } else if (pairingOrchestrator && req.body?.force) {
      // If forced, we should also reset the internal state of the orchestrator so it doesn't immediately fail again
      // This is a bit hacky but we can try to reset the internal counters if we had access.
      // For now, we rely on the fact that we are bypassing the check above.
      // But `performParallelPairingCodeRequest` might fail if the orchestrator's internal `requestCode` wrapper checks state?
      // The `requestCode` passed to orchestrator is `performPairingCodeRequest`.
      // The orchestrator manages the scheduling.
      // When we call `performParallelPairingCodeRequest`, it calls `waSock.requestPairingCode`.
      // It does NOT go through orchestrator's `schedule`.
      // So bypassing the check here is sufficient to trigger the request!
      // However, if the request fails with 429, the orchestrator (if listening to events) might pick it up.
      consecutiveAutoRefreshes = 0;
    }

    try {
      const result = await performParallelPairingCodeRequest(numbers);
      if (result) {
        return { ok: true, code: result.code, phone: maskPhone(result.phone), message: 'Pairing code generated' };
      }
      return reply.code(500).send({ error: 'Failed to get pairing code from any configured number' });
    } catch (err) {
      logger.error({ err, count: numbers.length }, 'Parallel pairing request failed');
      return reply.code(500).send({ error: 'Pairing code request failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  await refreshConsentGauge();

  const authResolution = await resolveAuthStrategy(redis);
  
  // Initialize phone numbers for Remote Auth (needed before building clientOptions)
  const remotePhoneNumbers = config.wa.remoteAuth.phoneNumbers.length > 0
    ? config.wa.remoteAuth.phoneNumbers
    : (config.wa.remoteAuth.phoneNumber ? [config.wa.remoteAuth.phoneNumber] : []);

  remotePhone = remotePhoneNumbers[0]; // Keep backwards compatibility for single phone variable

  let remoteSessionActive = authResolution.remote?.sessionExists ?? false;
  
  // Determine if we should use phone-number pairing mode (suppress QR codes)
  // This is true when phone numbers are configured and no session exists
  const shouldUsePhonePairingMode = Boolean(
    authResolution.remote &&
    remotePhoneNumbers.length > 0 &&
    !remoteSessionActive
  );
  
  // Auto-start pairing only if explicitly enabled
  const shouldAutoStartPairing = shouldUsePhonePairingMode && config.wa.remoteAuth.autoPair;

  // Build client options with optional phone pairing configuration
  // When pairWithPhoneNumber is set, the library properly exposes onCodeReceivedEvent
  // and handles the pairing flow internally, ensuring the ready event fires correctly
  const clientOptions: ClientOptions & { pairWithPhoneNumber?: { phoneNumber: string; showNotification?: boolean } } = {
    puppeteer: {
      headless: config.wa.headless,
      args: config.wa.puppeteerArgs,
      // Additional launch options for resource optimization
      handleSIGINT: false,          // Let Node.js handle signals
      handleSIGTERM: false,
      handleSIGHUP: false,
      ignoreHTTPSErrors: true,      // Reduce SSL validation overhead
      defaultViewport: {            // Set minimal viewport to reduce memory
        width: 1280,
        height: 720,
      },
      // Pipe instead of websocket for faster IPC (if available)
      pipe: process.platform !== 'win32',
    },
    authStrategy: authResolution.strategy,
  };

  // Configure phone pairing mode if we have a phone number and no existing session
  // This tells the library to use phone pairing instead of QR code authentication
  if (shouldUsePhonePairingMode && remotePhone) {
    clientOptions.pairWithPhoneNumber = {
      phoneNumber: remotePhone,
      showNotification: true,
    };
    logger.info({ phoneNumber: maskPhone(remotePhone) }, 'Configured library for phone-number pairing mode');
  }

  if (remotePhoneNumbers.length > 0) {
    logger.info(
      {
        count: remotePhoneNumbers.length,
        numbers: remotePhoneNumbers.map(maskPhone),
        pollingEnabled: config.wa.remoteAuth.pollingEnabled
      },
      'Remote Auth phone numbers configured'
    );
  }
  
  if (shouldUsePhonePairingMode) {
    if (config.wa.remoteAuth.autoPair) {
      logger.info({ phoneNumbers: remotePhoneNumbers.map(maskPhone) }, 'Auto pairing enabled; open WhatsApp > Linked Devices on the target device before continuing.');
    } else {
      logger.info({ phoneNumbers: remotePhoneNumbers.map(maskPhone) }, 'Phone-number pairing mode active. QR codes suppressed. Use /pair endpoint or setup wizard to request pairing code.');
    }
  } else if (!remoteSessionActive && remotePhoneNumbers.length === 0) {
    logger.info('No phone numbers configured and no session exists; QR code will be displayed for linking.');
  }

  const client = new Client(clientOptions);
  const pairingTimeoutMs = config.wa.remoteAuth.pairingDelayMs > 0
    ? config.wa.remoteAuth.pairingDelayMs
    : DEFAULT_PAIRING_CODE_TIMEOUT_MS;
  let allowQrOutput = !shouldUsePhonePairingMode;
  let qrSuppressedLogged = false;
  let cachedQr: string | null = null;
  let pairingCodeDelivered = false;
  let pairingCodeExpiryTimer: NodeJS.Timeout | null = null;
  let pairingFallbackTimer: NodeJS.Timeout | null = null;
  let lastPairingAttemptMs = 0;
  let consecutiveAutoRefreshes = 0;
  const MAX_CONSECUTIVE_AUTO_REFRESHES = 3;

  // Track the currently active phone number
  const getActivePairingPhone = async (): Promise<string | null> => {
    try {
      return await redis.get('wa:pairing:active_phone');
    } catch (err) {
      logger.warn({ err }, 'Failed to get active pairing phone');
      return null;
    }
  };

  const setActivePairingPhone = async (phone: string): Promise<void> => {
    try {
      const ttlSeconds = Math.max(1, Math.ceil(PHONE_PAIRING_CODE_TTL_MS / 1000));
      await redis.set('wa:pairing:active_phone', phone, 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err, phone: maskPhone(phone) }, 'Failed to set active pairing phone');
    }
  };

  // Perform parallel pairing code requests across multiple phone numbers
  // Returns the first successful code or null
  const performParallelPairingCodeRequest = async (
    phoneNumbers: string[]
  ): Promise<{ code: string; phone: string } | null> => {
    if (phoneNumbers.length === 0) {
      logger.warn('No phone numbers provided for parallel pairing request');
      return null;
    }

    if (phoneNumbers.length === 1) {
      // Optimize for single number case
      const code = await performPairingCodeRequestForPhone(phoneNumbers[0]);
      return code ? { code, phone: phoneNumbers[0] } : null;
    }

    logger.info(
      { count: phoneNumbers.length, numbers: phoneNumbers.map(maskPhone) },
      'Attempting parallel pairing code requests'
    );

    // Create promises for each phone number
    const promises = phoneNumbers.map(async (phone) => {
      try {
        const code = await performPairingCodeRequestForPhone(phone);
        if (code) {
          logger.info({ phone: maskPhone(phone) }, 'Got pairing code from phone number');
          return { code, phone };
        }
        return null;
      } catch (err) {
        logger.warn({ err, phone: maskPhone(phone) }, 'Failed to request code for phone');
        return null;
      }
    });

    // Race all requests with timeout, return first successful one
    const racePromise = Promise.race([
      ...promises,
      new Promise<null>((resolve) =>
        setTimeout(() => {
          logger.warn({ timeout: config.wa.remoteAuth.parallelCheckTimeoutMs }, 'Parallel pairing request timed out');
          resolve(null);
        }, config.wa.remoteAuth.parallelCheckTimeoutMs)
      ),
    ]);

    const result = await racePromise;

    if (result) {
      // Track which phone number produced the code
      await setActivePairingPhone(result.phone);
      await cachePairingCode(result.phone, result.code);
      logger.info(
        { phone: maskPhone(result.phone), count: phoneNumbers.length },
        'Parallel pairing request succeeded'
      );
    } else {
      logger.warn(
        { count: phoneNumbers.length },
        'All parallel pairing requests failed or timed out'
      );
    }

    return result;
  };

  // Wait for AuthStore.PairingCodeLinkUtils to be available
  // This is required before requesting a pairing code
  const waitForAuthStoreReady = async (maxWaitMs = 30000): Promise<boolean> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pupPage = (client as any).pupPage as { evaluate: (fn: () => unknown) => Promise<unknown> } | undefined;
    if (!pupPage) {
      logger.warn('Puppeteer page not available for AuthStore check');
      return false;
    }

    const startTime = Date.now();
    const pollInterval = 500;
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const isReady = await pupPage.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const win = window as any;
          return !!(win.AuthStore?.PairingCodeLinkUtils?.startAltLinkingFlow);
        });
        
        if (isReady) {
          logger.debug({ waitedMs: Date.now() - startTime }, 'AuthStore.PairingCodeLinkUtils is ready');
          return true;
        }
      } catch (err) {
        // Page might be navigating, continue waiting
        logger.debug({ err: err instanceof Error ? err.message : err }, 'AuthStore check failed, retrying...');
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    logger.warn({ maxWaitMs }, 'AuthStore.PairingCodeLinkUtils not ready after timeout');
    return false;
  };

  // Perform pairing code request for a specific phone number
  // Uses the library's built-in requestPairingCode method for proper auth handling
  const performPairingCodeRequestForPhone = async (phone: string): Promise<string | null> => {
    // Record attempt for this specific phone
    try {
      lastPairingAttemptMs = Date.now();
      await recordPairingAttempt(phone, lastPairingAttemptMs);
    } catch (err) {
      logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to record pairing attempt');
    }

    await addHumanBehaviorJitter();

    // Wait for AuthStore to be ready before attempting pairing code request
    const authStoreReady = await waitForAuthStoreReady();
    if (!authStoreReady) {
      logger.warn({ phoneNumber: maskPhone(phone) }, 'AuthStore not ready, will retry pairing code request later');
      return null;
    }

    try {
      // Use the library's official requestPairingCode method
      // This properly sets up the auth flow and emits events correctly
      logger.info({ phoneNumber: maskPhone(phone) }, 'Requesting pairing code via library method');
      const code = await client.requestPairingCode(phone, true);
      if (code && typeof code === 'string') {
        logger.info({ phoneNumber: maskPhone(phone), codeLength: code.length }, 'Pairing code received from library');
        return code;
      }
      logger.warn({ phoneNumber: maskPhone(phone), code }, 'Invalid pairing code response from library');
      return null;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err: errMsg, phoneNumber: maskPhone(phone) }, 'Failed to request pairing code via library');
      
      // If the error is a minified WhatsApp error (like "Evaluation failed: t"), 
      // it means the page state isn't ready - return null to allow retry
      if (errMsg.includes('Evaluation failed')) {
        logger.warn({ phoneNumber: maskPhone(phone) }, 'WhatsApp page not ready for pairing, will retry later');
        return null;
      }
      
      // Fall back to Puppeteer method if library method fails with other errors
      logger.info({ phoneNumber: maskPhone(phone) }, 'Falling back to Puppeteer pairing code request');
      const pageHandle = getPageHandle(client);
      if (!pageHandle) {
        logger.warn({ phoneNumber: maskPhone(phone) }, 'Puppeteer page handle unavailable for pairing fallback');
        return null;
      }
      const interval = Math.max(60000, config.wa.remoteAuth.pairingDelayMs ?? 0);
      try {
        const outcome = await executePairingCodeRequestForPhone(pageHandle, phone, interval);
        return processPairingOutcome(outcome);
      } catch (fallbackErr) {
        logger.error({ err: fallbackErr instanceof Error ? fallbackErr.message : fallbackErr, phoneNumber: maskPhone(phone) }, 'Puppeteer fallback also failed');
        return null;
      }
    }
  };

  const performPairingCodeRequest = async (): Promise<string | null> => {
    if (!remotePhone) {
      throw new Error('No phone number configured for pairing');
    }
    return performPairingCodeRequestForPhone(remotePhone);
  };

  function getPageHandle(client: Client): PageHandle | null {
    const page = (client as unknown as { pupPage?: { evaluate?: (...args: unknown[]) => Promise<unknown> } }).pupPage;
    if (!page || typeof page.evaluate !== 'function') {
      return null;
    }

    const evaluateFn = page.evaluate.bind(page) as (...args: unknown[]) => Promise<unknown>;

    return {
      evaluate: (pageFn, phoneNumber, showNotification, intervalMs) =>
        evaluateFn(pageFn as (...args: unknown[]) => unknown, phoneNumber, showNotification, intervalMs),
    };
  }

  function recordPairingAttemptIfNeeded(): void {
    if (remotePhone) {
      lastPairingAttemptMs = Date.now();
      recordPairingAttempt(remotePhone, lastPairingAttemptMs).catch(err => {
        logger.warn({ err, phoneNumber: maskPhone(remotePhone!) }, 'Failed to record pairing attempt');
      });
    }
  }

  async function addHumanBehaviorJitter(): Promise<void> {
    // Add jitter to mimic human behavior (1-5 seconds)
    const jitter = Math.floor(Math.random() * 4000) + 1000;
    await new Promise(resolve => setTimeout(resolve, jitter));
  }

  async function executePairingCodeRequest(pageHandle: PageHandle, interval: number): Promise<unknown> {
    return await pageHandle.evaluate(async (phoneNumber: string, showNotification: boolean, intervalMs: number) => {
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const globalWindow = window as unknown as PairingCodeWindow;

      // Inline helper functions for browser context
      async function waitForUtils(globalWindow: PairingCodeWindow, wait: (ms: number) => Promise<unknown>): Promise<PairingCodeUtils> {
        for (let i = 0; i < 20; i++) {
          if (globalWindow.AuthStore?.PairingCodeLinkUtils) {
            return globalWindow.AuthStore.PairingCodeLinkUtils as PairingCodeUtils;
          }
          await wait(500);
        }
        throw new Error('AuthStore.PairingCodeLinkUtils not found after timeout');
      }

      function setupEventHandlers(globalWindow: PairingCodeWindow, intervalMs: number): void {
        if (typeof globalWindow.onCodeReceivedEvent !== 'function') {
          globalWindow.onCodeReceivedEvent = (codeValue: string) => codeValue;
        }
        if (globalWindow.codeInterval) {
          clearInterval(globalWindow.codeInterval as number);
        }
        globalWindow.codeInterval = setInterval(async () => {
          const state = globalWindow.AuthStore?.AppState?.state;
          if (state !== 'UNPAIRED' && state !== 'UNPAIRED_IDLE') {
            clearInterval(globalWindow.codeInterval as number);
            return;
          }
        }, intervalMs);
      }

      async function requestCode(utils: PairingCodeUtils, phoneNumber: string, showNotification: boolean, wait: (ms: number) => Promise<unknown>): Promise<string> {
        await wait(Math.random() * 500 + 200);
        if (typeof utils.setPairingType === 'function') {
          utils.setPairingType('ALT_DEVICE_LINKING');
        }
        if (typeof utils.initializeAltDeviceLinking === 'function') {
          await utils.initializeAltDeviceLinking();
        }
        if (typeof utils.startAltLinkingFlow !== 'function') {
          throw new Error('startAltLinkingFlow function missing on PairingCodeLinkUtils');
        }
        return utils.startAltLinkingFlow(phoneNumber, showNotification);
      }

      function isValidCode(code: unknown): code is string {
        return typeof code === 'string' && code.length > 0;
      }

      function formatErrorForResponse(err: unknown, globalWindow: PairingCodeWindow) {
        const typedErr = err as { message?: string; stack?: string; name?: string };
        const raw = typeof err === 'object' && err !== null ? Object.assign({}, err, { message: typedErr?.message, stack: typedErr?.stack }) : err;
        const msg = typedErr?.message || '';
        const isRateLimit = msg.includes('429') || msg.includes('rate-overlimit');
        return {
          ok: false,
          reason: msg || String(err ?? 'unknown'),
          stack: typedErr?.stack,
          state: globalWindow.AuthStore?.AppState?.state,
          hasUtils: Boolean(globalWindow.AuthStore?.PairingCodeLinkUtils),
          isRateLimit,
          rawError: raw,
        };
      }

      const utils = await waitForUtils(globalWindow, wait);
      setupEventHandlers(globalWindow, intervalMs);

      try {
        const firstCode = await requestCode(utils, phoneNumber, showNotification, wait);
        if (isValidCode(firstCode)) {
          return { ok: true, code: firstCode };
        }
        return { ok: false, reason: 'empty_code', state: globalWindow.AuthStore?.AppState?.state };
      } catch (err: unknown) {
        return formatErrorForResponse(err, globalWindow);
      }
    }, remotePhone, true, interval);
  }

  async function executePairingCodeRequestForPhone(pageHandle: PageHandle, phone: string, interval: number): Promise<unknown> {
    return await pageHandle.evaluate(async (phoneNumber: string, showNotification: boolean, intervalMs: number) => {
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const globalWindow = window as unknown as PairingCodeWindow;

      // Inline helper functions for browser context
      async function waitForUtils(globalWindow: PairingCodeWindow, wait: (ms: number) => Promise<unknown>): Promise<PairingCodeUtils> {
        for (let i = 0; i < 20; i++) {
          if (globalWindow.AuthStore?.PairingCodeLinkUtils) {
            return globalWindow.AuthStore.PairingCodeLinkUtils as PairingCodeUtils;
          }
          await wait(500);
        }
        throw new Error('AuthStore.PairingCodeLinkUtils not found after timeout');
      }

      function setupEventHandlers(globalWindow: PairingCodeWindow, intervalMs: number): void {
        if (typeof globalWindow.onCodeReceivedEvent !== 'function') {
          globalWindow.onCodeReceivedEvent = (codeValue: string) => codeValue;
        }
        if (globalWindow.codeInterval) {
          clearInterval(globalWindow.codeInterval as number);
        }
        globalWindow.codeInterval = setInterval(async () => {
          const state = globalWindow.AuthStore?.AppState?.state;
          if (state !== 'UNPAIRED' && state !== 'UNPAIRED_IDLE') {
            clearInterval(globalWindow.codeInterval as number);
            return;
          }
        }, intervalMs);
      }

      async function requestCode(utils: PairingCodeUtils, phoneNumber: string, showNotification: boolean, wait: (ms: number) => Promise<unknown>): Promise<string> {
        await wait(Math.random() * 500 + 200);
        if (typeof utils.setPairingType === 'function') {
          utils.setPairingType('ALT_DEVICE_LINKING');
        }
        if (typeof utils.initializeAltDeviceLinking === 'function') {
          await utils.initializeAltDeviceLinking();
        }
        if (typeof utils.startAltLinkingFlow !== 'function') {
          throw new Error('startAltLinkingFlow function missing on PairingCodeLinkUtils');
        }
        return utils.startAltLinkingFlow(phoneNumber, showNotification);
      }

      function isValidCode(code: unknown): code is string {
        return typeof code === 'string' && code.length > 0;
      }

      function formatErrorForResponse(err: unknown, globalWindow: PairingCodeWindow) {
        const typedErr = err as { message?: string; stack?: string; name?: string };
        const raw = typeof err === 'object' && err !== null ? Object.assign({}, err, { message: typedErr?.message, stack: typedErr?.stack }) : err;
        const msg = typedErr?.message || '';
        const isRateLimit = msg.includes('429') || msg.includes('rate-overlimit');
        return {
          ok: false,
          reason: msg || String(err ?? 'unknown'),
          stack: typedErr?.stack,
          state: globalWindow.AuthStore?.AppState?.state,
          hasUtils: Boolean(globalWindow.AuthStore?.PairingCodeLinkUtils),
          isRateLimit,
          rawError: raw,
        };
      }

      const utils = await waitForUtils(globalWindow, wait);
      setupEventHandlers(globalWindow, intervalMs);

      try {
        const firstCode = await requestCode(utils, phoneNumber, showNotification, wait);
        if (isValidCode(firstCode)) {
          return { ok: true, code: firstCode };
        }
        return { ok: false, reason: 'empty_code', state: globalWindow.AuthStore?.AppState?.state };
      } catch (err: unknown) {
        return formatErrorForResponse(err, globalWindow);
      }
    }, phone, true, interval);
  }

  async function waitForUtils(globalWindow: PairingCodeWindow, wait: (ms: number) => Promise<unknown>): Promise<PairingCodeUtils> {
    for (let i = 0; i < 20; i++) {
      if (globalWindow.AuthStore?.PairingCodeLinkUtils) {
        return globalWindow.AuthStore.PairingCodeLinkUtils as PairingCodeUtils;
      }
      await wait(500);
    }
    throw new Error('AuthStore.PairingCodeLinkUtils not found after timeout');
  }

  function setupEventHandlers(globalWindow: PairingCodeWindow, intervalMs: number): void {
    if (typeof globalWindow.onCodeReceivedEvent !== 'function') {
      globalWindow.onCodeReceivedEvent = (codeValue: string) => codeValue;
    }

    if (globalWindow.codeInterval) {
      clearInterval(globalWindow.codeInterval as number);
    }

    // Setup interval for refreshing code if needed
    globalWindow.codeInterval = setInterval(async () => {
      const state = globalWindow.AuthStore?.AppState?.state;
      if (state !== 'UNPAIRED' && state !== 'UNPAIRED_IDLE') {
        clearInterval(globalWindow.codeInterval as number);
        return;
      }
      // Only refresh if we can silently get a new code, otherwise we might trigger rate limits
      // For now, we rely on the orchestrator to manage re-requests
    }, intervalMs);
  }

  async function requestCode(utils: PairingCodeUtils, phoneNumber: string, showNotification: boolean, wait: (ms: number) => Promise<unknown>): Promise<string> {
    // Random small delay before interaction
    await wait(Math.random() * 500 + 200);

    if (typeof utils.setPairingType === 'function') {
      utils.setPairingType('ALT_DEVICE_LINKING');
    }
    if (typeof utils.initializeAltDeviceLinking === 'function') {
      await utils.initializeAltDeviceLinking();
    }

    if (typeof utils.startAltLinkingFlow !== 'function') {
      throw new Error('startAltLinkingFlow function missing on PairingCodeLinkUtils');
    }

    return utils.startAltLinkingFlow(phoneNumber, showNotification);
  }

  function isValidCode(code: unknown): code is string {
    return typeof code === 'string' && code.length > 0;
  }

  interface PairingErrorPayload {
    ok: false;
    reason: string;
    stack?: string;
    state?: string;
    hasUtils: boolean;
    isRateLimit: boolean;
    rawError: unknown;
  }

  function formatErrorForResponse(err: unknown, globalWindow: PairingCodeWindow): PairingErrorPayload {
    const typedErr = err as { message?: string; stack?: string; name?: string };
    const raw =
      typeof err === 'object' && err !== null
        ? Object.assign({}, err, { message: typedErr?.message, stack: typedErr?.stack })
        : err;

    // Detect rate limit errors from WA internal exceptions
    const msg = typedErr?.message || '';
    let isRateLimit = msg.includes('429') || msg.includes('rate-overlimit');

    // Check for structured error objects (e.g., CompanionHelloError with IQErrorRateOverlimit)
    if (!isRateLimit && typeof raw === 'object' && raw !== null) {
      const rawObj = raw as Record<string, unknown>;

      // Check for IQErrorRateOverlimit in type.name
      if (rawObj.type && typeof rawObj.type === 'object') {
        const typeObj = rawObj.type as Record<string, unknown>;
        if (typeObj.name === 'IQErrorRateOverlimit' || String(typeObj.name).includes('RateOverlimit')) {
          isRateLimit = true;
        }
        // Check for code: 429 in type.value
        if (!isRateLimit && typeObj.value && typeof typeObj.value === 'object') {
          const valueObj = typeObj.value as Record<string, unknown>;
          if (valueObj.code === 429 || valueObj.text === 'rate-overlimit') {
            isRateLimit = true;
          }
        }
      }

      // Check for error name containing rate limit indicators
      if (!isRateLimit && rawObj.name && String(rawObj.name).toLowerCase().includes('ratelimit')) {
        isRateLimit = true;
      }
    }

    return {
      ok: false,
      reason: msg || String(err ?? 'unknown'),
      stack: typedErr?.stack,
      state: globalWindow.AuthStore?.AppState?.state,
      hasUtils: Boolean(globalWindow.AuthStore?.PairingCodeLinkUtils),
      isRateLimit,
      rawError: raw,
    };
  }

  function processPairingOutcome(outcome: unknown): string | null {
    if (outcome && typeof outcome === 'object' && 'ok' in outcome) {
      const payload = outcome as { ok?: unknown; code?: unknown; reason?: unknown; isRateLimit?: boolean };
      if (payload.ok === true && typeof payload.code === 'string' && payload.code.length > 0) {
        return payload.code;
      }
      // Propagate rate limit detection to the orchestrator
      if (payload.isRateLimit) {
        throw new Error(`pairing_code_request_failed:rate-overlimit:${JSON.stringify(payload)}`);
      }
      const errPayload = JSON.stringify(payload);
      throw new Error(`pairing_code_request_failed:${errPayload}`);
    }
    return typeof outcome === 'string' ? outcome : null;
  }

  function cancelPairingCodeRefresh() {
    if (pairingCodeExpiryTimer) {
      clearTimeout(pairingCodeExpiryTimer);
      pairingCodeExpiryTimer = null;
    }
  }

  function schedulePairingCodeRefresh(delayMs: number) {
    cancelPairingCodeRefresh();
    const normalized = Math.max(1000, delayMs);
    pairingCodeExpiryTimer = setTimeout(() => {
      pairingCodeExpiryTimer = null;
      if (remoteSessionActive) {
        return;
      }

      // Pause logic: Stop auto-refreshing after N attempts to avoid massive rate limits
      if (consecutiveAutoRefreshes >= MAX_CONSECUTIVE_AUTO_REFRESHES) {
        logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing paused after multiple expired codes. Run "make pair" to generate a new one.');
        if (config.wa.qrTerminal) {
          process.stdout.write('\nPairing paused. Run "make pair" to generate a new code.\n');
        }
        return;
      }

      consecutiveAutoRefreshes++;
      logger.info({ phoneNumber: maskPhone(remotePhone), attempt: consecutiveAutoRefreshes }, 'Previous pairing code expired. Requesting a new one...');
      if (config.wa.qrTerminal) {
        process.stdout.write(`\nPrevious pairing code expired. Requesting a new one (Attempt ${consecutiveAutoRefreshes}/${MAX_CONSECUTIVE_AUTO_REFRESHES})...\n`);
      }
      pairingCodeDelivered = false;
      pairingOrchestrator?.setCodeDelivered(false);
      requestPairingCodeWithRetry(0);
      startPairingFallbackTimer();
    }, normalized);
  }

  const rateLimitDelayMs = Math.max(60000, PAIRING_RETRY_DELAY_MS);
  const isFirstTimeSetup = !remoteSessionActive;

  // Hybrid approach: manual-only for re-pairing, allow automatic for first-time setup ONLY
  // This prevents background rate limiting while allowing smooth initial setup
  const useManualOnlyMode = !isFirstTimeSetup;

  if (shouldAutoStartPairing && remotePhone) {
    // Pre-flight check: warn user if rate limited before attempting
    const rateLimitKey = `wa:pairing:next_attempt:${remotePhone}`;
    const nextAttemptTime = await redis.get(rateLimitKey);
    if (nextAttemptTime) {
      const nextAttempt = new Date(Number(nextAttemptTime));
      const remainingMs = nextAttempt.getTime() - Date.now();
      if (remainingMs > 0) {
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        logger.warn({ 
          phoneNumber: maskPhone(remotePhone), 
          nextAttemptAt: nextAttempt.toISOString(),
          remainingMinutes 
        }, 'Rate limit active: pairing code requests blocked until {{nextAttemptAt}} ({{remainingMinutes}} minutes). Use "!scanner pair-status" to check status.');
        if (config.wa.qrTerminal) {
          process.stdout.write(`\n⚠️  Rate limit active for ${maskPhone(remotePhone)}. Next pairing attempt allowed in ${remainingMinutes} minutes at ${nextAttempt.toLocaleTimeString()}.\n`);
        }
        // Skip orchestrator creation if rate limited
        pairingOrchestrator = null;
      } else {
        // Rate limit expired, clear it and proceed
        await redis.del(rateLimitKey);
        const orchestrator = new PairingOrchestrator({
          enabled: true,
          forcePhonePairing: FORCE_PHONE_PAIRING,
          maxAttempts: MAX_PAIRING_CODE_RETRIES,
          baseRetryDelayMs: PAIRING_RETRY_DELAY_MS,
          rateLimitDelayMs,
          manualOnly: useManualOnlyMode,
          storage: {
            get: async () => {
              if (!remotePhone) return null;
              return redis.get(`wa:pairing:next_attempt:${remotePhone}`);
            },
            set: async (val: string) => {
              if (!remotePhone) return;
              await redis.set(`wa:pairing:next_attempt:${remotePhone}`, val);
            }
          },
          requestCode: async () => {
            const code = await performPairingCodeRequest();
            if (!code || typeof code !== 'string') {
              throw new Error('pairing_code_request_failed:empty');
            }
            return code;
          },
          onSuccess: (code, attempt) => {
            if (remotePhone) {
              cachePairingCode(remotePhone, code).catch(err => {
                logger.warn({ err, phoneNumber: maskPhone(remotePhone!) }, 'Failed to cache pairing code');
              });
              schedulePairingCodeRefresh(PHONE_PAIRING_CODE_TTL_MS);
            }
            const msg = `\n╔${'═'.repeat(50)}╗\n║  WhatsApp Pairing Code: ${code.padEnd(24)} ║\n║  Phone: ${maskPhone(remotePhone).padEnd(37)} ║\n║  Valid for: ~2:40 minutes${' '.repeat(22)} ║\n╚${'═'.repeat(50)}╝\n`;
            process.stdout.write(msg);
            logger.info({ phoneNumber: maskPhone(remotePhone), attempt, code }, 'Phone-number pairing code ready.');
          },
          onError: (err, attempt, nextDelayMs, meta, errorInfo) => {
            if (meta?.rateLimited && errorInfo) {
              const minutes = Math.ceil(nextDelayMs / 60000);
              const nextTime = meta.holdUntil ? new Date(meta.holdUntil).toLocaleTimeString() : 'unknown';
              process.stdout.write(`\n⚠️  WhatsApp rate limit detected. Next retry allowed in ${minutes} minute(s) at ${nextTime}.\n`);
            }

            // Format error for cleaner logging
            const formattedError = err instanceof Error
              ? { name: err.name, message: err.message }
              : errorInfo?.type === 'rate_limit'
                ? { type: 'rate_limit', message: 'WhatsApp API rate limit (429)' }
                : err;

            logger.warn({
              error: formattedError,
              phoneNumber: maskPhone(remotePhone),
              attempt,
              nextRetryMs: nextDelayMs,
              nextRetryAt: meta?.holdUntil ? new Date(meta.holdUntil).toISOString() : undefined,
              rateLimited: meta?.rateLimited ?? false,
              errorType: errorInfo?.type,
            }, 'Failed to request pairing code.');
          },
          onFallback: () => {
            pairingOrchestrator?.setEnabled(false);
            cancelPairingCodeRefresh();
            allowQrOutput = true;
            logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing code retries exhausted; falling back to QR pairing.');
            replayCachedQr();
          },
          onForcedRetry: (err, attempt, nextDelayMs, meta, errorInfo) => {
            const minutes = Math.ceil(nextDelayMs / 60000);
            if (meta?.rateLimited) {
              process.stdout.write(`\n⚠️  Rate limit continues. Waiting ${minutes} minute(s) before retry. Use !scanner pair-status to check.\n`);
            }
            logger.warn({
              err,
              phoneNumber: maskPhone(remotePhone),
              attempt,
              nextRetryMs: nextDelayMs,
              nextRetryAt: meta?.holdUntil ? new Date(meta.holdUntil).toISOString() : undefined,
              rateLimited: meta?.rateLimited ?? false,
              errorType: errorInfo?.type,
            }, 'Pairing retries exhausted; QR fallback disabled.');
          },
        });
        await orchestrator.init();
        pairingOrchestrator = orchestrator;
      }
    } else {
      // No rate limit, create orchestrator normally
      const orchestrator = new PairingOrchestrator({
        enabled: true,
        forcePhonePairing: FORCE_PHONE_PAIRING,
        maxAttempts: MAX_PAIRING_CODE_RETRIES,
        baseRetryDelayMs: PAIRING_RETRY_DELAY_MS,
        rateLimitDelayMs,
        manualOnly: useManualOnlyMode,
        storage: {
          get: async () => {
            if (!remotePhone) return null;
            return redis.get(`wa:pairing:next_attempt:${remotePhone}`);
          },
          set: async (val: string) => {
            if (!remotePhone) return;
            await redis.set(`wa:pairing:next_attempt:${remotePhone}`, val);
          }
        },
        requestCode: async () => {
          const code = await performPairingCodeRequest();
          if (!code || typeof code !== 'string') {
            throw new Error('pairing_code_request_failed:empty');
          }
          return code;
        },
        onSuccess: (code, attempt) => {
          if (remotePhone) {
            cachePairingCode(remotePhone, code).catch(err => {
              logger.warn({ err, phoneNumber: maskPhone(remotePhone!) }, 'Failed to cache pairing code');
            });
            schedulePairingCodeRefresh(PHONE_PAIRING_CODE_TTL_MS);
          }
          const msg = `\n╔${'═'.repeat(50)}╗\n║  WhatsApp Pairing Code: ${code.padEnd(24)} ║\n║  Phone: ${maskPhone(remotePhone).padEnd(37)} ║\n║  Valid for: ~2:40 minutes${' '.repeat(22)} ║\n╚${'═'.repeat(50)}╝\n`;
          process.stdout.write(msg);
          logger.info({ phoneNumber: maskPhone(remotePhone), attempt, code }, 'Phone-number pairing code ready.');
        },
        onError: (err, attempt, nextDelayMs, meta, errorInfo) => {
          if (meta?.rateLimited && errorInfo) {
            const minutes = Math.ceil(nextDelayMs / 60000);
            const nextTime = meta.holdUntil ? new Date(meta.holdUntil).toLocaleTimeString() : 'unknown';
            process.stdout.write(`\n⚠️  WhatsApp rate limit detected. Next retry allowed in ${minutes} minute(s) at ${nextTime}.\n`);
          }

          // Format error for cleaner logging
          const formattedError = err instanceof Error
            ? { name: err.name, message: err.message }
            : errorInfo?.type === 'rate_limit'
              ? { type: 'rate_limit', message: 'WhatsApp API rate limit (429)' }
              : err;

          logger.warn({
            error: formattedError,
            phoneNumber: maskPhone(remotePhone),
            attempt,
            nextRetryMs: nextDelayMs,
            nextRetryAt: meta?.holdUntil ? new Date(meta.holdUntil).toISOString() : undefined,
            rateLimited: meta?.rateLimited ?? false,
            errorType: errorInfo?.type,
          }, 'Failed to request pairing code.');
        },
        onFallback: () => {
          pairingOrchestrator?.setEnabled(false);
          cancelPairingCodeRefresh();
          allowQrOutput = true;
          logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing code retries exhausted; falling back to QR pairing.');
          replayCachedQr();
        },
        onForcedRetry: (err, attempt, nextDelayMs, meta, errorInfo) => {
          const minutes = Math.ceil(nextDelayMs / 60000);
          if (meta?.rateLimited) {
            process.stdout.write(`\n⚠️  Rate limit continues. Waiting ${minutes} minute(s) before retry. Use !scanner pair-status to check.\n`);
          }
          logger.warn({
            err,
            phoneNumber: maskPhone(remotePhone),
            attempt,
            nextRetryMs: nextDelayMs,
            nextRetryAt: meta?.holdUntil ? new Date(meta.holdUntil).toISOString() : undefined,
            rateLimited: meta?.rateLimited ?? false,
            errorType: errorInfo?.type,
          }, 'Pairing retries exhausted; QR fallback disabled.');
        },
      });
      await orchestrator.init();
      pairingOrchestrator = orchestrator;
    }
  } else {
    pairingOrchestrator = null;
  }

  if (pairingOrchestrator) {
    pairingOrchestrator.setSessionActive(remoteSessionActive);
    pairingOrchestrator.setCodeDelivered(false);
    if (isFirstTimeSetup) {
      logger.info({ phoneNumber: maskPhone(remotePhone) }, 'First-time setup detected: automatic pairing enabled for initial connection.');
    } else {
      logger.info({ phoneNumber: maskPhone(remotePhone) }, 'Re-pairing mode: use !scanner pair command to request pairing codes manually.');
    }
  }

  const clearPairingRetry = () => {
    pairingOrchestrator?.cancel();
    cancelPairingCodeRefresh();
  };

  const requestPairingCodeWithRetry = (delayMs = 0) => {
    if (!remotePhone || pairingCodeDelivered || remoteSessionActive) return;
    const now = Date.now();
    let effectiveDelay = Math.max(0, delayMs);
    if (lastPairingAttemptMs > 0) {
      const sinceLast = now - lastPairingAttemptMs;
      if (sinceLast < rateLimitDelayMs) {
        effectiveDelay = Math.max(effectiveDelay, rateLimitDelayMs - sinceLast);
      }
    }
    pairingOrchestrator?.schedule(effectiveDelay);
  };

  if (remotePhone) {
    const [cachedPairingCode, recordedAttempt] = await Promise.all([
      getCachedPairingCode(remotePhone),
      getLastPairingAttempt(remotePhone),
    ]);
    if (typeof recordedAttempt === 'number') {
      lastPairingAttemptMs = recordedAttempt;
    }
    if (cachedPairingCode) {
      const ageMs = Date.now() - cachedPairingCode.storedAt;
      const remainingMs = PHONE_PAIRING_CODE_TTL_MS - ageMs;
      if (remainingMs > 1000) {
        pairingCodeDelivered = true;
        if (pairingOrchestrator) {
          pairingOrchestrator.setCodeDelivered(true);
        }
        schedulePairingCodeRefresh(remainingMs);
        logger.info({ pairingCode: cachedPairingCode.code, phoneNumber: maskPhone(remotePhone), remainingMs }, 'Reusing cached phone-number pairing code still within validity window.');
        if (config.wa.qrTerminal) {
          process.stdout.write(`\nWhatsApp pairing code for ${maskPhone(remotePhone)}: ${cachedPairingCode.code}\nOpen WhatsApp > Linked devices > Link with phone number and enter this code.\n`);
        }
      }
    }
  }
  const cancelPairingFallback = () => {
    if (pairingFallbackTimer) {
      clearTimeout(pairingFallbackTimer);
      pairingFallbackTimer = null;
    }
  };

  function startPairingFallbackTimer() {
    if (pairingFallbackTimer || !pairingOrchestrator || !remotePhone || pairingCodeDelivered || remoteSessionActive) {
      return;
    }
    pairingFallbackTimer = setTimeout(() => {
      pairingFallbackTimer = null;
      if (!pairingCodeDelivered && !remoteSessionActive) {
        metrics.waSessionReconnects.labels('pairing_code_timeout').inc();
        if (FORCE_PHONE_PAIRING) {
          if (consecutiveAutoRefreshes >= MAX_CONSECUTIVE_AUTO_REFRESHES) {
            logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing paused after multiple timeouts to prevent rate limits. Run "!scanner pair" to resume.');
            if (config.wa.qrTerminal) {
              process.stdout.write(`\n⚠️  Pairing paused after multiple timeouts. Run "!scanner pair" to resume.\n`);
            }
            return;
          }
          logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing code not received within timeout; QR fallback disabled. Ensure WhatsApp is open to Linked Devices > Link with phone number.');
          requestPairingCodeWithRetry(Math.max(PAIRING_RETRY_DELAY_MS, 60000));
          startPairingFallbackTimer();
        } else {
          allowQrOutput = true;
          logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing code not received within timeout; enabling QR fallback.');
          clearPairingRetry();
          if (!pairingOrchestrator) return;
          pairingOrchestrator.setEnabled(false);
          replayCachedQr();
        }
      }
    }, pairingTimeoutMs);
  }

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

  client.on('qr', async (qr: string) => {
    cachedQr = qr;

    // Self-healing: If we receive a QR code but we expect a RemoteAuth session to be active,
    // it means the session is invalid. We should clear it and restart.
    if (FORCE_PHONE_PAIRING && remoteSessionActive) {
      logger.warn('Received QR code while expecting active RemoteAuth session. Session is invalid/expired.');
      await sessionManager.clearSession('QR received while RemoteAuth session expected');
      logger.info('Exiting process to trigger restart and re-pairing...');
      process.exit(1);
    }

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
      consecutiveAutoRefreshes = 0;
      cancelPairingFallback();
      clearPairingRetry();
      pairingOrchestrator?.setSessionActive(true);
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'RemoteAuth session synchronized');
    });
    if (remotePhone) {
      client.on('code', code => {
        pairingCodeDelivered = true;
        cancelPairingFallback();
        clearPairingRetry();
        pairingOrchestrator?.setCodeDelivered(true);
        if (remotePhone) {
          cachePairingCode(remotePhone, code).catch(err => {
            logger.warn({ err, phoneNumber: maskPhone(remotePhone!) }, 'Failed to cache pairing code');
          });
        }
        schedulePairingCodeRefresh(PHONE_PAIRING_CODE_TTL_MS);
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

  // Track if ready event has fired to prevent duplicate handling
  let readyEventFired = false;
  let readyFallbackTimer: NodeJS.Timeout | null = null;

  // Helper function to execute ready logic (used by both event and fallback)
  const executeReadyLogic = async (source: string) => {
    if (readyEventFired) {
      logger.debug({ source }, 'Ready logic already executed, skipping');
      return;
    }
    readyEventFired = true;
    if (readyFallbackTimer) {
      clearInterval(readyFallbackTimer);
      readyFallbackTimer = null;
    }
    logger.info({ source }, 'WhatsApp client ready');
    cancelPairingFallback();
    clearPairingRetry();
    waSessionStatusGauge.labels('ready').set(1);
    waSessionStatusGauge.labels('disconnected').set(0);
    metrics.waSessionReconnects.labels('ready').inc();
    updateSessionStateGauge('ready');
    botWid = client.info?.wid?._serialized || null;
    logger.info({ botWid, source }, 'Bot WID assigned, now listening for messages');
    try {
      await rehydrateAckWatchers(client);
    } catch (err) {
      logger.warn({ err }, 'Failed to rehydrate ack watchers on ready');
    }
  };

  client.on('authenticated', () => {
    logger.info('WhatsApp client authenticated - session received from WhatsApp');
    metrics.waSessionReconnects.labels('authenticated').inc();
    cancelPairingFallback();
    clearPairingRetry();
    pairingOrchestrator?.setSessionActive(true);

    // WORKAROUND: whatsapp-web.js may not fire 'ready' event when using phone pairing
    // The 'ready' event is emitted inside onAppStateHasSyncedEvent after:
    // 1. window.Store is injected
    // 2. client.info is created from window.Store.Conn
    // 3. Event listeners are attached
    // 
    // When hasSynced doesn't fire, we need to:
    // 1. Check if window.Store is available via Puppeteer
    // 2. Manually get the user info and trigger ready
    let pollCount = 0;
    const maxPolls = 90; // 90 * 2s = 180 seconds max wait
    const initialDelay = 5000; // Wait 5s before first poll (allows for Store injection)
    
    setTimeout(() => {
      readyFallbackTimer = setInterval(async () => {
        pollCount++;
        if (readyEventFired) {
          if (readyFallbackTimer) {
            clearInterval(readyFallbackTimer);
            readyFallbackTimer = null;
          }
          return;
        }
        
        try {
          // Primary check: client.info.wid is populated (created from window.Store.Conn)
          if (client.info?.wid) {
            logger.info({ pollCount, botWid: client.info.wid._serialized }, 'Detected client.info.wid populated - triggering ready fallback');
            await executeReadyLogic('authenticated-fallback-info');
            return;
          }
          
          // Secondary check: Use Puppeteer to check if window.Store is available
          // and manually trigger the ready state if the library failed to do so
          // Access pupPage directly with a simple evaluate signature
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pupPage = (client as any).pupPage as { evaluate: (fn: () => unknown) => Promise<unknown> } | undefined;
          if (pupPage && pollCount >= 10) { // Wait at least 20 seconds before trying Puppeteer fallback
            try {
              const storeInfo = await pupPage.evaluate(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const win = window as any;
                
                // Check if Store is available and has the required data
                if (typeof win.Store === 'undefined') {
                  return { hasStore: false, hasUser: false, hasWid: false, wid: null };
                }
                
                // Check if we have user info
                const user = win.Store?.User;
                const conn = win.Store?.Conn;
                if (!user || !conn) {
                  return { hasStore: true, hasUser: false, hasWid: false, wid: null };
                }
                
                // Try to get the user's WID
                const wid = user.getMaybeMePnUser?.() || user.getMaybeMeLidUser?.() || user.getMeUser?.();
                if (!wid) {
                  return { hasStore: true, hasUser: true, hasWid: false, wid: null };
                }
                
                // Return the serialized WID
                return {
                  hasStore: true,
                  hasUser: true,
                  hasWid: true,
                  wid: typeof wid.toJid === 'function' ? wid.toJid() : (wid._serialized || String(wid)),
                  pushname: conn.pushname || null,
                  platform: conn.platform || null,
                };
              }) as { hasStore: boolean; hasUser: boolean; hasWid: boolean; wid: string | null; pushname?: string | null; platform?: string | null };
              
              if (storeInfo.hasWid && storeInfo.wid) {
                logger.info({ pollCount, storeInfo }, 'Puppeteer fallback: Detected window.Store with user info - triggering ready');
                
                // The library didn't set client.info, but we have the data
                // We can still trigger ready and the bot will work for message handling
                // Note: Some client.info methods may not work, but basic functionality will
                await executeReadyLogic('puppeteer-store-fallback');
                return;
              } else if (pollCount % 10 === 0) {
                logger.debug({ pollCount, storeInfo }, 'Puppeteer fallback: Store state check');
              }
            } catch (evalErr) {
              // Puppeteer evaluation can fail during page transitions
              if (pollCount % 15 === 0) {
                logger.debug({ err: evalErr instanceof Error ? evalErr.message : evalErr, pollCount }, 'Puppeteer fallback evaluation error');
              }
            }
          }
          
          // Tertiary check: getState() returns CONNECTED
          const state = await client.getState().catch(() => null);
          
          if (pollCount >= maxPolls) {
            logger.error({ pollCount, hasInfo: !!client.info, state }, 'Ready event fallback: Max polls reached without detecting ready state');
            if (readyFallbackTimer) {
              clearInterval(readyFallbackTimer);
              readyFallbackTimer = null;
            }
          } else if (pollCount % 15 === 0) {
            logger.info({ pollCount, hasInfo: !!client.info, state }, 'Ready fallback: Still waiting for client.info to be populated');
          }
        } catch (err) {
          if (pollCount % 15 === 0) {
            logger.debug({ err: err instanceof Error ? err.message : err, pollCount }, 'Ready fallback poll error (may be normal during init)');
          }
        }
      }, 2000);
    }, initialDelay);
  });

  client.on('ready', async () => {
    await executeReadyLogic('ready-event');
  });
  client.on('auth_failure', async (m) => {
    logger.error({ m }, 'Auth failure');
    waSessionStatusGauge.labels('ready').set(0);
    metrics.waSessionReconnects.labels('auth_failure').inc();
    botWid = null;

    // Self-healing: If auto-pair is enabled, clear the invalid session and restart
    if (config.wa.remoteAuth.autoPair) {
      logger.warn('Auth failure detected with auto-pair enabled. Clearing session and restarting...');
      await sessionManager.clearSession('Auth failure event received');
      process.exit(1);
    }
  });
  client.on('change_state', (state) => {
    const label = typeof state === 'string' ? state.toLowerCase() : 'unknown';
    metrics.waSessionReconnects.labels(`state_${label}`).inc();
    updateSessionStateGauge(String(state));
    logger.info({ state, timestamp: Date.now() }, 'WhatsApp client state change');
  });

  client.on('loading_screen', (percent: number, message: string) => {
    logger.info({ percent, message }, 'WhatsApp loading screen progress');
  });

  client.on('disconnected', (r) => {
    logger.warn({ r }, 'Disconnected');
    cancelPairingFallback();
    waSessionStatusGauge.labels('ready').set(0);
    waSessionStatusGauge.labels('disconnected').set(1);
    metrics.waSessionReconnects.labels('disconnected').inc();
    updateSessionStateGauge('disconnected');
    botWid = null;
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
        await handleAdminCommand(client, msg, chat as GroupChat, redis);
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
        const payload = {
          chatId,
          messageId,
          senderIdHash: senderHash,
          url: norm,
          timestamp: Date.now()
        };
        const validationResult = ScanRequestSchema.safeParse(payload);
        if (!validationResult.success) {
          metrics.inputValidationFailures.labels('wa-client', 'ScanRequest').inc();
          logger.warn({
            errors: validationResult.error.issues,
            payload,
            chatId,
            messageId,
          }, 'ScanRequest validation failed in message handler');
          continue; // Skip this URL
        }
        await scanRequestQueue.add('scan', validationResult.data, jobOpts);
      }
      await messageStore.recordMessageCreate({
        ...baseRecord,
        normalizedUrls,
        urlHashes,
      });
    } catch (e) {
      logger.error({ err: e, chatId: sanitizeLogValue((msg as unknown as { from?: string })?.from) }, 'Failed to process incoming WhatsApp message');
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
        const payload = {
          chatId,
          messageId,
          senderIdHash: senderHash,
          url: norm,
          timestamp: Date.now(),
        };
        const validated = ScanRequestSchema.parse(payload);
        await scanRequestQueue.add('scan', validated, jobOpts);
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
    const snapshot = snapshotSession();
    if (!isSessionReady(snapshot)) {
      logger.debug({ messageId: msg.id?._serialized, session: describeSession(snapshot) }, 'Skipping group revoke handler because session is not ready');
      return;
    }
    try {
      const original = revoked ?? msg;
      const chat = await original.getChat().catch((err) => {
        const fallbackChat = (original.id as unknown as { remote?: string })?.remote ?? undefined;
        throw enrichEvaluationError(err, {
          operation: 'message_revoke_everyone:getChat',
          chatId: fallbackChat,
          messageId: original.id?._serialized,
          snapshot,
        });
      });
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
    const snapshot = snapshotSession();
    try {
      await handleSelfMessageRevoke(msg, {
        snapshot,
        logger,
        messageStore,
        recordMetric: () => metrics.waMessageRevocations.labels('me').inc(),
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to record self message revoke');
    }
  });

  client.on('message_reaction', async (reaction: Reaction) => {
    try {
      const messageId = (reaction.msgId as unknown as { _serialized?: string })?._serialized || reaction.msgId?.id;
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
        await chat.sendMessage(lines.join(' '), { mentions: recipients.map(c => c.id?._serialized).filter((id): id is string => !!id) } as any);
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

  await initializeWhatsAppWithRetry(client);

  if (pairingOrchestrator && !pairingCodeDelivered && (FORCE_PHONE_PAIRING || !useManualOnlyMode)) {
    const configuredDelay = config.wa.remoteAuth.pairingDelayMs && config.wa.remoteAuth.pairingDelayMs > 0
      ? config.wa.remoteAuth.pairingDelayMs
      : 5000;
    const initialDelay = Math.max(rateLimitDelayMs, configuredDelay);
    requestPairingCodeWithRetry(initialDelay);
  }
  startPairingFallbackTimer();

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ host: '0.0.0.0', port });
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
  const reasonsStr = reasons.slice(0, 3).join('; ');
  return `Link scan: ${level}\nDomain: ${domain}\n${advice}${reasonsStr ? `\nWhy: ${reasonsStr}` : ''}`;
}

interface AdminCommandContext {
  client: Client;
  msg: Message;
  chat: GroupChat;
  redis: Redis;
  senderId: string | undefined;
  parts: string[];
  authHeaders: { authorization: string; 'x-csrf-token': string };
  base: string;
  pairingOrchestrator: PairingOrchestrator | null;
  remotePhone: string | undefined;
  sender: GroupParticipant | undefined;
  isSelfCommand: boolean;
}

const adminCommandHandlers: Record<string, (ctx: AdminCommandContext) => Promise<void>> = {
  mute: async ({ chat, base, authHeaders }) => {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chat.id._serialized)}/mute`, { method: 'POST', headers: authHeaders }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner muted for 60 minutes.' : 'Mute failed.');
  },
  unmute: async ({ chat, base, authHeaders }) => {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chat.id._serialized)}/unmute`, { method: 'POST', headers: authHeaders }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner unmuted.' : 'Unmute failed.');
  },
  status: async ({ chat, base, authHeaders }) => {
    try {
      const resp = await fetch(`${base}/status`, { headers: { authorization: authHeaders.authorization } });
      if (!resp.ok) {
        logger.warn({ status: resp.status, chatId: chat.id._serialized }, 'Status command fetch failed');
        await chat.sendMessage('Scanner status temporarily unavailable.');
        return;
      }
      const json = (await resp.json().catch(() => ({}))) as { scans?: number; malicious?: number };
      await chat.sendMessage(`Scanner status: scans=${json.scans ?? 0}, malicious=${json.malicious ?? 0}`);
    } catch (err) {
      logger.warn({ err, chatId: chat.id._serialized }, 'Failed to handle status command');
      await chat.sendMessage('Scanner status temporarily unavailable.');
    }
  },
  rescan: async ({ chat, parts, base, authHeaders }) => {
    if (!parts[2]) return;
    const rescanUrl = parts[2];
    const resp = await fetch(`${base}/rescan`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    if (resp && resp.ok) {
      const data = (await resp.json().catch(() => null)) as { ok?: boolean; urlHash?: string; jobId?: string } | null;
      if (data?.ok && data.urlHash && data.jobId) {
        await chat.sendMessage(`Rescan queued. hash=${data.urlHash} job=${data.jobId}`);
      } else {
        await chat.sendMessage('Rescan queued, awaiting confirmation.');
      }
    } else {
      await chat.sendMessage('Rescan failed.');
    }
  },
  consent: async ({ chat, msg }) => {
    if (!config.wa.consentOnJoin) {
      await chat.sendMessage('Consent enforcement is currently disabled.');
      return;
    }
    await markConsentGranted(chat.id._serialized);
    await chat.setMessagesAdminsOnly(false).catch(() => undefined);
    await chat.sendMessage('Consent recorded. Automated scanning enabled for this group.');
    metrics.waGroupEvents.labels('consent_granted').inc();
    await groupStore.recordEvent({
      chatId: chat.id._serialized,
      type: 'consent_granted',
      timestamp: Date.now(),
      actorId: msg.author || msg.from,
      metadata: { source: 'command' },
    });
  },
  consentstatus: async ({ chat }) => {
    const status = await getConsentStatus(chat.id._serialized) ?? 'none';
    await chat.sendMessage(`Consent status: ${status}`);
  },
  approve: async ({ client, chat, parts, msg }) => {
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
      await chat.sendMessage(`Unable to approve ${target}.`);
    }
  },
  governance: async ({ chat, parts }) => {
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
  },
  pair: async ({ chat, senderId, pairingOrchestrator }) => {
    if (!pairingOrchestrator) {
      await chat.sendMessage('Pairing orchestrator not available (phone pairing may be disabled).');
      return;
    }
    const status = pairingOrchestrator.getStatus();
    if (status.rateLimited && status.nextAttemptIn > 0) {
      const minutes = Math.ceil(status.nextAttemptIn / 60000);
      const seconds = Math.ceil((status.nextAttemptIn % 60000) / 1000);
      await chat.sendMessage(`⚠️ Rate limited. Please wait ${minutes}m ${seconds}s before requesting another code.`);
      return;
    }
    if (!status.canRequest) {
      await chat.sendMessage('Cannot request pairing code at this time (session may already be active).');
      return;
    }
    const requested = pairingOrchestrator.requestManually();
    if (requested) {
      await chat.sendMessage('Pairing code request sent. Check logs/terminal for the code.');
      logger.info({ chatId: chat.id._serialized, senderId }, 'Manual pairing code requested via admin command');
    } else {
      await chat.sendMessage('Unable to request pairing code. Check status with !scanner pair-status.');
    }
  },
  'pair-status': async ({ chat, pairingOrchestrator }) => {
    if (!pairingOrchestrator) {
      await chat.sendMessage('Pairing orchestrator not available.');
      return;
    }
    const status = pairingOrchestrator.getStatus();
    if (status.canRequest) {
      await chat.sendMessage('✅ Ready to request pairing code. Use !scanner pair');
    } else if (status.rateLimited && status.nextAttemptIn > 0) {
      const minutes = Math.ceil(status.nextAttemptIn / 60000);
      const seconds = Math.ceil((status.nextAttemptIn % 60000) / 1000);
      const lastAttempt = status.lastAttemptAt ? new Date(status.lastAttemptAt).toLocaleTimeString() : 'unknown';
      await chat.sendMessage(`⚠️ Rate limited\nLast attempt: ${lastAttempt}\nRetry in: ${minutes}m ${seconds}s\nConsecutive rate limits: ${status.consecutiveRateLimits}`);
    } else {
      await chat.sendMessage(`Status: Session may already be active or code delivered.`);
    }
  },
  'pair-reset': async ({ chat, senderId, remotePhone, redis, sender, isSelfCommand }) => {
    if (!sender?.isAdmin && !sender?.isSuperAdmin && !isSelfCommand) {
      await chat.sendMessage('Only admins can use this command.');
      return;
    }
    if (remotePhone) {
      const cacheKey = pairingCodeCacheKey(remotePhone);
      await redis.del(cacheKey);
      await chat.sendMessage('Pairing code cache cleared.');
      logger.info({ chatId: chat.id._serialized, senderId }, 'Pairing cache cleared via admin command');
    } else {
      await chat.sendMessage('No phone number configured for remote auth.');
    }
  },
};

export async function handleAdminCommand(client: Client, msg: Message, existingChat: GroupChat | undefined, redis: Redis) {
  const chat = existingChat ?? (await msg.getChat());
  if (!(chat as GroupChat).isGroup) return;
  const gc = chat as GroupChat;
  const participants = await hydrateParticipantList(gc);
  const senderId = msg.author || (msg.fromMe && botWid ? botWid : undefined);
  const senderVariants = expandWidVariants(senderId);
  const isSelfCommand = msg.fromMe || (botWid !== null && senderVariants.includes(botWid));
  const parts = (msg.body || '').trim().split(/\s+/);
  logger.info({ chatId: gc.id._serialized, senderId, senderVariants, isSelfCommand, participantCount: participants.length, command: parts[1] ?? null }, 'Received admin command');

  // Resolve contact to handle LID vs PN mismatch
  const contact = await msg.getContact();
  const contactId = contact.id._serialized;

  // Try to find sender by contact ID first, then by variants
  let sender = participants.find(p => p.id._serialized === contactId);
  if (!sender) {
    sender = participants.find(p => senderVariants.includes(p.id._serialized));
  }

  if (!isSelfCommand && !sender?.isAdmin && !sender?.isSuperAdmin) {
    logger.info({ chatId: gc.id._serialized, senderId, contactId }, 'Ignoring command from non-admin sender');
    return;
  }

  const cmd = parts[1];
  if (!cmd) return;

  const handler = adminCommandHandlers[cmd];
  if (handler) {
    const base = resolveControlPlaneBase();
    const token = assertControlPlaneToken();
    const csrfToken = config.controlPlane.csrfToken;
    const authHeaders = {
      authorization: `Bearer ${token}`,
      'x-csrf-token': csrfToken,
    };

    await handler({
      client,
      msg,
      chat: gc,
      redis,
      senderId,
      parts,
      authHeaders,
      base,
      pairingOrchestrator,
      remotePhone,
      sender,
      isSelfCommand,
    });
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status|rescan <url>|consent|consentstatus|approve [memberId]|governance [limit]|pair|pair-status|pair-reset');
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error({ err }, 'Fatal in wa-client');
    process.exit(1);
  });
}
