import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

vi.mock("ioredis", () => ({
  __esModule: true,
  default: class RedisMock {
    del = vi.fn();
    on = vi.fn();
    quit = vi.fn();
  },
}));

vi.mock("bullmq", () => ({
  Queue: class QueueMock {
    add = vi.fn();
    on = vi.fn();
    constructor() {
      // no-op
    }
  },
}));

vi.mock("confusables", () => ({
  __esModule: true,
  default: (input: string) => input,
}));
vi.mock("bottleneck", () => ({
  __esModule: true,
  default: class BottleneckMock {
    on(): void {
      // intentionally no-op: event subscriptions are not required for test limiter
    }
    async currentReservoir(): Promise<number> {
      return 1;
    }
    schedule<T>(fn: (...args: any[]) => T, ...params: any[]): Promise<T> {
      return Promise.resolve(fn(...params));
    }
  },
}));

process.env.CONTROL_PLANE_API_TOKEN = "test-token";

describe("Control plane integration", () => {
  const redisDel = vi.fn().mockResolvedValue(1);
  const redisGet = vi.fn().mockResolvedValue(null);
  const queueAdd = vi.fn().mockResolvedValue({ id: "job-123" });
  const dbClient = {
    query: vi.fn(),
  } as any;

  beforeEach(() => {
    redisDel.mockReset();
    redisDel.mockResolvedValue(1);
    redisGet.mockReset();
    redisGet.mockResolvedValue(null);
    queueAdd.mockReset();
    queueAdd.mockResolvedValue({ id: "job-123" });
    dbClient.query.mockReset();
  });

  it("invalidates caches and enqueues rescan", async () => {
    dbClient.query.mockResolvedValueOnce({
      rows: [{ chat_id: "chat-123", message_id: "msg-456" }],
    });

    const { buildServer } =
      await import("../../services/control-plane/src/index");
    const { app } = await buildServer({
      dbClient,
      redisClient: { del: redisDel, get: redisGet } as any,
      queue: { add: queueAdd } as any,
    });

    const response = await app.inject({
      method: "POST",
      url: "/rescan",
      payload: { url: "http://example.com" },
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(redisDel).toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledWith(
      "rescan",
      expect.objectContaining({
        url: "http://example.com/",
        urlHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      expect.objectContaining({
        removeOnComplete: true,
        removeOnFail: 100,
        priority: 1,
      }),
    );
    const body = response.json();
    expect(body).toEqual({
      ok: true,
      urlHash: expect.any(String),
      jobId: "job-123",
    });
  });

  it("streams stored artifacts from disk", async () => {
    const urlHash =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const screenshotPath = resolve(
      process.env.URLSCAN_ARTIFACT_DIR ||
        resolve(repoRoot, "storage/urlscan-artifacts"),
      "test_e2e.png",
    );
    const fs = await import("node:fs/promises");
    await Fastify().ready();
    await fs.mkdir(dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, "fake", "utf8");
    dbClient.query.mockResolvedValueOnce({
      rows: [{ urlscan_screenshot_path: screenshotPath }],
    });

    const { buildServer } =
      await import("../../services/control-plane/src/index");
    const { app } = await buildServer({
      dbClient,
      redisClient: { del: redisDel, get: redisGet } as any,
      queue: { add: queueAdd } as any,
    });

    const response = await app.inject({
      method: "GET",
      url: `/scans/${urlHash}/urlscan-artifacts/screenshot`,
      headers: { authorization: "Bearer test-token" },
    });

    expect(response.statusCode).toBe(200);
    async function extractBody(resp: any): Promise<string | undefined> {
      if (resp.body && resp.body.length > 0) return resp.body;
      if (resp.payload && resp.payload.length > 0) return resp.payload;
      const rawPayload = resp.rawPayload as Buffer | undefined;
      if (rawPayload?.length) return rawPayload.toString("utf8");
      const rawBody = resp.rawBody as Buffer | undefined;
      if (rawBody?.length) return rawBody.toString("utf8");
      if (resp.stream && typeof resp.stream.on === "function") {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          resp.stream.on("data", (chunk: Buffer | string) => {
            chunks.push(
              typeof chunk === "string"
                ? Buffer.from(chunk)
                : Buffer.from(chunk),
            );
          });
          resp.stream.on("error", reject);
          resp.stream.on("end", resolve);
        });
        if (chunks.length) {
          return Buffer.concat(chunks).toString("utf8");
        }
      }
      return undefined;
    }

    const payload = await extractBody(response);
    if (payload !== undefined) {
      expect(payload).toBe("fake");
    } else {
      expect((response as any).stream).toBeDefined();
    }
    await fs.unlink(screenshotPath);
  });

  it("reports scan status via /status endpoint", async () => {
    dbClient.query.mockResolvedValueOnce({
      rows: [{ scans: "12", malicious: "3" }],
    });

    const { buildServer } =
      await import("../../services/control-plane/src/index");
    const { app } = await buildServer({
      dbClient,
      redisClient: { del: redisDel, get: redisGet } as any,
      queue: { add: queueAdd } as any,
    });

    const response = await app.inject({
      method: "GET",
      url: "/status",
      headers: { authorization: "Bearer test-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      scans: 12,
      malicious: 3,
      groups: 0,
    });
  });
});

describe("WA admin command integration", () => {
  beforeAll(() => {
    process.env.CONTROL_PLANE_BASE = "http://control-plane:8080";
  });

  it("invokes control-plane rescan endpoint", async () => {
    const fetchMock = vi.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, urlHash: "hash123", jobId: "job-1" }),
    } as any);
    const chat = { sendMessage: vi.fn(), id: { _serialized: "group" } } as any;
    const msg = {
      body: "!scanner rescan http://example.com",
      author: "user",
      from: "user",
      getContact: async () => ({ id: { _serialized: "user" } }),
      getChat: async () => ({
        isGroup: true,
        sendMessage: chat.sendMessage.bind(chat),
        id: { _serialized: "group" },
        participants: [
          { id: { _serialized: "user" }, isAdmin: true, isSuperAdmin: false },
        ],
      }),
    } as any;
    const { handleAdminCommand } =
      await import("../../services/wa-client/src/index");
    const fakeClient = {} as any;
    const fakeRedis = {} as any;
    await handleAdminCommand(fakeClient, msg as any, undefined, fakeRedis);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/rescan"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "Rescan queued. hash=hash123 job=job-1",
    );
    fetchMock.mockRestore();
  });
});
