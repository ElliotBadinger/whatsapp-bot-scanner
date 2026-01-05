import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("ioredis", () => ({
  __esModule: true,
  default: class RedisMock {
    del = vi.fn();
    on = vi.fn();
    quit = vi.fn();
    duplicate = vi.fn(() => new RedisMock());
  },
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(), on: vi.fn() })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

beforeAll(() => {
  process.env.CONTROL_PLANE_API_TOKEN = "test-token";
});

describe("Control plane Postgres persistence", () => {
  it("persists override records through the REST API", async () => {
    const dbClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as any;
    const redisClient = { del: vi.fn() } as any;
    const queue = { add: vi.fn() } as any;

    const { buildServer } =
      await import("../../services/control-plane/src/index");
    const { app } = await buildServer({ dbClient, redisClient, queue });

    const response = await app.inject({
      method: "POST",
      url: "/overrides",
      payload: {
        url_hash: "abc",
        status: "deny",
        reason: "manual block",
      },
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO overrides"),
      expect.arrayContaining(["abc", null, "deny"]),
    );

    await app.close();
  });
});
