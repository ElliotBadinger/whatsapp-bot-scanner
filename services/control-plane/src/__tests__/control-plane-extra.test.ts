import { createMockQueue, createMockRedis } from "../../../../test-utils/setup";

jest.mock("node:fs/promises", () => ({
  access: jest.fn(async () => undefined),
  readFile: jest.fn(async () => "<html/>"),
}));

jest.mock("node:fs", () => ({
  createReadStream: jest.fn(() => ({ on: jest.fn() })),
}));

const fsPromises = jest.requireMock("node:fs/promises") as {
  access: jest.Mock;
  readFile: jest.Mock;
};

const authHeader = { authorization: "Bearer test-token" };

describe("control-plane extra routes", () => {
  let buildServer: typeof import("../index").buildServer;

  beforeAll(async () => {
    process.env.URLSCAN_ARTIFACT_DIR = "/tmp/urlscan-artifacts";
    ({ buildServer } = await import("../index"));
  });

  it("lists overrides and updates group mute/unmute", async () => {
    const dbClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith("SELECT * FROM overrides")) {
          return { rows: [{ id: 1 }] };
        }
        return { rows: [] };
      }),
    };
    const redisClient = createMockRedis();
    const queue = createMockQueue("scan-request");
    const { app } = await buildServer({
      dbClient,
      redisClient: redisClient as any,
      queue: queue as any,
    });

    try {
      const overrides = await app.inject({
        method: "GET",
        url: "/overrides",
        headers: authHeader,
      });
      expect(overrides.statusCode).toBe(200);

      const mute = await app.inject({
        method: "POST",
        url: "/groups/group-1/mute",
        headers: authHeader,
      });
      expect(mute.statusCode).toBe(200);

      const unmute = await app.inject({
        method: "POST",
        url: "/groups/group-1/unmute",
        headers: authHeader,
      });
      expect(unmute.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("handles urlscan artifact routes", async () => {
    const screenshotPath = "/tmp/urlscan-artifacts/test.png";
    const domPath = "/tmp/urlscan-artifacts/test.html";
    const dbClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("urlscan_screenshot_path")) {
          return { rows: [{ urlscan_screenshot_path: screenshotPath }] };
        }
        if (sql.includes("urlscan_dom_path")) {
          return { rows: [{ urlscan_dom_path: domPath }] };
        }
        return { rows: [] };
      }),
    };
    const redisClient = createMockRedis();
    const queue = createMockQueue("scan-request");
    const { app } = await buildServer({
      dbClient,
      redisClient: redisClient as any,
      queue: queue as any,
    });
    const validHash = "c".repeat(64);

    try {
      const missing = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/dom`,
        headers: authHeader,
      });
      expect(missing.statusCode).toBe(200);

      fsPromises.access.mockRejectedValueOnce({ code: "ENOENT" });
      const screenshotMissing = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/screenshot`,
        headers: authHeader,
      });
      expect(screenshotMissing.statusCode).toBe(404);

      fsPromises.readFile.mockRejectedValueOnce({ code: "EACCES" });
      const domFailure = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/dom`,
        headers: authHeader,
      });
      expect(domFailure.statusCode).toBe(500);
    } finally {
      await app.close();
    }
  });

  it("returns 404 when artifact path not found in database", async () => {
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
    const validHash = "d".repeat(64);

    try {
      const screenshot = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/screenshot`,
        headers: authHeader,
      });
      expect(screenshot.statusCode).toBe(404);
      expect(JSON.parse(screenshot.payload).error).toBe("screenshot_not_found");

      const dom = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/dom`,
        headers: authHeader,
      });
      expect(dom.statusCode).toBe(404);
      expect(JSON.parse(dom.payload).error).toBe("dom_not_found");
    } finally {
      await app.close();
    }
  });

  it("handles rescan without chat context in database", async () => {
    const dbClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith("SELECT chat_id")) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
    const redisClient = createMockRedis();
    const queue = createMockQueue("scan-request");
    const { app } = await buildServer({
      dbClient,
      redisClient: redisClient as any,
      queue: queue as any,
    });

    try {
      const res = await app.inject({
        method: "POST",
        url: "/rescan",
        headers: authHeader,
        payload: { url: "https://example.com/test" },
      });
      expect(res.statusCode).toBe(200);
      expect(queue.add).toHaveBeenCalledWith(
        "rescan",
        expect.objectContaining({
          rescan: true,
        }),
        expect.any(Object),
      );
      // Should not have chatId/messageId when not found in DB
      const callArgs = (queue.add as jest.Mock).mock.calls[0][1];
      expect(callArgs.chatId).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("handles mute/unmute with invalid params", async () => {
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

    try {
      // Test with empty chatId - should still work as schema validates string
      const mute = await app.inject({
        method: "POST",
        url: "/groups//mute",
        headers: authHeader,
      });
      // Empty path param should result in 404 or validation error
      expect(mute.statusCode).toBeGreaterThanOrEqual(400);
    } finally {
      await app.close();
    }
  });

  it("handles screenshot file access errors other than ENOENT", async () => {
    const screenshotPath = "/tmp/urlscan-artifacts/error.png";
    const dbClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("urlscan_screenshot_path")) {
          return { rows: [{ urlscan_screenshot_path: screenshotPath }] };
        }
        return { rows: [] };
      }),
    };
    const redisClient = createMockRedis();
    const queue = createMockQueue("scan-request");
    const { app } = await buildServer({
      dbClient,
      redisClient: redisClient as any,
      queue: queue as any,
    });
    const validHash = "e".repeat(64);

    try {
      fsPromises.access.mockRejectedValueOnce({ code: "EACCES" });
      const res = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/screenshot`,
        headers: authHeader,
      });
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.payload).error).toBe("artifact_unavailable");
    } finally {
      await app.close();
    }
  });

  it("handles DOM file ENOENT error", async () => {
    const domPath = "/tmp/urlscan-artifacts/missing.html";
    const dbClient = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("urlscan_dom_path")) {
          return { rows: [{ urlscan_dom_path: domPath }] };
        }
        return { rows: [] };
      }),
    };
    const redisClient = createMockRedis();
    const queue = createMockQueue("scan-request");
    const { app } = await buildServer({
      dbClient,
      redisClient: redisClient as any,
      queue: queue as any,
    });
    const validHash = "f".repeat(64);

    try {
      fsPromises.readFile.mockRejectedValueOnce({ code: "ENOENT" });
      const res = await app.inject({
        method: "GET",
        url: `/scans/${validHash}/urlscan-artifacts/dom`,
        headers: authHeader,
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.payload).error).toBe("dom_not_found");
    } finally {
      await app.close();
    }
  });

  it("rejects rescan with invalid body schema", async () => {
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

    try {
      const res = await app.inject({
        method: "POST",
        url: "/rescan",
        headers: authHeader,
        payload: { invalid_field: "no url field" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe("invalid_body");
    } finally {
      await app.close();
    }
  });

  it("exposes metrics endpoint without auth", async () => {
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

    try {
      const res = await app.inject({
        method: "GET",
        url: "/metrics",
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
    } finally {
      await app.close();
    }
  });
});
