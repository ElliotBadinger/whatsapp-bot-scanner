import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";
import { sessionExists, useRedisAuthState } from "../auth/baileys-auth-store";

class SimpleRedis {
  private readonly store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
  }

  async del(...keys: string[]) {
    keys.forEach((key) => this.store.delete(key));
    return keys.length;
  }

  async keys(pattern: string) {
    const regex = new RegExp(`^${pattern.replace("*", ".*")}$`);
    return Array.from(this.store.keys()).filter((key) => regex.test(key));
  }

  async exists(key: string) {
    return this.store.has(key) ? 1 : 0;
  }
}

describe("baileys-auth-store", () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads existing credentials and saves updates", async () => {
    const redis = new SimpleRedis();
    const creds = initAuthCreds();
    const serialized = JSON.stringify(creds, BufferJSON.replacer);
    await redis.set("auth:client:creds", serialized);

    const { state, saveCreds } = await useRedisAuthState({
      redis: redis as any,
      logger: logger as any,
      prefix: "auth",
      clientId: "client",
    });

    expect(state.creds).toBeDefined();
    await saveCreds();
    const stored = await redis.get("auth:client:creds");
    expect(stored).toBeTruthy();
  });

  it("initializes new credentials and clears state keys", async () => {
    const redis = new SimpleRedis();

    const { state, clearState } = await useRedisAuthState({
      redis: redis as any,
      logger: logger as any,
      prefix: "auth",
      clientId: "client",
    });

    await state.keys.set({
      "pre-key": {
        "1": { keyId: 1 } as any,
      },
    });

    expect(await redis.keys("auth:client:*")).not.toEqual([]);
    await clearState();
    expect(await redis.keys("auth:client:*")).toEqual([]);
  });

  it("gets and removes key entries via the key store", async () => {
    const redis = new SimpleRedis();

    const { state } = await useRedisAuthState({
      redis: redis as any,
      logger: logger as any,
      prefix: "auth",
      clientId: "client",
    });

    await state.keys.set({
      session: {
        alpha: { session: "value" } as any,
        beta: null,
      },
    });

    const found = await state.keys.get("session", ["alpha", "beta"]);
    expect(found).toEqual({
      alpha: { session: "value" },
    });
  });

  it("reports session existence based on creds key", async () => {
    const redis = new SimpleRedis();
    expect(await sessionExists(redis as any, "auth", "client")).toBe(false);
    await redis.set("auth:client:creds", "present");
    expect(await sessionExists(redis as any, "auth", "client")).toBe(true);
  });
});
