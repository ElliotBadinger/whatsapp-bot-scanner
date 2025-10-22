import type { Client, Message, GroupChat } from 'whatsapp-web.js';
import { handleAdminCommand, formatGroupVerdict } from '../index';

describe('handleAdminCommand', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.CONTROL_PLANE_BASE = 'http://control-plane.test';
    process.env.CONTROL_PLANE_API_TOKEN = 'secret-token';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ scans: 5, malicious: 1 }) }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('issues mute command for group admins', async () => {
    const sendMessage = jest.fn();
    const mockChat = {
      isGroup: true,
      id: { _serialized: 'group-123' },
      sendMessage,
    } as unknown as GroupChat;
    (mockChat as any).participants = [{ id: { _serialized: 'user-1' }, isAdmin: true, isSuperAdmin: false }];

    const mockMessage = {
      body: '!scanner mute',
      from: 'user-1',
      author: 'user-1',
      id: { id: 'msg-1', _serialized: 'msg-1' },
      getChat: jest.fn().mockResolvedValue(mockChat),
    } as unknown as Message;

    await handleAdminCommand({} as Client, mockMessage);

    expect(global.fetch).toHaveBeenCalledWith('http://control-plane.test/groups/group-123/mute', expect.objectContaining({
      method: 'POST',
      headers: { authorization: 'Bearer secret-token' },
    }));
    expect(sendMessage).toHaveBeenCalledWith('Scanner muted for 60 minutes.');
  });
});

describe('formatGroupVerdict', () => {
  it('limits reasons and formats output', () => {
    const message = formatGroupVerdict('suspicious', ['reason1', 'reason2', 'reason3', 'reason4'], 'https://example.com');
    expect(message).toContain('Link scan: SUSPICIOUS');
    expect(message).toContain('example[.]com');
    expect(message.split('\n').length).toBeGreaterThan(2);
  });
});
