import { extractUrls, normalizeUrl, urlHash } from '../url';

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

