import { scoreFromSignals } from "../scoring";

test("gsb malware threat is malicious", () => {
  const result = scoreFromSignals({ gsbThreatTypes: ["MALWARE"] });
  expect(result.level).toBe("malicious");
  expect(result.score).toBe(10); // Exact value to catch increment mutations
});

test("GSB score is exactly 10 (mutation boundary)", () => {
  const result = scoreFromSignals({ gsbThreatTypes: ["SOCIAL_ENGINEERING"] });
  expect(result.score).toBe(10);
  expect(result.level).toBe("malicious");
});

test("redirect count exactly 3 triggers suspicious", () => {
  const result = scoreFromSignals({ redirectCount: 3 });
  expect(result.score).toBeGreaterThanOrEqual(2);
  expect(result.reasons.some((r) => r.includes("redirect"))).toBe(true);
});

test("redirect count exactly 2 does not trigger redirect warning", () => {
  const result = scoreFromSignals({ redirectCount: 2 });
  expect(result.reasons.some((r) => r.includes("redirect"))).toBe(false);
});

test("gsb additional threat types are malicious", () => {
  const unwantedSoftware = scoreFromSignals({
    gsbThreatTypes: ["UNWANTED_SOFTWARE"],
  });
  expect(unwantedSoftware.level).toBe("malicious");
  expect(unwantedSoftware.score).toBeGreaterThanOrEqual(10);
  expect(
    unwantedSoftware.reasons.some((r) => r.includes("Google Safe Browsing:")),
  ).toBe(true);

  const maliciousBinary = scoreFromSignals({
    gsbThreatTypes: ["MALICIOUS_BINARY"],
  });
  expect(maliciousBinary.level).toBe("malicious");
  expect(maliciousBinary.score).toBeGreaterThanOrEqual(10);
  expect(
    maliciousBinary.reasons.some((r) => r.includes("Google Safe Browsing:")),
  ).toBe(true);

  const pha = scoreFromSignals({
    gsbThreatTypes: ["POTENTIALLY_HARMFUL_APPLICATION"],
  });
  expect(pha.level).toBe("malicious");
  expect(pha.score).toBeGreaterThanOrEqual(10);
  expect(pha.reasons.some((r) => r.includes("Google Safe Browsing:"))).toBe(
    true,
  );
});

test("young domain suspicious", () => {
  const result = scoreFromSignals({ domainAgeDays: 3 });
  expect(result.level).toBe("suspicious");
});

test("multiple blocklists escalate to malicious", () => {
  const result = scoreFromSignals({
    gsbThreatTypes: ["SOCIAL_ENGINEERING"],
    phishtankVerified: true,
    urlhausListed: true,
  });
  expect(result.level).toBe("malicious");
  expect(result.score).toBeGreaterThanOrEqual(10);
});

test("openphish listing is malicious", () => {
  const result = scoreFromSignals({ openphishListed: true });
  expect(result.level).toBe("malicious");
  expect(result.reasons).toContain("Known phishing (OpenPhish)");
});

test("cert pl listing is malicious", () => {
  const result = scoreFromSignals({ certPlListed: true });
  expect(result.level).toBe("malicious");
  expect(result.reasons).toContain("Listed as dangerous (CERT Polska)");
});

test("suspicious domain feed adds risk", () => {
  const result = scoreFromSignals({ suspiciousDomainListed: true });
  expect(result.score).toBeGreaterThanOrEqual(5);
  expect(result.reasons).toContain("Domain listed in suspicious activity feed");
});

test("userinfo in URL adds risk", () => {
  const result = scoreFromSignals({ hasUserInfo: true });
  expect(result.score).toBeGreaterThanOrEqual(6);
  expect(result.reasons).toContain("URL contains embedded credentials");
});

test("open redirect parameter adds risk", () => {
  const result = scoreFromSignals({ hasRedirectParam: true });
  expect(result.score).toBeGreaterThanOrEqual(2);
  expect(result.reasons).toContain("Open redirect parameter detected");
});

test("typosquat signals add risk", () => {
  const result = scoreFromSignals({
    typoSquatTarget: "google.com",
    typoSquatMethod: "missing-char",
  });
  expect(result.level).toBe("suspicious");
  expect(result.reasons.some((r) => r.includes("typosquat"))).toBe(true);
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
      isPunycode: false,
      mixedScript: false,
      unicodeHostname: "evil.test",
      normalizedDomain: "evil.test",
      confusableChars: [],
      riskLevel: "high",
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
