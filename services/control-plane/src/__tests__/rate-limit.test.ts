import { buildServer } from "../index";
import { createMockQueue, createMockRedis } from "../../../../test-utils/setup";
import { RATE_LIMIT_CONFIGS } from "@wbscanner/shared";

const authHeader = { authorization: "Bearer test-token" };

async function buildTestServer() {
  const dbClient = {
    query: jest.fn(async () => ({ rows: [] })),
  };
  const redisClient = createMockRedis();
  const queue = createMockQueue("scan-request");
  const { app } = await buildServer({
    dbClient,
    redisClient: redisClient as any,
    queue: queue as any,
  });
  return { app };
}

describe("Security: Rate Limiting", () => {
  test("enforces rate limits on sensitive endpoints", async () => {
    const { app } = await buildTestServer();
    const limit = RATE_LIMIT_CONFIGS.rescan.points;
    const url = "/rescan";
    const payload = { url: "https://example.com" };

    try {
      // Consume all available points
      for (let i = 0; i < limit; i++) {
        const response = await app.inject({
          method: "POST",
          url,
          headers: authHeader,
          payload,
        });
        expect(response.statusCode).not.toBe(429);
      }

      // The next request should fail with 429
      const blockedResponse = await app.inject({
        method: "POST",
        url,
        headers: authHeader,
        payload,
      });

      expect(blockedResponse.statusCode).toBe(429);
      const body = JSON.parse(blockedResponse.payload);
      expect(body.code).toBe("RATE_LIMIT");
    } finally {
      await app.close();
    }
  });

  test("different endpoints have independent limits", async () => {
    const { app } = await buildTestServer();
    try {
      // Exhaust rescan limit
      for (let i = 0; i < RATE_LIMIT_CONFIGS.rescan.points; i++) {
        await app.inject({
          method: "POST",
          url: "/rescan",
          headers: authHeader,
          payload: { url: "https://example.com" },
        });
      }

      // Verify rescan is blocked
      const blockedRescan = await app.inject({
        method: "POST",
        url: "/rescan",
        headers: authHeader,
        payload: { url: "https://example.com" },
      });
      expect(blockedRescan.statusCode).toBe(429);

      // Verify other endpoints (e.g. status) are NOT blocked
      const statusResponse = await app.inject({
        method: "GET",
        url: "/status",
        headers: authHeader,
      });

      // It should not be 429. It might be 500 or 200 depending on mock setup,
      // but the important thing is it's NOT rate limited.
      expect(statusResponse.statusCode).not.toBe(429);
    } finally {
      await app.close();
    }
  });
});
