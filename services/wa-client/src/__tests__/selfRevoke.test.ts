import { describe, expect, it, jest } from '@jest/globals';
import type { Message } from 'whatsapp-web.js';
import { handleSelfMessageRevoke } from '../handlers/selfRevoke';
import type { SessionSnapshot } from '../session/guards';

type RecordRevocationFn = (chatId: string, messageId: string, scope: 'me' | 'everyone', timestamp: number) => Promise<unknown>;

function createMessage(overrides: Partial<Message> = {}): Message {
  const getChat = jest.fn(async () => ({ id: { _serialized: 'chat-1' } }));
  return {
    id: { _serialized: 'msg-1', id: 'msg-1' },
    getChat,
    ...overrides,
  } as unknown as Message;
}

function createLogger() {
  return {
    debug: jest.fn() as jest.MockedFunction<(context: unknown, message: string) => void>,
  };
}

describe('handleSelfMessageRevoke', () => {
  it('skips when session is not ready', async () => {
    const message = createMessage();
    const snapshot: SessionSnapshot = { state: 'disconnected', wid: null };
    const recordRevocation = jest.fn(async () => undefined) as jest.MockedFunction<RecordRevocationFn>;
    const messageStore = { recordRevocation } as any;
    const logger = createLogger();

    const result = await handleSelfMessageRevoke(message, {
      snapshot,
      logger: logger as any,
      messageStore,
      recordMetric: jest.fn(),
    });

    expect(result).toBe('skipped');
    expect(recordRevocation).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('records revocation when session ready', async () => {
    const message = createMessage();
    const snapshot: SessionSnapshot = { state: 'ready', wid: 'bot@c.us' };
    const recordRevocation = jest.fn(async () => undefined) as jest.MockedFunction<RecordRevocationFn>;
    const messageStore = { recordRevocation } as any;
    const recordMetric = jest.fn();
    const logger = createLogger();

    const result = await handleSelfMessageRevoke(message, {
      snapshot,
      logger: logger as any,
      messageStore,
      recordMetric,
      now: () => 123,
    });

    expect(result).toBe('recorded');
    expect(recordRevocation).toHaveBeenCalledWith('chat-1', 'msg-1', 'me', 123);
    expect(recordMetric).toHaveBeenCalled();
  });

  it('throws enriched error when chat lookup fails', async () => {
    const error = new Error('Evaluation failed: b');
    const getChat = jest.fn(async () => { throw error; });
    const message = createMessage({ getChat } as Partial<Message>);
    const snapshot: SessionSnapshot = { state: 'ready', wid: 'bot@c.us' };
    const recordRevocation = jest.fn(async () => undefined) as jest.MockedFunction<RecordRevocationFn>;
    const messageStore = { recordRevocation } as any;
    const logger = createLogger();

    await expect(handleSelfMessageRevoke(message, {
      snapshot,
      logger: logger as any,
      messageStore,
      recordMetric: jest.fn(),
    })).rejects.toThrow(/WhatsApp Web evaluation failed during message_revoke_me:getChat/);
  });
});
