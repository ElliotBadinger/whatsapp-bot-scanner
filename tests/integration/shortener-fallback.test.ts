import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  __esModule: true,
  request: vi.fn(),
  fetch: vi.fn(),
}));
const expandMock = vi.fn();
vi.mock('url-expand', () => ({ __esModule: true, default: expandMock }));

const dnsLookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34' }]);
vi.mock('node:dns/promises', () => ({
  __esModule: true,
  default: { lookup: dnsLookup },
  lookup: dnsLookup,
}));

const buildResponse = (status: number, headers: Record<string, string> = {}) => ({
  status,
  headers: {
    get(name: string) {
      return headers[name.toLowerCase()] ?? null;
    },
  },
  body: {
    cancel: vi.fn().mockResolvedValue(undefined),
  },
});

beforeEach(() => {
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34' }]);
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  dnsLookup.mockReset();
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34' }]);
});

describe('Shortener fallback chain', () => {
  it('uses url-expander when Unshorten and HEAD fail', async () => {
    const undici = await import('undici');
    const expand = expandMock;

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValue(buildResponse(500) as any);
    expand.mockImplementation((_url: string, cb: (err: unknown, expanded?: string) => void) =>
      cb(null, 'https://expanded.example/path'),
    );

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/demo');
    expect(result.provider).toBe('urlexpander');
    expect(result.finalUrl).toBe('https://expanded.example/path');
    expect(result.expanded).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('blocks url-expander results that resolve to private addresses', async () => {
    const undici = await import('undici');
    const expand = expandMock;

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValue(buildResponse(500) as any);
    expand.mockImplementation((_url: string, cb: (err: unknown, expanded?: string) => void) =>
      cb(null, 'http://127.0.0.1/admin'),
    );

    dnsLookup.mockResolvedValueOnce([{ address: '93.184.216.34' }]);
    dnsLookup.mockResolvedValueOnce([{ address: '127.0.0.1' }]);
    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/private');
    expect(result.provider).toBe('original');
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe('ssrf-blocked');
    expect(result.error).toContain('SSRF protection');
  });

  it('flags responses above the content-length cap', async () => {
    const undici = await import('undici');
    const expand = expandMock;

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValue(
      buildResponse(200, { 'content-length': '2097152' }) as any,
    );
    expand.mockImplementation((_url: string, cb: (err: unknown, expanded?: string) => void) =>
      cb(new Error('library failure')),
    );

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/oversized');
    expect(result.provider).toBe('original');
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe('max-content-length');
    expect(result.error).toContain('Content too large');
  });

  it('reports timeouts from the direct fetch fallback', async () => {
    const undici = await import('undici');
    const expand = expandMock;

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    vi.mocked(undici.fetch).mockRejectedValue(abortError);
    expand.mockImplementation((_url: string, cb: (err: unknown, expanded?: string) => void) =>
      cb(new Error('library failure')),
    );

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/timeout');
    expect(result.provider).toBe('original');
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe('timeout');
    expect(result.error).toContain('timed out');
  });
});
