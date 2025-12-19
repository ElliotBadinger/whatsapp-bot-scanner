import { __testables } from "../index";

const { handleScanRequestJob } = __testables;

const makeMetrics = () => {
  const counter = () => ({ inc: jest.fn(), labels: () => ({ inc: jest.fn() }) });
  const histogram = () => ({
    observe: jest.fn(),
    labels: () => ({ observe: jest.fn() }),
  });
  return {
    queueJobWait: histogram(),
    queueProcessingDuration: histogram(),
    queueCompleted: counter(),
    queueRetries: { labels: () => ({ inc: jest.fn() }) },
    queueFailures: { labels: () => ({ inc: jest.fn() }) },
    fastPathLatency: histogram(),
    scanPathCounter: { labels: () => ({ inc: jest.fn() }) },
    homoglyphDetections: { labels: () => ({ inc: jest.fn() }) },
  };
};

const makeDeps = () => {
  const metrics = makeMetrics();
  return {
    queueName: "scan-request",
    now: () => Date.now(),
    logger: {
      error: jest.fn(),
      info: jest.fn(),
    },
    metrics,
    scanRequestQueue: { name: "scan-request" },
    deepScanQueue: { add: jest.fn() },
    dbClient: { query: jest.fn(), transaction: jest.fn(async (cb) => cb()) },
    enhancedSecurity: {
      analyze: jest.fn(),
    },
    normalizeUrl: jest.fn((input: string) => input),
    urlHash: jest.fn((input: string) => `hash:${input}`),
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
};

describe("scan-orchestrator scan worker", () => {
  test("records queue metrics on invalid jobs", async () => {
    const deps = makeDeps();
    const job = {
      data: { url: "not-a-url" },
      attemptsMade: 0,
    };

    await handleScanRequestJob(job as any, deps as any);

    expect(deps.recordQueueMetrics).toHaveBeenCalled();
    expect(deps.handleCachedVerdict).not.toHaveBeenCalled();
  });

  test("dispatches cached verdicts and returns early", async () => {
    const deps = makeDeps();
    deps.getCachedVerdict.mockResolvedValue({
      verdict: "benign",
      score: 0,
      reasons: [],
    });

    const job = {
      data: {
        chatId: "chat-1",
        messageId: "msg-1",
        url: "https://example.com",
      },
      attemptsMade: 0,
    };

    await handleScanRequestJob(job as any, deps as any);

    expect(deps.handleCachedVerdict).toHaveBeenCalled();
    expect(deps.analyzeUrl).not.toHaveBeenCalled();
  });

  test("short-circuits high-confidence malicious URLs", async () => {
    const deps = makeDeps();
    deps.getCachedVerdict.mockResolvedValue(null);
    deps.analyzeUrl.mockResolvedValue({
      finalUrl: "https://example.com",
      finalUrlObj: new URL("https://example.com"),
      redirectChain: [],
      heurSignals: {},
      wasShortened: false,
      finalUrlMismatch: false,
      shortenerInfo: null,
    });
    deps.detectHomoglyphs.mockReturnValue({
      detected: false,
      riskLevel: "low",
      confusableChars: [],
    });
    deps.enhancedSecurity.analyze.mockResolvedValue({
      verdict: "malicious",
      confidence: "high",
      score: 99,
      reasons: ["signal"],
      skipExternalAPIs: true,
    });

    const job = {
      data: { url: "https://example.com" },
      attemptsMade: 0,
    };

    await handleScanRequestJob(job as any, deps as any);

    expect(deps.handleHighConfidenceThreat).toHaveBeenCalled();
    expect(deps.performBlocklistChecks).not.toHaveBeenCalled();
  });

  test("queues deep scans for non-malicious fast verdicts", async () => {
    const deps = makeDeps();
    deps.getCachedVerdict.mockResolvedValue(null);
    deps.analyzeUrl.mockResolvedValue({
      finalUrl: "https://example.com",
      finalUrlObj: new URL("https://example.com"),
      redirectChain: ["https://example.com"],
      heurSignals: {},
      wasShortened: false,
      finalUrlMismatch: false,
      shortenerInfo: null,
    });
    deps.detectHomoglyphs.mockReturnValue({
      detected: false,
      riskLevel: "low",
      confusableChars: [],
    });
    deps.enhancedSecurity.analyze.mockResolvedValue({
      verdict: "unknown",
      confidence: "low",
      score: 0,
      reasons: [],
      skipExternalAPIs: false,
    });
    deps.performBlocklistChecks.mockResolvedValue({});
    deps.generateVerdict.mockResolvedValue({
      verdict: "benign",
      score: 0,
      reasons: [],
      cacheTtl: 3600,
      ttl: 3600,
      enqueuedUrlscan: false,
    });

    const job = {
      data: {
        chatId: "chat-1",
        messageId: "msg-1",
        url: "https://example.com",
      },
      attemptsMade: 0,
    };

    await handleScanRequestJob(job as any, deps as any);

    expect(deps.storeAndDispatchResults).toHaveBeenCalled();
    expect(deps.deepScanQueue.add).toHaveBeenCalledWith(
      "deep-scan",
      expect.objectContaining({ url: "https://example.com" }),
      { removeOnComplete: true },
    );
  });
});
