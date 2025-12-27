import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { request } from "undici";
import { LocalThreatDatabase } from "../../reputation/local-threat-db";

jest.mock("undici", () => ({
  request: jest.fn(),
}));

class FakePipeline {
  private readonly redis: FakeRedis;
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(redis: FakeRedis) {
    this.redis = redis;
  }

  del(key: string) {
    this.calls.push({ method: "del", args: [key] });
    this.redis.del(key);
    return this;
  }

  sadd(key: string, ...members: string[]) {
    this.calls.push({ method: "sadd", args: [key, members] });
    this.redis.sadd(key, ...members);
    return this;
  }

  set(key: string, value: string | number) {
    this.calls.push({ method: "set", args: [key, value] });
    this.redis.set(key, String(value));
    return this;
  }

  expire(key: string, ttl: number) {
    this.calls.push({ method: "expire", args: [key, ttl] });
    this.redis.expire(key, ttl);
    return this;
  }

  async exec() {
    return this.calls.map(() => [null, "OK"]);
  }
}

class FakeRedis {
  private readonly store = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly zsets = new Map<string, Map<string, number>>();
  expireCalls: Array<{ key: string; ttl: number }> = [];

  pipeline() {
    return new FakePipeline(this);
  }

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string) {
    this.store.delete(key);
    this.sets.delete(key);
    this.zsets.delete(key);
    return 1;
  }

  async sismember(key: string, value: string) {
    return this.sets.get(key)?.has(value) ? 1 : 0;
  }

  async sadd(key: string, ...values: string[]) {
    const set = this.sets.get(key) ?? new Set<string>();
    values.forEach((value) => set.add(value));
    this.sets.set(key, set);
    return set.size;
  }

  async zscore(key: string, member: string) {
    return this.zsets.get(key)?.get(member) ?? null;
  }

  async zadd(key: string, score: number, member: string) {
    const set = this.zsets.get(key) ?? new Map<string, number>();
    set.set(member, score);
    this.zsets.set(key, set);
    return 1;
  }

  async expire(key: string, ttl: number) {
    this.expireCalls.push({ key, ttl });
    return 1;
  }

  async scard(key: string) {
    return this.sets.get(key)?.size ?? 0;
  }

  async zcard(key: string) {
    return this.zsets.get(key)?.size ?? 0;
  }
}

describe("LocalThreatDatabase", () => {
  const undiciRequest = request as jest.MockedFunction<typeof request>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scores matches from OpenPhish and collaborative data", async () => {
    const redis = new FakeRedis();
    const db = new LocalThreatDatabase(redis as any, {
      feedUrl: "https://example.com/feed.txt",
      updateIntervalMs: 60000,
    });

    await redis.sadd("threat_db:openphish", "http://example.com/path");
    await redis.zadd("threat_db:collaborative", 0.9, "http://example.com/path");

    const result = await db.check("http://example.com/path?utm=123", "hash");

    expect(result.openphishMatch).toBe(true);
    expect(result.collaborativeMatch).toBe(true);
    expect(result.score).toBeGreaterThan(2);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "URL found in OpenPhish feed",
        "URL flagged by collaborative learning",
      ]),
    );
  });

  it("updates the OpenPhish feed and normalizes URLs", async () => {
    const redis = new FakeRedis();
    const db = new LocalThreatDatabase(redis as any, {
      feedUrl: "https://example.com/feed.txt",
      updateIntervalMs: 60000,
    });

    undiciRequest.mockResolvedValue({
      statusCode: 200,
      body: {
        text: async () =>
          [
            "http://Example.com/path?utm=1#frag",
            "not-a-url",
            "https://example.com/second",
          ].join("\n"),
      },
    } as any);

    await db.updateOpenPhishFeed();

    const normalized = await redis.sismember(
      "threat_db:openphish",
      "http://example.com/path",
    );
    const normalizedSecond = await redis.sismember(
      "threat_db:openphish",
      "https://example.com/second",
    );
    expect(normalized).toBe(1);
    expect(normalizedSecond).toBe(1);
  });

  it("loads OpenPhish feed from a local file without remote fetches", async () => {
    const redis = new FakeRedis();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wbscanner-"));
    const feedPath = path.join(tempDir, "openphish.txt");
    fs.writeFileSync(
      feedPath,
      "http://Example.com/path?utm=1#frag\nhttps://example.com/second",
      "utf8",
    );

    const db = new LocalThreatDatabase(redis as any, {
      feedUrl: feedPath,
      updateIntervalMs: 60000,
      allowRemoteFeeds: false,
    });

    await db.updateOpenPhishFeed();

    expect(undiciRequest).not.toHaveBeenCalled();
    const normalized = await redis.sismember(
      "threat_db:openphish",
      "http://example.com/path",
    );
    const normalizedSecond = await redis.sismember(
      "threat_db:openphish",
      "https://example.com/second",
    );
    expect(normalized).toBe(1);
    expect(normalizedSecond).toBe(1);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("handles OpenPhish failures without throwing", async () => {
    const redis = new FakeRedis();
    const db = new LocalThreatDatabase(redis as any, {
      feedUrl: "https://example.com/feed.txt",
      updateIntervalMs: 60000,
    });

    undiciRequest.mockResolvedValue({
      statusCode: 500,
      body: {
        text: async () => "error",
      },
    } as any);

    await expect(db.updateOpenPhishFeed()).resolves.toBeUndefined();
  });

  it("records collaborative verdicts for suspicious and malicious URLs", async () => {
    const redis = new FakeRedis();
    const db = new LocalThreatDatabase(redis as any, {
      feedUrl: "https://example.com/feed.txt",
      updateIntervalMs: 60000,
    });

    await db.recordVerdict("http://example.com/path?utm=1", "suspicious", 0.8);
    await db.recordVerdict("http://example.com/path2", "malicious", 0.9);
    await db.recordVerdict("http://example.com/benign", "benign", 0.7);

    expect(
      await redis.zscore("threat_db:collaborative", "http://example.com/path"),
    ).toBe(0.4);
    expect(
      await redis.zscore("threat_db:collaborative", "http://example.com/path2"),
    ).toBe(0.9);
    expect(
      await redis.zscore(
        "threat_db:collaborative",
        "http://example.com/benign",
      ),
    ).toBeNull();
    expect(redis.expireCalls.length).toBe(2);
  });

  it("returns zeroed stats on redis errors", async () => {
    const redis = new FakeRedis();
    const db = new LocalThreatDatabase(redis as any, {
      feedUrl: "https://example.com/feed.txt",
      updateIntervalMs: 60000,
    });
    const scardSpy = jest
      .spyOn(redis, "scard")
      .mockRejectedValue(new Error("fail"));

    const stats = await db.getStats();

    expect(stats).toEqual({ openphishCount: 0, collaborativeCount: 0 });
    scardSpy.mockRestore();
  });
});
