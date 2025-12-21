import {
  createApiRateLimiter,
  consumeRateLimit,
  RATE_LIMIT_CONFIGS,
} from "../src/rate-limiter";

describe("Rate Limiter", () => {
  describe("createApiRateLimiter", () => {
    it("should create an in-memory limiter in test mode", () => {
      const limiter = createApiRateLimiter(null, RATE_LIMIT_CONFIGS.api);
      expect(limiter).toBeDefined();
    });

    it("should create limiter with custom config", () => {
      const config = {
        points: 50,
        duration: 30,
        keyPrefix: "test:rate",
        blockDuration: 10,
      };
      const limiter = createApiRateLimiter(null, config);
      expect(limiter).toBeDefined();
    });

    it("should require Redis outside tests unless allowMemory is set", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      expect(() => createApiRateLimiter(null, RATE_LIMIT_CONFIGS.api)).toThrow(
        /Redis is required/i,
      );
      const limiter = createApiRateLimiter(null, RATE_LIMIT_CONFIGS.api, {
        allowMemory: true,
      });
      expect(limiter).toBeDefined();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("consumeRateLimit", () => {
    it("should allow requests within limit", async () => {
      const limiter = createApiRateLimiter(null, {
        points: 5,
        duration: 60,
        keyPrefix: "test:consume",
      });

      const result = await consumeRateLimit(limiter, "test-key");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should track remaining points correctly", async () => {
      const limiter = createApiRateLimiter(null, {
        points: 3,
        duration: 60,
        keyPrefix: "test:track",
      });

      const result1 = await consumeRateLimit(limiter, "track-key");
      expect(result1.remaining).toBe(2);

      const result2 = await consumeRateLimit(limiter, "track-key");
      expect(result2.remaining).toBe(1);

      const result3 = await consumeRateLimit(limiter, "track-key");
      expect(result3.remaining).toBe(0);
    });

    it("should deny requests when limit exceeded", async () => {
      const limiter = createApiRateLimiter(null, {
        points: 2,
        duration: 60,
        keyPrefix: "test:exceed",
      });

      await consumeRateLimit(limiter, "exceed-key");
      await consumeRateLimit(limiter, "exceed-key");

      const result = await consumeRateLimit(limiter, "exceed-key");
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it("should track different keys independently", async () => {
      const limiter = createApiRateLimiter(null, {
        points: 2,
        duration: 60,
        keyPrefix: "test:keys",
      });

      await consumeRateLimit(limiter, "key-a");
      await consumeRateLimit(limiter, "key-a");
      const resultA = await consumeRateLimit(limiter, "key-a");
      expect(resultA.allowed).toBe(false);

      const resultB = await consumeRateLimit(limiter, "key-b");
      expect(resultB.allowed).toBe(true);
    });

    it("should rethrow non-rate-limit errors", async () => {
      const limiter = {
        consume: async () => {
          throw new Error("redis down");
        },
      } as any;
      await expect(consumeRateLimit(limiter, "key")).rejects.toThrow(
        /redis down/i,
      );
    });
  });

  describe("RATE_LIMIT_CONFIGS", () => {
    it("should have api config", () => {
      expect(RATE_LIMIT_CONFIGS.api).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.api.points).toBeGreaterThan(0);
      expect(RATE_LIMIT_CONFIGS.api.duration).toBeGreaterThan(0);
    });

    it("should have override config", () => {
      expect(RATE_LIMIT_CONFIGS.override).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.override.points).toBeLessThan(
        RATE_LIMIT_CONFIGS.api.points,
      );
    });

    it("should have rescan config", () => {
      expect(RATE_LIMIT_CONFIGS.rescan).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.rescan.points).toBeLessThan(
        RATE_LIMIT_CONFIGS.override.points,
      );
    });
  });
});
