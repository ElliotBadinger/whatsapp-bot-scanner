import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { resetRuntimeSessionState } from '../state/runtimeSession';

export interface ForceRemoteSessionResetOptions {
  sessionName: string;
  dataPath: string;
  deleteRemoteSession: (session: string) => Promise<void>;
  clearAckWatchers: () => void;
  logger: Pick<Logger, 'info' | 'warn'>;
  fsImpl?: typeof fs;
}

export interface ForceRemoteSessionResetResult {
  remoteSessionDeleted: boolean;
  dataPath: string;
}

export async function forceRemoteSessionReset(options: ForceRemoteSessionResetOptions): Promise<ForceRemoteSessionResetResult> {
  const { sessionName, dataPath, deleteRemoteSession, clearAckWatchers, logger } = options;
  const fsModule = options.fsImpl ?? fs;
  const resolvedDataPath = path.resolve(dataPath);
  let remoteSessionDeleted = false;

  try {
    await deleteRemoteSession(sessionName);
    remoteSessionDeleted = true;
    logger.info({ session: sessionName }, 'Deleted RemoteAuth session while forcing relink');
  } catch (err) {
    logger.warn({ err, session: sessionName }, 'Failed to delete RemoteAuth session while forcing relink');
  }

  try {
    await fsModule.rm(resolvedDataPath, { recursive: true, force: true });
    await fsModule.mkdir(resolvedDataPath, { recursive: true });
    logger.info({ resolvedDataPath }, 'Reset RemoteAuth data path while forcing relink');
  } catch (err) {
    logger.warn({ err, resolvedDataPath }, 'Failed to clean RemoteAuth data path while forcing relink');
  }

  try {
    clearAckWatchers();
  } catch (err) {
    logger.warn({ err }, 'Failed to clear ack watchers during session reset');
  }

  resetRuntimeSessionState();

  return { remoteSessionDeleted, dataPath: resolvedDataPath };
}
