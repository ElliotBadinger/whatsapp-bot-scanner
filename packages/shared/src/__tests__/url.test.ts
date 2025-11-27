jest.mock("undici", () => ({
  request: jest.fn(),
}));

jest.mock("../ssrf", () => ({
  isPrivateHostname: jest.fn().mockResolvedValue(false),
}));

import {
  extractUrls,
  expandUrl,
  isSuspiciousTld,
  normalizeUrl,
  urlHash,
} from "../url";
import type { request as requestType } from "undici";

const { request } = jest.requireMock("undici") as {
  request: jest.MockedFunction<typeof requestType>;
};
const { isPrivateHostname } = jest.requireMock("../ssrf") as {
  isPrivateHostname: jest.Mock;
};

beforeEach(() => {
  request.mockReset();
  (isPrivateHostname as jest.Mock).mockReset();
  (isPrivateHostname as jest.Mock).mockResolvedValue(false);
});

test("extractUrls finds http and www", () => {
  const text = "check https://example.com and www.test.org/path?x=1#frag";
  const urls = extractUrls(text);
  expect(urls.length).toBe(2);
});

test("normalize strips tracking and fragments", () => {
  const u = normalizeUrl(
    "https://EXAMPLE.com:443/a?utm_source=x&fbclid=123#frag",
  );
  expect(u).toBe("https://example.com/a");
});

test("urlHash stable for normalized url", () => {
  const u = normalizeUrl("http://example.com:80/a");
  const h1 = urlHash(u!);
  const h2 = urlHash("http://example.com/a");
  expect(h1).toBe(h2);
});

test("expandUrl follows redirects and returns content type", async () => {
  request
    .mockResolvedValueOnce({
      statusCode: 302,
      headers: {
        location: "https://final.test/path",
        "content-type": "text/html",
      },
      body: null,
      trailers: {},
      opaque: null,
      context: null,
    } as any)
    .mockResolvedValueOnce({
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: null,
      trailers: {},
      opaque: null,
      context: null,
    } as any);

  const result = await expandUrl("https://short.test/start", {
    maxRedirects: 5,
    timeoutMs: 1000,
    maxContentLength: 1024,
  });
  expect(result.finalUrl).toBe("https://final.test/path");
  expect(result.chain).toEqual([
    "https://short.test/start",
    "https://final.test/path",
  ]);
  expect(result.contentType).toBe("text/html");
});

test("expandUrl aborts when hostname becomes private", async () => {
  (isPrivateHostname as jest.Mock).mockResolvedValueOnce(true);
  const result = await expandUrl("https://internal.test", {
    maxRedirects: 5,
    timeoutMs: 1000,
    maxContentLength: 1024,
  });
  expect(result.finalUrl).toBe("https://internal.test/");
  expect(result.chain).toHaveLength(0);
});

test("detects suspicious tlds", () => {
  expect(isSuspiciousTld("evil.zip")).toBe(true);
  expect(isSuspiciousTld("safe.example")).toBe(false);
  expect(isSuspiciousTld("test.xyz")).toBe(true);
  expect(isSuspiciousTld("sub.domain.tk")).toBe(true);
});

test("normalizeUrl handles invalid inputs", () => {
  expect(normalizeUrl("not-a-url")).toBeNull();
  expect(normalizeUrl("ftp://example.com")).toBeNull();
  expect(normalizeUrl("")).toBeNull();
});

test("normalizeUrl handles IDN domains", () => {
  // "münchen.de" -> "xn--mnchen-3ya.de"
  const u = normalizeUrl("http://münchen.de");
  expect(u).toBe("http://xn--mnchen-3ya.de/");
});

test("normalizeUrl handles complex paths and queries", () => {
  const u = normalizeUrl("https://example.com/a//b///c?x=1&y=2");
  expect(u).toBe("https://example.com/a/b/c?x=1&y=2");
});

test("expandUrl handles network errors gracefully", async () => {
  request.mockRejectedValueOnce(new Error("Network error"));

  const result = await expandUrl("https://down.test", {
    maxRedirects: 2,
    timeoutMs: 100,
    maxContentLength: 1000,
  });

  expect(result.finalUrl).toBe("https://down.test/");
  expect(result.chain).toEqual(["https://down.test/"]);
});

test("expandUrl stops at max redirects", async () => {
  request.mockResolvedValue({
    statusCode: 301,
    headers: { location: "https://next.test" },
    body: null,
    trailers: {},
    opaque: null,
    context: null,
  } as any);

  const result = await expandUrl("https://start.test", {
    maxRedirects: 2,
    timeoutMs: 100,
    maxContentLength: 1000,
  });

  expect(result.chain).toHaveLength(2);
  // Should stop expanding after limit
});
