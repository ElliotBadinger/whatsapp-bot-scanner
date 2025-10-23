jest.mock('undici', () => ({
  request: jest.fn(),
  fetch: jest.fn(),
}));

jest.mock('url-expand', () => jest.fn());

jest.mock('../ssrf', () => ({
  isPrivateHostname: jest.fn().mockResolvedValue(false),
}));

import { isKnownShortener, registerAdditionalShorteners, resolveShortener } from '../url-shortener';

const { request, fetch } = require('undici') as { request: jest.Mock; fetch: jest.Mock };
const expandUrl = jest.requireMock('url-expand') as jest.Mock;
const { isPrivateHostname } = jest.requireMock('../ssrf') as { isPrivateHostname: jest.Mock };

describe('shortener utilities', () => {
  beforeEach(() => {
    request.mockReset();
    fetch.mockReset();
    expandUrl.mockReset();
    (isPrivateHostname as jest.Mock).mockReset();
    (isPrivateHostname as jest.Mock).mockResolvedValue(false);
  });

  it('recognises default and custom shortener hosts', () => {
    expect(isKnownShortener('bit.ly')).toBe(true);
    registerAdditionalShorteners(['example.short']);
    expect(isKnownShortener('example.short')).toBe(true);
    expect(isKnownShortener('example.com')).toBe(false);
  });

  it('returns original url when host is not a shortener', async () => {
    const result = await resolveShortener('https://example.com/path');
    expect(result.finalUrl).toBe('https://example.com/path');
    expect(result.wasShortened).toBe(false);
  });

  it('uses unshorten.me when available', async () => {
    request.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: async () => ({ resolved_url: 'https://target.test', success: true }),
      },
    } as any);

    const result = await resolveShortener('https://bit.ly/foo');
    expect(result.provider).toBe('unshorten_me');
    expect(result.finalUrl).toBe('https://target.test/');
    expect(result.chain).toEqual(['https://bit.ly/foo', 'https://target.test/']);
  });

  it('falls back to direct fetch when unshorten fails', async () => {
    request.mockResolvedValue({
      statusCode: 500,
      body: { json: async () => ({}) },
    } as any);

    fetch.mockResolvedValueOnce({
      status: 200,
      headers: {
        get: (key: string) => (key === 'content-type' ? 'text/html' : null),
      },
    } as any);

    const result = await resolveShortener('https://t.co/path');
    expect(result.provider).toBe('direct');
    expect(result.finalUrl!.startsWith('https://t.co/path')).toBe(true);
    expect(result.chain[0]).toBe('https://t.co/path');
    expect(result.wasShortened).toBe(true);
  });

  it('uses url-expander as final fallback and guards private hosts', async () => {
    request.mockResolvedValue({
      statusCode: 500,
      body: { json: async () => ({}) },
    } as any);
    fetch.mockRejectedValueOnce(new Error('network'));

    expandUrl.mockImplementation((_url: string, cb: (err: Error | null, expanded?: string) => void) => {
      cb(null, 'https://expanded.test/resource');
    });

    const result = await resolveShortener('https://bit.ly/abc');
    expect(result.provider).toBe('urlexpander');
    expect(result.finalUrl).toBe('https://expanded.test/resource');
    expect(result.chain).toEqual(['https://bit.ly/abc', 'https://expanded.test/resource']);
  });

  it('returns original url with error when fallback resolves to private host', async () => {
    request.mockResolvedValue({
      statusCode: 500,
      body: { json: async () => ({}) },
    } as any);
    fetch.mockRejectedValue(new Error('timeout'));

    expandUrl.mockImplementation((_url: string, cb: (err: Error | null, expanded?: string) => void) => {
      cb(null, 'http://127.0.0.1/secret');
    });
    (isPrivateHostname as jest.Mock).mockImplementation(async (host: string) => host === '127.0.0.1');

    const result = await resolveShortener('https://bit.ly/private');
    expect(result.provider).toBe('original');
    expect(result.wasShortened).toBe(true);
    expect(result.error).toMatch(/Private IP/);
  });
});
