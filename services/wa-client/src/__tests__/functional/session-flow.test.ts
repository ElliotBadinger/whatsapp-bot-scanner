import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { forceRemoteSessionReset } from '../../session/cleanup';
import { resolveChatForVerdict } from '../../utils/chatResolver';
import { handleSelfMessageRevoke } from '../../events/messageRevoke';
import {
  markClientReady,
  resetRuntimeSessionState,
  setCurrentSessionState,
  setBotWid,
  markClientDisconnected,
} from '../../state/runtimeSession';

describe('Functional session flows', () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
  } as any;

  const metrics = {
    waMessageRevocations: {
      labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
    },
  };

  beforeEach(() => {
    resetRuntimeSessionState();
    jest.clearAllMocks();
  });

  it('resets remote session data and allows verdict delivery after reconnect', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wa-client-functional-'));
    const dataPath = path.join(tmpRoot, 'remote');
    await fs.mkdir(path.join(dataPath, 'Default'), { recursive: true });
    await fs.writeFile(path.join(dataPath, 'Default', 'session.json'), '{}');

    markClientReady();
    setCurrentSessionState('ready');
    setBotWid('bot-1');

    const clearAckWatchers = jest.fn();
    const deleteRemoteSession = jest.fn(async () => undefined);

    await forceRemoteSessionReset({
      sessionName: 'RemoteAuth-functional',
      dataPath,
      deleteRemoteSession,
      clearAckWatchers,
      logger,
    });

    expect(deleteRemoteSession).toHaveBeenCalled();
    expect(clearAckWatchers).toHaveBeenCalled();

    markClientReady();
    setCurrentSessionState('ready');

    const chat = {
      id: { _serialized: '123@group' },
      isGroup: true,
      sendMessage: jest.fn(),
    } as any;

    const client = {
      getMessageById: jest.fn().mockResolvedValue(null),
      getChatById: jest.fn().mockResolvedValue(chat),
    };

    const resolved = await resolveChatForVerdict({
      client,
      logger,
      chatId: '123@group',
      messageId: 'msg-1',
    });

    await chat.sendMessage('hello after reset');
    expect(resolved.chat).toBe(chat);

    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('handles self message revokes without throwing', async () => {
    markClientReady();
    const recordRevocation = jest.fn();
    await handleSelfMessageRevoke({ messageStore: { recordRevocation } as any, metrics, logger }, {
      fromMe: true,
      to: 'group-1',
      id: { _serialized: 'msg-5' },
    } as any);

    expect(recordRevocation).toHaveBeenCalled();
  });

  it('combines reset and revoke flows without destabilising state', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wa-client-functional-'));
    const dataPath = path.join(tmpRoot, 'remote');
    await fs.mkdir(dataPath, { recursive: true });

    markClientReady();
    setCurrentSessionState('ready');
    setBotWid('bot-2');

    await forceRemoteSessionReset({
      sessionName: 'RemoteAuth-combined',
      dataPath,
      deleteRemoteSession: async () => undefined,
      clearAckWatchers: jest.fn(),
      logger,
    });

    markClientDisconnected();
    markClientReady();
    setCurrentSessionState('ready');

    const chat = {
      id: { _serialized: 'abc@group' },
      isGroup: true,
      sendMessage: jest.fn(),
    } as any;

    const client = {
      getMessageById: jest.fn().mockResolvedValue(null),
      getChatById: jest.fn().mockResolvedValue(chat),
    };

    await resolveChatForVerdict({
      client,
      logger,
      chatId: 'abc@group',
      messageId: 'msg-9',
    });

    await handleSelfMessageRevoke({ messageStore: { recordRevocation: jest.fn() } as any, metrics, logger }, {
      fromMe: true,
      to: 'abc@group',
      id: { _serialized: 'msg-9' },
    } as any);

    await fs.rm(tmpRoot, { recursive: true, force: true });
  });
});
