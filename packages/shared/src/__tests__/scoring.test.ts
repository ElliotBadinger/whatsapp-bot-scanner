import { scoreFromSignals } from "../scoring";

test("gsb malware threat is malicious", () => {
  const result = scoreFromSignals({ gsbThreatTypes: ["MALWARE"] });
  expect(result.level).toBe("malicious");
  expect(result.score).toBeGreaterThanOrEqual(10);
});

test("young domain suspicious", () => {
  const result = scoreFromSignals({ domainAgeDays: 3 });
  expect(result.level).toBe("suspicious");
});

test("multiple blocklists escalate to malicious", () => {
  const result = scoreFromSignals({
    gsbThreatTypes: ["PHISHING"],
    phishtankVerified: true,
    urlhausListed: true,
  });
  expect(result.level).toBe("malicious");
  expect(result.score).toBeGreaterThanOrEqual(10);
});

test("final url mismatch adds risk", () => {
  const result = scoreFromSignals({ finalUrlMismatch: true });
  expect(result.score).toBeGreaterThanOrEqual(2);
});

test("manual overrides take precedence over signals", () => {
  const allow = scoreFromSignals({
    manualOverride: "allow",
    gsbThreatTypes: ["MALWARE"],
  });
  expect(allow.level).toBe("benign");
  expect(allow.score).toBe(0);
  expect(allow.cacheTtl).toBe(86400);
  expect(allow.reasons).toContain("Manually allowed");

  const deny = scoreFromSignals({
    manualOverride: "deny",
    domainAgeDays: 1,
  });
  expect(deny.level).toBe("malicious");
  expect(deny.score).toBe(15);
  expect(deny.reasons).toContain("Manually blocked");
});

test("scoring uses domain age buckets and suspicious heuristics", () => {
  const result = scoreFromSignals({
    domainAgeDays: 10,
    hasUncommonPort: true,
    redirectCount: 3,
    isIpLiteral: true,
    hasExecutableExtension: true,
  });
  expect(result.level).toBe("malicious");
  expect(result.score).toBeGreaterThanOrEqual(12);
  expect(result.cacheTtl).toBe(900);
});

test("score clamps at 15 even with stacked blocklists", () => {
  const result = scoreFromSignals({
    gsbThreatTypes: ["MALWARE"],
    phishtankVerified: true,
    urlhausListed: true,
    vtMalicious: 5,
    homoglyph: {
      detected: true,
      riskLevel: "high",
      confusableChars: [],
      normalizedDomain: "evil.test",
      isPunycode: false,
      mixedScript: false,
      unicodeHostname: "evil.test",
      riskReasons: ["High-risk homoglyph attack detected"],
    },
    urlLength: 400,
    wasShortened: true,
    finalUrlMismatch: true,
  });
  expect(result.level).toBe("malicious");
  expect(result.score).toBeLessThanOrEqual(15);
  expect(result.cacheTtl).toBe(900);
});

test("suspicious tier returns 1 hour ttl", () => {
  const result = scoreFromSignals({
    vtMalicious: 1,
    domainAgeDays: 20,
  });
  expect(result.level).toBe("suspicious");
  expect(result.cacheTtl).toBe(3600);
});

test("homoglyph detection adds to score", () => {
  const highRisk = scoreFromSignals({
    homoglyph: {
      detected: true,
      riskLevel: "high",
      confusableChars: [
        {
          original: "a",
          confusedWith: "а",
          position: 0,
          script: "Cyrillic",
          alternatives: ["a"],
        },
      ],
      normalizedDomain: "test.com",
      isPunycode: false,
      mixedScript: true,
      unicodeHostname: "test.com",
      riskReasons: ["High-risk homoglyph attack detected"],
    },
  });
  expect(highRisk.score).toBeGreaterThanOrEqual(5);
  expect(highRisk.reasons.some((r) => r.includes("High-risk homoglyph"))).toBe(
    true,
  );

  const mediumRisk = scoreFromSignals({
    homoglyph: {
      detected: true,
      riskLevel: "medium",
      confusableChars: [],
      normalizedDomain: "test.com",
      isPunycode: false,
      mixedScript: true,
      unicodeHostname: "test.com",
      riskReasons: ["Suspicious homoglyph"],
    },
  });
  expect(mediumRisk.score).toBeGreaterThanOrEqual(3);

  const lowRisk = scoreFromSignals({
    homoglyph: {
      detected: true,
      riskLevel: "low",
      confusableChars: [],
      normalizedDomain: "test.com",
      isPunycode: true,
      mixedScript: false,
      unicodeHostname: "test.com",
      riskReasons: [],
    },
  });
  expect(lowRisk.score).toBeGreaterThanOrEqual(1);
  expect(lowRisk.reasons.some((r) => r.includes("Punycode/IDN"))).toBe(true);
});

test("benign score returns correct level and ttl", () => {
  const result = scoreFromSignals({
    domainAgeDays: 365,
    urlLength: 20,
  });
  expect(result.level).toBe("benign");
  expect(result.score).toBe(0);
  expect(result.cacheTtl).toBe(86400);
});

test("vt malicious count logic", () => {
  const low = scoreFromSignals({ vtMalicious: 1 });
  expect(low.score).toBe(5);

  const high = scoreFromSignals({ vtMalicious: 3 });
  expect(high.score).toBe(8);
});

test("score clamps at 15 even with excessive signals", () => {
  const result = scoreFromSignals({
    gsbThreatTypes: ["MALWARE"], // +10
    phishtankVerified: true, // +10
    urlhausListed: true, // +10
    vtMalicious: 5, // +8
    domainAgeDays: 1, // +6
  });
  // Total raw score would be 44
  expect(result.score).toBe(15);
  expect(result.level).toBe("malicious");
});
