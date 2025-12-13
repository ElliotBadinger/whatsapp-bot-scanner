process.env["NODE_ENV"] = "test";
process.env["URLSCAN_CALLBACK_SECRET"] = "test-secret";

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

jest.mock('@wbscanner/shared', () => {
  const actual = jest.requireActual('@wbscanner/shared');
  return {
    ...actual,
    createRedisConnection: jest.fn(() => ({
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      ttl: jest.fn().mockResolvedValue(-1),
      quit: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

async function loadIndex() {
  return await import('../index');
}

async function loadShared() {
  return await import('@wbscanner/shared');
}

describe('error classification helpers', () => {
  it('classifies rate limit errors', async () => {
    const { __testables } = await loadIndex();
    const reason = __testables.classifyError({ code: 429 });
    expect(reason).toBe('rate_limited');
  });

  it('classifies undici timeout errors', async () => {
    const { __testables } = await loadIndex();
    const reason = __testables.classifyError({ code: 'UND_ERR_HEADERS_TIMEOUT' });
    expect(reason).toBe('timeout');
  });
});

describe('retry policy', () => {
  it('retries on 5xx errors', async () => {
    const { __testables } = await loadIndex();
    expect(__testables.shouldRetry({ statusCode: 502 })).toBe(true);
  });

  it('does not retry on rate-limit errors', async () => {
    const { __testables } = await loadIndex();
    expect(__testables.shouldRetry({ code: 429 })).toBe(false);
  });
});

describe('module initialization', () => {
  it('does not initialize Redis/BullMQ at module import time', async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const shared = await loadShared();
    const bullmq = await import('bullmq');
    await loadIndex();

    expect((shared as any).createRedisConnection).not.toHaveBeenCalled();
    expect((bullmq as any).Queue).not.toHaveBeenCalled();
  });
});

describe('fallback behaviours', () => {
  it('expands invalid url falls back', async () => {
    const shared = await loadShared();
    const expanded = await shared.expandUrl('foo', {
      maxRedirects: 0,
      timeoutMs: 1,
      maxContentLength: 0,
    });
    expect(expanded.finalUrl).toBe('foo');
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

  it('returns true when GSB has no matches', async () => {
    const { __testables } = await loadIndex();
    expect(__testables.shouldQueryPhishtank(baseInput)).toBe(true);
  });

  it('returns false when disabled', async () => {
    const { __testables } = await loadIndex();
    expect(
      __testables.shouldQueryPhishtank({
        ...baseInput,
        phishtankEnabled: false,
      }),
    ).toBe(false);
  });

  it('returns true when GSB hit exists but request errored', async () => {
    const { __testables } = await loadIndex();
    const err = new Error('timeout');
    expect(
      __testables.shouldQueryPhishtank({
        ...baseInput,
        gsbHit: true,
        gsbError: err,
      })
    ).toBe(true);
  });

  it('returns true when latency threshold exceeded', async () => {
    const { __testables } = await loadIndex();
    expect(
      __testables.shouldQueryPhishtank({
        ...baseInput,
        gsbHit: true,
        gsbDurationMs: 600,
      })
    ).toBe(true);
  });

  it('returns true when GSB API key missing', async () => {
    const { __testables } = await loadIndex();
    expect(
      __testables.shouldQueryPhishtank({
        ...baseInput,
        gsbHit: true,
        gsbApiKeyPresent: false,
      })
    ).toBe(true);
  });

  it('returns false when GSB hit exists and no fallback conditions met', async () => {
    const { __testables } = await loadIndex();
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
    type ArtifactCandidate = { type: string; url: string };
    const candidates = (jest
      .requireActual('../index')
      .__testables.extractUrlscanArtifactCandidates('abc', {
      screenshotURL: 'https://urlscan.io/screenshots/custom.png',
      task: { screenshotURL: '/screens/custom.png', domURL: '/dom/custom.json' },
      domURL: '/dom/abc.json',
    }) as ArtifactCandidate[]);

    expect(
      candidates.some(
        (c: ArtifactCandidate) =>
          c.type === 'screenshot' &&
          c.url === 'https://urlscan.io/screenshots/custom.png',
      ),
    ).toBe(true);
    expect(
      candidates.some(
        (c: ArtifactCandidate) =>
          c.type === 'screenshot' && c.url.endsWith('/screenshots/abc.png'),
      ),
    ).toBe(true);
    expect(
      candidates.some(
        (c: ArtifactCandidate) =>
          c.type === 'dom' && c.url.endsWith('/dom/abc.json'),
      ),
    ).toBe(true);
    expect(
      candidates.every(
        (c: ArtifactCandidate) => new URL(c.url).hostname.endsWith('urlscan.io'),
      ),
    ).toBe(true);
  });

  it('omits artifact candidates outside the trusted host', () => {
    type ArtifactCandidate = { type: string; url: string };
    const candidates = (jest
      .requireActual('../index')
      .__testables.extractUrlscanArtifactCandidates('abc', {
      screenshotURL: 'https://evil.example/snap.png',
      domURL: 'https://malicious.invalid/dom.json',
    }) as ArtifactCandidate[]);

    expect(candidates.length).toBeGreaterThan(0);
    expect(
      candidates.every(
        (c: ArtifactCandidate) =>
          !c.url.includes('evil.example') && !c.url.includes('malicious.invalid'),
      ),
    ).toBe(true);
  });
});

describe('normalizeUrlscanArtifactCandidate', () => {
  const baseUrl = (jest
    .requireActual('@wbscanner/shared')
    .config.urlscan.baseUrl || 'https://urlscan.io'
  ).replace(/\/+$/, '');

  it('normalizes relative artifact paths to the base domain', async () => {
    const { __testables } = await loadIndex();
    const result = __testables.normalizeUrlscanArtifactCandidate(
      '/screenshots/foo.png',
      baseUrl,
    );
    expect(result.invalid).toBe(false);
    expect(result.url).toBe(`${baseUrl}/screenshots/foo.png`);
  });

  it('flags artifacts targeting other hosts', async () => {
    const { __testables } = await loadIndex();
    const result = __testables.normalizeUrlscanArtifactCandidate(
      'https://attacker.invalid/payload.png',
      baseUrl,
    );
    expect(result.invalid).toBe(true);
    expect(result.url).toBeUndefined();
  });
});
