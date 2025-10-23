import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  __esModule: true,
  request: vi.fn(),
  fetch: vi.fn(),
}));
const expandMock = vi.fn();
vi.mock('url-expand', () => ({ __esModule: true, expand: expandMock }));

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
});

beforeEach(() => {
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34' }]);
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  expandMock.mockReset();
  dnsLookup.mockReset();
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34' }]);
});

describe('Shortener fallback chain', () => {
  it('returns original URL when Unshorten and url-expand fail', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    expandMock.mockRejectedValue(new Error('Service unavailable'));

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/down');
    expect(result.provider).toBe('original');
    expect(result.error).toContain('Service unavailable');
  });

  it('uses url-expand when Unshorten fails', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch)
      .mockResolvedValueOnce(buildResponse(301, { location: 'https://expanded.example/path' }) as any)
      .mockResolvedValueOnce(buildResponse(200) as any);

    expandMock.mockImplementation(async (shortUrl: string, options: any) => {
      await options.fetch(shortUrl);
      await options.fetch('https://expanded.example/path');
      return {
        url: 'https://expanded.example/path',
        redirects: [shortUrl, 'https://expanded.example/path'],
      };
    });

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/demo');
    expect(result.provider).toBe('url_expand');
    expect(result.finalUrl).toBe('https://expanded.example/path');
    expect(result.chain).toContain('https://expanded.example/path');
  });

  it('blocks url-expand results that resolve to private addresses', async () => {
    const undici = await import('undici');

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValue(buildResponse(301, { location: 'http://127.0.0.1/admin' }) as any);

    expandMock.mockImplementation(async (shortUrl: string, options: any) => {
      await options.fetch(shortUrl);
      await options.fetch('http://127.0.0.1/admin');
      return {
        url: 'http://127.0.0.1/admin',
        redirects: [shortUrl, 'http://127.0.0.1/admin'],
      };
    });

    dnsLookup.mockResolvedValueOnce([{ address: '93.184.216.34' }]);
    dnsLookup.mockResolvedValueOnce([{ address: '127.0.0.1' }]);

    const { resolveShortener } = await import('@wbscanner/shared');

    const result = await resolveShortener('http://bit.ly/private');
    expect(result.provider).toBe('original');
    expect(result.error).toContain('SSRF protection');
  });
});
