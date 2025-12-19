/**
 * Property-Based Tests for URL Functions
 *
 * Tests mathematical properties:
 * - Normalization idempotence
 * - URL extraction completeness
 * - Hash determinism
 * - TLD detection consistency
 */

import { describe, expect, test } from "@jest/globals";
import fc from "fast-check";
import { extractUrls, normalizeUrl, urlHash, isSuspiciousTld, isShortener } from "../url";

const NUM_RUNS = process.env.CI ? 10000 : 1000;

const validUrlArb = fc.webUrl({ validSchemes: ["http", "https"] });

const suspiciousTldArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), {
      minLength: 1,
      maxLength: 10,
    }),
    fc.constantFrom('.tk', '.ml', '.cf', '.gq', '.xyz', '.top', '.club'),
  )
  .map(([name, tld]) => `https://${name}${tld}`);

const safeTldArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), {
      minLength: 1,
      maxLength: 10,
    }),
    fc.constantFrom('.com', '.org', '.net', '.edu', '.gov'),
  )
  .map(([name, tld]) => `https://${name}${tld}`);

const shortenerArb = fc.constantFrom(
  'https://bit.ly/abc123',
  'https://t.co/xyz789',
  'https://goo.gl/short',
  'https://tinyurl.com/test',
  'https://ow.ly/link',
);

describe("URL Functions - Property Tests", () => {
  describe("normalizeUrl Properties", () => {
    test("PROPERTY: Normalization is idempotent", () => {
      fc.assert(
        fc.property(validUrlArb, (url) => {
          const normalized1 = normalizeUrl(url);
          if (normalized1 === null) return;

          const normalized2 = normalizeUrl(normalized1);

          expect(normalized2).toBe(normalized1);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Normalized URL is lowercase hostname", () => {
      fc.assert(
        fc.property(validUrlArb, (url) => {
          const normalized = normalizeUrl(url);
          if (normalized === null) return;

          const parsed = new URL(normalized);
          expect(parsed.hostname).toBe(parsed.hostname.toLowerCase());
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Default ports are stripped", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "http://example.com:80/path",
            "https://example.com:443/path",
          ),
          (url) => {
            const normalized = normalizeUrl(url);
            if (normalized === null) return;

            const parsed = new URL(normalized);
            expect(parsed.port).toBe("");
          },
        ),
        { numRuns: 100 },
      );
    });

    test("PROPERTY: Non-default ports are preserved", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 65535 }).filter((p) => p !== 80 && p !== 443),
          (port) => {
            const url = `https://example.com:${port}/path`;
            const normalized = normalizeUrl(url);
            if (normalized === null) return;

            const parsed = new URL(normalized);
            expect(parsed.port).toBe(String(port));
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Fragments are stripped", () => {
      fc.assert(
        fc.property(
          validUrlArb,
          fc.asciiString({ minLength: 1, maxLength: 20 }),
          (url, fragment) => {
            const urlWithFragment = `${url}#${fragment}`;
            const normalized = normalizeUrl(urlWithFragment);
            if (normalized === null) return;

            expect(normalized.includes("#")).toBe(false);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Only http and https protocols are valid", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("ftp://example.com", "file:///etc/passwd", "javascript:alert(1)"),
          (url) => {
            const normalized = normalizeUrl(url);
            expect(normalized).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("urlHash Properties", () => {
    test("PROPERTY: Hash is deterministic", () => {
      fc.assert(
        fc.property(validUrlArb, (url) => {
          const normalized = normalizeUrl(url);
          if (normalized === null) return;

          const hash1 = urlHash(normalized);
          const hash2 = urlHash(normalized);
          const hash3 = urlHash(normalized);

          expect(hash1).toBe(hash2);
          expect(hash2).toBe(hash3);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Hash is always 64 characters (SHA-256 hex)", () => {
      fc.assert(
        fc.property(validUrlArb, (url) => {
          const normalized = normalizeUrl(url);
          if (normalized === null) return;

          const hash = urlHash(normalized);

          expect(hash.length).toBe(64);
          expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Different URLs produce different hashes (collision resistance)", () => {
      fc.assert(
        fc.property(validUrlArb, validUrlArb, (url1, url2) => {
          const normalized1 = normalizeUrl(url1);
          const normalized2 = normalizeUrl(url2);

          if (normalized1 === null || normalized2 === null) return;
          if (normalized1 === normalized2) return;

          const hash1 = urlHash(normalized1);
          const hash2 = urlHash(normalized2);

          expect(hash1).not.toBe(hash2);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("extractUrls Properties", () => {
    test("PROPERTY: Empty string returns empty array", () => {
      const result = extractUrls("");
      expect(result).toEqual([]);
    });

    test("PROPERTY: Extracted URLs are valid", () => {
      fc.assert(
        fc.property(validUrlArb, (url) => {
          const text = `Check out ${url} for more info`;
          const extracted = extractUrls(text);

          for (const extractedUrl of extracted) {
            expect(() => new URL(extractedUrl)).not.toThrow();
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: No duplicates in extracted URLs", () => {
      fc.assert(
        fc.property(validUrlArb, (url) => {
          const text = `Visit ${url} and ${url} again`;
          const extracted = extractUrls(text);
          const unique = new Set(extracted);

          expect(unique.size).toBe(extracted.length);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("isSuspiciousTld Properties", () => {
    test("PROPERTY: Suspicious TLDs are detected", () => {
      fc.assert(
        fc.property(suspiciousTldArb, (url) => {
          const parsed = new URL(url);
          const result = isSuspiciousTld(parsed.hostname);

          expect(result).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Safe TLDs are not flagged", () => {
      fc.assert(
        fc.property(safeTldArb, (url) => {
          const parsed = new URL(url);
          const result = isSuspiciousTld(parsed.hostname);

          expect(result).toBe(false);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Detection is case-insensitive", () => {
      fc.assert(
        fc.property(
          fc.constantFrom('example.TK', 'EXAMPLE.tk', 'Example.Tk'),
          (hostname) => {
            const result = isSuspiciousTld(hostname);
            expect(result).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("isShortener Properties", () => {
    test("PROPERTY: Known shorteners are detected", () => {
      fc.assert(
        fc.property(shortenerArb, (url) => {
          const parsed = new URL(url);
          const result = isShortener(parsed.hostname);

          expect(result).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    test("PROPERTY: Detection is deterministic", () => {
      fc.assert(
        fc.property(
          fc.constantFrom('bit.ly', 't.co', 'example.com', 'google.com'),
          (hostname) => {
            const result1 = isShortener(hostname);
            const result2 = isShortener(hostname);
            const result3 = isShortener(hostname);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
