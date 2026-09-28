import { afterEach, describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";

const redisState = {
  store: new Map<string, string>(),
  ttlStore: new Map<string, number>(),
  getMock: vi.fn(async (key: string) => redisState.store.get(key) ?? null),
  setMock: vi.fn(async (key: string, value: string) => {
    redisState.store.set(key, value);
    return "OK";
  }),
  delMock: vi.fn(async (key: string) => {
    const existed = redisState.store.delete(key);
    redisState.ttlStore.delete(key);
    return existed ? 1 : 0;
  }),
  ttlMock: vi.fn(async (key: string) => {
    return redisState.ttlStore.get(key) ?? -1;
  }),
};

vi.mock("undici", () => ({
  __esModule: true,
  request: vi.fn(),
}));

afterEach(() => {
  redisState.store.clear();
  redisState.ttlStore.clear();
  redisState.getMock.mockClear();
  redisState.setMock.mockClear();
  redisState.delMock.mockClear();
  redisState.ttlMock.mockClear();
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete (globalThis as any).__WBSCANNER_TEST_REDIS__;
  vi.clearAllMocks();
});

describe("Scan orchestrator Redis caching", () => {
  it("stores and reuses cached GSB results", async () => {
    const undici = await import("undici");
    vi.mocked(undici.request).mockResolvedValue({
      statusCode: 200,
      body: {
        json: async () => ({
          matches: [
            {
              threatType: "MALWARE",
              platformType: "ANY_PLATFORM",
              threatEntryType: "URL",
              threat: { url: "https://cache.test" },
            },
          ],
        }),
      },
    } as any);

    const redisStub = {
      get: redisState.getMock,
      set: vi.fn(
        async (
          key: string,
          value: string,
          mode?: string,
          ttlArg?: number,
          nxMode?: string,
        ) => {
          if (mode === "EX") {
            const ttl = typeof ttlArg === "number" ? ttlArg : 0;
            if (nxMode === "NX" && redisState.store.has(key)) {
              return null;
            }
            redisState.ttlStore.set(key, ttl);
            await redisState.setMock(key, value);
            return "OK";
          }
          await redisState.setMock(key, value);
          return "OK";
        },
      ),
      del: redisState.delMock,
      ttl: redisState.ttlMock,
    } as unknown as Redis;

    const orchestrator =
      await import("../../services/scan-orchestrator/src/index");
    const { fetchGsbAnalysis } = orchestrator.__testables;
    orchestrator.__testables.setRedisForTests(redisStub);

    const first = await fetchGsbAnalysis("https://cache.test", "abc123");

    expect(first.fromCache).toBe(false);
    expect(redisState.getMock).toHaveBeenCalledWith("url:analysis:abc123:gsb");
    expect(redisState.setMock).toHaveBeenCalledWith(
      "url:analysis:abc123:gsb",
      expect.stringContaining('"threatType":"MALWARE"'),
    );

    const requestCount = vi.mocked(undici.request).mock.calls.length;

    const second = await fetchGsbAnalysis("https://cache.test", "abc123");
    expect(second.fromCache).toBe(true);
    expect(vi.mocked(undici.request).mock.calls.length).toBe(requestCount);
    expect(second.matches[0]?.threat).toBe("https://cache.test");
  });
});
