import Redis from "ioredis";
import {
  createEncryptedRedis,
  resetEncryptionKey,
  EncryptedRedisClient,
} from "@wbscanner/shared";

describe("Redis Encryption Regression Suite", () => {
  let redis: Redis;
  let encryptedClient: EncryptedRedisClient;

  beforeAll(() => {
    process.env.REDIS_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    resetEncryptionKey();
  });

  afterAll(() => {
    delete process.env.REDIS_ENCRYPTION_KEY;
    resetEncryptionKey();
  });

  beforeEach(() => {
    redis = new Redis({ lazyConnect: true });
    encryptedClient = createEncryptedRedis(redis, true);
  });

  afterEach(async () => {
    await redis.quit().catch(() => {});
  });

  it("should maintain verdict caching functionality", async () => {
    const urlHash = "test_url_hash";
    const verdict = JSON.stringify({
      verdict: "malicious",
      score: 15,
      reasons: ["GSB match"],
      decidedAt: Date.now(),
    });

    await encryptedClient.set(`scan:${urlHash}`, verdict, "EX", 3600);

    const cached = await encryptedClient.get(`scan:${urlHash}`);
    expect(cached).toBeDefined();
    const parsed = JSON.parse(cached!);
    expect(parsed.verdict).toBe("malicious");
    expect(parsed.score).toBe(15);
  });

  it("should maintain message store operations", async () => {
    const messageRecord = JSON.stringify({
      chatId: "test-chat@g.us",
      messageId: "test-msg",
      urlHashes: ["hash1", "hash2"],
      createdAt: Date.now(),
    });

    await encryptedClient.set("wa:message:hash1:hash2", messageRecord, "EX", 86400);

    const retrieved = await encryptedClient.get("wa:message:hash1:hash2");
    expect(retrieved).toBeDefined();
    const parsed = JSON.parse(retrieved!);
    expect(parsed.urlHashes).toContain("hash1");
  });

  it("should maintain pairing code caching", async () => {
    const pairingData = JSON.stringify({
      code: "ABC-DEF-GHI",
      storedAt: Date.now(),
      phoneHash: "hashed_phone",
    });

    await encryptedClient.set("wa:pairing:code:phone123", pairingData, "EX", 160);

    const cached = await encryptedClient.get("wa:pairing:code:phone123");
    expect(cached).toBeDefined();
    const parsed = JSON.parse(cached!);
    expect(parsed.code).toBe("ABC-DEF-GHI");
  });

  it("should maintain session persistence", async () => {
    const sessionData = JSON.stringify({
      authenticated: true,
      wid: "test@c.us",
      createdAt: Date.now(),
    });

    await encryptedClient.set("wa:session:test", sessionData, "EX", 86400);

    const retrieved = await encryptedClient.get("wa:session:test");
    expect(retrieved).toBeDefined();
    const parsed = JSON.parse(retrieved!);
    expect(parsed.authenticated).toBe(true);
  });

  it("should maintain sorted set operations for pending acks", async () => {
    const context1 = JSON.stringify({ chatId: "chat1", messageId: "msg1", urlHash: "hash1" });
    const context2 = JSON.stringify({ chatId: "chat2", messageId: "msg2", urlHash: "hash2" });

    await encryptedClient.zadd("wa:verdict:pending_ack", Date.now(), context1);
    await encryptedClient.zadd("wa:verdict:pending_ack", Date.now() + 1, context2);

    const pending = await encryptedClient.zrange("wa:verdict:pending_ack", 0, -1);
    expect(pending.length).toBe(2);
    expect(pending.some((p) => p.includes("chat1"))).toBe(true);
  });

  it("should maintain hash operations for rate limiting", async () => {
    await encryptedClient.hset("wa:ratelimit:global", {
      tokens: "100",
      lastRefill: String(Date.now()),
    });

    const tokens = await encryptedClient.hget("wa:ratelimit:global", "tokens");
    expect(tokens).toBe("100");

    const all = await encryptedClient.hgetall("wa:ratelimit:global");
    expect(all.tokens).toBe("100");
    expect(all.lastRefill).toBeDefined();
  });

  it("should handle reconnection after encryption enabled", async () => {
    await encryptedClient.set("reconnect:test", "value", "EX", 60);

    // Simulate reconnection by creating new client with same Redis
    const newClient = createEncryptedRedis(redis, true);
    const value = await newClient.get("reconnect:test");
    expect(value).toBe("value");
  });

  it("should not break existing counter operations", async () => {
    // Counters don't need encryption, should work as pass-through
    await redis.set("counter:test", "5");
    
    const incremented = await encryptedClient.incr("counter:test");
    expect(incremented).toBe(6);

    const decremented = await encryptedClient.decr("counter:test");
    expect(decremented).toBe(5);
  });
});
