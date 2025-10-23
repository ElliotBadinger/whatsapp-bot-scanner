process.env.NODE_ENV = 'test';
process.env.URLSCAN_CALLBACK_SECRET = 'test-secret';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(null),
    })),
    Worker: jest.fn().mockImplementation(() => ({})),
  };
});

jest.mock('pg', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue({ rows: [] }),
      end: jest.fn().mockResolvedValue(null),
    })),
  };
});

const consumeMock = jest.fn().mockResolvedValue(undefined);

jest.mock('rate-limiter-flexible', () => {
  class RateLimiterResMock {
    msBeforeNext: number;
    constructor(msBeforeNext = 0) {
      this.msBeforeNext = msBeforeNext;
    }
  }

  class RateLimiterRedisMock {
    consume = consumeMock;
  }

  return {
    RateLimiterRedis: RateLimiterRedisMock,
    RateLimiterRes: RateLimiterResMock,
  };
});

import { __testables } from '../index';
import { config } from '@wbscanner/shared';
// eslint-disable-next-line import/no-commonjs
const rateLimiterModule = require('rate-limiter-flexible');

const originalVtConfig = { ...config.vt };

describe('error classification helpers', () => {
  it('classifies rate limit errors', () => {
    const reason = __testables.classifyError({ code: 429 });
    expect(reason).toBe('rate_limited');
  });

  it('classifies undici timeout errors', () => {
    const reason = __testables.classifyError({ code: 'UND_ERR_HEADERS_TIMEOUT' });
    expect(reason).toBe('timeout');
  });
});

describe('retry policy', () => {
  it('retries on 5xx errors', () => {
    expect(__testables.shouldRetry({ statusCode: 502 })).toBe(true);
  });

  it('does not retry on rate-limit errors', () => {
    expect(__testables.shouldRetry({ code: 429 })).toBe(false);
  });
});

describe('applyVtRateLimit', () => {
  beforeEach(() => {
    consumeMock.mockReset().mockResolvedValue(undefined);
    config.vt.apiKey = 'test-key';
    config.vt.requestJitterMs = 0;
    __testables.setVtRateLimiterForTest({ consume: consumeMock } as any);
  });

  afterEach(() => {
    Object.assign(config.vt, originalVtConfig);
    __testables.resetVtRateLimiterForTest();
  });

  it('invokes limiter consume for each call', async () => {
    await __testables.applyVtRateLimit();
    expect(consumeMock).toHaveBeenCalledTimes(1);
  });

  it('waits and retries when limiter signals delay', async () => {
    const { RateLimiterRes } = rateLimiterModule;
    consumeMock
      .mockRejectedValueOnce(new RateLimiterRes(5))
      .mockResolvedValueOnce(undefined);

    await __testables.applyVtRateLimit();
    expect(consumeMock).toHaveBeenCalledTimes(2);
  });
});

describe('shouldQueryPhishtank helper', () => {
  const baseInput = {
    gsbHit: false,
    gsbError: null as Error | null,
    gsbDurationMs: 100,
    gsbFromCache: false,
    fallbackLatencyMs: 500,
    gsbApiKeyPresent: true,
    phishtankEnabled: true,
  };

  it('returns true when GSB has no matches', () => {
    expect(__testables.shouldQueryPhishtank(baseInput)).toBe(true);
  });

  it('returns false when disabled', () => {
    expect(__testables.shouldQueryPhishtank({ ...baseInput, phishtankEnabled: false })).toBe(false);
  });

  it('returns true when GSB hit exists but request errored', () => {
    const err = new Error('timeout');
    expect(
      __testables.shouldQueryPhishtank({
        ...baseInput,
        gsbHit: true,
        gsbError: err,
      })
    ).toBe(true);
  });

  it('returns true when latency threshold exceeded', () => {
    expect(
      __testables.shouldQueryPhishtank({
        ...baseInput,
        gsbHit: true,
        gsbDurationMs: 600,
      })
    ).toBe(true);
  });

  it('returns true when GSB API key missing', () => {
    expect(
      __testables.shouldQueryPhishtank({
        ...baseInput,
        gsbHit: true,
        gsbApiKeyPresent: false,
      })
    ).toBe(true);
  });

  it('returns false when GSB hit exists and no fallback conditions met', () => {
    expect(
      __testables.shouldQueryPhishtank({
        ...baseInput,
        gsbHit: true,
      })
    ).toBe(false);
  });
});

describe('extractUrlscanArtifactCandidates', () => {
  it('returns unique screenshot and dom candidates with defaults', () => {
    const candidates = __testables.extractUrlscanArtifactCandidates('abc', {
      screenshotURL: 'https://urlscan.io/screenshots/custom.png',
      task: { screenshotURL: '/screens/custom.png', domURL: '/dom/custom.json' },
      domURL: '/dom/abc.json',
    });

    expect(candidates.some(c => c.type === 'screenshot' && c.url === 'https://urlscan.io/screenshots/custom.png')).toBe(true);
    expect(candidates.some(c => c.type === 'screenshot' && c.url.endsWith('/screenshots/abc.png'))).toBe(true);
    expect(candidates.some(c => c.type === 'dom' && c.url.endsWith('/dom/abc.json'))).toBe(true);
    expect(candidates.every(c => new URL(c.url).hostname.endsWith('urlscan.io'))).toBe(true);
  });

  it('omits artifact candidates outside the trusted host', () => {
    const candidates = __testables.extractUrlscanArtifactCandidates('abc', {
      screenshotURL: 'https://evil.example/snap.png',
      domURL: 'https://malicious.invalid/dom.json',
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(c => !c.url.includes('evil.example') && !c.url.includes('malicious.invalid'))).toBe(true);
  });
});

describe('normalizeUrlscanArtifactCandidate', () => {
  const baseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');

  it('normalizes relative artifact paths to the base domain', () => {
    const result = __testables.normalizeUrlscanArtifactCandidate('/screenshots/foo.png', baseUrl);
    expect(result.invalid).toBe(false);
    expect(result.url).toBe(`${baseUrl}/screenshots/foo.png`);
  });

  it('flags artifacts targeting other hosts', () => {
    const result = __testables.normalizeUrlscanArtifactCandidate('https://attacker.invalid/payload.png', baseUrl);
    expect(result.invalid).toBe(true);
    expect(result.url).toBeUndefined();
  });
});
