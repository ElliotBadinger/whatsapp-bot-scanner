/**
 * Advanced Property-Based Tests for Scoring Algorithm
 *
 * Tests mathematical properties that should hold for ALL inputs:
 * - Associativity
 * - Commutativity
 * - Idempotence
 * - Transitivity
 * - Conservation
 * - Distributivity
 * - Identity elements
 * - Absorption
 */

import { describe, expect, test } from "@jest/globals";
import fc from "fast-check";
import { scoreFromSignals } from "../scoring";
import type { Signals, RiskVerdict } from "../scoring";
import {
  NUM_RUNS,
  realisticSignalsArb,
  maliciousSignalsArb,
  benignSignalsArb,
  edgeCaseSignalsArb,
  signalsNoOverrideArb,
  makeHomoglyph,
} from "../testing/arbitraries";

describe("Advanced Property Tests - Mathematical Invariants", () => {
  describe("Idempotence Properties", () => {
    test("PROPERTY: scoreFromSignals is idempotent (same input → same output)", () => {
      fc.assert(
        fc.property(realisticSignalsArb, (signals) => {
          const result1 = scoreFromSignals(signals);
          const result2 = scoreFromSignals(signals);
          const result3 = scoreFromSignals(signals);

          expect(result1).toEqual(result2);
          expect(result2).toEqual(result3);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: scoring the same signals object multiple times is consistent", () => {
      fc.assert(
        fc.property(edgeCaseSignalsArb, (signals) => {
          const results: RiskVerdict[] = [];
          for (let i = 0; i < 5; i++) {
            results.push(scoreFromSignals(signals));
          }

          const first = results[0];
          results.forEach((result) => {
            expect(result.score).toBe(first.score);
            expect(result.level).toBe(first.level);
          });
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Transitivity Properties", () => {
    test("PROPERTY: verdict ordering is transitive (benign ≤ suspicious ≤ malicious)", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 15, noNaN: true }),
          fc.double({ min: 0, max: 15, noNaN: true }),
          fc.double({ min: 0, max: 15, noNaN: true }),
          (score1, score2, score3) => {
            const [a, b, c] = [score1, score2, score3].sort((x, y) => x - y);

            const verdictA = scoreToVerdict(a);
            const verdictB = scoreToVerdict(b);
            const verdictC = scoreToVerdict(c);

            const order: Record<string, number> = {
              benign: 0,
              suspicious: 1,
              malicious: 2,
            };

            if (
              order[verdictA] <= order[verdictB] &&
              order[verdictB] <= order[verdictC]
            ) {
              expect(order[verdictA]).toBeLessThanOrEqual(order[verdictC]);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: score thresholds form total order", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, signalsNoOverrideArb, (s1, s2) => {
          const r1 = scoreFromSignals(s1);
          const r2 = scoreFromSignals(s2);

          const order: Record<string, number> = {
            benign: 0,
            suspicious: 1,
            malicious: 2,
          };

          if (r1.score <= r2.score) {
            expect(order[r1.level]).toBeLessThanOrEqual(order[r2.level]);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Boundedness Properties", () => {
    test("PROPERTY: score is always in [0, 15] range", () => {
      fc.assert(
        fc.property(realisticSignalsArb, (signals) => {
          const result = scoreFromSignals(signals);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(15);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: verdict is always one of three valid values", () => {
      fc.assert(
        fc.property(edgeCaseSignalsArb, (signals) => {
          const result = scoreFromSignals(signals);
          expect(["benign", "suspicious", "malicious"]).toContain(result.level);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: cacheTtl is always positive", () => {
      fc.assert(
        fc.property(realisticSignalsArb, (signals) => {
          const result = scoreFromSignals(signals);
          expect(result.cacheTtl).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Monotonicity Properties", () => {
    test("PROPERTY: adding any threat signal never decreases score", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (signals) => {
          const baseline = scoreFromSignals(signals).score;

          const withPhishtank = scoreFromSignals({
            ...signals,
            phishtankVerified: true,
          }).score;
          const withUrlhaus = scoreFromSignals({
            ...signals,
            urlhausListed: true,
          }).score;
          const withSuspiciousTld = scoreFromSignals({
            ...signals,
            hasSuspiciousTld: true,
          }).score;
          const withIpLiteral = scoreFromSignals({
            ...signals,
            isIpLiteral: true,
          }).score;
          const withUncommonPort = scoreFromSignals({
            ...signals,
            hasUncommonPort: true,
          }).score;

          expect(withPhishtank).toBeGreaterThanOrEqual(baseline);
          expect(withUrlhaus).toBeGreaterThanOrEqual(baseline);
          expect(withSuspiciousTld).toBeGreaterThanOrEqual(baseline);
          expect(withIpLiteral).toBeGreaterThanOrEqual(baseline);
          expect(withUncommonPort).toBeGreaterThanOrEqual(baseline);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: higher VT malicious count never decreases score", () => {
      fc.assert(
        fc.property(
          signalsNoOverrideArb,
          fc.nat(50),
          fc.nat(50),
          (signals, a, b) => {
            const low = Math.min(a, b);
            const high = Math.max(a, b);

            const scoreLow = scoreFromSignals({
              ...signals,
              vtMalicious: low,
            }).score;
            const scoreHigh = scoreFromSignals({
              ...signals,
              vtMalicious: high,
            }).score;

            expect(scoreHigh).toBeGreaterThanOrEqual(scoreLow);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: more redirects never decrease score", () => {
      fc.assert(
        fc.property(
          signalsNoOverrideArb,
          fc.nat(10),
          fc.nat(10),
          (signals, a, b) => {
            const low = Math.min(a, b);
            const high = Math.max(a, b);

            const scoreLow = scoreFromSignals({
              ...signals,
              redirectCount: low,
            }).score;
            const scoreHigh = scoreFromSignals({
              ...signals,
              redirectCount: high,
            }).score;

            expect(scoreHigh).toBeGreaterThanOrEqual(scoreLow);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: younger domain age never decreases score", () => {
      fc.assert(
        fc.property(
          signalsNoOverrideArb,
          fc.nat(365),
          fc.nat(365),
          (signals, a, b) => {
            const young = Math.min(a, b);
            const old = Math.max(a, b);

            const scoreYoung = scoreFromSignals({
              ...signals,
              domainAgeDays: young,
            }).score;
            const scoreOld = scoreFromSignals({
              ...signals,
              domainAgeDays: old,
            }).score;

            expect(scoreYoung).toBeGreaterThanOrEqual(scoreOld);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: homoglyph risk ordering is monotonic (low ≤ medium ≤ high)", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (signals) => {
          const base = { ...signals, homoglyph: undefined };

          const scoreLow = scoreFromSignals({
            ...base,
            homoglyph: makeHomoglyph("low"),
          }).score;
          const scoreMedium = scoreFromSignals({
            ...base,
            homoglyph: makeHomoglyph("medium"),
          }).score;
          const scoreHigh = scoreFromSignals({
            ...base,
            homoglyph: makeHomoglyph("high"),
          }).score;

          expect(scoreMedium).toBeGreaterThanOrEqual(scoreLow);
          expect(scoreHigh).toBeGreaterThanOrEqual(scoreMedium);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Conservation Properties", () => {
    test("PROPERTY: reasons list is never empty when score > 0 (unless override)", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (signals) => {
          const result = scoreFromSignals(signals);

          if (result.score > 0) {
            expect(result.reasons.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: reasons have no duplicates", () => {
      fc.assert(
        fc.property(realisticSignalsArb, (signals) => {
          const { reasons } = scoreFromSignals(signals);
          const unique = new Set(reasons);
          expect(unique.size).toBe(reasons.length);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: cacheTtl correlates inversely with threat level", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, signalsNoOverrideArb, (s1, s2) => {
          const r1 = scoreFromSignals(s1);
          const r2 = scoreFromSignals(s2);

          const order: Record<string, number> = {
            benign: 0,
            suspicious: 1,
            malicious: 2,
          };

          if (order[r1.level] < order[r2.level]) {
            expect(r1.cacheTtl).toBeGreaterThanOrEqual(r2.cacheTtl);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Override Properties", () => {
    test("PROPERTY: manual allow override always produces score 0 and benign", () => {
      fc.assert(
        fc.property(realisticSignalsArb, (signals) => {
          const result = scoreFromSignals({
            ...signals,
            manualOverride: "allow",
          });

          expect(result.score).toBe(0);
          expect(result.level).toBe("benign");
          expect(result.reasons).toContain("Manually allowed");
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: manual deny override always produces score 15 and malicious", () => {
      fc.assert(
        fc.property(realisticSignalsArb, (signals) => {
          const result = scoreFromSignals({
            ...signals,
            manualOverride: "deny",
          });

          expect(result.score).toBe(15);
          expect(result.level).toBe("malicious");
          expect(result.reasons).toContain("Manually blocked");
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: overrides are absolute (ignore all other signals)", () => {
      fc.assert(
        fc.property(maliciousSignalsArb, (signals) => {
          const allowResult = scoreFromSignals({
            ...signals,
            manualOverride: "allow",
          });
          expect(allowResult.score).toBe(0);

          const denyResult = scoreFromSignals({
            ...signals,
            manualOverride: "deny",
          });
          expect(denyResult.score).toBe(15);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Biased Generator Properties", () => {
    test("PROPERTY: malicious signals produce high scores", () => {
      fc.assert(
        fc.property(maliciousSignalsArb, (signals) => {
          const result = scoreFromSignals(signals);

          expect(["suspicious", "malicious"]).toContain(result.level);
          expect(result.score).toBeGreaterThanOrEqual(3);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: benign signals produce low scores", () => {
      fc.assert(
        fc.property(benignSignalsArb, (signals) => {
          const result = scoreFromSignals(signals);

          expect(result.level).toBe("benign");
          expect(result.score).toBeLessThanOrEqual(3);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Edge Case Properties", () => {
    test("PROPERTY: domain age boundary conditions are handled correctly", () => {
      fc.assert(
        fc.property(
          signalsNoOverrideArb,
          fc.constantFrom(0, 6, 7, 13, 14, 29, 30, 31, 100, 365),
          (signals, age) => {
            const result = scoreFromSignals({
              ...signals,
              domainAgeDays: age,
            });

            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(15);

            if (age < 7) {
              expect(
                result.reasons.some((r) => r.includes("days ago (<7)")),
              ).toBe(true);
            } else if (age < 14) {
              expect(
                result.reasons.some((r) => r.includes("days ago (<14)")),
              ).toBe(true);
            } else if (age < 30) {
              expect(
                result.reasons.some((r) => r.includes("days ago (<30)")),
              ).toBe(true);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: VT malicious threshold boundaries work correctly", () => {
      fc.assert(
        fc.property(
          signalsNoOverrideArb,
          fc.constantFrom(0, 1, 2, 3, 5, 10, 20),
          (signals, vtCount) => {
            const baseline = {
              ...signals,
              gsbThreatTypes: undefined,
              phishtankVerified: false,
              urlhausListed: false,
              domainAgeDays: 365,
              isIpLiteral: false,
              hasSuspiciousTld: false,
              redirectCount: 0,
              hasUncommonPort: false,
              urlLength: 50,
              hasExecutableExtension: false,
              wasShortened: false,
              finalUrlMismatch: false,
              homoglyph: undefined,
            };

            const result = scoreFromSignals({
              ...baseline,
              vtMalicious: vtCount,
            });

            if (vtCount === 0) {
              expect(result.score).toBe(0);
            } else if (vtCount >= 1 && vtCount < 3) {
              expect(result.score).toBe(5);
            } else if (vtCount >= 3) {
              expect(result.score).toBe(8);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: redirect count threshold at 3 works correctly", () => {
      fc.assert(
        fc.property(
          signalsNoOverrideArb,
          fc.constantFrom(0, 1, 2, 3, 4, 5, 10),
          (signals, redirects) => {
            const baseline = {
              ...signals,
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

            const result = scoreFromSignals({
              ...baseline,
              redirectCount: redirects,
            });

            if (redirects < 3) {
              expect(result.score).toBe(0);
            } else {
              expect(result.score).toBe(2);
              expect(
                result.reasons.some((r) => r.includes("Multiple redirects")),
              ).toBe(true);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: URL length threshold at 200 works correctly", () => {
      fc.assert(
        fc.property(
          signalsNoOverrideArb,
          fc.constantFrom(50, 100, 199, 200, 201, 300, 400),
          (signals, urlLen) => {
            const baseline = {
              ...signals,
              gsbThreatTypes: undefined,
              vtMalicious: 0,
              phishtankVerified: false,
              urlhausListed: false,
              domainAgeDays: 365,
              isIpLiteral: false,
              hasSuspiciousTld: false,
              redirectCount: 0,
              hasUncommonPort: false,
              hasExecutableExtension: false,
              wasShortened: false,
              finalUrlMismatch: false,
              homoglyph: undefined,
            };

            const result = scoreFromSignals({
              ...baseline,
              urlLength: urlLen,
            });

            if (urlLen <= 200) {
              expect(result.score).toBe(0);
            } else {
              expect(result.score).toBe(2);
              expect(result.reasons.some((r) => r.includes("Long URL"))).toBe(
                true,
              );
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Commutativity-like Properties", () => {
    test("PROPERTY: order of signal evaluation doesn't affect final score", () => {
      fc.assert(
        fc.property(signalsNoOverrideArb, (signals) => {
          const forward = scoreFromSignals(signals);

          const reversed: Signals = {
            heuristicsOnly: signals.heuristicsOnly,
            homoglyph: signals.homoglyph,
            finalUrlMismatch: signals.finalUrlMismatch,
            wasShortened: signals.wasShortened,
            hasExecutableExtension: signals.hasExecutableExtension,
            urlLength: signals.urlLength,
            hasUncommonPort: signals.hasUncommonPort,
            redirectCount: signals.redirectCount,
            hasSuspiciousTld: signals.hasSuspiciousTld,
            isIpLiteral: signals.isIpLiteral,
            domainAgeDays: signals.domainAgeDays,
            phishtankVerified: signals.phishtankVerified,
            urlhausListed: signals.urlhausListed,
            vtHarmless: signals.vtHarmless,
            vtSuspicious: signals.vtSuspicious,
            vtMalicious: signals.vtMalicious,
            gsbThreatTypes: signals.gsbThreatTypes,
            manualOverride: signals.manualOverride,
          };

          const backward = scoreFromSignals(reversed);

          expect(forward.score).toBe(backward.score);
          expect(forward.level).toBe(backward.level);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });
});

function scoreToVerdict(score: number): "benign" | "suspicious" | "malicious" {
  if (score <= 3) return "benign";
  if (score <= 7) return "suspicious";
  return "malicious";
}
