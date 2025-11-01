import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { forceRemoteSessionReset } from '../session/cleanup';
import { markClientReady, setCurrentSessionState, setBotWid, isClientReady, getCurrentSessionState, getBotWid, resetRuntimeSessionState } from '../state/runtimeSession';

describe('forceRemoteSessionReset', () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
  } as any;

  beforeEach(() => {
    resetRuntimeSessionState();
    jest.clearAllMocks();
  });

  it('deletes remote session data and resets runtime state', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wa-client-test-'));
    const dataPath = path.join(tmpRoot, 'remote-session');
    const nested = path.join(dataPath, 'Default');
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(path.join(nested, 'session.json'), '{}');

    markClientReady();
    setCurrentSessionState('ready');
    setBotWid('bot-123');

    const clearAckWatchers = jest.fn();
    const deleteRemoteSession = jest.fn(async () => undefined);

    const result = await forceRemoteSessionReset({
      sessionName: 'RemoteAuth-test',
      dataPath,
      deleteRemoteSession,
      clearAckWatchers,
      logger,
    });

    expect(result.remoteSessionDeleted).toBe(true);
    expect(deleteRemoteSession).toHaveBeenCalledWith('RemoteAuth-test');
    expect(clearAckWatchers).toHaveBeenCalledTimes(1);
    expect(isClientReady()).toBe(false);
    expect(getCurrentSessionState()).toBeNull();
    expect(getBotWid()).toBeNull();

    const entries = await fs.readdir(result.dataPath);
    expect(entries).toHaveLength(0);

    await fs.rm(tmpRoot, { recursive: true, force: true });
  });
});
