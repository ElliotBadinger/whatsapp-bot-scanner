/**
 * Custom fast-check arbitraries for property-based testing
 *
 * This module provides specialized generators for:
 * - Realistic threat signal distributions
 * - Edge case focused signals
 * - Malicious/benign biased signals
 * - URL and domain generators
 */

import fc from "fast-check";
import type { Signals } from "../scoring";
import type { HomoglyphResult } from "../homoglyph";

export const NUM_RUNS = process.env.CI ? 10000 : 1000;

const MALICIOUS_GSB_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "MALICIOUS_BINARY",
  "POTENTIALLY_HARMFUL_APPLICATION",
] as const;

/**
 * Generator for homoglyph confusable characters
 */
export const homoglyphCharArb = fc.record({
  original: fc.constantFrom("a", "e", "o", "i", "l", "0", "1"),
  confusedWith: fc.constantFrom("а", "е", "о", "і", "ӏ", "০", "１"),
  position: fc.nat(50),
  script: fc.constantFrom("Latin", "Cyrillic", "Greek"),
  alternatives: fc.array(fc.constantFrom("a", "е", "o"), { maxLength: 3 }),
});

/**
 * Generator for homoglyph detection results
 */
export const homoglyphResultArb: fc.Arbitrary<HomoglyphResult> = fc.record({
  detected: fc.constant(true),
  isPunycode: fc.boolean(),
  mixedScript: fc.boolean(),
  unicodeHostname: fc.asciiString({ minLength: 1, maxLength: 20 }),
  normalizedDomain: fc.asciiString({ minLength: 1, maxLength: 20 }),
  confusableChars: fc.array(homoglyphCharArb, { maxLength: 5 }),
  riskLevel: fc.constantFrom("low", "medium", "high"),
  riskReasons: fc.array(fc.asciiString({ minLength: 1, maxLength: 40 }), {
    maxLength: 3,
  }),
});

/**
 * Generator for realistic threat signals matching production distribution
 * - 70% benign patterns
 * - 25% suspicious patterns
 * - 5% malicious patterns
 */
export const realisticSignalsArb: fc.Arbitrary<Signals> = fc.oneof(
  fc.record({
    gsbThreatTypes: fc.constant(undefined),
    vtMalicious: fc.constant(0),
    vtSuspicious: fc.nat(2),
    vtHarmless: fc.integer({ min: 60, max: 90 }),
    urlhausListed: fc.constant(false),
    phishtankVerified: fc.constant(false),
    domainAgeDays: fc.integer({ min: 365, max: 3650 }),
    isIpLiteral: fc.constant(false),
    hasSuspiciousTld: fc.constant(false),
    redirectCount: fc.nat(1),
    hasUncommonPort: fc.constant(false),
    urlLength: fc.integer({ min: 20, max: 100 }),
    hasExecutableExtension: fc.constant(false),
    wasShortened: fc.constant(false),
    manualOverride: fc.constant(undefined),
    finalUrlMismatch: fc.constant(false),
    homoglyph: fc.constant(undefined),
    heuristicsOnly: fc.constant(false),
  }),
  fc.record({
    gsbThreatTypes: fc.constant(undefined),
    vtMalicious: fc.integer({ min: 1, max: 2 }),
    vtSuspicious: fc.integer({ min: 1, max: 5 }),
    vtHarmless: fc.integer({ min: 30, max: 60 }),
    urlhausListed: fc.constant(false),
    phishtankVerified: fc.constant(false),
    domainAgeDays: fc.option(fc.integer({ min: 14, max: 90 }), {
      nil: undefined,
    }),
    isIpLiteral: fc.boolean(),
    hasSuspiciousTld: fc.boolean(),
    redirectCount: fc.integer({ min: 1, max: 3 }),
    hasUncommonPort: fc.boolean(),
    urlLength: fc.integer({ min: 50, max: 200 }),
    hasExecutableExtension: fc.boolean(),
    wasShortened: fc.boolean(),
    manualOverride: fc.constant(undefined),
    finalUrlMismatch: fc.boolean(),
    homoglyph: fc.option(homoglyphResultArb, { nil: undefined }),
    heuristicsOnly: fc.boolean(),
  }),
  fc.record({
    gsbThreatTypes: fc.option(
      fc.array(fc.constantFrom(...MALICIOUS_GSB_TYPES), {
        minLength: 1,
        maxLength: 3,
      }),
      { nil: undefined },
    ),
    vtMalicious: fc.integer({ min: 3, max: 20 }),
    vtSuspicious: fc.integer({ min: 2, max: 10 }),
    vtHarmless: fc.integer({ min: 0, max: 30 }),
    urlhausListed: fc.boolean(),
    phishtankVerified: fc.boolean(),
    domainAgeDays: fc.option(fc.nat(14), { nil: undefined }),
    isIpLiteral: fc.boolean(),
    hasSuspiciousTld: fc.constant(true),
    redirectCount: fc.integer({ min: 3, max: 10 }),
    hasUncommonPort: fc.constant(true),
    urlLength: fc.integer({ min: 150, max: 400 }),
    hasExecutableExtension: fc.boolean(),
    wasShortened: fc.constant(true),
    manualOverride: fc.constant(undefined),
    finalUrlMismatch: fc.constant(true),
    homoglyph: fc.option(
      fc.constantFrom("medium", "high").chain((level) =>
        fc.record({
          detected: fc.constant(true),
          isPunycode: fc.boolean(),
          mixedScript: fc.constant(true),
          unicodeHostname: fc.asciiString({ minLength: 1, maxLength: 20 }),
          normalizedDomain: fc.asciiString({ minLength: 1, maxLength: 20 }),
          confusableChars: fc.array(homoglyphCharArb, {
            minLength: 1,
            maxLength: 5,
          }),
          riskLevel: fc.constant(level as "low" | "medium" | "high"),
          riskReasons: fc.array(
            fc.asciiString({ minLength: 1, maxLength: 40 }),
          ),
        }),
      ),
      { nil: undefined },
    ),
    heuristicsOnly: fc.constant(false),
  }),
);

/**
 * Generator for guaranteed malicious signals (biased toward high threat)
 */
export const maliciousSignalsArb: fc.Arbitrary<Signals> = fc.record({
  gsbThreatTypes: fc.option(
    fc.array(fc.constantFrom(...MALICIOUS_GSB_TYPES), {
      minLength: 1,
      maxLength: 3,
    }),
    { nil: undefined },
  ),
  vtMalicious: fc.integer({ min: 5, max: 30 }),
  vtSuspicious: fc.integer({ min: 2, max: 10 }),
  vtHarmless: fc.integer({ min: 0, max: 20 }),
  urlhausListed: fc.boolean(),
  phishtankVerified: fc.boolean(),
  domainAgeDays: fc.option(fc.nat(7), { nil: undefined }),
  isIpLiteral: fc.boolean(),
  hasSuspiciousTld: fc.constant(true),
  redirectCount: fc.integer({ min: 3, max: 10 }),
  hasUncommonPort: fc.constant(true),
  urlLength: fc.integer({ min: 200, max: 400 }),
  hasExecutableExtension: fc.boolean(),
  wasShortened: fc.constant(true),
  manualOverride: fc.constant(undefined),
  finalUrlMismatch: fc.constant(true),
  homoglyph: fc.option(
    fc.constantFrom("medium" as const, "high" as const).chain((level) =>
      fc.record({
        detected: fc.constant(true),
        isPunycode: fc.boolean(),
        mixedScript: fc.constant(true),
        unicodeHostname: fc.asciiString({ minLength: 1, maxLength: 20 }),
        normalizedDomain: fc.asciiString({ minLength: 1, maxLength: 20 }),
        confusableChars: fc.array(homoglyphCharArb, {
          minLength: 1,
          maxLength: 5,
        }),
        riskLevel: fc.constant(level as "low" | "medium" | "high"),
        riskReasons: fc.array(fc.asciiString({ minLength: 1, maxLength: 40 })),
      }),
    ),
    { nil: undefined },
  ),
  heuristicsOnly: fc.constant(false),
});

/**
 * Generator for guaranteed benign signals (biased toward safe)
 */
export const benignSignalsArb: fc.Arbitrary<Signals> = fc.record({
  gsbThreatTypes: fc.constant(undefined),
  vtMalicious: fc.constant(0),
  vtSuspicious: fc.nat(1),
  vtHarmless: fc.integer({ min: 70, max: 90 }),
  urlhausListed: fc.constant(false),
  phishtankVerified: fc.constant(false),
  domainAgeDays: fc.integer({ min: 365, max: 3650 }),
  isIpLiteral: fc.constant(false),
  hasSuspiciousTld: fc.constant(false),
  redirectCount: fc.nat(1),
  hasUncommonPort: fc.constant(false),
  urlLength: fc.integer({ min: 20, max: 100 }),
  hasExecutableExtension: fc.constant(false),
  wasShortened: fc.constant(false),
  manualOverride: fc.constant(undefined),
  finalUrlMismatch: fc.constant(false),
  homoglyph: fc.constant(undefined),
  heuristicsOnly: fc.constant(false),
});

/**
 * Generator for edge case signals focusing on boundary conditions
 */
export const edgeCaseSignalsArb: fc.Arbitrary<Signals> = fc.record({
  gsbThreatTypes: fc.option(
    fc.array(fc.constantFrom(...MALICIOUS_GSB_TYPES), { maxLength: 1 }),
    { nil: undefined },
  ),
  vtMalicious: fc.constantFrom(0, 1, 2, 3, 5, 10),
  vtSuspicious: fc.constantFrom(0, 1, 5),
  vtHarmless: fc.constantFrom(0, 50, 100),
  urlhausListed: fc.boolean(),
  phishtankVerified: fc.boolean(),
  domainAgeDays: fc.constantFrom(undefined, 0, 6, 7, 13, 14, 29, 30, 31, 365),
  isIpLiteral: fc.boolean(),
  hasSuspiciousTld: fc.boolean(),
  redirectCount: fc.constantFrom(0, 1, 2, 3, 5, 10),
  hasUncommonPort: fc.boolean(),
  urlLength: fc.constantFrom(50, 100, 199, 200, 201, 400),
  hasExecutableExtension: fc.boolean(),
  wasShortened: fc.boolean(),
  manualOverride: fc.constantFrom(undefined, "allow", "deny", null),
  finalUrlMismatch: fc.boolean(),
  homoglyph: fc.option(homoglyphResultArb, { nil: undefined }),
  heuristicsOnly: fc.boolean(),
});

/**
 * Generator for signals without manual override (for monotonicity tests)
 */
export const signalsNoOverrideArb: fc.Arbitrary<Signals> = fc.record({
  gsbThreatTypes: fc.option(
    fc.array(fc.constantFrom(...MALICIOUS_GSB_TYPES), { maxLength: 4 }),
    { nil: undefined },
  ),
  vtMalicious: fc.option(fc.nat(20), { nil: undefined }),
  vtSuspicious: fc.option(fc.nat(10), { nil: undefined }),
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
  manualOverride: fc.constant(undefined),
  finalUrlMismatch: fc.option(fc.boolean(), { nil: undefined }),
  homoglyph: fc.option(homoglyphResultArb, { nil: undefined }),
  heuristicsOnly: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * Generator for URL-like strings
 */
export const urlStringArb = fc.oneof(
  fc.webUrl(),
  fc.webUrl({ validSchemes: ["https"] }),
  fc
    .tuple(
      fc.constantFrom("http://", "https://"),
      fc.ipV4(),
      fc.option(fc.constantFrom(":8080", ":8443", ":3000"), { nil: "" }),
      fc.webPath(),
    )
    .map(([scheme, ip, port, path]) => `${scheme}${ip}${port ?? ""}${path}`),
);

/**
 * Generator for domain names
 */
export const domainArb = fc.oneof(
  fc.domain(),
  fc
    .tuple(
      fc.stringOf(fc.constantFrom("a", "b", "c", "1", "2", "-"), {
        minLength: 1,
        maxLength: 10,
      }),
      fc.constantFrom(
        ".com",
        ".org",
        ".net",
        ".io",
        ".xyz",
        ".tk",
        ".ml",
        ".ga",
      ),
    )
    .map(([name, tld]) => name.replaceAll(/^-|-$/g, "a") + tld),
);

/**
 * Generator for redirect counts with realistic distribution
 */
export const redirectCountArb = fc.oneof(
  fc.nat(2),
  fc.nat(2),
  fc.nat(2),
  fc.integer({ min: 3, max: 5 }),
  fc.integer({ min: 6, max: 20 }),
);

/**
 * Generator for domain age with realistic distribution
 */
export const domainAgeArb = fc.oneof(
  fc.nat(7),
  fc.integer({ min: 7, max: 30 }),
  fc.integer({ min: 30, max: 365 }),
  fc.integer({ min: 365, max: 3650 }),
  fc.integer({ min: 365, max: 3650 }),
);

/**
 * Generator for VT malicious count with realistic distribution
 */
export const vtMaliciousArb = fc.oneof(
  fc.constant(0),
  fc.constant(0),
  fc.constant(0),
  fc.constant(0),
  fc.integer({ min: 1, max: 2 }),
  fc.integer({ min: 3, max: 10 }),
);

/**
 * Helper to create a homoglyph result with specific risk level
 */
export function makeHomoglyph(
  riskLevel: "low" | "medium" | "high",
): HomoglyphResult {
  return {
    detected: true,
    isPunycode: false,
    mixedScript: riskLevel !== "low",
    unicodeHostname: "example.com",
    normalizedDomain: "example.com",
    confusableChars: [],
    riskLevel,
    riskReasons: [],
  };
}

/**
 * Shrinkable signals arbitrary with custom shrinking for better debugging.
 * When a test fails, fast-check will shrink the input to find the minimal failing case.
 * This arbitrary is optimized for shrinking by preferring simpler values.
 */
export const shrinkableSignalsArb: fc.Arbitrary<Signals> = fc
  .record({
    gsbThreatTypes: fc.option(
      fc.array(fc.constantFrom(...MALICIOUS_GSB_TYPES), { maxLength: 2 }),
      { nil: undefined },
    ),
    vtMalicious: fc.option(fc.nat(10), { nil: undefined }),
    vtSuspicious: fc.option(fc.nat(5), { nil: undefined }),
    vtHarmless: fc.option(fc.nat(100), { nil: undefined }),
    urlhausListed: fc.option(fc.boolean(), { nil: undefined }),
    phishtankVerified: fc.option(fc.boolean(), { nil: undefined }),
    domainAgeDays: fc.option(fc.nat(365), { nil: undefined }),
    isIpLiteral: fc.option(fc.boolean(), { nil: undefined }),
    hasSuspiciousTld: fc.option(fc.boolean(), { nil: undefined }),
    redirectCount: fc.option(fc.nat(10), { nil: undefined }),
    hasUncommonPort: fc.option(fc.boolean(), { nil: undefined }),
    urlLength: fc.option(fc.nat(400), { nil: undefined }),
    hasExecutableExtension: fc.option(fc.boolean(), { nil: undefined }),
    wasShortened: fc.option(fc.boolean(), { nil: undefined }),
    manualOverride: fc.constant(undefined),
    finalUrlMismatch: fc.option(fc.boolean(), { nil: undefined }),
    homoglyph: fc.option(homoglyphResultArb, { nil: undefined }),
    heuristicsOnly: fc.option(fc.boolean(), { nil: undefined }),
  })
  .filter((s) => s !== null);

/**
 * Minimal signals arbitrary for finding boundary conditions.
 * All fields default to "safe" values, allowing isolated testing.
 */
export const minimalSignalsArb: fc.Arbitrary<Signals> = fc.record({
  gsbThreatTypes: fc.constant(undefined),
  vtMalicious: fc.constant(0),
  vtSuspicious: fc.constant(0),
  vtHarmless: fc.constant(70),
  urlhausListed: fc.constant(false),
  phishtankVerified: fc.constant(false),
  domainAgeDays: fc.constant(365),
  isIpLiteral: fc.constant(false),
  hasSuspiciousTld: fc.constant(false),
  redirectCount: fc.constant(0),
  hasUncommonPort: fc.constant(false),
  urlLength: fc.constant(50),
  hasExecutableExtension: fc.constant(false),
  wasShortened: fc.constant(false),
  manualOverride: fc.constant(undefined),
  finalUrlMismatch: fc.constant(false),
  homoglyph: fc.constant(undefined),
  heuristicsOnly: fc.constant(false),
});

/**
 * Single-threat signals arbitrary for testing individual threat contributions.
 * Only one threat signal is active at a time, making it easy to identify
 * which signal caused a test failure.
 */
export const singleThreatSignalsArb: fc.Arbitrary<Signals> = fc.oneof(
  fc.record({
    ...minimalSignalsDefaults(),
    vtMalicious: fc.integer({ min: 1, max: 10 }),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    phishtankVerified: fc.constant(true),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    urlhausListed: fc.constant(true),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    gsbThreatTypes: fc.constant(["MALWARE"]),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    domainAgeDays: fc.nat(6),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    isIpLiteral: fc.constant(true),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    hasSuspiciousTld: fc.constant(true),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    redirectCount: fc.integer({ min: 3, max: 10 }),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    hasUncommonPort: fc.constant(true),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    urlLength: fc.integer({ min: 201, max: 400 }),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    hasExecutableExtension: fc.constant(true),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    wasShortened: fc.constant(true),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    finalUrlMismatch: fc.constant(true),
  }),
  fc.record({
    ...minimalSignalsDefaults(),
    homoglyph: fc.constant(makeHomoglyph("high")),
  }),
);

function minimalSignalsDefaults() {
  return {
    gsbThreatTypes: fc.constant(undefined),
    vtMalicious: fc.constant(0),
    vtSuspicious: fc.constant(0),
    vtHarmless: fc.constant(70),
    urlhausListed: fc.constant(false),
    phishtankVerified: fc.constant(false),
    domainAgeDays: fc.constant(365),
    isIpLiteral: fc.constant(false),
    hasSuspiciousTld: fc.constant(false),
    redirectCount: fc.constant(0),
    hasUncommonPort: fc.constant(false),
    urlLength: fc.constant(50),
    hasExecutableExtension: fc.constant(false),
    wasShortened: fc.constant(false),
    manualOverride: fc.constant(undefined),
    finalUrlMismatch: fc.constant(false),
    homoglyph: fc.constant(undefined),
    heuristicsOnly: fc.constant(false),
  };
}

describe("arbitraries", () => {
  test("exports property generators", () => {
    expect(realisticSignalsArb).toBeDefined();
    expect(maliciousSignalsArb).toBeDefined();
    expect(edgeCaseSignalsArb).toBeDefined();
  });
});
