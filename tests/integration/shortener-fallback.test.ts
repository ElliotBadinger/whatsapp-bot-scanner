import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  __esModule: true,
  request: vi.fn(),
  fetch: vi.fn(),
}));

const legacyExpandMock = vi.fn();
const modernExpandMock = vi.fn();
let useModernExpand = false;

vi.mock('url-expand', () => {
  const legacyWrapper = (shortUrl: string, callback: (error: unknown, expanded?: string | null) => void) =>
    legacyExpandMock(shortUrl, callback);

  Object.defineProperty(legacyWrapper, 'expand', {
    get() {
      return useModernExpand ? modernExpandMock : undefined;
    },
  });

  return {
    __esModule: true,
    default: legacyWrapper,
    get expand() {
      return useModernExpand ? modernExpandMock : undefined;
    },
  };
});

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
  useModernExpand = false;
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  legacyExpandMock.mockReset();
  modernExpandMock.mockReset();
  dnsLookup.mockReset();
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34' }]);
  useModernExpand = false;
});

describe('Shortener fallback chain (legacy url-expand API)', () => {
  it('returns original URL when Unshorten and url-expand fail', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValue(buildResponse(404) as any);
    legacyExpandMock.mockImplementation((_shortUrl: string, callback: (error: Error) => void) => {
      callback(new Error('Service unavailable'));
    });

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/down');
    expect(result.provider).toBe('original');
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe('library-error');
    expect(result.error).toContain('Service unavailable');
  });

  it('uses url-expand when Unshorten fails', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValue(buildResponse(500) as any);
    legacyExpandMock.mockImplementation((_shortUrl: string, callback: (error: null, expanded: string) => void) => {
      callback(null, 'https://expanded.example/path');
    });

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/demo');
    expect(result.provider).toBe('urlexpander');
    expect(result.finalUrl).toBe('https://expanded.example/path');
    expect(result.chain).toContain('https://expanded.example/path');
    expect(result.expanded).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('blocks url-expand results that resolve to private addresses', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValue(buildResponse(500) as any);
    legacyExpandMock.mockImplementation((_shortUrl: string, callback: (error: null, expanded: string) => void) => {
      callback(null, 'http://127.0.0.1/admin');
    });

    dnsLookup.mockResolvedValueOnce([{ address: '93.184.216.34' }]);
    dnsLookup.mockResolvedValueOnce([{ address: '127.0.0.1' }]);

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/private');
    expect(result.provider).toBe('original');
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe('ssrf-blocked');
    expect(result.error).toContain('SSRF protection');
  });
});

describe('Shortener fallback chain (modern url-expand API)', () => {
  beforeEach(() => {
    useModernExpand = true;
  });

  it('uses url-expand modern API when available', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch)
      .mockResolvedValueOnce(buildResponse(500) as any)
      .mockResolvedValueOnce(buildResponse(301, { location: 'https://expanded.example/path' }) as any)
      .mockResolvedValueOnce(buildResponse(200) as any);

    modernExpandMock.mockImplementation(async (shortUrl: string, options: any) => {
      await options.fetch(shortUrl);
      await options.fetch('https://expanded.example/path');
      return {
        url: 'https://expanded.example/path',
        redirects: [shortUrl, 'https://expanded.example/path'],
      };
    });

    legacyExpandMock.mockImplementation(() => {
      throw new Error('legacy API should not be used when modern expand exists');
    });

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/demo');
    expect(result.provider).toBe('urlexpander');
    expect(result.finalUrl).toBe('https://expanded.example/path');
    expect(result.chain).toContain('https://expanded.example/path');
    expect(result.expanded).toBe(true);
    expect(modernExpandMock).toHaveBeenCalled();
  });

  it('blocks modern url-expand results that resolve to private addresses', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch)
      .mockResolvedValueOnce(buildResponse(500) as any)
      .mockResolvedValueOnce(buildResponse(301, { location: 'http://127.0.0.1/admin' }) as any);

    modernExpandMock.mockImplementation(async (shortUrl: string, options: any) => {
      await options.fetch(shortUrl);
      await options.fetch('http://127.0.0.1/admin');
      return {
        url: 'http://127.0.0.1/admin',
        redirects: [shortUrl, 'http://127.0.0.1/admin'],
      };
    });

    legacyExpandMock.mockImplementation(() => {
      throw new Error('legacy API should not be used when modern expand exists');
    });

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

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch)
      .mockResolvedValueOnce(buildResponse(200, { 'content-length': '2097152' }) as any)
      .mockResolvedValueOnce(buildResponse(200, { 'content-length': '2097152' }) as any);
    modernExpandMock.mockImplementation((_shortUrl: string, options: any) => options.fetch('http://bit.ly/oversized'));
    legacyExpandMock.mockImplementation((_shortUrl: string, callback: (error: Error) => void) => {
      callback(new Error('library failure'));
    });

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/oversized');
    expect(result.provider).toBe('original');
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe('max-content-length');
    expect(result.error).toContain('Content too large');
  });

  it('reports timeouts from the direct fetch fallback', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    vi.mocked(undici.fetch).mockRejectedValue(abortError);
    modernExpandMock.mockImplementation((_shortUrl: string, options: any) => options.fetch('http://bit.ly/timeout'));
    legacyExpandMock.mockImplementation((_shortUrl: string, callback: (error: Error) => void) => {
      callback(new Error('library failure'));
    });

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/timeout');
    expect(result.provider).toBe('original');
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe('timeout');
    expect(result.error).toContain('timed out');
  });
});
