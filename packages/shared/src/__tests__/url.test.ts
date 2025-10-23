jest.mock('undici', () => ({
  request: jest.fn(),
}));

jest.mock('../ssrf', () => ({
  isPrivateHostname: jest.fn().mockResolvedValue(false),
}));

import { extractUrls, expandUrl, isSuspiciousTld, normalizeUrl, urlHash } from '../url';

const { request } = require('undici') as { request: jest.Mock };
const { isPrivateHostname } = jest.requireMock('../ssrf') as { isPrivateHostname: jest.Mock };

beforeEach(() => {
  request.mockReset();
  (isPrivateHostname as jest.Mock).mockReset();
  (isPrivateHostname as jest.Mock).mockResolvedValue(false);
});

test('extractUrls finds http and www', () => {
  const text = 'check https://example.com and www.test.org/path?x=1#frag';
  const urls = extractUrls(text);
  expect(urls.length).toBe(2);
});

test('normalize strips tracking and fragments', () => {
  const u = normalizeUrl('https://EXAMPLE.com:443/a?utm_source=x&fbclid=123#frag');
  expect(u).toBe('https://example.com/a');
});

test('urlHash stable for normalized url', () => {
  const u = normalizeUrl('http://example.com:80/a');
  const h1 = urlHash(u!);
  const h2 = urlHash('http://example.com/a');
  expect(h1).toBe(h2);
});

test('expandUrl follows redirects and returns content type', async () => {
  request
    .mockResolvedValueOnce({
      statusCode: 302,
      headers: { location: 'https://final.test/path', 'content-type': 'text/html' },
    })
    .mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
    });

  const result = await expandUrl('https://short.test/start', {
    maxRedirects: 5,
    timeoutMs: 1000,
    maxContentLength: 1024,
  });
  expect(result.finalUrl).toBe('https://final.test/path');
  expect(result.chain).toEqual(['https://short.test/start', 'https://final.test/path']);
  expect(result.contentType).toBe('text/html');
});

test('expandUrl aborts when hostname becomes private', async () => {
  (isPrivateHostname as jest.Mock).mockResolvedValueOnce(true);
  const result = await expandUrl('https://internal.test', {
    maxRedirects: 5,
    timeoutMs: 1000,
    maxContentLength: 1024,
  });
  expect(result.finalUrl).toBe('https://internal.test/');
  expect(result.chain).toHaveLength(0);
});

test('detects suspicious tlds', () => {
  expect(isSuspiciousTld('evil.zip')).toBe(true);
  expect(isSuspiciousTld('safe.example')).toBe(false);
});
