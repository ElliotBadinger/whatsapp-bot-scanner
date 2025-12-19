import { createMockDatabase, createMockQueue, createMockRedis } from "../../../../test-utils/setup";

type SharedModule = typeof import("@wbscanner/shared");

let shared: SharedModule;
let testables: typeof import("../index").__testables;
const queueInstances = new Map<string, ReturnType<typeof createMockQueue>>();

async function loadModule() {
  jest.resetModules();
  queueInstances.clear();

  process.env.GSB_API_KEY = "test-gsb-key";
  process.env.PHISHTANK_ENABLED = "true";
  process.env.PHISHTANK_APP_KEY = "test-phishtank";
  process.env.URLSCAN_ENABLED = "true";
  process.env.URLSCAN_API_KEY = "urlscan-key";

  jest.doMock("bullmq", () => {
    class QueueMock {
      name: string;
      add: ReturnType<typeof createMockQueue>["add"];
      getJobs: ReturnType<typeof createMockQueue>["getJobs"];
      getJobCounts: ReturnType<typeof createMockQueue>["getJobCounts"];
      close: ReturnType<typeof createMockQueue>["close"];
      constructor(name: string) {
        const queue = createMockQueue(name);
        this.name = name;
        this.add = queue.add;
        this.getJobs = queue.getJobs;
        this.getJobCounts = queue.getJobCounts;
        this.close = queue.close;
        queueInstances.set(name, this as ReturnType<typeof createMockQueue>);
      }
    }

    return { Queue: QueueMock, Worker: jest.fn() };
  });

  jest.doMock("@wbscanner/shared", () => {
    const actual = jest.requireActual("@wbscanner/shared");
    return {
      ...actual,
      scoreFromSignals: jest.fn(),
      gsbLookup: jest.fn(),
      phishtankLookup: jest.fn(),
      urlhausLookup: jest.fn(),
    };
  });

  shared = await import("@wbscanner/shared");
  const orchestrator = await import("../index");
  testables = orchestrator.__testables;
  testables.setRedisForTests(createMockRedis() as any);

  const scanVerdictQueue = createMockQueue(shared.config.queues.scanVerdict);
  const urlscanQueue = createMockQueue(shared.config.queues.urlscan);
  testables.setQueuesForTests({
    scanVerdictQueue: scanVerdictQueue as any,
    urlscanQueue: urlscanQueue as any,
  });
  queueInstances.set(shared.config.queues.scanVerdict, scanVerdictQueue);
  queueInstances.set(shared.config.queues.urlscan, urlscanQueue);
}

beforeEach(async () => {
  jest.restoreAllMocks();
  await loadModule();
});

describe("scan-orchestrator verdict generation", () => {
  test("handleCachedVerdict dispatches to scan verdict queue when chat context exists", async () => {
    const cachedVerdict = { verdict: "benign", score: 0, reasons: [] };
    const queueName = shared.config.queues.scanVerdict;
    const queue = queueInstances.get(queueName);

    await testables.handleCachedVerdict(
      cachedVerdict as any,
      "chat-1",
      "msg-1",
      true,
      Date.now(),
      queueName,
      Date.now(),
      0,
      "https://example.com",
      false,
      "job-1",
    );

    expect(queue?.add).toHaveBeenCalledWith(
      "verdict",
      expect.objectContaining({
        chatId: "chat-1",
        messageId: "msg-1",
        verdict: "benign",
      }),
      { removeOnComplete: true },
    );
  });

  test("handleCachedVerdict skips dispatch without chat context", async () => {
    const cachedVerdict = { verdict: "benign", score: 0, reasons: [] };
    const queueName = shared.config.queues.scanVerdict;
    const queue = queueInstances.get(queueName);

    await testables.handleCachedVerdict(
      cachedVerdict as any,
      undefined,
      undefined,
      false,
      Date.now(),
      queueName,
      Date.now(),
      1,
      "https://example.com",
      true,
      "job-2",
    );

    expect(queue?.add).not.toHaveBeenCalled();
  });

  test("recordQueueMetrics tracks retries", () => {
    expect(() =>
      testables.recordQueueMetrics("scan-request", Date.now() - 500, 2),
    ).not.toThrow();
  });

  test("performBlocklistChecks respects manual overrides and urlhaus fallback", async () => {
    const gsbLookup = shared.gsbLookup as jest.Mock;
    const phishtankLookup = shared.phishtankLookup as jest.Mock;
    const urlhausLookup = shared.urlhausLookup as jest.Mock;

    gsbLookup.mockResolvedValue({ matches: [], latencyMs: 5 });
    phishtankLookup.mockResolvedValue({
      inDatabase: false,
      verified: false,
      url: "https://example.com",
      latencyMs: 5,
    });
    urlhausLookup.mockResolvedValue({ listed: true, threat: "malware" });

    const dbClient = createMockDatabase() as {
      query: jest.Mock;
    };
    dbClient.query.mockResolvedValueOnce({ rows: [{ status: "deny" }] });

    const result = await testables.performBlocklistChecks(
      "https://example.com",
      new URL("https://example.com"),
      "hash-1",
      dbClient as any,
    );

    expect(result.manualOverride).toBe("deny");
    expect(result.urlhausConsulted).toBe(true);
    expect(result.urlhausResult?.listed).toBe(true);
  });

  test("generateVerdict flags degraded mode and enqueues urlscan on suspicious verdicts", async () => {
    const scoreFromSignals = shared.scoreFromSignals as jest.Mock;
    scoreFromSignals.mockReturnValue({
      level: "suspicious",
      score: 55,
      reasons: ["heuristic"],
      cacheTtl: 1800,
    });

    const blocklistResult = {
      gsbMatches: [],
      gsbResult: { matches: [], error: new Error("gsb down"), fromCache: false, durationMs: 0 },
      phishtankResult: null,
      phishtankNeeded: true,
      phishtankError: new Error("phishtank down"),
    };

    const externalResults = {
      blocklistResult,
      domainIntel: { ageDays: 5, source: "rdap", registrar: "Example" },
      manualOverride: null,
      vtStats: undefined,
      vtQuotaExceeded: true,
      vtError: new Error("vt down"),
      urlhausResult: null,
      urlhausError: new Error("urlhaus down"),
      urlhausConsulted: true,
    };

    const result = await testables.generateVerdict(
      externalResults as any,
      "https://example.com",
      "hash-1",
      ["https://example.com"],
      false,
      false,
      { detected: false, riskLevel: "low", confusableChars: [] } as any,
      {},
      { verdict: "suspicious", confidence: "medium", score: 10, reasons: [], skipExternalAPIs: false },
      null,
    );

    expect(result.degradedMode).toBeDefined();
    expect(result.enqueuedUrlscan).toBe(true);
    expect(scoreFromSignals).toHaveBeenCalled();
  });
});
