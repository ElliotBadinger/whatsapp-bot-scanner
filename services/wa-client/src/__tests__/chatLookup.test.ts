import { describe, expect, it, jest } from '@jest/globals';
import type { GroupChat } from 'whatsapp-web.js';
import { safeGetGroupChatById } from '../utils/chatLookup';
import type { SessionSnapshot } from '../session/guards';

function createClient() {
  return {
    getChatById: jest.fn() as jest.MockedFunction<(chatId: string) => Promise<GroupChat | null>>,
  };
}

function createLogger() {
  return {
    debug: jest.fn() as jest.MockedFunction<(context: unknown, message: string) => void>,
    warn: jest.fn() as jest.MockedFunction<(context: unknown, message: string) => void>,
  };
}

describe('safeGetGroupChatById', () => {
  it('skips lookup when session is not ready', async () => {
    const client = createClient();
    const logger = createLogger();
    const snapshot: SessionSnapshot = { state: 'disconnected', wid: null };

    const result = await safeGetGroupChatById({
      client: client as any,
      chatId: '123@c.us',
      snapshot,
      logger: logger as any,
    });

    expect(result).toBeNull();
    expect(client.getChatById).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { chatId: '123@c.us', session: expect.stringContaining('state=disconnected') },
      'Skipping chat lookup because session is not ready',
    );
  });

  it('wraps evaluation errors with descriptive context', async () => {
    const client = createClient();
    client.getChatById.mockRejectedValue(new Error('Evaluation failed: b'));
    const logger = createLogger();
    const snapshot: SessionSnapshot = { state: 'ready', wid: '555@c.us' };

    await expect(safeGetGroupChatById({
      client: client as any,
      chatId: '456@c.us',
      snapshot,
      logger: logger as any,
    })).rejects.toThrow(/WhatsApp Web evaluation failed during getChatById/);
    expect(client.getChatById).toHaveBeenCalledWith('456@c.us');
  });

  it('returns group chat when lookup succeeds', async () => {
    const chat = { isGroup: true } as GroupChat;
    const client = createClient();
    client.getChatById.mockResolvedValue(chat);
    const logger = createLogger();
    const snapshot: SessionSnapshot = { state: 'ready', wid: '999@c.us' };

    const result = await safeGetGroupChatById({
      client: client as any,
      chatId: '789@c.us',
      snapshot,
      logger: logger as any,
    });

    expect(result).toBe(chat);
  });
});
