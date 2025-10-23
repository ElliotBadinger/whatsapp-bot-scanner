import Fastify from 'fastify';
import { Client, LocalAuth, Message, GroupChat } from 'whatsapp-web.js';
import QRCode from 'qrcode-terminal';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { config, logger, extractUrls, normalizeUrl, urlHash, metrics, register, assertControlPlaneToken } from '@wbscanner/shared';
import { ensureMessageState, updateMessageBody, markMessageRevoked, recordReaction, recordMessageAck } from './state/messageStore';
import { appendGovernanceLog, recordGovernanceAction, getGovernanceActionCount } from './groupGovernance';
import { ensureMessageState, updateMessageBody, markMessageRevoked, recordReaction, recordMessageAck } from './state/messageStore';
import { appendGovernanceLog, recordGovernanceAction, getGovernanceActionCount } from './groupGovernance';
import { RateLimiterRedis } from 'rate-limiter-flexible';

const redis = new Redis(config.redisUrl);
const scanRequestQueue = new Queue(config.queues.scanRequest, { connection: redis });

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
const processedKey = (chatId: string, messageId: string, urlH: string) => `processed:${chatId}:${messageId}:${urlH}`;

function validateStartupConfig() {
  const required = ['VT_API_KEY', 'GSB_API_KEY', 'REDIS_URL', 'POSTGRES_HOST'];
  const missing = required.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
  if (missing.length > 0) {
    logger.error({ missing }, 'Missing required environment variables for wa-client');
    process.exit(1);
  }
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

  const client = new Client({
    puppeteer: { headless: config.wa.headless },
    authStrategy: new LocalAuth({ dataPath: './data/session' })
  });

  client.on('qr', qr => { if (config.wa.qrTerminal) QRCode.generate(qr, { small: true }); });
  client.on('ready', () => logger.info('WhatsApp client ready'));
  client.on('auth_failure', (m) => logger.error({ m }, 'Auth failure'));
  client.on('disconnected', (r) => logger.warn({ r }, 'Disconnected'));

  const handleMessageCreate = async (msg: Message) => {
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

        try { await globalLimiter.consume('global'); } catch { continue; }

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
  };

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
      const originalMessage = await chat.fetchMessage(messageId);
      if (originalMessage) {
        await originalMessage.reply(msg);
        if (verdict === 'malicious') {
          await originalMessage.react('⚠️');
        }
      } else {
        await chat.sendMessage(msg, { quotedMessageId: messageId }).catch(() => undefined);
      }
    }, delay);
  }, { connection: redis });

  client.on('message_create', handleMessageCreate);
  client.on('message_edit', handleMessageEdit);
  client.on('message_revoke_everyone', handleMessageRevokeEveryone);
  client.on('message_revoke_me', handleMessageRevokeMe);
  client.on('message_reaction', handleMessageReaction);
  client.on('group_join', handleGroupJoin);
  client.on('group_membership_request', handleGroupMembershipRequest);
  client.on('message_ack', handleMessageAck);
  client.on('message_edit', handleMessageEdit);
  client.on('message_revoke_everyone', handleMessageRevokeEveryone);
  client.on('message_revoke_me', handleMessageRevokeMe);
  client.on('message_reaction', handleMessageReaction);
  client.on('group_join', handleGroupJoin);
  client.on('group_membership_request', handleGroupMembershipRequest);
  client.on('message_ack', handleMessageAck);

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
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}
if (process.env.NODE_ENV !== 'test') {
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}





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
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}
if (process.env.NODE_ENV !== 'test') {
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}






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
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}
if (process.env.NODE_ENV !== 'test') {
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}





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
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}
if (process.env.NODE_ENV !== 'test') {
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}







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
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}
if (process.env.NODE_ENV !== 'test') {
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}





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
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}
if (process.env.NODE_ENV !== 'test') {
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}






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
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}
if (process.env.NODE_ENV !== 'test') {
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}





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
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




      },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Rescan queued.' : 'Rescan failed.');
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status');
  }
}
if (process.env.NODE_ENV !== 'test') {
async function handleMessageEdit(message: Message, newBody: string, prevBody: string) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: prevBody,
      timestamp: message.timestamp,
    });

    await updateMessageBody(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      newBody,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message edit recorded');
  } catch (e) {
    logger.error(e, 'Error handling message edit');
  }
}

async function handleMessageRevokeEveryone(message: Message, revoked_msg?: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await ensureMessageState(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      from: message.author || message.from,
      body: revoked_msg?.body || message.body,
      timestamp: message.timestamp,
    });

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke');
  }
}

async function handleMessageRevokeMe(message: Message) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await markMessageRevoked(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
    });

    logger.info({ chatId: chat.id._serialized, messageId: message.id.id }, 'Message revoke (me) recorded');
  } catch (e) {
    logger.error(e, 'Error handling message revoke me');
  }
}

async function handleMessageReaction(reaction: any) {
  try {
    const chat = await reaction.msgId.getChat();
    if (!chat.isGroup) return;

    await recordReaction(redis, {
      chatId: chat.id._serialized,
      messageId: reaction.msgId.id,
      senderId: reaction.senderId,
      reaction: reaction.reaction,
    });

    logger.info({ chatId: chat.id._serialized, messageId: reaction.msgId.id, reaction: reaction.reaction }, 'Message reaction recorded');
  } catch (e) {
    logger.error(e, 'Error handling message reaction');
  }
}

async function handleGroupJoin(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Set chat to admins-only for messages
    await (chat as GroupChat).setMessagesAdminsOnly(true);

    // Send consent message
    const consentMsg = `Welcome! This group uses automated link scanning for security. By staying, you consent to message analysis. Type !scanner status for info.`;
    await chat.sendMessage(consentMsg);

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600); // 1 hour TTL
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'group_join_auto_admin_only',
      actor: notification.id,
      targets: notification.recipientIds,
      detail: 'Set messages to admins-only on new member join',
    });

    logger.info({ chatId: chat.id._serialized, newMembers: notification.recipientIds }, 'Group join handled with auto admin-only');
  } catch (e) {
    logger.error(e, 'Error handling group join');
  }
}

async function handleGroupMembershipRequest(notification: any) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    // Check rate limits
    const actionCount = await getGovernanceActionCount(redis, chat.id._serialized);
    if (actionCount >= 10) { // Max 10 auto-approvals per hour
      logger.warn({ chatId: chat.id._serialized }, 'Rate limit exceeded for membership auto-approval');
      return;
    }

    // Auto-approve membership request
    await (chat as GroupChat).approveGroupMembershipRequests({
      requesterIds: [notification.author]
    });

    // Record governance action
    await recordGovernanceAction(redis, chat.id._serialized, 3600);
    await appendGovernanceLog(redis, chat.id._serialized, {
      action: 'membership_request_auto_approved',
      actor: notification.author,
      detail: 'Auto-approved membership request',
    });

    logger.info({ chatId: chat.id._serialized, requester: notification.author }, 'Membership request auto-approved');
  } catch (e) {
    logger.error(e, 'Error handling group membership request');
  }
}

async function handleMessageAck(message: Message, ack: number) {
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    await recordMessageAck(redis, {
      chatId: chat.id._serialized,
      messageId: message.id.id || message.id._serialized,
      ack,
    });

    logger.debug({ chatId: chat.id._serialized, messageId: message.id.id, ack }, 'Message ack recorded');
  } catch (e) {
    logger.error(e, 'Error handling message ack');
  }
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



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
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}



}
if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}




    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}


if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}
  main().catch(err => {
    logger.error(err, 'Fatal in wa-client');
    process.exit(1);
  });
}



  });
}








