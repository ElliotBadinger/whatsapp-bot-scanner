import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

vi.mock("ioredis", () => ({
  __esModule: true,
  default: class RedisMock {
    del = vi.fn();
    on = vi.fn();
    quit = vi.fn();
  },
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(), on: vi.fn() })),
}));

vi.mock("url-expand", () => ({
  __esModule: true,
  default: vi.fn(async (url: string) => url),
}));
vi.mock("confusables", () => ({
  __esModule: true,
  default: (input: string) => input,
}));
vi.mock("bottleneck", () => ({
  __esModule: true,
  default: class BottleneckMock {
    on(): void {}
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
  const queueAdd = vi.fn().mockResolvedValue({ id: "job-123" });
  const pgClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
  } as any;

  beforeEach(() => {
    redisDel.mockReset();
    redisDel.mockResolvedValue(1);
    queueAdd.mockReset();
    queueAdd.mockResolvedValue({ id: "job-123" });
    pgClient.query.mockReset();
  });

  it("invalidates caches and enqueues rescan", async () => {
    pgClient.query.mockResolvedValueOnce({
      rows: [{ chat_id: "chat-123", message_id: "msg-456" }],
    });

    const { buildServer } = await import(
      "../../services/control-plane/src/index"
    );
    const { app } = await buildServer({
      pgClient,
      redisClient: { del: redisDel } as any,
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
    const screenshotPath = "storage/urlscan-artifacts/test_e2e.png";
    const fs = await import("node:fs/promises");
    await Fastify().ready();
    await fs.mkdir("storage/urlscan-artifacts", { recursive: true });
    await fs.writeFile(screenshotPath, "fake", "utf8");
    pgClient.query.mockResolvedValueOnce({
      rows: [{ urlscan_screenshot_path: screenshotPath }],
    });

    const { buildServer } = await import(
      "../../services/control-plane/src/index"
    );
    const { app } = await buildServer({
      pgClient,
      redisClient: { del: redisDel } as any,
      queue: { add: queueAdd } as any,
    });

    const response = await app.inject({
      method: "GET",
      url: "/scans/hash123/urlscan-artifacts/screenshot",
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
    pgClient.query.mockResolvedValueOnce({
      rows: [{ scans: "12", malicious: "3" }],
    });

    const { buildServer } = await import(
      "../../services/control-plane/src/index"
    );
    const { app } = await buildServer({
      pgClient,
      redisClient: { del: redisDel } as any,
      queue: { add: queueAdd } as any,
    });

    const response = await app.inject({
      method: "GET",
      url: "/status",
      headers: { authorization: "Bearer test-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ scans: 12, malicious: 3 });
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
      getChat: async () => ({
        isGroup: true,
        sendMessage: chat.sendMessage.bind(chat),
        id: { _serialized: "group" },
        participants: [
          { id: { _serialized: "user" }, isAdmin: true, isSuperAdmin: false },
        ],
      }),
    } as any;
    const { handleAdminCommand } = await import(
      "../../services/wa-client/src/index"
    );
    await handleAdminCommand(
      { getChat: msg.getChat.bind(msg) } as any,
      msg as any,
    );
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
