import { promises as fs } from "node:fs";
import path from "node:path";
import type { Logger } from "pino";
import type { RedisRemoteAuthStore } from "../remoteAuthStore";
import { resetRuntimeSessionState } from "../state/runtimeSession";

export interface RemoteSessionCleanupOptions {
  deleteRemoteSession: (sessionName: string) => Promise<void>;
  clearAckWatchers?: () => void;
  sessionName: string;
  dataPath: string;
  logger: Logger;
}

function resolveZipPath(sessionName: string): string {
  return path.resolve(`${sessionName}.zip`);
}

async function removeIfExists(
  targetPath: string,
  options?: { recursive?: boolean },
): Promise<void> {
  await fs
    .rm(targetPath, { force: true, recursive: options?.recursive ?? false })
    .catch((err: unknown) => {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return;
      throw err;
    });
}

export async function resetRemoteSessionArtifacts(
  options: RemoteSessionCleanupOptions,
): Promise<void> {
  const {
    deleteRemoteSession,
    clearAckWatchers,
    sessionName,
    dataPath,
    logger,
  } = options;
  try {
    await deleteRemoteSession(sessionName);
  } catch (err) {
    logger.warn(
      { err, session: sessionName },
      "Failed to delete RemoteAuth session record from Redis",
    );
  }

  // Clear runtime state
  if (clearAckWatchers) {
    clearAckWatchers();
  }

  // Reset in-memory session state
  resetRuntimeSessionState();

  const resolvedDataPath = path.resolve(dataPath || "./data/remote-session");
  const zipPath = resolveZipPath(sessionName);

  await removeIfExists(zipPath).catch((err) => {
    logger.warn(
      { err, zipPath },
      "Failed to delete RemoteAuth snapshot archive during force reset",
    );
  });

  await removeIfExists(resolvedDataPath, { recursive: true }).catch((err) => {
    logger.warn(
      { err, resolvedDataPath },
      "Failed to remove RemoteAuth data directory during force reset",
    );
  });

  try {
    await fs.mkdir(resolvedDataPath, { recursive: true });
    const tempSessionPath = path.join(
      resolvedDataPath,
      "wwebjs_temp_session_default",
      "Default",
    );
    await fs.mkdir(tempSessionPath, { recursive: true });
  } catch (err) {
    logger.warn(
      { err, resolvedDataPath },
      "Failed to recreate RemoteAuth data directories during force reset",
    );
  }
}

export async function ensureRemoteSessionDirectories(
  dataPath: string,
  logger: Logger,
): Promise<void> {
  const resolvedDataPath = path.resolve(dataPath || "./data/remote-session");
  const tempSessionPath = path.join(
    resolvedDataPath,
    "wwebjs_temp_session_default",
    "Default",
  );
  try {
    await fs.mkdir(tempSessionPath, { recursive: true });
  } catch (err) {
    logger.error(
      { err, resolvedDataPath },
      "Unable to create RemoteAuth session directories",
    );
    throw err;
  }
  try {
    await fs.access(tempSessionPath);
  } catch (err) {
    logger.error(
      { err, resolvedDataPath },
      "RemoteAuth temp session directory still missing after creation attempt",
    );
    throw err;
  }
}
