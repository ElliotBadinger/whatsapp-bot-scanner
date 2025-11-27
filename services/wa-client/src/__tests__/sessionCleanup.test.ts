import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ensureRemoteSessionDirectories,
  resetRemoteSessionArtifacts,
  type RemoteSessionCleanupOptions,
} from "../session/cleanup";

const createdPaths: string[] = [];
const createdFiles: string[] = [];

afterEach(async () => {
  for (const file of createdFiles.splice(0)) {
    await fs.rm(file, { force: true }).catch(() => {});
  }
  for (const dir of createdPaths.splice(0)) {
    await fs.rm(dir, { force: true, recursive: true }).catch(() => {});
  }
});

describe("ensureRemoteSessionDirectories", () => {
  it("creates required temp session directories", async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), "wa-session-ensure-"));
    createdPaths.push(baseDir);
    const dataPath = path.join(baseDir, "remote-session");
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await ensureRemoteSessionDirectories(dataPath, logger as any);

    const defaultDir = path.join(
      dataPath,
      "wwebjs_temp_session_default",
      "Default",
    );
    const stats = await fs.stat(defaultDir);
    expect(stats.isDirectory()).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("resetRemoteSessionArtifacts", () => {
  it("removes stored artifacts and recreates fresh directories", async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), "wa-session-reset-"));
    createdPaths.push(baseDir);
    const dataPath = path.join(baseDir, "remote-session");
    const tempDir = path.join(
      dataPath,
      "wwebjs_temp_session_default",
      "Default",
    );
    await fs.mkdir(tempDir, { recursive: true });
    createdPaths.push(dataPath);

    const sessionName = "RemoteAuth-session-reset-test";
    const archivePath = path.resolve(`${sessionName}.zip`);
    await fs.writeFile(archivePath, Buffer.from("mock-session"));
    createdFiles.push(archivePath);

    const deleteMock = jest.fn(async () => undefined);
    const store = {
      delete: deleteMock,
    } as RemoteSessionCleanupOptions["store"];
    const logger = {
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    await resetRemoteSessionArtifacts({
      store,
      sessionName,
      dataPath,
      logger: logger as any,
    });

    expect(store.delete).toHaveBeenCalledWith({ session: sessionName });
    await expect(fs.access(archivePath)).rejects.toThrow();

    const recreatedDefaultDir = path.join(
      dataPath,
      "wwebjs_temp_session_default",
      "Default",
    );
    const stats = await fs.stat(recreatedDefaultDir);
    expect(stats.isDirectory()).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
