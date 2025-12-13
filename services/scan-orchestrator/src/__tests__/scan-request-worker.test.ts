process.env.NODE_ENV = "test";
process.env.URLSCAN_CALLBACK_SECRET = "test-secret";

/**
 * This is a "worker invocation" unit test that calls the scan-request worker handler directly
 * (DI style) instead of booting BullMQ/Redis/PG.
 *
 * It intentionally focuses on the bug/regression:
 * - rescan jobs may not have chatId/messageId
 * - timestamp may be absent (worker can fall back to job.timestamp/started)
 * - schema validation must not reject rescan jobs
 */

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue("PONG"),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    ttl: jest.fn().mockResolvedValue(-1),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

jest.mock("bullmq", () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: "job-queued" }),
    })),
    Worker: jest.fn().mockImplementation(() => ({})),
  };
});

jest.mock("pg", () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue({ rows: [] }),
      end: jest.fn().mockResolvedValue(null),
    })),
  };
});

import { __testables, handleScanRequestJob } from "../index";

type JobLike = {
  id?: string;
  data: unknown;
  timestamp?: number;
  attemptsMade: number;
};

function createDbClientStub() {
  return {
    query: jest.fn(async () => ({ rows: [] as unknown[] })),
    transaction: jest.fn(async (fn: () => unknown | Promise<unknown>) => {
      return await fn();
    }),
    close: jest.fn(() => undefined),
    getDatabase: jest.fn(() => ({})),
  };
}

function createEnhancedSecurityStub() {
  return {
    analyze: jest.fn(async () => ({
      verdict: null,
      confidence: undefined,
      score: 0,
      reasons: [],
      skipExternalAPIs: false,
    })),
  };
}

describe("scan request worker handler (invocation)", () => {
  it("processes a rescan job without chat context (does not fail validation; reaches cache lookup)", async () => {
    expect(typeof handleScanRequestJob).toBe("function");
    expect((__testables as any).handleScanRequestJob).toBe(
      handleScanRequestJob,
    );

    const calls = {
      getCachedVerdict: 0,
      handleCachedVerdict: 0,
      analyzeUrl: 0,
      recordQueueMetrics: 0,
      refreshQueueMetrics: 0,
    };

    const nowBase = 1_700_000_000_000;
    const now = jest.fn(() => nowBase);

    const deps = {
      queueName: "scan-request",
      now,
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      } as unknown,
      metrics: {
        queueJobWait: { labels: () => ({ observe: jest.fn() }) },
        homographDetections: { labels: () => ({ inc: jest.fn() }) },
        homoglyphDetections: { labels: () => ({ inc: jest.fn() }) },
        fastPathLatency: { observe: jest.fn() },
        scanPathCounter: { labels: () => ({ inc: jest.fn() }) },
        queueFailures: { labels: () => ({ inc: jest.fn() }) },
        queueProcessingDuration: { labels: () => ({ observe: jest.fn() }) },
      } as unknown,
      scanRequestQueue: {} as unknown,
      deepScanQueue: { add: jest.fn().mockResolvedValue(undefined) } as unknown,

      // Injected deps (DI): provide full IDatabaseConnection + compatible EnhancedSecurityAnalyzer
      dbClient: createDbClientStub(),
      enhancedSecurity: createEnhancedSecurityStub(),

      normalizeUrl: jest.fn((u: string) => u),
      urlHash: jest.fn((_u: string) => "h"),

      getCachedVerdict: jest.fn(async (_cacheKey: string) => {
        calls.getCachedVerdict += 1;
        return null;
      }),
      handleCachedVerdict: jest.fn(async () => {
        calls.handleCachedVerdict += 1;
      }),

      analyzeUrl: jest.fn(async () => {
        calls.analyzeUrl += 1;
        throw new Error(
          "stop-after-validation: analyzeUrl called (expected for this test)",
        );
      }),

      detectHomoglyphs: jest.fn((_hostname: string) => ({
        detected: false,
        riskLevel: "low",
        confusableChars: [],
      })),

      performBlocklistChecks: jest.fn(async () => {
        throw new Error("not-reached");
      }),
      generateVerdict: jest.fn(async () => {
        throw new Error("not-reached");
      }),
      storeAndDispatchResults: jest.fn(async () => {
        throw new Error("not-reached");
      }),
      handleHighConfidenceThreat: jest.fn(async () => {
        throw new Error("not-reached");
      }),

      recordQueueMetrics: jest.fn(() => {
        calls.recordQueueMetrics += 1;
      }),
      refreshQueueMetrics: jest.fn(async () => {
        calls.refreshQueueMetrics += 1;
      }),
    };

    const job: JobLike = {
      id: "job-1",
      attemptsMade: 0,
      timestamp: nowBase - 5000,
      data: {
        url: "https://example.com",
        urlHash: "abc123",
        rescan: true,
        priority: 1,
        // chatId/messageId intentionally omitted
        // timestamp intentionally omitted (worker falls back)
      },
    };

    // The handler catches exceptions internally; don't assert on thrown errors.
    await handleScanRequestJob(job, deps as any);

    // Key assertions: we got past schema validation and into the processing flow.
    expect(calls.getCachedVerdict).toBe(1);
    expect(calls.analyzeUrl).toBe(1);

    // Not a validation failure path
    expect(calls.recordQueueMetrics).toBe(0);

    // Finally block runs
    expect(calls.refreshQueueMetrics).toBe(1);

    // The handler logs errors for downstream exceptions (e.g. our intentional analyzeUrl throw),
    // so don't assert on logger.error here. Validation failures are covered by a separate test.
  });

  it("rejects invalid job data (missing url) and records queue metrics", async () => {
    expect(typeof handleScanRequestJob).toBe("function");
    expect((__testables as any).handleScanRequestJob).toBe(
      handleScanRequestJob,
    );

    const nowBase = 1_700_000_000_000;

    const deps = {
      queueName: "scan-request",
      now: () => nowBase,
      logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } as unknown,
      metrics: {
        queueJobWait: { labels: () => ({ observe: jest.fn() }) },
        queueFailures: { labels: () => ({ inc: jest.fn() }) },
        queueProcessingDuration: { labels: () => ({ observe: jest.fn() }) },
      } as unknown,
      scanRequestQueue: {} as unknown,
      deepScanQueue: { add: jest.fn() } as unknown,

      // Injected deps (DI): provide full IDatabaseConnection + compatible EnhancedSecurityAnalyzer
      dbClient: createDbClientStub(),
      enhancedSecurity: createEnhancedSecurityStub(),

      normalizeUrl: jest.fn((u: string) => u),
      urlHash: jest.fn((_u: string) => "h"),

      getCachedVerdict: jest.fn(),
      handleCachedVerdict: jest.fn(),

      analyzeUrl: jest.fn(),
      detectHomoglyphs: jest.fn(),

      performBlocklistChecks: jest.fn(),
      generateVerdict: jest.fn(),
      storeAndDispatchResults: jest.fn(),
      handleHighConfidenceThreat: jest.fn(),

      recordQueueMetrics: jest.fn(),
      refreshQueueMetrics: jest.fn(async () => undefined),
    };

    const job: JobLike = {
      id: "job-invalid",
      attemptsMade: 0,
      timestamp: nowBase,
      data: {
        // url intentionally missing
        rescan: true,
      },
    };

    await handleScanRequestJob(job, deps as any);

    expect((deps.logger as any).error).toHaveBeenCalled();
    expect(deps.recordQueueMetrics).toHaveBeenCalledTimes(1);
    expect(deps.getCachedVerdict).not.toHaveBeenCalled();
    expect(deps.analyzeUrl).not.toHaveBeenCalled();
  });

  it("skips verdict dispatch when cached verdict exists but no chat context (uses handleCachedVerdict)", async () => {
    expect(typeof handleScanRequestJob).toBe("function");
    expect((__testables as any).handleScanRequestJob).toBe(
      handleScanRequestJob,
    );

    const nowBase = 1_700_000_000_000;

    const deps = {
      queueName: "scan-request",
      now: () => nowBase,
      logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } as unknown,
      metrics: {
        queueJobWait: { labels: () => ({ observe: jest.fn() }) },
        queueFailures: { labels: () => ({ inc: jest.fn() }) },
        queueProcessingDuration: { labels: () => ({ observe: jest.fn() }) },
      } as unknown,
      scanRequestQueue: {} as unknown,
      deepScanQueue: { add: jest.fn() } as unknown,

      // Injected deps (DI): provide full IDatabaseConnection + compatible EnhancedSecurityAnalyzer
      dbClient: createDbClientStub(),
      enhancedSecurity: createEnhancedSecurityStub(),

      normalizeUrl: jest.fn((u: string) => u),
      urlHash: jest.fn((_u: string) => "h"),

      getCachedVerdict: jest.fn(async () => ({
        verdict: "benign",
        score: 0,
        reasons: [],
        decidedAt: nowBase - 1000,
      })),
      handleCachedVerdict: jest.fn(async () => undefined),

      analyzeUrl: jest.fn(),
      detectHomoglyphs: jest.fn(),

      performBlocklistChecks: jest.fn(),
      generateVerdict: jest.fn(),
      storeAndDispatchResults: jest.fn(),
      handleHighConfidenceThreat: jest.fn(),

      recordQueueMetrics: jest.fn(),
      refreshQueueMetrics: jest.fn(async () => undefined),
    };

    const job: JobLike = {
      id: "job-cached",
      attemptsMade: 0,
      timestamp: nowBase - 5000,
      data: {
        url: "https://example.com",
        rescan: true,
        // no chatId/messageId
      },
    };

    await handleScanRequestJob(job, deps as any);

    expect(deps.getCachedVerdict).toHaveBeenCalledTimes(1);
    expect(deps.handleCachedVerdict).toHaveBeenCalledTimes(1);
    expect(deps.analyzeUrl).not.toHaveBeenCalled();
  });
});
