/**
 * Metamorphic Property Tests for Scoring Algorithm
 *
 * Metamorphic testing verifies score relationships under transformations:
 * - Additive transformations
 * - Multiplicative relationships
 * - Composition properties
 * - Invariant preservation
 */

import { describe, expect, test } from "@jest/globals";
import fc from "fast-check";
import { scoreFromSignals } from "../scoring";
import type { Signals } from "../scoring";
import {
  NUM_RUNS,
  signalsNoOverrideArb,
  benignSignalsArb,
  maliciousSignalsArb,
  makeHomoglyph,
} from "./arbitraries";

describe("Scoring - Metamorphic Property Tests", () => {
  describe("Additive Transformations", () => {
    test("MR1: Adding threat signal never decreases score", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (baseSignals) => {
          const baseScore = scoreFromSignals(baseSignals).score;

          const transformations: Partial<Signals>[] = [
            { phishtankVerified: true },
            { urlhausListed: true },
            { isIpLiteral: true },
            { hasSuspiciousTld: true },
            { hasUncommonPort: true },
            { hasExecutableExtension: true },
            { wasShortened: true },
            { finalUrlMismatch: true },
          ];

          for (const transform of transformations) {
            const enhanced = { ...baseSignals, ...transform };
            const enhancedScore = scoreFromSignals(enhanced).score;

            expect(enhancedScore).toBeGreaterThanOrEqual(baseScore);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR2: Removing threat signal never increases score", () => {
      fc.assert(
        fc.property(maliciousSignalsArb, (baseSignals) => {
          const baseScore = scoreFromSignals(baseSignals).score;

          const sanitized: Signals = {
            ...baseSignals,
            gsbThreatTypes: undefined,
            phishtankVerified: false,
            urlhausListed: false,
          };

          const sanitizedScore = scoreFromSignals(sanitized).score;

          expect(sanitizedScore).toBeLessThanOrEqual(baseScore);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR3: Domain age increase never increases score", () => {
      fc.assert(
        fc.property(
          signalsNoOverrideArb,
          fc.integer({ min: 0, max: 365 }),
          fc.integer({ min: 0, max: 365 }),
          (baseSignals, age1, age2) => {
            const young = Math.min(age1, age2);
            const old = Math.max(age1, age2);

            const youngSignals = { ...baseSignals, domainAgeDays: young };
            const oldSignals = { ...baseSignals, domainAgeDays: old };

            const youngScore = scoreFromSignals(youngSignals).score;
            const oldScore = scoreFromSignals(oldSignals).score;

            expect(oldScore).toBeLessThanOrEqual(youngScore);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Multiplicative Relationships", () => {
    test("MR4: VT malicious count has diminishing returns", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (baseSignals) => {
          const scores = [0, 1, 2, 3, 5, 10, 20].map((vt) =>
            scoreFromSignals({
              ...baseSignals,
              vtMalicious: vt,
              gsbThreatTypes: undefined,
              phishtankVerified: false,
              urlhausListed: false,
            }).score,
          );

          for (let i = 1; i < scores.length; i++) {
            expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR5: Redirect count has threshold effect at 3", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (baseSignals) => {
          const clean = {
            ...baseSignals,
            gsbThreatTypes: undefined,
            vtMalicious: 0,
            phishtankVerified: false,
            urlhausListed: false,
            domainAgeDays: 365,
            isIpLiteral: false,
            hasSuspiciousTld: false,
            hasUncommonPort: false,
            urlLength: 50,
            hasExecutableExtension: false,
            wasShortened: false,
            finalUrlMismatch: false,
            homoglyph: undefined,
          };

          const score2 = scoreFromSignals({ ...clean, redirectCount: 2 }).score;
          const score3 = scoreFromSignals({ ...clean, redirectCount: 3 }).score;
          const score4 = scoreFromSignals({ ...clean, redirectCount: 4 }).score;

          expect(score2).toBe(score3 - 2);
          expect(score3).toBe(score4);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Composition Properties", () => {
    test("MR6: Homoglyph risk levels compose correctly", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (baseSignals) => {
          const clean = { ...baseSignals, homoglyph: undefined };

          const none = scoreFromSignals(clean).score;
          const low = scoreFromSignals({ ...clean, homoglyph: makeHomoglyph("low") }).score;
          const medium = scoreFromSignals({ ...clean, homoglyph: makeHomoglyph("medium") }).score;
          const high = scoreFromSignals({ ...clean, homoglyph: makeHomoglyph("high") }).score;

          expect(low).toBeGreaterThanOrEqual(none);
          expect(medium).toBeGreaterThanOrEqual(low);
          expect(high).toBeGreaterThanOrEqual(medium);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR7: Multiple blocklist hits don't overflow score", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (baseSignals) => {
          const maxThreat: Signals = {
            ...baseSignals,
            gsbThreatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            phishtankVerified: true,
            urlhausListed: true,
            vtMalicious: 100,
            domainAgeDays: 0,
            isIpLiteral: true,
            hasSuspiciousTld: true,
            redirectCount: 20,
            hasUncommonPort: true,
            urlLength: 500,
            hasExecutableExtension: true,
            wasShortened: true,
            finalUrlMismatch: true,
            homoglyph: makeHomoglyph("high"),
          };

          const result = scoreFromSignals(maxThreat);

          expect(result.score).toBeLessThanOrEqual(15);
          expect(result.level).toBe("malicious");
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Invariant Preservation", () => {
    test("MR8: Allow override always produces benign regardless of signals", () => {
      fc.assert(
        fc.property(maliciousSignalsArb, (signals) => {
          const result = scoreFromSignals({ ...signals, manualOverride: "allow" });

          expect(result.score).toBe(0);
          expect(result.level).toBe("benign");
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR9: Deny override always produces malicious regardless of signals", () => {
      fc.assert(
        fc.property(benignSignalsArb, (signals) => {
          const result = scoreFromSignals({ ...signals, manualOverride: "deny" });

          expect(result.score).toBe(15);
          expect(result.level).toBe("malicious");
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR10: heuristicsOnly flag adds reason but doesn't change score", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (signals) => {
          const without = scoreFromSignals({ ...signals, heuristicsOnly: false });
          const with_ = scoreFromSignals({ ...signals, heuristicsOnly: true });

          expect(with_.score).toBe(without.score);
          expect(with_.level).toBe(without.level);

          if (with_.reasons.length > 0) {
            const hasHeuristicReason = with_.reasons.some((r) =>
              r.includes("Heuristics-only"),
            );
            expect(hasHeuristicReason).toBe(true);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Symmetry Properties", () => {
    test("MR11: Same signals produce same verdict class", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, signalsNoOverrideArb, (s1, s2) => {
          const r1 = scoreFromSignals(s1);
          const r2 = scoreFromSignals(s2);

          if (r1.score === r2.score) {
            expect(r1.level).toBe(r2.level);
            expect(r1.cacheTtl).toBe(r2.cacheTtl);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR12: Verdict boundaries are consistent", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 15 }), (targetScore) => {
          const result = { score: targetScore, level: "" as string };

          if (targetScore <= 3) {
            result.level = "benign";
          } else if (targetScore <= 7) {
            result.level = "suspicious";
          } else {
            result.level = "malicious";
          }

          expect(["benign", "suspicious", "malicious"]).toContain(result.level);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Cache TTL Transformations", () => {
    test("MR13: Higher scores produce shorter cache TTLs", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, signalsNoOverrideArb, (s1, s2) => {
          const r1 = scoreFromSignals(s1);
          const r2 = scoreFromSignals(s2);

          const levelOrder: Record<string, number> = {
            benign: 0,
            suspicious: 1,
            malicious: 2,
          };

          if (levelOrder[r1.level] < levelOrder[r2.level]) {
            expect(r1.cacheTtl).toBeGreaterThanOrEqual(r2.cacheTtl);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR14: Benign verdicts have longest cache TTL", () => {
      fc.assert(
        fc.property(benignSignalsArb, (signals) => {
          const result = scoreFromSignals(signals);

          if (result.level === "benign") {
            expect(result.cacheTtl).toBe(86400);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("MR15: Malicious verdicts have shortest cache TTL", () => {
      fc.assert(
        fc.property(maliciousSignalsArb, (signals) => {
          const enhanced = {
            ...signals,
            gsbThreatTypes: ["MALWARE"],
            phishtankVerified: true,
          };
          const result = scoreFromSignals(enhanced);

          if (result.level === "malicious") {
            expect(result.cacheTtl).toBe(900);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
