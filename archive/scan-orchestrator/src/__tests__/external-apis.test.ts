import { createMockRedis } from '../../../../test-utils/setup';

let shared: typeof import('@wbscanner/shared');
let testables: typeof import('../index').__testables;

const testUrl = 'https://example.com';
const testHash = 'hash-abc123';

async function loadModule() {
  jest.resetModules();
  process.env.PHISHTANK_APP_KEY = 'test-phishtank-key';
  process.env.PHISHTANK_ENABLED = 'true';

  jest.doMock('@wbscanner/shared', () => {
    const actual = jest.requireActual('@wbscanner/shared');
    return {
      ...actual,
      gsbLookup: jest.fn(),
      vtAnalyzeUrl: jest.fn(),
      vtVerdictStats: jest.fn(),
      urlhausLookup: jest.fn(),
      phishtankLookup: jest.fn(),
    };
  });

  shared = await import('@wbscanner/shared');
  const orchestrator = await import('../index');
  testables = orchestrator.__testables;
  testables.setRedisForTests(createMockRedis() as any);
}

beforeEach(async () => {
  jest.restoreAllMocks();
  await loadModule();
});

describe('External API Integration Tests', () => {
  test('Google Safe Browsing returns matches and caches results', async () => {
    const gsbLookup = shared.gsbLookup as jest.Mock;
    gsbLookup.mockResolvedValue({
      matches: [
        {
          threatType: 'MALWARE',
          platformType: 'ANY_PLATFORM',
          threatEntryType: 'URL',
          threat: testUrl,
        },
      ],
      latencyMs: 10,
    });

    const first = await testables.fetchGsbAnalysis(testUrl, testHash);
    expect(first.matches).toHaveLength(1);
    expect(first.error).toBeNull();
    expect(first.fromCache).toBe(false);

    const second = await testables.fetchGsbAnalysis(testUrl, testHash);
    expect(second.fromCache).toBe(true);
    expect(gsbLookup).toHaveBeenCalledTimes(1);
  });

  test('Google Safe Browsing handles API errors gracefully', async () => {
    const err = new Error('GSB failure');
    const gsbLookup = shared.gsbLookup as jest.Mock;
    gsbLookup.mockRejectedValue(err);

    const result = await testables.fetchGsbAnalysis(testUrl, testHash);
    expect(result.matches).toHaveLength(0);
    expect(result.error).toBe(err);
  });

  test('VirusTotal parses stats and caches results', async () => {
    const vtAnalyzeUrl = shared.vtAnalyzeUrl as jest.Mock;
    vtAnalyzeUrl.mockResolvedValue({
      latencyMs: 12,
    } as any);
    const vtVerdictStats = shared.vtVerdictStats as jest.Mock;
    vtVerdictStats.mockReturnValue({
      malicious: 5,
      suspicious: 2,
      harmless: 60,
    } as any);

    const first = await testables.fetchVirusTotal(testUrl, testHash);
    expect(first.stats).toEqual({
      malicious: 5,
      suspicious: 2,
      harmless: 60,
    });
    expect(first.quotaExceeded).toBe(false);

    const second = await testables.fetchVirusTotal(testUrl, testHash);
    expect(second.fromCache).toBe(true);
    expect(vtVerdictStats).toHaveBeenCalledTimes(1);
  });

  test('VirusTotal sets quotaExceeded on 429 errors', async () => {
    const error = Object.assign(new Error('Quota exceeded'), {
      statusCode: 429,
    });
    const vtAnalyzeUrl = shared.vtAnalyzeUrl as jest.Mock;
    vtAnalyzeUrl.mockRejectedValue(error);

    const result = await testables.fetchVirusTotal(testUrl, testHash);
    expect(result.stats).toBeUndefined();
    expect(result.quotaExceeded).toBe(true);
  });

  test('Phishtank returns verified results and caches', async () => {
    const phishtankLookup = shared.phishtankLookup as jest.Mock;
    phishtankLookup.mockResolvedValue({
      inDatabase: true,
      verified: true,
      url: testUrl,
      latencyMs: 18,
    });

    const first = await testables.fetchPhishtank(testUrl, testHash);
    expect(first.result?.verified).toBe(true);
    expect(first.fromCache).toBe(false);

    const second = await testables.fetchPhishtank(testUrl, testHash);
    expect(second.fromCache).toBe(true);
    expect(phishtankLookup).toHaveBeenCalledTimes(1);
  });

  test('URLhaus returns listing details and caches', async () => {
    const urlhausLookup = shared.urlhausLookup as jest.Mock;
    urlhausLookup.mockResolvedValue({
      listed: true,
      threat: 'malware_download',
      latencyMs: 22,
    });

    const first = await testables.fetchUrlhaus(testUrl, testHash);
    expect(first.result?.listed).toBe(true);
    expect(first.result?.threat).toBe('malware_download');
    expect(first.fromCache).toBe(false);

    const second = await testables.fetchUrlhaus(testUrl, testHash);
    expect(second.fromCache).toBe(true);
    expect(urlhausLookup).toHaveBeenCalledTimes(1);
  });
});
