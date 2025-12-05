import type { Logger } from 'pino';
import type { Message } from 'whatsapp-web.js';
import type { MessageStore } from '../message-store.js';

type MetricsCounter = { inc: () => void };

type Metrics = {
  waMessageRevocations: {
    labels: (scope: 'me' | 'everyone') => MetricsCounter;
  };
};

export interface MessageRevokeDependencies {
  messageStore: Pick<MessageStore, 'recordRevocation'>;
  metrics: Metrics;
  logger: Pick<Logger, 'warn'>;
}

export async function handleSelfMessageRevoke(deps: MessageRevokeDependencies, msg: Pick<Message, 'fromMe' | 'from' | 'to' | 'id'>): Promise<void> {
  const { messageStore, metrics, logger } = deps;
  try {
    const chatId = msg.fromMe ? msg.to : msg.from;
    if (!chatId) {
      return;
    }
    const messageId = (msg.id as unknown as { _serialized?: string })?._serialized || (msg.id as unknown as { id?: string })?.id;
    if (!messageId) {
      return;
    }
    await messageStore.recordRevocation(chatId, messageId, 'me', Date.now());
    metrics.waMessageRevocations.labels('me').inc();
  } catch (err) {
    logger.warn({ err }, 'Failed to record self message revoke');
  }
}
