import {
  EncryptedRedisClient,
  createEncryptedRedis,
} from "../src/redis/encrypted-client";
import { resetEncryptionKey } from "../src/crypto/redis-encryption";
import { InMemoryRedis } from "../src/testing/in-memory-redis";

describe("EncryptedRedisClient", () => {
  let redis: InMemoryRedis;
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
    redis = new InMemoryRedis();
    encryptedClient = createEncryptedRedis(redis as any, true);
  });

  describe("set/get operations", () => {
    it("should encrypt values on set and decrypt on get", async () => {
      await encryptedClient.set("test:key", "sensitive_value");

      // Raw value should be encrypted
      const raw = await redis.get("test:key");
      expect(raw).not.toBe("sensitive_value");
      expect(raw).not.toContain("sensitive");

      // Client should decrypt automatically
      const decrypted = await encryptedClient.get("test:key");
      expect(decrypted).toBe("sensitive_value");
    });

    it("should handle TTL with EX option", async () => {
      await encryptedClient.set("test:expiring", "value", "EX", 60);
      const value = await encryptedClient.get("test:expiring");
      expect(value).toBe("value");
    });

    it("should handle TTL with PX option", async () => {
      await encryptedClient.set("test:expiring-ms", "value", "PX", 60000);
      const value = await encryptedClient.get("test:expiring-ms");
      expect(value).toBe("value");
    });

    it("should return null for non-existent keys", async () => {
      const value = await encryptedClient.get("nonexistent");
      expect(value).toBeNull();
    });
  });

  describe("setex operation", () => {
    it("should encrypt values with setex", async () => {
      await encryptedClient.setex("test:setex", 60, "secret_data");
      const value = await encryptedClient.get("test:setex");
      expect(value).toBe("secret_data");
    });
  });

  describe("hash operations", () => {
    it("should encrypt values in hset/hget", async () => {
      await encryptedClient.hset("test:hash", "field1", "secret_value");

      const raw = await redis.hget("test:hash", "field1");
      expect(raw).not.toBe("secret_value");

      const decrypted = await encryptedClient.hget("test:hash", "field1");
      expect(decrypted).toBe("secret_value");
    });

    it("should encrypt all fields in hset with object", async () => {
      await encryptedClient.hset("test:hash2", {
        field1: "value1",
        field2: "value2",
      });

      const val1 = await encryptedClient.hget("test:hash2", "field1");
      const val2 = await encryptedClient.hget("test:hash2", "field2");
      expect(val1).toBe("value1");
      expect(val2).toBe("value2");
    });

    it("should decrypt all fields in hgetall", async () => {
      await encryptedClient.hset("test:hash3", "a", "alpha");
      await encryptedClient.hset("test:hash3", "b", "beta");

      const all = await encryptedClient.hgetall("test:hash3");
      expect(all.a).toBe("alpha");
      expect(all.b).toBe("beta");
    });
  });

  describe("list operations", () => {
    it("should encrypt values in lpush/lrange", async () => {
      await encryptedClient.lpush("test:list", "item1", "item2");

      const items = await encryptedClient.lrange("test:list", 0, -1);
      expect(items).toContain("item1");
      expect(items).toContain("item2");
    });

    it("should encrypt values in rpush", async () => {
      await encryptedClient.rpush("test:list2", "first", "second");

      const items = await encryptedClient.lrange("test:list2", 0, -1);
      expect(items).toContain("first");
      expect(items).toContain("second");
    });

    it("should decrypt lpop and rpop", async () => {
      await encryptedClient.rpush("test:list3", "a", "b", "c");

      const first = await encryptedClient.lpop("test:list3");
      const last = await encryptedClient.rpop("test:list3");
      expect(first).toBe("a");
      expect(last).toBe("c");
    });
  });

  describe("set operations", () => {
    it("should encrypt values in sadd/smembers", async () => {
      await encryptedClient.sadd("test:set", "member1", "member2");

      const members = await encryptedClient.smembers("test:set");
      expect(members).toContain("member1");
      expect(members).toContain("member2");
    });
  });

  describe("sorted set operations", () => {
    it("should encrypt values in zadd/zrange", async () => {
      await encryptedClient.zadd("test:zset", 1, "first");
      await encryptedClient.zadd("test:zset", 2, "second");

      const members = await encryptedClient.zrange("test:zset", 0, -1);
      expect(members).toContain("first");
      expect(members).toContain("second");
    });
  });

  describe("pass-through operations", () => {
    it("should pass through del correctly", async () => {
      await encryptedClient.set("test:del", "value");
      await encryptedClient.del("test:del");
      const value = await encryptedClient.get("test:del");
      expect(value).toBeNull();
    });

    it("should pass through exists correctly", async () => {
      await encryptedClient.set("test:exists", "value");
      const exists = await encryptedClient.exists("test:exists");
      expect(exists).toBe(1);
    });

    it("should pass through incr/decr correctly", async () => {
      await redis.set("test:counter", "5");
      const incremented = await encryptedClient.incr("test:counter");
      expect(incremented).toBe(6);

      const decremented = await encryptedClient.decr("test:counter");
      expect(decremented).toBe(5);
    });
  });

  describe("encryption disabled", () => {
    it("should store plain values when encryption is disabled", async () => {
      const plainClient = createEncryptedRedis(redis as any, false);
      await plainClient.set("test:plain", "unencrypted");

      const raw = await redis.get("test:plain");
      expect(raw).toBe("unencrypted");
    });
  });

  describe("backward compatibility", () => {
    it("should handle unencrypted values gracefully", async () => {
      // Store unencrypted value directly
      await redis.set("test:legacy", "plain_text");

      // Encrypted client should return it as-is
      const value = await encryptedClient.get("test:legacy");
      expect(value).toBe("plain_text");
    });
  });
});
