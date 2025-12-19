/**
 * Property-Based Tests for Homoglyph Detection
 *
 * Tests mathematical properties of homoglyph analysis:
 * - Determinism
 * - Risk level ordering
 * - Character detection consistency
 * - Brand spoofing detection
 */

import { describe, expect, test } from "@jest/globals";
import fc from "fast-check";
import { detectHomoglyphs } from "../homoglyph";

const NUM_RUNS = process.env.CI ? 10000 : 1000;

const asciiDomainArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), {
      minLength: 1,
      maxLength: 20,
    }),
    fc.constantFrom('.com', '.org', '.net', '.io', '.co'),
  )
  .map(([name, tld]) => name + tld);

const brandLikeDomainArb = fc
  .tuple(
    fc.constantFrom('google', 'facebook', 'paypal', 'amazon', 'microsoft', 'apple'),
    fc.constantFrom('.com', '.org', '.net'),
  )
  .map(([brand, tld]) => brand + tld);

const punycodeArb = fc
  .tuple(
    fc.constant('xn--'),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), {
      minLength: 1,
      maxLength: 15,
    }),
    fc.constantFrom('.com', '.org'),
  )
  .map(([prefix, name, tld]) => prefix + name + tld);

describe("Homoglyph Detection - Property Tests", () => {
  describe("Determinism Properties", () => {
    test("PROPERTY: Same domain always produces same result", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result1 = detectHomoglyphs(domain);
          const result2 = detectHomoglyphs(domain);
          const result3 = detectHomoglyphs(domain);

          expect(result1).toEqual(result2);
          expect(result2).toEqual(result3);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Result structure is always complete", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);

          expect(typeof result.detected).toBe("boolean");
          expect(typeof result.isPunycode).toBe("boolean");
          expect(typeof result.mixedScript).toBe("boolean");
          expect(typeof result.unicodeHostname).toBe("string");
          expect(typeof result.normalizedDomain).toBe("string");
          expect(Array.isArray(result.confusableChars)).toBe(true);
          expect(["none", "low", "medium", "high"]).toContain(result.riskLevel);
          expect(Array.isArray(result.riskReasons)).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Risk Level Properties", () => {
    test("PROPERTY: Pure ASCII domains have low or no risk", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);

          expect(["none", "low"]).toContain(result.riskLevel);
          expect(result.mixedScript).toBe(false);
          expect(result.isPunycode).toBe(false);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Risk level ordering is consistent", () => {
      const riskOrder: Record<string, number> = {
        none: 0,
        low: 1,
        medium: 2,
        high: 3,
      };

      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);
          const riskValue = riskOrder[result.riskLevel];

          expect(riskValue).toBeGreaterThanOrEqual(0);
          expect(riskValue).toBeLessThanOrEqual(3);

          if (!result.detected) {
            expect(result.riskLevel).toBe("none");
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: detected=false implies riskLevel=none", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);

          if (!result.detected) {
            expect(result.riskLevel).toBe("none");
            expect(result.confusableChars.length).toBe(0);
            expect(result.isPunycode).toBe(false);
            expect(result.mixedScript).toBe(false);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Punycode Properties", () => {
    test("PROPERTY: Punycode domains are detected", () => {
      fc.assert(
        fc.property(punycodeArb, (domain) => {
          const result = detectHomoglyphs(domain);

          expect(result.isPunycode).toBe(true);
          expect(result.detected).toBe(true);
          expect(["low", "medium", "high"]).toContain(result.riskLevel);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Character Analysis Properties", () => {
    test("PROPERTY: confusableChars entries have required fields", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);

          for (const char of result.confusableChars) {
            expect(typeof char.original).toBe("string");
            expect(typeof char.confusedWith).toBe("string");
            expect(typeof char.position).toBe("number");
            expect(typeof char.script).toBe("string");
            expect(Array.isArray(char.alternatives)).toBe(true);
            expect(char.position).toBeGreaterThanOrEqual(0);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Reason strings are non-empty when present", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);

          for (const reason of result.riskReasons) {
            expect(reason.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Normalization Properties", () => {
    test("PROPERTY: normalizedDomain is lowercase", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);

          expect(result.normalizedDomain).toBe(result.normalizedDomain.toLowerCase());
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: unicodeHostname preserves domain structure", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);

          const originalDots = (domain.match(/\./g) || []).length;
          const unicodeDots = (result.unicodeHostname.match(/\./g) || []).length;

          expect(unicodeDots).toBe(originalDots);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Brand Detection Properties", () => {
    test("PROPERTY: Exact brand names are not flagged as spoofs", () => {
      fc.assert(
        fc.property(brandLikeDomainArb, (domain) => {
          const result = detectHomoglyphs(domain);

          const hasBrandSpoof = result.riskReasons.some((r) =>
            r.includes("Visually similar to brand"),
          );

          expect(hasBrandSpoof).toBe(false);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Idempotence Properties", () => {
    test("PROPERTY: Detection is idempotent on normalized domain", () => {
      fc.assert(
        fc.property(asciiDomainArb, (domain) => {
          const result1 = detectHomoglyphs(domain);
          const result2 = detectHomoglyphs(result1.normalizedDomain);

          expect(result2.normalizedDomain).toBe(result1.normalizedDomain);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
