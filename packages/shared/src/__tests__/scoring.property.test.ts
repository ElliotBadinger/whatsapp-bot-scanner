import { describe, expect, test } from "@jest/globals";
import fc from "fast-check";
import { scoreFromSignals } from "../scoring";
import type { Signals } from "../scoring";
import type { HomoglyphResult } from "../homoglyph";

const MALICIOUS_GSB_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "MALICIOUS_BINARY",
  "POTENTIALLY_HARMFUL_APPLICATION",
] as const;

const homoglyphCharArb = fc.record({
  original: fc.constantFrom("a", "e", "o"),
  confusedWith: fc.constantFrom("a", "e", "o"),
  position: fc.nat(50),
  script: fc.constant("Latin"),
  alternatives: fc.array(fc.constantFrom("a", "e", "o"), { maxLength: 3 }),
});

const homoglyphArb: fc.Arbitrary<HomoglyphResult> = fc.record({
  detected: fc.constant(true),
  isPunycode: fc.boolean(),
  mixedScript: fc.boolean(),
  unicodeHostname: fc.asciiString({ minLength: 1, maxLength: 20 }),
  normalizedDomain: fc.asciiString({ minLength: 1, maxLength: 20 }),
  confusableChars: fc.array(homoglyphCharArb, { maxLength: 3 }),
  riskLevel: fc.constantFrom("low", "medium", "high"),
  riskReasons: fc.array(fc.asciiString({ minLength: 1, maxLength: 40 }), {
    maxLength: 3,
  }),
});

const signalsArb: fc.Arbitrary<Signals> = fc.record({
  gsbThreatTypes: fc.option(
    fc.array(fc.constantFrom(...MALICIOUS_GSB_TYPES), { maxLength: 4 }),
    { nil: undefined },
  ),
  vtMalicious: fc.option(fc.nat(5), { nil: undefined }),
  vtSuspicious: fc.option(fc.nat(5), { nil: undefined }),
  vtHarmless: fc.option(fc.nat(100), { nil: undefined }),
  urlhausListed: fc.option(fc.boolean(), { nil: undefined }),
  phishtankVerified: fc.option(fc.boolean(), { nil: undefined }),
  domainAgeDays: fc.option(fc.nat(60), { nil: undefined }),
  isIpLiteral: fc.option(fc.boolean(), { nil: undefined }),
  hasSuspiciousTld: fc.option(fc.boolean(), { nil: undefined }),
  redirectCount: fc.option(fc.nat(10), { nil: undefined }),
  hasUncommonPort: fc.option(fc.boolean(), { nil: undefined }),
  urlLength: fc.option(fc.nat(400), { nil: undefined }),
  hasExecutableExtension: fc.option(fc.boolean(), { nil: undefined }),
  wasShortened: fc.option(fc.boolean(), { nil: undefined }),
  manualOverride: fc.option(
    fc.constantFrom<"allow" | "deny" | null>("allow", "deny", null),
    { nil: undefined },
  ),
  finalUrlMismatch: fc.option(fc.boolean(), { nil: undefined }),
  homoglyph: fc.option(homoglyphArb, { nil: undefined }),
  heuristicsOnly: fc.option(fc.boolean(), { nil: undefined }),
});

const signalsNoOverrideArb = signalsArb.map((signals) => ({
  ...signals,
  manualOverride: undefined,
}));

const maliciousThreatTypeSet = new Set<string>(MALICIOUS_GSB_TYPES);

function stripMaliciousThreats(
  threatTypes: Signals["gsbThreatTypes"],
): string[] {
  if (!threatTypes) return [];
  return threatTypes.filter((t) => !maliciousThreatTypeSet.has(t));
}

function makeHomoglyph(
  riskLevel: HomoglyphResult["riskLevel"],
): HomoglyphResult {
  return {
    detected: true,
    isPunycode: false,
    mixedScript: false,
    unicodeHostname: "example.com",
    normalizedDomain: "example.com",
    confusableChars: [],
    riskLevel,
    riskReasons: [],
  };
}

describe("Scoring Algorithm - Property-Based Tests", () => {
  test("PROPERTY: score is deterministic for identical inputs", () => {
    fc.assert(
      fc.property(signalsArb, (signals) => {
        const result1 = scoreFromSignals(signals);
        const result2 = scoreFromSignals(signals);
        const result3 = scoreFromSignals(signals);

        expect(result1).toEqual(result2);
        expect(result2).toEqual(result3);
      }),
      { numRuns: 1000 },
    );
  });

  test("PROPERTY: score is bounded and verdict matches score bands", () => {
    fc.assert(
      fc.property(signalsArb, (signals) => {
        const result = scoreFromSignals(signals);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(15);

        if (result.score <= 3) {
          expect(result.level).toBe("benign");
        } else if (result.score <= 7) {
          expect(result.level).toBe("suspicious");
        } else {
          expect(result.level).toBe("malicious");
        }
      }),
      { numRuns: 1000 },
    );
  });

  test("PROPERTY: reasons list has no duplicates", () => {
    fc.assert(
      fc.property(signalsArb, (signals) => {
        const { reasons } = scoreFromSignals(signals);
        const unique = new Set(reasons);
        expect(unique.size).toBe(reasons.length);
      }),
      { numRuns: 1000 },
    );
  });

  test("PROPERTY: adding a malicious GSB threat does not lower score", () => {
    fc.assert(
      fc.property(signalsNoOverrideArb, (signals) => {
        const baseThreats = stripMaliciousThreats(signals.gsbThreatTypes);
        const baseline = {
          ...signals,
          gsbThreatTypes: baseThreats,
        };
        const elevated = {
          ...baseline,
          gsbThreatTypes: [...baseThreats, "MALWARE"],
        };

        const scoreBaseline = scoreFromSignals(baseline).score;
        const scoreElevated = scoreFromSignals(elevated).score;
        expect(scoreElevated).toBeGreaterThanOrEqual(scoreBaseline);
      }),
      { numRuns: 1000 },
    );
  });

  test("PROPERTY: phishtank listing does not lower score", () => {
    fc.assert(
      fc.property(signalsNoOverrideArb, (signals) => {
        const baseline = { ...signals, phishtankVerified: false };
        const elevated = { ...signals, phishtankVerified: true };
        const scoreBaseline = scoreFromSignals(baseline).score;
        const scoreElevated = scoreFromSignals(elevated).score;
        expect(scoreElevated).toBeGreaterThanOrEqual(scoreBaseline);
      }),
      { numRuns: 1000 },
    );
  });

  test("PROPERTY: urlhaus listing does not lower score", () => {
    fc.assert(
      fc.property(signalsNoOverrideArb, (signals) => {
        const baseline = { ...signals, urlhausListed: false };
        const elevated = { ...signals, urlhausListed: true };
        const scoreBaseline = scoreFromSignals(baseline).score;
        const scoreElevated = scoreFromSignals(elevated).score;
        expect(scoreElevated).toBeGreaterThanOrEqual(scoreBaseline);
      }),
      { numRuns: 1000 },
    );
  });

  test("PROPERTY: increasing redirect count does not lower score", () => {
    fc.assert(
      fc.property(signalsNoOverrideArb, (signals) => {
        const baselineRedirects = Math.max(0, signals.redirectCount ?? 0);
        const baseline = { ...signals, redirectCount: baselineRedirects };
        const elevated = {
          ...signals,
          redirectCount: baselineRedirects + 1,
        };
        const scoreBaseline = scoreFromSignals(baseline).score;
        const scoreElevated = scoreFromSignals(elevated).score;
        expect(scoreElevated).toBeGreaterThanOrEqual(scoreBaseline);
      }),
      { numRuns: 1000 },
    );
  });

  test("PROPERTY: younger domains do not lower score", () => {
    fc.assert(
      fc.property(
        signalsNoOverrideArb,
        fc.nat(60),
        fc.nat(60),
        (signals, age1, age2) => {
          const young = Math.min(age1, age2);
          const old = Math.max(age1, age2);
          const youngScore = scoreFromSignals({
            ...signals,
            domainAgeDays: young,
          }).score;
          const oldScore = scoreFromSignals({
            ...signals,
            domainAgeDays: old,
          }).score;

          expect(youngScore).toBeGreaterThanOrEqual(oldScore);
        },
      ),
      { numRuns: 1000 },
    );
  });

  test("PROPERTY: higher homoglyph risk does not lower score", () => {
    fc.assert(
      fc.property(signalsNoOverrideArb, (signals) => {
        const baseline = { ...signals, homoglyph: undefined };
        const low = scoreFromSignals({
          ...baseline,
          homoglyph: makeHomoglyph("low"),
        }).score;
        const medium = scoreFromSignals({
          ...baseline,
          homoglyph: makeHomoglyph("medium"),
        }).score;
        const high = scoreFromSignals({
          ...baseline,
          homoglyph: makeHomoglyph("high"),
        }).score;

        expect(medium).toBeGreaterThanOrEqual(low);
        expect(high).toBeGreaterThanOrEqual(medium);
      }),
      { numRuns: 1000 },
    );
  });
});
