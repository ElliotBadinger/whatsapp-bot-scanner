import FakeRedis from './fake-redis';
import type Redis from 'ioredis';

jest.mock('ioredis', () => FakeRedis);

jest.mock('rate-limiter-flexible', () => ({
  RateLimiterRedis: class {
    async consume() { return; }
  }
}));

import type { Client, Message, GroupChat } from 'whatsapp-web.js';
import { handleAdminCommand, formatGroupVerdict } from '../index';

jest.mock('confusables', () => ({ __esModule: true, default: (input: string) => input }), { virtual: true });
jest.mock('bottleneck', () => ({
  __esModule: true,
  default: class BottleneckMock {
    on(): void {
      // intentionally no-op: bottleneck events are not required in command handler tests
    }
    async currentReservoir(): Promise<number> { return 1; }
    schedule<T>(fn: (...args: any[]) => T, ...params: any[]): Promise<T> { return Promise.resolve(fn(...params)); }
  }
}), { virtual: true });

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
      getContact: jest.fn().mockResolvedValue({ id: { _serialized: 'user-1' } }),
    } as unknown as Message;

    await handleAdminCommand({} as Client, mockMessage, undefined, {} as unknown as Redis);

    expect(global.fetch).toHaveBeenCalledWith('http://control-plane.test/groups/group-123/mute', expect.objectContaining({
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'x-csrf-token': 'secret-token' },
    }));
    expect(sendMessage).toHaveBeenCalledWith('Scanner muted for 60 minutes.');
  });

  it('relays rescan confirmation when successful', async () => {
    const sendMessage = jest.fn();
    const mockChat = {
      isGroup: true,
      id: { _serialized: 'group-123' },
      sendMessage,
      setMessagesAdminsOnly: jest.fn().mockResolvedValue(true),
    } as unknown as GroupChat;
    (mockChat as any).participants = [{ id: { _serialized: 'user-1' }, isAdmin: true, isSuperAdmin: false }];

    const mockMessage = {
      body: '!scanner rescan https://example.com/test',
      from: 'user-1',
      author: 'user-1',
      id: { id: 'msg-2', _serialized: 'msg-2' },
      getChat: jest.fn().mockResolvedValue(mockChat),
      getContact: jest.fn().mockResolvedValue({ id: { _serialized: 'user-1' } }),
    } as unknown as Message;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, urlHash: 'abc123', jobId: 'job-1' }),
    });

    await handleAdminCommand({} as Client, mockMessage, undefined, {} as unknown as Redis);

    expect(global.fetch).toHaveBeenCalledWith('http://control-plane.test/rescan', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer secret-token', 'x-csrf-token': 'secret-token' }),
    }));
    expect(sendMessage).toHaveBeenCalledWith('Rescan queued. hash=abc123 job=job-1');
  });

  it('records consent acknowledgement from admins', async () => {
    const sendMessage = jest.fn();
    const setMessagesAdminsOnly = jest.fn().mockResolvedValue(true);
    const mockChat = {
      isGroup: true,
      id: { _serialized: 'group-123' },
      sendMessage,
      setMessagesAdminsOnly,
    } as unknown as GroupChat;
    (mockChat as any).participants = [{ id: { _serialized: 'user-1' }, isAdmin: true, isSuperAdmin: false }];

    const mockMessage = {
      body: '!scanner consent',
      from: 'user-1',
      author: 'user-1',
      id: { id: 'msg-3', _serialized: 'msg-3' },
      getChat: jest.fn().mockResolvedValue(mockChat),
      getContact: jest.fn().mockResolvedValue({ id: { _serialized: 'user-1' } }),
    } as unknown as Message;

    await handleAdminCommand({} as Client, mockMessage, undefined, {} as unknown as Redis);

    expect(setMessagesAdminsOnly).toHaveBeenCalledWith(false);
    expect(sendMessage).toHaveBeenCalledWith('Consent recorded. Automated scanning enabled for this group.');
  });

  it('approves membership overrides from admins', async () => {
    const sendMessage = jest.fn();
    const approveMembership = jest.fn().mockResolvedValue(undefined);
    const mockChat = {
      isGroup: true,
      id: { _serialized: 'group-456' },
      sendMessage,
      setMessagesAdminsOnly: jest.fn().mockResolvedValue(true),
    } as unknown as GroupChat;
    (mockChat as any).participants = [{ id: { _serialized: 'admin-1' }, isAdmin: true, isSuperAdmin: false }];

    const mockMessage = {
      body: '!scanner approve pending-user',
      from: 'admin-1',
      author: 'admin-1',
      id: { id: 'msg-4', _serialized: 'msg-4' },
      getChat: jest.fn().mockResolvedValue(mockChat),
      getContact: jest.fn().mockResolvedValue({ id: { _serialized: 'admin-1' } }),
    } as unknown as Message;

    await handleAdminCommand(
      { approveGroupMembershipRequests: approveMembership } as unknown as Client,
      mockMessage,
      undefined,
      {} as unknown as Redis,
    );

    expect(approveMembership).toHaveBeenCalledWith('group-456', { requesterIds: ['pending-user'], sleep: null });
    expect(sendMessage).toHaveBeenCalledWith('Approved membership request for pending-user.');
  });

  it('summarizes governance events for admins', async () => {
    const sendMessage = jest.fn();
    const setMessagesAdminsOnly = jest.fn().mockResolvedValue(true);
    const mockChat = {
      isGroup: true,
      id: { _serialized: 'group-789' },
      sendMessage,
      setMessagesAdminsOnly,
    } as unknown as GroupChat;
    (mockChat as any).participants = [{ id: { _serialized: 'admin-1' }, isAdmin: true, isSuperAdmin: false }];

    const baseMessage = {
      from: 'admin-1',
      author: 'admin-1',
      id: { id: 'msg-5', _serialized: 'msg-5' },
      getChat: jest.fn().mockResolvedValue(mockChat),
      getContact: jest.fn().mockResolvedValue({ id: { _serialized: 'admin-1' } }),
    } as unknown as Message;

    await handleAdminCommand({} as Client, { ...baseMessage, body: '!scanner consent' }, undefined, {} as unknown as Redis);
    sendMessage.mockClear();

    await handleAdminCommand({} as Client, { ...baseMessage, body: '!scanner governance 5' }, undefined, {} as unknown as Redis);

    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('consent_granted'));
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
