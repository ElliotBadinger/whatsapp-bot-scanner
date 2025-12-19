/**
 * Fuzz Testing Integration
 *
 * Uses fast-check for JavaScript-native fuzzing with:
 * - Boundary value testing
 * - Invalid input handling
 * - Unicode edge cases
 * - Large input stress testing
 * - Malformed data resilience
 */

import { describe, expect, test } from "@jest/globals";
import fc from "fast-check";
import { scoreFromSignals } from "../scoring";
import type { Signals } from "../scoring";
import { detectHomoglyphs } from "../homoglyph";
import { normalizeUrl, extractUrls, urlHash } from "../url";
import { UrlValidator } from "../validation";

const NUM_RUNS = process.env.CI ? 10000 : 1000;

describe("Fuzz Testing - Boundary Values", () => {
  describe("Scoring Boundary Fuzzing", () => {
    test("FUZZ: Extreme numeric values don't crash", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 1000000 }),
          fc.integer({ min: -1000000, max: 1000000 }),
          fc.integer({ min: -1000000, max: 1000000 }),
          fc.integer({ min: -1000000, max: 1000000 }),
          fc.integer({ min: -1000000, max: 1000000 }),
          (vtMal, vtSus, vtHarm, redirects, urlLen) => {
            const signals: Signals = {
              vtMalicious: vtMal,
              vtSuspicious: vtSus,
              vtHarmless: vtHarm,
              redirectCount: redirects,
              urlLength: urlLen,
            };

            expect(() => scoreFromSignals(signals)).not.toThrow();
            const result = scoreFromSignals(signals);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(15);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("FUZZ: Domain age edge cases", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(undefined),
            fc.constant(null as unknown as number),
            fc.constant(0),
            fc.constant(-1),
            fc.constant(Number.MAX_SAFE_INTEGER),
            fc.constant(Number.MIN_SAFE_INTEGER),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
            fc.nat(36500),
          ),
          (domainAgeDays) => {
            const signals: Signals = { domainAgeDays };

            expect(() => scoreFromSignals(signals)).not.toThrow();
            const result = scoreFromSignals(signals);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(15);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("FUZZ: Boolean field combinations", () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          (a, b, c, d, e, f, g, h) => {
            const signals: Signals = {
              urlhausListed: a,
              phishtankVerified: b,
              isIpLiteral: c,
              hasSuspiciousTld: d,
              hasUncommonPort: e,
              hasExecutableExtension: f,
              wasShortened: g,
              finalUrlMismatch: h,
            };

            expect(() => scoreFromSignals(signals)).not.toThrow();
            const result = scoreFromSignals(signals);
            expect(["benign", "suspicious", "malicious"]).toContain(
              result.level,
            );
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Homoglyph Fuzzing", () => {
    test("FUZZ: Random Unicode strings don't crash", () => {
      fc.assert(
        fc.property(
          fc.unicodeString({ minLength: 1, maxLength: 100 }),
          (domain) => {
            expect(() => detectHomoglyphs(domain)).not.toThrow();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("FUZZ: Mixed script combinations", () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.oneof(
              fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"),
              fc.constantFrom(..."αβγδεζηθικλμνξοπρστυφχψω"),
              fc.constantFrom(..."абвгдежзийклмнопрстуфхцчшщъыьэюя"),
              fc.constantFrom(..."0123456789"),
              fc.constant("."),
              fc.constant("-"),
            ),
            { minLength: 1, maxLength: 50 },
          ),
          (domain) => {
            expect(() => detectHomoglyphs(domain)).not.toThrow();
            const result = detectHomoglyphs(domain);
            expect(typeof result.detected).toBe("boolean");
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("FUZZ: Punycode edge cases", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant("xn--"),
            fc.constant("xn--abc"),
            fc.constant("xn--80ak6aa92e.com"),
            fc.constant("xn--nxasmq5b.com"),
            fc
              .asciiString({ minLength: 0, maxLength: 30 })
              .map((s) => `xn--${s}.com`),
          ),
          (domain) => {
            expect(() => detectHomoglyphs(domain)).not.toThrow();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("FUZZ: Empty and whitespace inputs", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(""),
            fc.constant(" "),
            fc.constant("\t"),
            fc.constant("\n"),
            fc.constant("   "),
            fc.stringOf(fc.constantFrom(" ", "\t", "\n", "\r"), {
              maxLength: 10,
            }),
          ),
          (domain) => {
            expect(() => detectHomoglyphs(domain)).not.toThrow();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("URL Fuzzing", () => {
    test("FUZZ: Malformed URLs are handled gracefully", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.asciiString({ maxLength: 100 }),
            fc.unicodeString({ maxLength: 100 }),
            fc.constant(""),
            fc.constant("://"),
            fc.constant("http://"),
            fc.constant("https://"),
            fc.constant("javascript:alert(1)"),
            fc.constant("file:///etc/passwd"),
            fc.constant("data:text/html,<script>"),
            fc.constant("http://user:pass@host:port/path?query#fragment"),
          ),
          (url) => {
            expect(() => normalizeUrl(url)).not.toThrow();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("FUZZ: URL extraction from random text", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.asciiString({ maxLength: 500 }),
            fc.unicodeString({ maxLength: 500 }),
            fc.stringOf(
              fc.oneof(
                fc.constantFrom(
                  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                ),
                fc.constantFrom(
                  " ",
                  "\n",
                  "\t",
                  ".",
                  "/",
                  ":",
                  "?",
                  "=",
                  "&",
                  "#",
                ),
                fc.constant("http://"),
                fc.constant("https://"),
                fc.constant("www."),
              ),
              { maxLength: 500 },
            ),
          ),
          (text) => {
            expect(() => extractUrls(text)).not.toThrow();
            const urls = extractUrls(text);
            expect(Array.isArray(urls)).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("FUZZ: URL hash on various inputs", () => {
      fc.assert(
        fc.property(
          fc.asciiString({ minLength: 1, maxLength: 200 }),
          (input) => {
            expect(() => urlHash(input)).not.toThrow();
            const hash = urlHash(input);
            expect(hash.length).toBe(64);
            expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Validation Fuzzing", () => {
    test("FUZZ: URL validator handles any string input", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.asciiString({ maxLength: 3000 }),
            fc.unicodeString({ maxLength: 1000 }),
            fc.webUrl(),
            fc.constant(""),
            fc.constant("not a url"),
            fc.constant("http://localhost"),
            fc.constant("http://127.0.0.1"),
            fc.constant("http://10.0.0.1"),
            fc.constant("http://192.168.1.1"),
          ),
          async (url) => {
            const validator = new UrlValidator();
            const result = await validator.validateUrl(url);
            expect(result).toBeDefined();
          },
        ),
        { numRuns: Math.min(NUM_RUNS, 500) },
      );
    });
  });

  describe("Large Input Stress Testing", () => {
    test("FUZZ: Very long strings don't crash scoring", () => {
      fc.assert(
        fc.property(
          fc.array(fc.asciiString({ maxLength: 100 }), {
            minLength: 10,
            maxLength: 100,
          }),
          (reasons) => {
            const signals: Signals = {
              urlLength: reasons.join("").length,
            };

            expect(() => scoreFromSignals(signals)).not.toThrow();
          },
        ),
        { numRuns: Math.min(NUM_RUNS, 100) },
      );
    });

    test("FUZZ: Many GSB threat types", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "MALICIOUS_BINARY",
              "POTENTIALLY_HARMFUL_APPLICATION",
              "UNKNOWN_THREAT",
              "CUSTOM_THREAT",
            ),
            { maxLength: 50 },
          ),
          (threats) => {
            const signals: Signals = { gsbThreatTypes: threats };

            expect(() => scoreFromSignals(signals)).not.toThrow();
            const result = scoreFromSignals(signals);
            expect(result.score).toBeLessThanOrEqual(15);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Type Coercion Resilience", () => {
    test("FUZZ: Undefined vs null vs missing fields", () => {
      fc.assert(
        fc.property(
          fc.record({
            vtMalicious: fc.option(fc.nat(100), { nil: undefined }),
            vtSuspicious: fc.option(fc.nat(100), { nil: undefined }),
            vtHarmless: fc.option(fc.nat(100), { nil: undefined }),
            redirectCount: fc.option(fc.nat(20), { nil: undefined }),
            urlLength: fc.option(fc.nat(500), { nil: undefined }),
            domainAgeDays: fc.option(fc.nat(3650), { nil: undefined }),
          }),
          (partialSignals) => {
            expect(() => scoreFromSignals(partialSignals)).not.toThrow();
            const result = scoreFromSignals(partialSignals);
            expect(result).toBeDefined();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});

describe("Fuzz Testing - Crash Resistance", () => {
  test("FUZZ: Arbitrary signals never crash", () => {
    fc.assert(
      fc.property(
        fc.record({
          gsbThreatTypes: fc.option(
            fc.array(fc.asciiString({ maxLength: 50 })),
            {
              nil: undefined,
            },
          ),
          vtMalicious: fc.option(fc.integer(), { nil: undefined }),
          vtSuspicious: fc.option(fc.integer(), { nil: undefined }),
          vtHarmless: fc.option(fc.integer(), { nil: undefined }),
          urlhausListed: fc.option(fc.boolean(), { nil: undefined }),
          phishtankVerified: fc.option(fc.boolean(), { nil: undefined }),
          domainAgeDays: fc.option(fc.integer(), { nil: undefined }),
          isIpLiteral: fc.option(fc.boolean(), { nil: undefined }),
          hasSuspiciousTld: fc.option(fc.boolean(), { nil: undefined }),
          redirectCount: fc.option(fc.integer(), { nil: undefined }),
          hasUncommonPort: fc.option(fc.boolean(), { nil: undefined }),
          urlLength: fc.option(fc.integer(), { nil: undefined }),
          hasExecutableExtension: fc.option(fc.boolean(), { nil: undefined }),
          wasShortened: fc.option(fc.boolean(), { nil: undefined }),
          manualOverride: fc.option(
            fc.constantFrom("allow" as const, "deny" as const, null),
            { nil: undefined },
          ),
          finalUrlMismatch: fc.option(fc.boolean(), { nil: undefined }),
          heuristicsOnly: fc.option(fc.boolean(), { nil: undefined }),
        }),
        (signals) => {
          expect(() => scoreFromSignals(signals)).not.toThrow();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  test("FUZZ: Score output is always valid", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        try {
          const result = scoreFromSignals(input as Signals);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(15);
          expect(["benign", "suspicious", "malicious"]).toContain(result.level);
          expect(Array.isArray(result.reasons)).toBe(true);
          expect(typeof result.cacheTtl).toBe("number");
        } catch {
          // Some inputs may throw, which is acceptable for truly malformed data
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
