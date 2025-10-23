import Fastify from 'fastify';
import { Client, LocalAuth, RemoteAuth, Message, GroupChat, Reaction, GroupNotification, MessageMedia, Call, Chat } from 'whatsapp-web.js';
import QRCode from 'qrcode-terminal';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { config, logger, extractUrls, normalizeUrl, urlHash, metrics, register, assertControlPlaneToken, waSessionStatusGauge } from '@wbscanner/shared';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { loadEncryptionMaterials } from './crypto/dataKeyProvider';
import { createRemoteAuthStore } from './remoteAuthStore';
import { publishWaHealth, incrementAuthFailure, resetAuthFailures, type WaHealthContext, type WaHealthEvent } from './waHealth';
import { createAsyncDebouncer } from './utils/debounce';
import { sendAuthFailureAlert } from './alerts';
import { ensureMessageState, updateMessageBody, markMessageRevoked, recordReaction, recordVerdictAssociation, clearVerdictAssociation, getMessageState, recordMessageAck, upsertMessageMetadata, recordMediaUpload, appendMessageEdit } from './state/messageStore';
import { getGroupConsent, setGroupConsent, getAutoApprove, setAutoApprove, recordGovernanceAction, appendGovernanceLog, recordInviteRotation, getLastInviteRotation } from './groupGovernance';
import { storePendingVerdict, clearPendingVerdict, loadPendingVerdict, restorePendingVerdicts, triggerVerdictRetry, type PendingVerdictRecord } from './verdictTracker';
import { rememberChat, updateChatCursor, listKnownChats, syncChatHistory } from './utils/historySync';
import { buildVerdictMedia } from './media';

// BullMQ requires maxRetriesPerRequest to be null to support blocking commands.
const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} as const;

const redis = new Redis(config.redisUrl, redisOptions);
const scanRequestQueue = new Queue(config.queues.scanRequest, { connection: redis });
const waHealthQueue = new Queue(config.queues.waHealth, { connection: redis });
const waClientId = config.wa.remoteAuth.clientId || 'default';

const globalLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate',
  points: config.wa.globalRatePerHour,
  duration: 3600,
});
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
  keyPrefix: 'group_govern',
  points: config.wa.governanceActionsPerHour,
  duration: 3600,
});
const membershipApprovalLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_membership',
  points: config.wa.autoApproveRatePerHour,
  duration: 3600,
});
const processedKey = (chatId: string, messageId: string, urlH: string) => `processed:${chatId}:${messageId}:${urlH}`;

function validateStartupConfig() {
  const required = ['VT_API_KEY', 'GSB_API_KEY', 'REDIS_URL', 'POSTGRES_HOST'];
  const missing = required.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
  if (missing.length > 0) {
    logger.error({ missing }, 'Missing required environment variables for wa-client');
    process.exit(1);
  }
}

async function buildAuthStrategy(): Promise<LocalAuth | RemoteAuth> {
  if (config.wa.authStrategy === 'remote') {
    if (config.wa.remoteAuth.store !== 'redis') {
      throw new Error(`Unsupported WA remote auth store: ${config.wa.remoteAuth.store}`);
    }
    const materials = await loadEncryptionMaterials({
      store: config.wa.remoteAuth.store,
      clientId: waClientId,
      kmsKeyId: config.wa.remoteAuth.kmsKeyId,
      encryptedDataKey: config.wa.remoteAuth.encryptedDataKey,
      dataKey: config.wa.remoteAuth.dataKey,
      vaultTransitPath: config.wa.remoteAuth.vaultTransitPath,
      vaultToken: config.wa.remoteAuth.vaultToken,
      vaultAddress: config.wa.remoteAuth.vaultAddress,
    }, logger);
    const store = createRemoteAuthStore({
      redis,
      logger,
      prefix: `remoteauth:v1:${waClientId}`,
      materials,
      clientId: waClientId,
    });
    logger.info({ clientId: waClientId }, 'Using RemoteAuth strategy for wa-client');
    return new RemoteAuth({
      clientId: waClientId,
      store,
      backupSyncIntervalMs: config.wa.remoteAuth.backupIntervalMs,
      dataPath: config.wa.remoteAuth.dataPath,
    });
  }
  logger.info('Using LocalAuth strategy for wa-client');
  return new LocalAuth({ dataPath: './data/session' });
}

async function main() {
  validateStartupConfig();
  assertControlPlaneToken();

  const app = Fastify();
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  const authStrategy = await buildAuthStrategy();

  const client = new Client({
    puppeteer: {
      headless: config.wa.headless,
      args: config.wa.puppeteerArgs,
    },
    authStrategy
  });

  const waHealthContext: WaHealthContext = {
    queue: waHealthQueue,
    redis,
    clientId: waClientId,
    logger,
    alertThreshold: config.wa.remoteAuth.alertThreshold,
    alertCooldownSeconds: config.wa.remoteAuth.alertCooldownSeconds,
    failureWindowSeconds: config.wa.remoteAuth.failureWindowSeconds,
  };
  const resetDebounce = createAsyncDebouncer(config.wa.remoteAuth.resetDebounceSeconds * 1000);
  waSessionStatusGauge.labels('ready').set(0);

  const emitHealth = (payload: WaHealthEvent) => {
    publishWaHealth(waHealthContext, payload).catch((err) => {
      logger.warn({ err, payload }, 'Failed to publish WhatsApp health event');
    });
  };

  let statePoller: NodeJS.Timeout | null = null;
  const startStatePoller = () => {
    if (statePoller) return;
    statePoller = setInterval(async () => {
      try {
        const [state, version] = await Promise.all([
          client.getState().catch(() => null),
          client.getWWebVersion().catch(() => null),
        ]);
        emitHealth({ event: 'state_poll', state: state ?? undefined, version: version ?? undefined, details: { polledAt: Date.now() } });
      } catch (err) {
        logger.debug({ err }, 'State poll failed');
      }
    }, 60_000);
  };

  const stopStatePoller = () => {
    if (statePoller) {
      clearInterval(statePoller);
      statePoller = null;
    }
  };

  let historySyncTimer: NodeJS.Timeout | null = null;
  const historySyncIntervalMs = 5 * 60 * 1000;

  const runHistorySync = async () => {
    const chatIds = await listKnownChats(redis);
    if (chatIds.length === 0) return;
    for (const chatId of chatIds) {
      try {
        const processed = await syncChatHistory({
          client,
          redis,
          logger,
          chatId,
          onMessage: processHistoricalMessage,
        });
        if (processed > 0) {
          logger.info({ chatId, processed }, 'Replayed historical messages after reconnect');
        }
      } catch (err) {
        logger.error({ err, chatId }, 'Failed to sync chat history');
      }
    }
  };

  const startHistorySync = () => {
    if (historySyncTimer) return;
    historySyncTimer = setInterval(() => {
      runHistorySync().catch((err) => logger.error({ err }, 'History sync tick failed'));
    }, historySyncIntervalMs);
    void runHistorySync();
  };

  const stopHistorySync = () => {
    if (historySyncTimer) {
      clearInterval(historySyncTimer);
      historySyncTimer = null;
    }
  };

  type VerdictJobPayload = {
    chatId: string;
    messageId: string;
    verdict: string;
    reasons: string[];
    url: string;
    urlHash: string;
    normalizedUrl?: string;
    artifacts?: { screenshotPath?: string | null; badgePath?: string | null };
    urlscan?: { screenshotPath?: string | null; artifactPath?: string | null };
    [key: string]: unknown;
  };

  const queueUrlsForMessage = async (msg: Message, chat: GroupChat, options: { forceRescan?: boolean; bodyOverride?: string } = {}) => {
    const body = options.bodyOverride ?? msg.body ?? '';
    const urls = extractUrls(body);
    metrics.ingestionRate.inc();
    metrics.urlsPerMessage.observe(urls.length);
    if (urls.length === 0) return;

    for (const raw of urls) {
      const norm = normalizeUrl(raw);
      if (!norm) continue;
      const h = urlHash(norm);
      const messageKey = msg.id._serialized;
      const idem = processedKey(chat.id._serialized, messageKey, h);
      if (options.forceRescan) {
        await redis.del(idem);
        await redis.set(idem, '1', 'EX', 60 * 60 * 24 * 7);
      } else {
        const already = await redis.set(idem, '1', 'EX', 60 * 60 * 24 * 7, 'NX');
        if (already === null) continue;
      }

      try { await globalLimiter.consume('global'); } catch { continue; }

      const jobOpts: JobsOptions = { removeOnComplete: true, removeOnFail: 1000, attempts: 2, backoff: { type: 'exponential', delay: 1000 } };
      await scanRequestQueue.add('scan', {
        chatId: chat.id._serialized,
        messageId: messageKey,
        senderIdHash: sha256(msg.author || msg.from || chat.id._serialized),
        url: norm,
        timestamp: Date.now(),
        origin: options.forceRescan ? 'edit' : 'new'
      }, jobOpts);
    }
  };

  const collectMessageMetadata = async (msg: Message) => {
    const mentionedIds = Array.isArray(msg.mentionedIds) ? msg.mentionedIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : undefined;
    const groupMentionsRaw = (msg as unknown as { groupMentions?: Array<{ groupJid?: { _serialized?: string } } | string> }).groupMentions;
    const groupMentions = Array.isArray(groupMentionsRaw)
      ? groupMentionsRaw
          .map((entry) => {
            if (typeof entry === 'string') return entry;
            if (entry && typeof entry === 'object') {
              const maybeJid = (entry as { groupJid?: { _serialized?: string } }).groupJid;
              if (maybeJid && typeof maybeJid._serialized === 'string') return maybeJid._serialized;
            }
            return undefined;
          })
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      : undefined;

    let quotedMessageId: string | undefined;
    if (msg.hasQuotedMsg) {
      try {
        const quoted = await msg.getQuotedMessage();
        if (quoted?.id?._serialized) {
          quotedMessageId = quoted.id._serialized;
        }
      } catch {
        quotedMessageId = undefined;
      }
    }

    const forwardingScore = typeof msg.forwardingScore === 'number' ? msg.forwardingScore : undefined;
    const viewOnce = (msg as unknown as { isViewOnce?: boolean }).isViewOnce === true;
    const ephemeral = (msg as unknown as { isEphemeral?: boolean }).isEphemeral === true;

    return { mentionedIds, groupMentions, quotedMessageId, forwardingScore, viewOnce, ephemeral };
  };

  const normalizeJid = (raw: unknown): string | null => {
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && '_serialized' in (raw as Record<string, unknown>)) {
      const serialized = (raw as { _serialized?: unknown })._serialized;
      if (typeof serialized === 'string') return serialized;
    }
    return null;
  };

  const withGovernanceBudget = async (chatId: string, reason: string, handler: () => Promise<void>, detail?: string): Promise<boolean> => {
    try {
      await governanceLimiter.consume(chatId);
    } catch {
      await appendGovernanceLog(redis, chatId, { action: 'governance_skipped', reason: `${reason}:rate_limited`, detail });
      return false;
    }
    try {
      await handler();
      await recordGovernanceAction(redis, chatId, 3600);
      await appendGovernanceLog(redis, chatId, { action: 'governance_enforced', reason, detail });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown-error';
      await appendGovernanceLog(redis, chatId, { action: 'governance_failed', reason, detail: message });
      logger.warn({ err, chatId, reason }, 'Governance enforcement failed');
      return false;
    }
  };

  const applyAdminsOnlyGuard = async (groupChat: GroupChat, chatId: string, reason: string) => {
    await withGovernanceBudget(chatId, reason, async () => {
      await groupChat.setMessagesAdminsOnly(true);
    }, 'set_admins_only');
  };

  const rotateInviteLinkSafely = async (groupChat: GroupChat, chatId: string, reason: string) => {
    const lastRotation = await getLastInviteRotation(redis, chatId);
    if (lastRotation && Date.now() - lastRotation < 5 * 60 * 1000) {
      await appendGovernanceLog(redis, chatId, { action: 'invite_rotation_skipped', reason, detail: 'cooldown_active' });
      return;
    }
    const rotated = await withGovernanceBudget(chatId, reason, async () => {
      await groupChat.revokeInvite();
      await recordInviteRotation(redis, chatId);
    }, 'rotate_invite');
    if (rotated) {
      logger.info({ chatId }, 'Rotated group invite link');
    }
  };

  const processHistoricalMessage = async (msg: Message, chat: GroupChat) => {
    const chatId = chat.id._serialized;
    await rememberChat(redis, chatId);
    const metadata = await collectMessageMetadata(msg);
    await ensureMessageState(redis, {
      chatId,
      messageId: msg.id._serialized,
      from: msg.author || msg.from,
      body: msg.body || '',
      timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
      mentionedIds: metadata.mentionedIds,
      groupMentions: metadata.groupMentions,
      quotedMessageId: metadata.quotedMessageId,
      forwardingScore: metadata.forwardingScore,
      viewOnce: metadata.viewOnce,
      ephemeral: metadata.ephemeral,
    });
    if (metadata.mentionedIds?.length || metadata.groupMentions?.length || metadata.quotedMessageId || metadata.forwardingScore !== undefined || metadata.viewOnce !== undefined || metadata.ephemeral !== undefined) {
      await upsertMessageMetadata(redis, {
        chatId,
        messageId: msg.id._serialized,
        mentionedIds: metadata.mentionedIds,
        groupMentions: metadata.groupMentions,
        quotedMessageId: metadata.quotedMessageId,
        forwardingScore: metadata.forwardingScore,
        viewOnce: metadata.viewOnce,
        ephemeral: metadata.ephemeral,
      });
    }
    await updateChatCursor(redis, chatId, msg.timestamp ? msg.timestamp * 1000 : Date.now());
    if ((msg.body || '').startsWith('!scanner')) return;
    await queueUrlsForMessage(msg, chat, { forceRescan: true });
  };

  const retractVerdictForMessage = async (chatId: string, messageId: string) => {
    const state = await getMessageState(redis, chatId, messageId);
    if (!state?.verdictMessageId) return;
    try {
      const verdictMsg = await client.getMessageById(state.verdictMessageId);
      await verdictMsg.delete(true).catch(() => undefined);
    } catch (err) {
      logger.debug({ err, chatId, messageId }, 'Failed to delete verdict message during retraction');
    }
    try {
      const original = await client.getMessageById(messageId);
      await original.react('').catch(() => undefined);
    } catch {
      // ignore missing original message
    }
    await clearVerdictAssociation(redis, { chatId, messageId });
    const pending = await loadPendingVerdict(redis, state.verdictMessageId);
    if (pending) {
      await clearPendingVerdict(redis, state.verdictMessageId, 'failed');
    }
  };

  const deliverVerdict = async (payload: VerdictJobPayload, options: { force?: boolean; previousVerdictId?: string; retries?: number } = {}): Promise<PendingVerdictRecord | null> => {
    const chat = await client.getChatById(payload.chatId).catch(() => null);
    if (!chat || !(chat as GroupChat).isGroup) return null;
    const groupChat = chat as GroupChat;

    const delay = Math.floor(800 + Math.random() * 1200);
    await new Promise(resolve => setTimeout(resolve, delay));

    const attemptNumber = (options.retries ?? 0) + 1;

    if (!options.force) {
      try { await groupLimiter.consume(payload.chatId); } catch { return null; }
    }
    try { await groupHourlyLimiter.consume(payload.chatId); } catch { return null; }

    const verdictKey = `verdict:${payload.chatId}:${payload.urlHash}`;
    if (!options.force) {
      const nx = await redis.set(verdictKey, '1', 'EX', 3600, 'NX');
      if (nx === null) return null;
    } else {
      await redis.set(verdictKey, '1', 'EX', 3600);
    }

    if (options.previousVerdictId) {
      try {
        const previous = await client.getMessageById(options.previousVerdictId);
        await previous.delete(true).catch(() => undefined);
      } catch {
        // best effort
      }
    }

    let sourceMessage: Message | null = null;
    try {
      sourceMessage = await client.getMessageById(payload.messageId);
    } catch {
      sourceMessage = null;
    }

    const verdictText = formatGroupVerdict(payload.verdict, payload.reasons, payload.url);

    let verdictMessage: Message | null = null;
    let mediaWrapper: { media: MessageMedia; caption?: string } | null = null;
    if (config.features.attachMediaToVerdicts) {
      mediaWrapper = await buildVerdictMedia(payload, logger);
      metrics.waVerdictAttachmentUsage.labels(mediaWrapper ? 'attached' : 'not_found').inc();
    } else {
      metrics.waVerdictAttachmentUsage.labels('disabled').inc();
    }

    try {
      if (sourceMessage) {
        if (mediaWrapper) {
          verdictMessage = await sourceMessage.reply(mediaWrapper.media, undefined, { caption: mediaWrapper.caption ?? verdictText });
        } else {
          verdictMessage = await sourceMessage.reply(verdictText);
        }
      } else {
        if (mediaWrapper) {
          verdictMessage = await groupChat.sendMessage(mediaWrapper.media, { caption: mediaWrapper.caption ?? verdictText, quotedMessageId: payload.messageId });
        } else {
          verdictMessage = await groupChat.sendMessage(verdictText, { quotedMessageId: payload.messageId });
        }
      }
    } catch (err) {
      logger.error({ err, chatId: payload.chatId }, 'Failed to send verdict message');
      return null;
    }

    if (sourceMessage && (payload.verdict === 'malicious' || payload.verdict === 'suspicious')) {
      try {
        await sourceMessage.react('⚠️');
        metrics.waVerdictReactions.labels('success').inc();
      } catch (err) {
        metrics.waVerdictReactions.labels('failed').inc();
        logger.debug({ err, chatId: payload.chatId }, 'Failed to react to flagged message');
      }
    }

    await recordVerdictAssociation(redis, {
      chatId: payload.chatId,
      messageId: payload.messageId,
      verdictMessageId: verdictMessage.id._serialized,
      attempt: attemptNumber,
      status: options.force ? 'resent' : 'sent',
    });

    const record: PendingVerdictRecord = {
      verdictMessageId: verdictMessage.id._serialized,
      originalMessageId: payload.messageId,
      chatId: payload.chatId,
      verdictText,
      urlHash: payload.urlHash,
      sentAt: Date.now(),
      retries: options.retries ?? 0,
      level: payload.verdict,
      payload: payload,
    };
    return record;
  };

  const resendPendingVerdict = async (record: PendingVerdictRecord): Promise<PendingVerdictRecord | null> => {
    const payload = record.payload as VerdictJobPayload;
    return deliverVerdict(payload, { force: true, previousVerdictId: record.verdictMessageId, retries: record.retries });
  };

  await restorePendingVerdicts(redis, resendPendingVerdict, logger);

  client.on('qr', qr => { if (config.wa.qrTerminal) QRCode.generate(qr, { small: true }); });
  client.on('ready', async () => {
    logger.info('WhatsApp client ready');
    waSessionStatusGauge.labels('ready').set(1);
    emitHealth({ event: 'ready', state: 'ready' });
    await resetAuthFailures(waHealthContext);
    startStatePoller();
    startHistorySync();
  });
  client.on('auth_failure', async (m) => {
    logger.error({ m }, 'Auth failure');
    emitHealth({ event: 'auth_failure', reason: typeof m === 'string' ? m : JSON.stringify(m) });
    const { count, alert } = await incrementAuthFailure(waHealthContext);
    if (alert) {
      try {
        await sendAuthFailureAlert(logger, { clientId: waClientId, count, lastMessage: typeof m === 'string' ? m : undefined });
      } catch (err) {
        logger.error({ err }, 'Failed to dispatch auth failure alert');
      }
    }
  });
  client.on('disconnected', (r) => {
    logger.warn({ r }, 'Disconnected');
    waSessionStatusGauge.labels('ready').set(0);
    emitHealth({ event: 'disconnected', reason: typeof r === 'string' ? r : JSON.stringify(r) });
    stopStatePoller();
    stopHistorySync();
  });
  client.on('remote_session_saved', async () => {
    emitHealth({ event: 'remote_session_saved' });
    await resetAuthFailures(waHealthContext);
  });
  client.on('change_state', (state) => {
    emitHealth({ event: 'change_state', state });
    if (state === 'CONNECTED') {
      waSessionStatusGauge.labels('ready').set(1);
      void resetAuthFailures(waHealthContext);
      startHistorySync();
    }
    if (state === 'CONFLICT' || state === 'UNPAIRED_IDLE') {
      void resetDebounce(async () => {
        logger.warn({ state }, 'Attempting client.resetState after state change');
        try {
          await client.resetState();
          emitHealth({ event: 'reset_state', state });
        } catch (err) {
          logger.error({ err }, 'Failed to reset WhatsApp client state');
        }
      });
    }
  });

  client.on('message_edit', async (message, newBody) => {
    try {
      const chat = await message.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const chatId = (chat as GroupChat).id._serialized;
      const body = typeof newBody === 'string' ? newBody : message.body || '';
      await appendMessageEdit(redis, { chatId, messageId: message.id._serialized, newBody: body });
      const metadata = await collectMessageMetadata(message);
      if (metadata.mentionedIds?.length || metadata.groupMentions?.length || metadata.quotedMessageId || metadata.forwardingScore !== undefined || metadata.viewOnce !== undefined || metadata.ephemeral !== undefined) {
        await upsertMessageMetadata(redis, {
          chatId,
          messageId: message.id._serialized,
          mentionedIds: metadata.mentionedIds,
          groupMentions: metadata.groupMentions,
          quotedMessageId: metadata.quotedMessageId,
          forwardingScore: metadata.forwardingScore,
          viewOnce: metadata.viewOnce,
          ephemeral: metadata.ephemeral,
        });
      }
      await retractVerdictForMessage(chatId, message.id._serialized);
      await queueUrlsForMessage(message, chat as GroupChat, { forceRescan: true, bodyOverride: body });
    } catch (err) {
      logger.error({ err }, 'Failed to handle message_edit event');
    }
  });

  client.on('message_revoke_everyone', async (after, before) => {
    const target = before || after;
    if (!target) return;
    try {
      const chat = await target.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const chatId = (chat as GroupChat).id._serialized;
      await markMessageRevoked(redis, { chatId, messageId: target.id._serialized });
      await retractVerdictForMessage(chatId, target.id._serialized);
    } catch (err) {
      logger.error({ err }, 'Failed to handle message revoke');
    }
  });

  client.on('message_revoke_me', async (message) => {
    try {
      const chat = await message.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const chatId = (chat as GroupChat).id._serialized;
      await markMessageRevoked(redis, { chatId, messageId: message.id._serialized });
      await retractVerdictForMessage(chatId, message.id._serialized);
    } catch (err) {
      logger.error({ err }, 'Failed to handle self message revoke');
    }
  });

  client.on('message_reaction', async (reaction: Reaction) => {
    try {
      const remote = (reaction.id as { remote?: string | { _serialized: string } } | undefined)?.remote;
      const chatId = typeof remote === 'object' ? remote?._serialized : remote;
      const parent = reaction.msgId as { _serialized?: string } | string | undefined;
      const messageId = typeof parent === 'object' ? parent?._serialized : parent;
      if (!chatId || !messageId) return;
      const sender = typeof reaction.senderId === 'string' ? reaction.senderId : 'unknown';
      const emoji = typeof reaction.reaction === 'string' && reaction.reaction.length > 0 ? reaction.reaction : null;
      await recordReaction(redis, {
        chatId,
        messageId,
        senderId: sender,
        reaction: emoji,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to record message reaction');
    }
  });

  client.on('message_ciphertext', async (message: Message) => {
    try {
      const verdictId = message.id?._serialized;
      if (!verdictId) return;
      const pending = await loadPendingVerdict(redis, verdictId);
      if (!pending) return;
      metrics.waVerdictDeliveryRetries.labels('ciphertext').inc();
      emitHealth({ event: 'ciphertext_retry', state: 'retrying', details: { messageId: verdictId } });
      await triggerVerdictRetry(redis, verdictId, resendPendingVerdict, logger);
    } catch (err) {
      logger.error({ err }, 'Failed to handle message_ciphertext');
    }
  });

  client.on('message_ack', async (message, ack) => {
    try {
      let chatId: string | undefined = message.fromMe ? message.to : message.from;
      if (!chatId) {
        try {
          const chat = await message.getChat();
          if ((chat as GroupChat).isGroup) {
            chatId = (chat as GroupChat).id._serialized;
          }
        } catch {
          chatId = undefined;
        }
      }
      if (chatId) {
        await recordMessageAck(redis, { chatId, messageId: message.id._serialized, ack });
      }
    } catch (err) {
      logger.error({ err }, 'Failed to persist message ack state');
    }
    if (ack < 2) return;
    const pending = await loadPendingVerdict(redis, message.id._serialized);
    if (!pending) return;
    await clearPendingVerdict(redis, message.id._serialized, 'success');
  });

  client.on('media_uploaded', async (message: Message) => {
    try {
      let chatId: string | undefined = message.fromMe ? message.to : message.from;
      if (!chatId) {
        try {
          const chat = await message.getChat();
          if ((chat as GroupChat).isGroup) {
            chatId = (chat as GroupChat).id._serialized;
          }
        } catch {
          chatId = undefined;
        }
      }
      if (!chatId) return;
      await recordMediaUpload(redis, { chatId, messageId: message.id._serialized });
      emitHealth({ event: 'media_uploaded', state: 'uploaded', details: { chatId, messageId: message.id._serialized } });
    } catch (err) {
      logger.error({ err }, 'Failed to process media_uploaded event');
    }
  });

  client.on('group_join', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const groupChat = chat as GroupChat;
      const chatId = groupChat.id._serialized;

      const actor = normalizeJid(notification.author);
      const targets = (Array.isArray(notification.recipientIds) ? notification.recipientIds : [])
        .map((id) => normalizeJid(id))
        .filter((id): id is string => typeof id === 'string');
      await appendGovernanceLog(redis, chatId, { action: 'group_join', actor, targets, detail: notification.type ?? 'join' });

      await rememberChat(redis, chatId);

      await setGroupConsent(redis, chatId, config.wa.consentOnJoin ? 'pending' : 'granted');

      if (config.wa.consentOnJoin) {
        const locked = await withGovernanceBudget(chatId, 'consent_pending_join', async () => {
          await groupChat.setMessagesAdminsOnly(true);
        }, 'set_admins_only_on_join');
        if (locked) {
          logger.info({ chatId }, 'Restricted group to admins-only after join');
        }
        await groupChat.sendMessage('Hello! I am the security scanner bot. Admins, please reply `!scanner consent approve` to enable link scanning or `!scanner consent deny` to remove me.');
      } else {
        await groupChat.sendMessage('Security scanner active. Use `!scanner mute` to pause automatic verdicts.');
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle group_join event');
    }
  });

  client.on('group_membership_request', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const groupChat = chat as GroupChat;
      const chatId = groupChat.id._serialized;

      const actor = normalizeJid(notification.author);
      const targets = (Array.isArray(notification.recipientIds) ? notification.recipientIds : [])
        .map((id) => normalizeJid(id))
        .filter((id): id is string => typeof id === 'string');
      await appendGovernanceLog(redis, chatId, { action: 'group_membership_request', actor, targets, detail: notification.type ?? 'membership_request' });

      await rememberChat(redis, chatId);

      const autoApprove = await getAutoApprove(redis, chatId, config.wa.autoApproveDefault);
      if (!autoApprove) return;

      try { await membershipApprovalLimiter.consume(chatId); } catch {
        logger.warn({ chatId }, 'Auto-approval rate limited; skipping membership approval');
        await appendGovernanceLog(redis, chatId, { action: 'group_membership_request_skipped', actor, targets, detail: 'rate_limited' });
        return;
      }

      const requesterIds = notification.recipientIds && notification.recipientIds.length > 0 ? notification.recipientIds : undefined;
      const approveOptions = { requesterIds: requesterIds ?? null, sleep: null as number | null };
      await groupChat.approveGroupMembershipRequests(approveOptions);
      await recordGovernanceAction(redis, chatId, 3600);
      logger.info({ chatId, requesterIds }, 'Auto-approved group membership request');
      const normalized = (requesterIds ?? []).map((id) => normalizeJid(id)).filter((id): id is string => typeof id === 'string');
      await appendGovernanceLog(redis, chatId, { action: 'group_membership_auto_approved', actor, targets: normalized, detail: 'auto_approved' });
    } catch (err) {
      logger.error({ err }, 'Failed to auto-approve membership request');
    }
  });

  client.on('group_leave', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const groupChat = chat as GroupChat;
      const chatId = groupChat.id._serialized;
      const actor = normalizeJid(notification.author);
      const targets = (Array.isArray(notification.recipientIds) ? notification.recipientIds : [])
        .map((id) => normalizeJid(id))
        .filter((id): id is string => typeof id === 'string');
      const changeType = notification.type ?? 'leave';
      await appendGovernanceLog(redis, chatId, { action: 'group_leave', actor, targets, detail: changeType });

      const botJid = client.info?.wid?._serialized;
      if (botJid && targets.includes(botJid) && changeType === 'remove') {
        logger.warn({ chatId }, 'Bot removed from group; skipping governance escalation');
        return;
      }

      if (changeType === 'remove' && targets.length >= 3) {
        await applyAdminsOnlyGuard(groupChat, chatId, 'bulk_member_removal');
        await rotateInviteLinkSafely(groupChat, chatId, 'bulk_member_removal');
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle group_leave event');
    }
  });

  client.on('group_admin_changed', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const groupChat = chat as GroupChat;
      const chatId = groupChat.id._serialized;
      const actor = normalizeJid(notification.author);
      const targets = (Array.isArray(notification.recipientIds) ? notification.recipientIds : [])
        .map((id) => normalizeJid(id))
        .filter((id): id is string => typeof id === 'string');
      const changeTypeRaw = notification.type as unknown;
      const changeType = typeof changeTypeRaw === 'string' ? changeTypeRaw : String(changeTypeRaw ?? 'admin_changed');
      await appendGovernanceLog(redis, chatId, { action: 'group_admin_changed', actor, targets, detail: changeType });

      if (changeType === 'promote' || changeType === 'demote') {
        await applyAdminsOnlyGuard(groupChat, chatId, `admin_change_${changeType}`);
      }
      if (changeType === 'promote') {
        await rotateInviteLinkSafely(groupChat, chatId, 'admin_promotion_invite');
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle group_admin_changed event');
    }
  });

  client.on('group_participants_changed', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const groupChat = chat as GroupChat;
      const chatId = groupChat.id._serialized;
      const actor = normalizeJid(notification.author);
      const targets = (Array.isArray(notification.recipientIds) ? notification.recipientIds : [])
        .map((id) => normalizeJid(id))
        .filter((id): id is string => typeof id === 'string');
      const changeType = notification.type ?? 'participants_changed';
      await appendGovernanceLog(redis, chatId, { action: 'group_participants_changed', actor, targets, detail: changeType });

      if (changeType === 'add' && targets.length >= 3) {
        await applyAdminsOnlyGuard(groupChat, chatId, 'mass_addition_detected');
        await rotateInviteLinkSafely(groupChat, chatId, 'mass_addition_detected');
      }
      if (changeType === 'remove' && targets.length >= 2) {
        await applyAdminsOnlyGuard(groupChat, chatId, 'sequential_removal_detected');
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle group_participants_changed event');
    }
  });

  client.on('group_update', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const groupChat = chat as GroupChat;
      const chatId = groupChat.id._serialized;
      const actor = normalizeJid(notification.author);
      const updateType = notification.type ?? 'update';
      const summary = typeof notification.body === 'string' && notification.body.length > 0
        ? `body:${notification.body.slice(0, 160)}`
        : undefined;
      await appendGovernanceLog(redis, chatId, { action: 'group_update', actor, detail: updateType, reason: summary, targets: [] });

      if (updateType === 'restrict' || updateType === 'announce') {
        await applyAdminsOnlyGuard(groupChat, chatId, `settings_${updateType}`);
        await rotateInviteLinkSafely(groupChat, chatId, `settings_${updateType}`);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle group_update event');
    }
  });

  client.on('incoming_call', async (call: Call) => {
    try {
      emitHealth({
        event: 'incoming_call',
        state: call.isVideo ? 'video' : 'voice',
        details: {
          from: call.from,
          isGroup: call.isGroup,
          canHandleLocally: call.canHandleLocally,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to record incoming call');
    }
  });

  client.on('chat_removed', async (chat: Chat) => {
    try {
      const chatId = (chat as unknown as { id?: { _serialized?: string } }).id?._serialized;
      emitHealth({ event: 'chat_removed', state: 'removed', details: { chatId } });
    } catch (err) {
      logger.error({ err }, 'Failed to handle chat_removed event');
    }
  });

  const handleMessageCreate = async (msg: Message) => {
    try {
      const chat = await msg.getChat();
      if (!(chat as GroupChat).isGroup) return;
      const groupChat = chat as GroupChat;
      const chatId = groupChat.id._serialized;
      const metadata = await collectMessageMetadata(msg);
      await ensureMessageState(redis, {
        chatId,
        messageId: msg.id._serialized,
        from: msg.author || msg.from,
        body: msg.body || '',
        timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
        mentionedIds: metadata.mentionedIds,
        groupMentions: metadata.groupMentions,
        quotedMessageId: metadata.quotedMessageId,
        forwardingScore: metadata.forwardingScore,
        viewOnce: metadata.viewOnce,
        ephemeral: metadata.ephemeral,
      });
      if (metadata.mentionedIds?.length || metadata.groupMentions?.length || metadata.quotedMessageId || metadata.forwardingScore !== undefined || metadata.viewOnce !== undefined || metadata.ephemeral !== undefined) {
        await upsertMessageMetadata(redis, {
          chatId,
          messageId: msg.id._serialized,
          mentionedIds: metadata.mentionedIds,
          groupMentions: metadata.groupMentions,
          quotedMessageId: metadata.quotedMessageId,
          forwardingScore: metadata.forwardingScore,
          viewOnce: metadata.viewOnce,
          ephemeral: metadata.ephemeral,
        });
      }
      await rememberChat(redis, chatId);
      await updateChatCursor(redis, chatId, msg.timestamp ? msg.timestamp * 1000 : Date.now());

      if ((msg.body || '').startsWith('!scanner')) {
        await handleAdminCommand(client, msg, groupChat);
        return;
      }

      await queueUrlsForMessage(msg, groupChat);
    } catch (e) {
      logger.error(e);
    }
  };

  // Consume verdicts
  new Worker(config.queues.scanVerdict, async (job) => {
    try {
      const payload = job.data as VerdictJobPayload;
      const record = await deliverVerdict(payload);
      if (record) {
        await storePendingVerdict(redis, record, resendPendingVerdict, logger);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process verdict job');
    }
  }, { connection: redis });

  client.on('message_create', handleMessageCreate);

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

export async function handleAdminCommand(client: Client, msg: Message, preloadedChat?: GroupChat) {
  const chat = preloadedChat ?? await msg.getChat();
  if (!(chat as GroupChat).isGroup) return;
  const gc = chat as GroupChat;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participants = (gc as any).participants as Array<{ id: { _serialized: string }, isAdmin: boolean, isSuperAdmin: boolean }> || [];
  const sender = participants.find((p) => p.id._serialized === (msg.author || msg.from));
  if (!sender?.isAdmin && !sender?.isSuperAdmin) return;

  const parts = (msg.body || '').trim().split(/\s+/);
  const cmd = parts[1];
  if (!cmd) return;
  const chatId = gc.id._serialized;
  const base = process.env.CONTROL_PLANE_BASE || 'http://control-plane:8080';
  const token = assertControlPlaneToken();

  if (cmd === 'mute') {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chatId)}/mute`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner muted for 60 minutes.' : 'Mute failed.');
    logger.info({ chatId, actor: sender.id._serialized, action: 'mute' }, 'Audit: group mute issued');
  } else if (cmd === 'unmute') {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chatId)}/unmute`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner unmuted.' : 'Unmute failed.');
    logger.info({ chatId, actor: sender.id._serialized, action: 'unmute' }, 'Audit: group unmute issued');
  } else if (cmd === 'status') {
    const resp = await fetch(`${base}/status`, { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
    const json = resp && resp.ok ? await resp.json() : {};
    await chat.sendMessage(`Scanner status: scans=${json.scans || 0}, malicious=${json.malicious || 0}`);
  } else if (cmd === 'rescan' && parts[2]) {
    const rescanUrl = parts[2];
    const resp = await fetch(`${base}/rescan`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
    metrics.rescanRequests.labels('wa').inc();
  } else if (cmd === 'consent') {
    const decision = (parts[2] || '').toLowerCase();
    if (['approve', 'allowed', 'allow', 'yes', 'on', 'grant'].includes(decision)) {
      await setGroupConsent(redis, chatId, 'granted');
      await chat.sendMessage('Consent recorded. Link scanning is active.');
      logger.info({ chatId, actor: sender.id._serialized, action: 'consent_granted' }, 'Audit: consent granted');
      try {
        await governanceLimiter.consume(chatId);
        await gc.setMessagesAdminsOnly(false);
        await recordGovernanceAction(redis, chatId, 3600);
      } catch (err) {
        logger.warn({ err, chatId }, 'Failed to restore group messaging permissions');
      }
    } else if (['deny', 'decline', 'no', 'off', 'remove'].includes(decision)) {
      await setGroupConsent(redis, chatId, 'denied');
      await chat.sendMessage('Consent denied. The scanner will leave the group.');
      logger.info({ chatId, actor: sender.id._serialized, action: 'consent_denied' }, 'Audit: consent denied');
      await gc.leave();
    } else if (decision === 'status') {
      const state = await getGroupConsent(redis, chatId);
      await chat.sendMessage(`Consent status: ${state ?? 'pending'}`);
    } else {
      await chat.sendMessage('Usage: !scanner consent approve|deny|status');
    }
  } else if (cmd === 'autoapprove') {
    const mode = (parts[2] || '').toLowerCase();
    if (['on', 'enable', 'yes'].includes(mode)) {
      await setAutoApprove(redis, chatId, true);
      await chat.sendMessage('Automatic membership approval enabled.');
      logger.info({ chatId, actor: sender.id._serialized, action: 'autoapprove_on' }, 'Audit: auto-approve enabled');
    } else if (['off', 'disable', 'no'].includes(mode)) {
      await setAutoApprove(redis, chatId, false);
      await chat.sendMessage('Automatic membership approval disabled.');
      logger.info({ chatId, actor: sender.id._serialized, action: 'autoapprove_off' }, 'Audit: auto-approve disabled');
    } else if (mode === 'status') {
      const enabled = await getAutoApprove(redis, chatId, config.wa.autoApproveDefault);
      await chat.sendMessage(`Auto-approval is ${enabled ? 'enabled' : 'disabled'}.`);
    } else {
      await chat.sendMessage('Usage: !scanner autoapprove on|off|status');
    }
  } else if (cmd === 'approve_join' && parts[2]) {
    const userId = parts[2];
    try {
        await gc.approveGroupMembershipRequests({ requesterIds: [userId], sleep: null });
        await chat.sendMessage('Membership request approved.');
        logger.info({ chatId, actor: sender.id._serialized, action: 'approve_join', target: userId }, 'Audit: group membership approved');
    } catch (err) {
        await chat.sendMessage('Failed to approve membership request.');
        logger.error({ err, chatId, userId }, 'Failed to approve membership request');
    }
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status|rescan <url>|consent <approve|deny|status>|autoapprove <on|off|status>|approve_join <userId>');
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
