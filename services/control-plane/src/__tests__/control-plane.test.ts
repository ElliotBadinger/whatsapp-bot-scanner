import { buildServer } from "../index";
import { normalizeUrl, urlHash } from "@wbscanner/shared";
import { createMockQueue, createMockRedis } from "../../../../test-utils/setup";

const authHeader = { authorization: "Bearer test-token" };

async function buildTestServer(
  dbQueryImpl?: (sql: string) => Promise<{ rows: unknown[] }>,
) {
  const dbClient = {
    query: jest.fn(dbQueryImpl ?? (async () => ({ rows: [] }))),
  };
  const redisClient = createMockRedis();
  const queue = createMockQueue("scan-request");
  const { app } = await buildServer({
    dbClient,
    redisClient: redisClient as any,
    queue: queue as any,
  });
  return { app, dbClient, redisClient, queue };
}

describe("control-plane buildServer", () => {
  test("GET /healthz is public and returns ok", async () => {
    const { app } = await buildTestServer();
    try {
      const res = await app.inject({ method: "GET", url: "/healthz" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  });

  test("GET /status requires auth", async () => {
    const { app } = await buildTestServer();
    try {
      const res = await app.inject({ method: "GET", url: "/status" });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  test("GET /status returns counts for authorized callers", async () => {
    const { app, dbClient } = await buildTestServer(async (sql: string) => {
      if (sql.startsWith("SELECT COUNT(*)")) {
        return { rows: [{ scans: "10", malicious: "2" }] };
      }
      return { rows: [] };
    });
    try {
      const res = await app.inject({
        method: "GET",
        url: "/status",
        headers: authHeader,
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ scans: 10, malicious: 2 });
      expect(dbClient.query).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  test("POST /overrides rejects invalid bodies", async () => {
    const { app } = await buildTestServer();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/overrides",
        headers: authHeader,
        payload: { status: "deny" },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  test("POST /overrides inserts valid overrides", async () => {
    const { app, dbClient } = await buildTestServer();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/overrides",
        headers: authHeader,
        payload: { url_hash: "abc", status: "deny" },
      });
      expect(res.statusCode).toBe(201);
      expect(dbClient.query).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  test("POST /rescan rejects URLs that cannot be normalized", async () => {
    const { app } = await buildTestServer();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/rescan",
        headers: authHeader,
        payload: { url: "ftp://example.com" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe("invalid_url");
    } finally {
      await app.close();
    }
  });

  test("POST /rescan clears caches and enqueues rescan job", async () => {
    const { app, dbClient, redisClient, queue } = await buildTestServer(
      async (sql: string) => {
        if (sql.startsWith("SELECT chat_id")) {
          return { rows: [{ chat_id: "chat-1", message_id: "msg-1" }] };
        }
        return { rows: [] };
      },
    );

    const url = "https://example.com/path";
    const normalized = normalizeUrl(url)!;
    const hash = urlHash(normalized);

    try {
      const res = await app.inject({
        method: "POST",
        url: "/rescan",
        headers: authHeader,
        payload: { url },
      });
      expect(res.statusCode).toBe(200);
      expect(queue.add).toHaveBeenCalledWith(
        "rescan",
        expect.objectContaining({
          url: normalized,
          urlHash: hash,
          rescan: true,
          chatId: "chat-1",
          messageId: "msg-1",
        }),
        expect.objectContaining({ priority: 1 }),
      );
      expect(redisClient.del).toHaveBeenCalled();
      expect(dbClient.query).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  test("GET /scans/:urlHash/urlscan-artifacts validates parameters", async () => {
    const { app } = await buildTestServer();
    const validHash = "a".repeat(64);
    try {
      const invalidHash = await app.inject({
        method: "GET",
        url: "/scans/not-a-hash/urlscan-artifacts/screenshot",
        headers: authHeader,
      });
      expect(invalidHash.statusCode).toBe(400);

      const invalidType = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/unknown`,
        headers: authHeader,
      });
      expect(invalidType.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  test("GET /scans/:urlHash/urlscan-artifacts blocks traversal outside root", async () => {
    const { app } = await buildTestServer(async (sql: string) => {
      if (sql.startsWith("SELECT urlscan_screenshot_path")) {
        return { rows: [{ urlscan_screenshot_path: "/tmp/outside.png" }] };
      }
      return { rows: [] };
    });
    const validHash = "b".repeat(64);
    try {
      const res = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/screenshot`,
        headers: authHeader,
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
