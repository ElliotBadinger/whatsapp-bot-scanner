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
});
