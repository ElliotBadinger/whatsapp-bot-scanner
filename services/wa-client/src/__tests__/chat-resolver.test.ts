import { resolveChatForVerdict, ChatLookupError } from '../utils/chatResolver';
import { markClientReady, markClientDisconnected, resetRuntimeSessionState, SessionNotReadyError } from '../state/runtimeSession';

describe('resolveChatForVerdict', () => {
  const logger = { warn: jest.fn() } as any;

  beforeEach(() => {
    resetRuntimeSessionState();
    jest.clearAllMocks();
  });

  it('throws a descriptive error when chat lookup fails', async () => {
    markClientReady();
    const client = {
      getMessageById: jest.fn().mockResolvedValue(null),
      getChatById: jest.fn().mockRejectedValue(new Error('Evaluation failed: b')),
    };

    await expect(resolveChatForVerdict({
      client,
      logger,
      chatId: '123@group',
      messageId: 'msg-1',
    })).rejects.toThrow(ChatLookupError);

    expect(client.getChatById).toHaveBeenCalledWith('123@group');
  });

  it('skips chat lookup when session is not ready', async () => {
    markClientDisconnected();
    const client = {
      getMessageById: jest.fn(),
      getChatById: jest.fn(),
    };

    await expect(resolveChatForVerdict({
      client,
      logger,
      chatId: '123@group',
      messageId: 'msg-1',
    })).rejects.toThrow(SessionNotReadyError);

    expect(client.getChatById).not.toHaveBeenCalled();
    expect(client.getMessageById).not.toHaveBeenCalled();
  });
});
