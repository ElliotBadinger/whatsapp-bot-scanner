import { buildServer } from "../src/index";
import { config } from "@wbscanner/shared";
import Redis from "ioredis";
import { FastifyInstance } from "fastify";

describe("Control Plane Rate Limiting", () => {
  let app: FastifyInstance;
  let dbClientMock: { query: jest.Mock };
  let redisMock: Redis;

  beforeEach(async () => {
    dbClientMock = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    redisMock = new Redis();

    const result = await buildServer({
      dbClient: dbClientMock,
      redisClient: redisMock,
      queue: { add: jest.fn().mockResolvedValue({ id: "1" }) } as any,
    });
    app = result.app;
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it("should rate limit rescan endpoint", async () => {
    const token = config.controlPlane.token;
    const headers = { Authorization: `Bearer ${token}` };
    const body = { url: "http://example.com" };

    // Limit is 10 per minute for rescan
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        app.inject({
          method: "POST",
          url: "/rescan",
          headers,
          payload: body,
        }),
      );
    }

    const results = await Promise.all(promises);
    results.forEach((res) => {
      expect(res.statusCode).toBe(200);
    });

    // 11th request should fail
    const blocked = await app.inject({
      method: "POST",
      url: "/rescan",
      headers,
      payload: body,
    });

    expect(blocked.statusCode).toBe(429);
  });
});
