import Redis from "ioredis";
import {
  createEncryptedRedis,
  resetEncryptionKey,
  EncryptedRedisClient,
} from "@wbscanner/shared";

describe("Redis Encryption Integration", () => {
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

  it("should store encrypted values that cannot be read directly", async () => {
    const sensitiveData = "pairing_code_ABC123";
    await encryptedClient.set("test:sensitive", sensitiveData, "EX", 60);

    // Raw access should show encrypted data
    const raw = await redis.get("test:sensitive");
    expect(raw).not.toBe(sensitiveData);
    expect(raw).not.toContain("ABC123");
    expect(raw).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/i);

    // Encrypted client should decrypt
    const decrypted = await encryptedClient.get("test:sensitive");
    expect(decrypted).toBe(sensitiveData);
  });

  it("should protect hash values from direct access", async () => {
    await encryptedClient.hset("test:session", {
      token: "secret_session_token",
      userId: "user_12345",
    });

    // Raw hash values should be encrypted
    const rawToken = await redis.hget("test:session", "token");
    expect(rawToken).not.toBe("secret_session_token");
    expect(rawToken).not.toContain("secret");

    // Encrypted client retrieves correctly
    const token = await encryptedClient.hget("test:session", "token");
    expect(token).toBe("secret_session_token");
  });

  it("should maintain data integrity across operations", async () => {
    const testData = {
      url: "http://malicious-site.com/phishing",
      verdict: "malicious",
      score: "15",
    };

    await encryptedClient.hset("test:scan:result", testData);

    const result = await encryptedClient.hgetall("test:scan:result");
    expect(result.url).toBe(testData.url);
    expect(result.verdict).toBe(testData.verdict);
    expect(result.score).toBe(testData.score);
  });

  it("should handle list operations with encryption", async () => {
    const sensitiveItems = ["secret1", "secret2", "secret3"];
    await encryptedClient.rpush("test:queue", ...sensitiveItems);

    // Verify encryption
    const rawItems = await redis.lrange("test:queue", 0, -1);
    for (const raw of rawItems) {
      expect(sensitiveItems).not.toContain(raw);
    }

    // Verify decryption
    const items = await encryptedClient.lrange("test:queue", 0, -1);
    expect(items).toEqual(sensitiveItems);
  });

  it("should preserve TTL when setting encrypted values", async () => {
    await encryptedClient.set("test:ttl", "value", "EX", 60);

    const ttl = await encryptedClient.ttl("test:ttl");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it("should handle concurrent encrypted operations", async () => {
    const operations = Array.from({ length: 50 }, (_, i) => ({
      key: `test:concurrent:${i}`,
      value: `secret_value_${i}`,
    }));

    // Concurrent writes
    await Promise.all(
      operations.map(({ key, value }) =>
        encryptedClient.set(key, value, "EX", 60),
      ),
    );

    // Concurrent reads
    const results = await Promise.all(
      operations.map(({ key }) => encryptedClient.get(key)),
    );

    // Verify all values
    results.forEach((result, i) => {
      expect(result).toBe(`secret_value_${i}`);
    });
  });

  it("should handle backward compatibility with unencrypted data", async () => {
    // Simulate legacy unencrypted data
    await redis.set("test:legacy", "plain_text_value");

    // Encrypted client should return it as-is
    const value = await encryptedClient.get("test:legacy");
    expect(value).toBe("plain_text_value");
  });
});
