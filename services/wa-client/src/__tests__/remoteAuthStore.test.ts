import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Logger } from "pino";
import type Redis from "ioredis";
import { createRemoteAuthStore } from "../remoteAuthStore";
import type { EncryptionMaterials } from "../crypto/dataKeyProvider";

class MemoryRedis {
  private store = new Map<string, string>();

  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
  }

  async get(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async del(key: string) {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string) {
    return this.store.has(key) ? 1 : 0;
  }
}

const noopLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  debug: () => undefined,
  trace: () => undefined,
  child: () => noopLogger,
  level: "info",
  silent: false,
} as unknown as Logger;

function materialFromSecret(secret: string): EncryptionMaterials {
  const base = Buffer.from(secret, "utf8");
  const enc = createHash("sha256").update(base).update("enc").digest();
  const hmac = createHash("sha256").update(base).update("mac").digest();
  return { encryptionKey: enc, hmacKey: hmac, keySource: "test" };
}

describe("RedisRemoteAuthStore", () => {
  jest.setTimeout(15000);
  const session = "RemoteAuth-test";
  const zipPath = path.resolve(`${session}.zip`);
  const clientId = "test-client";
  const prefix = "remoteauth:v1:test-client";
  const materials = materialFromSecret("super-secret");
  const redis = new MemoryRedis() as unknown as Redis;

  afterEach(async () => {
    await fs.rm(zipPath, { force: true });
  });

  it("persists, extracts, and deletes session payloads", async () => {
    const fixture = Buffer.from("zip-contents");
    await fs.writeFile(zipPath, fixture);
    const store = createRemoteAuthStore({
      redis,
      logger: noopLogger,
      prefix,
      materials,
      clientId,
    });

    await store.save({ session });
    expect(await store.sessionExists({ session })).toBe(true);

    // Remove the original file to ensure extract recreates it
    await fs.rm(zipPath, { force: true });
    await store.extract({ session, path: zipPath });
    const restored = await fs.readFile(zipPath);
    expect(restored.toString()).toEqual(fixture.toString());

    await store.delete({ session });
    expect(await store.sessionExists({ session })).toBe(false);
  });
});
