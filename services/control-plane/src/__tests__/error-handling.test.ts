import { buildServer } from "../index";
import { createMockQueue, createMockRedis } from "../../../../test-utils/setup";

describe("control-plane error handling", () => {
  const originalEnv = process.env.NODE_ENV;
  const authHeader = { authorization: "Bearer test-token" };

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  async function buildTestServer() {
    const dbClient = { query: jest.fn(async () => ({ rows: [] })) };
    const redisClient = createMockRedis();
    const queue = createMockQueue("scan-request");
    const { app } = await buildServer({
      dbClient,
      redisClient: redisClient as any,
      queue: queue as any,
    });
    return { app, dbClient };
  }

  it("sanitizes validation details in production", async () => {
    process.env.NODE_ENV = "production";
    const { app } = await buildTestServer();

    const response = await app.inject({
      method: "POST",
      url: "/overrides",
      headers: authHeader,
      payload: { invalid: "data" },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload) as Record<string, unknown>;
    expect(body).toEqual({ message: "Invalid request", code: "VALIDATION_ERROR" });

    await app.close();
  });

  it("returns generic messaging for internal errors", async () => {
    process.env.NODE_ENV = "production";
    const dbClient = {
      query: jest.fn(async () => {
        throw new Error("connection pool exhausted");
      }),
    };
    const redisClient = createMockRedis();
    const queue = createMockQueue("scan-request");
    const { app } = await buildServer({
      dbClient: dbClient as any,
      redisClient: redisClient as any,
      queue: queue as any,
    });

    const response = await app.inject({
      method: "GET",
      url: "/status",
      headers: authHeader,
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload) as Record<string, unknown>;
    expect(body.message).toBe("Internal server error");
    expect(body).not.toHaveProperty("stack");

    await app.close();
  });
});
