import type { Logger } from 'pino';
import type { Message } from 'whatsapp-web.js';
import type { MessageStore } from '../message-store';
import { describeSession, isSessionReady, type SessionSnapshot } from '../session/guards';
import { enrichEvaluationError } from '../session/errors';

export interface SelfRevokeDependencies {
  snapshot: SessionSnapshot;
  logger: Logger;
  messageStore: MessageStore;
  recordMetric: () => void;
  now?: () => number;
}

export type SelfRevokeOutcome = 'recorded' | 'skipped';

export async function handleSelfMessageRevoke(msg: Message, deps: SelfRevokeDependencies): Promise<SelfRevokeOutcome> {
  const { snapshot, logger, messageStore, recordMetric, now } = deps;
  if (!isSessionReady(snapshot)) {
    logger.debug({ messageId: msg.id?._serialized, session: describeSession(snapshot) }, 'Skipping self revoke handler because session is not ready');
    return 'skipped';
  }

  const chat = await msg.getChat().catch((err) => {
    throw enrichEvaluationError(err, {
      operation: 'message_revoke_me:getChat',
      chatId: (msg.id as any)?.remote ?? undefined,
      messageId: msg.id?._serialized,
      snapshot,
    });
  });
  const chatId = chat.id._serialized;
  const messageId = msg.id._serialized || msg.id.id;
  await messageStore.recordRevocation(chatId, messageId, 'me', now ? now() : Date.now());
  recordMetric();
  return 'recorded';
}
