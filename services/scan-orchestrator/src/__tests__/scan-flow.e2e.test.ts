import { handleScanRequestJob } from '../index';

type JobLike = {
  id?: string;
  data: unknown;
  timestamp?: number;
  attemptsMade: number;
};

function createDeps(overrides: Partial<Record<string, unknown>> = {}) {
  const defaultVerdict = {
    verdict: 'benign',
    level: 'benign',
    score: 0,
    reasons: [],
    cacheTtl: 86400,
    ttl: 86400,
    enqueuedUrlscan: false,
  };

  const deps = {
    queueName: 'scan-request',
    now: jest.fn(() => 1_700_000_000_000),
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    },
    metrics: {
      queueJobWait: { labels: () => ({ observe: jest.fn() }) },
      homoglyphDetections: { labels: () => ({ inc: jest.fn() }) },
      fastPathLatency: { observe: jest.fn() },
      scanPathCounter: { labels: () => ({ inc: jest.fn() }) },
      queueFailures: { labels: () => ({ inc: jest.fn() }) },
      queueProcessingDuration: { labels: () => ({ observe: jest.fn() }) },
    },
    scanRequestQueue: {} as unknown,
    deepScanQueue: { add: jest.fn().mockResolvedValue(undefined) },
    dbClient: {
      query: jest.fn(async () => ({ rows: [] })),
      transaction: jest.fn(async (fn: () => unknown | Promise<unknown>) => {
        return await fn();
      }),
    },
    enhancedSecurity: {
      analyze: jest.fn(async () => ({
        verdict: null,
        confidence: undefined,
        score: 0,
        reasons: [],
        skipExternalAPIs: false,
      })),
    },
    normalizeUrl: jest.fn((url: string) => url),
    urlHash: jest.fn(() => 'hash123'),
    getCachedVerdict: jest.fn(async () => null),
    handleCachedVerdict: jest.fn(async () => undefined),
    analyzeUrl: jest.fn(async () => {
      const finalUrl = 'https://example.com/path';
      return {
        finalUrl,
        finalUrlObj: new URL(finalUrl),
        redirectChain: [],
        heurSignals: {},
        wasShortened: false,
        finalUrlMismatch: false,
        shortenerInfo: null,
      };
    }),
    detectHomoglyphs: jest.fn(() => ({
      detected: false,
      riskLevel: 'low',
      confusableChars: [],
    })),
    performBlocklistChecks: jest.fn(async () => ({})),
    generateVerdict: jest.fn(async () => defaultVerdict),
    storeAndDispatchResults: jest.fn(async () => undefined),
    handleHighConfidenceThreat: jest.fn(async () => undefined),
    recordQueueMetrics: jest.fn(),
    refreshQueueMetrics: jest.fn(async () => undefined),
  };

  return { ...deps, ...overrides };
}

describe('End-to-End Scan Flow (worker invocation)', () => {
  test('malicious fast verdict skips deep scan enqueue', async () => {
    const deps = createDeps({
      generateVerdict: jest.fn(async () => ({
        verdict: 'malicious',
        level: 'malicious',
        score: 15,
        reasons: ['test'],
        cacheTtl: 900,
        ttl: 900,
        enqueuedUrlscan: false,
      })),
    });

    const job: JobLike = {
      id: 'job-1',
      attemptsMade: 0,
      timestamp: deps.now(),
      data: {
        chatId: 'chat-1',
        messageId: 'msg-1',
        url: 'https://example.com/path',
        timestamp: deps.now(),
      },
    };

    await handleScanRequestJob(job, deps as any);

    expect(deps.generateVerdict).toHaveBeenCalledTimes(1);
    expect(deps.storeAndDispatchResults).toHaveBeenCalledTimes(1);
    expect(deps.deepScanQueue.add).not.toHaveBeenCalled();
  });

  test('benign fast verdict enqueues deep scan', async () => {
    const deps = createDeps({
      generateVerdict: jest.fn(async () => ({
        verdict: 'benign',
        level: 'benign',
        score: 0,
        reasons: [],
        cacheTtl: 86400,
        ttl: 86400,
        enqueuedUrlscan: false,
      })),
    });

    const job: JobLike = {
      id: 'job-2',
      attemptsMade: 0,
      timestamp: deps.now(),
      data: {
        chatId: 'chat-2',
        messageId: 'msg-2',
        url: 'https://example.com/path',
        timestamp: deps.now(),
      },
    };

    await handleScanRequestJob(job, deps as any);

    expect(deps.generateVerdict).toHaveBeenCalledTimes(1);
    expect(deps.storeAndDispatchResults).toHaveBeenCalledTimes(1);
    expect(deps.deepScanQueue.add).toHaveBeenCalledWith(
      'deep-scan',
      expect.objectContaining({ fastVerdict: 'benign' }),
      { removeOnComplete: true },
    );
  });

  test('high-confidence enhanced security verdict short-circuits external checks', async () => {
    const deps = createDeps({
      enhancedSecurity: {
        analyze: jest.fn(async () => ({
          verdict: 'malicious',
          confidence: 'high',
          score: 12,
          reasons: ['enhanced'],
          skipExternalAPIs: true,
        })),
      },
    });

    const job: JobLike = {
      id: 'job-3',
      attemptsMade: 0,
      timestamp: deps.now(),
      data: {
        chatId: 'chat-3',
        messageId: 'msg-3',
        url: 'https://example.com/path',
      },
    };

    await handleScanRequestJob(job, deps as any);

    expect(deps.handleHighConfidenceThreat).toHaveBeenCalledTimes(1);
    expect(deps.performBlocklistChecks).not.toHaveBeenCalled();
    expect(deps.generateVerdict).not.toHaveBeenCalled();
    expect(deps.storeAndDispatchResults).not.toHaveBeenCalled();
    expect(deps.deepScanQueue.add).not.toHaveBeenCalled();
  });
});
