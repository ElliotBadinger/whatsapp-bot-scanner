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
      if (sql.startsWith("SELECT (SELECT COUNT(*)")) {
        return { rows: [{ scans: "10", malicious: "2", groups: "3" }] };
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
      expect(JSON.parse(res.payload)).toEqual({
        scans: 10,
        malicious: 2,
        groups: 3,
      });
      expect(dbClient.query).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  test("GET /scans/recent requires auth", async () => {
    const { app } = await buildTestServer();
    try {
      const res = await app.inject({ method: "GET", url: "/scans/recent" });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  test("GET /scans/recent returns scan rows for authorized callers", async () => {
    const now = new Date().toISOString();
    const { app, dbClient } = await buildTestServer(async (sql: string) => {
      if (sql.startsWith("SELECT id, url_hash")) {
        return {
          rows: [
            {
              id: 1,
              url_hash: "hash-1",
              normalized_url: "https://example.com/",
              verdict: "benign",
              last_seen_at: now,
            },
          ],
        };
      }
      return { rows: [] };
    });

    try {
      const res = await app.inject({
        method: "GET",
        url: "/scans/recent?limit=5",
        headers: authHeader,
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual([
        {
          id: 1,
          url_hash: "hash-1",
          normalized_url: "https://example.com/",
          verdict: "benign",
          last_seen_at: now,
        },
      ]);
      expect(dbClient.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM scans"),
        [5],
      );
    } finally {
      await app.close();
    }
  });

  test("GET /scans/recent supports cursor-based fetching", async () => {
    const now = new Date().toISOString();
    const cursor = Buffer.from(JSON.stringify({ ts: now, id: 10 })).toString(
      "base64url",
    );

    const { app, dbClient } = await buildTestServer(async (sql: string) => {
      if (sql.includes("WHERE last_seen_at >")) {
        return {
          rows: [
            {
              id: 11,
              url_hash: "hash-11",
              normalized_url: "https://example.com/new",
              verdict: "benign",
              last_seen_at: now,
            },
          ],
        };
      }
      return { rows: [] };
    });

    try {
      const res = await app.inject({
        method: "GET",
        url: `/scans/recent?limit=5&after=${encodeURIComponent(cursor)}`,
        headers: authHeader,
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual([
        {
          id: 11,
          url_hash: "hash-11",
          normalized_url: "https://example.com/new",
          verdict: "benign",
          last_seen_at: now,
        },
      ]);
      expect(dbClient.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY last_seen_at ASC"),
        [now, now, 10, 5],
      );
    } finally {
      await app.close();
    }
  });

  test("GET /scans/recent rejects invalid cursor", async () => {
    const badCursor = Buffer.from(JSON.stringify({ ts: "", id: -1 })).toString(
      "base64url",
    );

    const { app, dbClient } = await buildTestServer();

    try {
      const res = await app.inject({
        method: "GET",
        url: `/scans/recent?after=${encodeURIComponent(badCursor)}`,
        headers: authHeader,
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload)).toEqual({
        error: "invalid_after_cursor",
      });
      expect(dbClient.query).not.toHaveBeenCalled();
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
    const { app, redisClient, queue } = await buildTestServer();

    const url = "https://example.com/path";
    const normalized = normalizeUrl(url)!;
    const hash = urlHash(normalized);
    await redisClient.set(
      `scan:last-message:${hash}`,
      JSON.stringify({ chatId: "chat-1", messageId: "msg-1" }),
    );

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
