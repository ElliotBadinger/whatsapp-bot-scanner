import { scoreFromSignals } from '../scoring';

test('gsb malware threat is malicious', () => {
  const result = scoreFromSignals({ gsbThreatTypes: ['MALWARE'] });
  expect(result.level).toBe('malicious');
  expect(result.score).toBeGreaterThanOrEqual(10);
});

test('young domain suspicious', () => {
  const result = scoreFromSignals({ domainAgeDays: 3 });
  expect(result.level).toBe('suspicious');
});

test('multiple blocklists escalate to malicious', () => {
  const result = scoreFromSignals({
    gsbThreatTypes: ['PHISHING'],
    phishtankVerified: true,
    urlhausListed: true,
  });
  expect(result.level).toBe('malicious');
  expect(result.score).toBeGreaterThanOrEqual(10);
});

test('final url mismatch adds risk', () => {
  const result = scoreFromSignals({ finalUrlMismatch: true });
  expect(result.score).toBeGreaterThanOrEqual(2);
});

test('manual overrides take precedence over signals', () => {
  const allow = scoreFromSignals({
    manualOverride: 'allow',
    gsbThreatTypes: ['MALWARE'],
  });
  expect(allow.level).toBe('benign');
  expect(allow.score).toBe(0);
  expect(allow.cacheTtl).toBe(86400);

  const deny = scoreFromSignals({
    manualOverride: 'deny',
    domainAgeDays: 1,
  });
  expect(deny.level).toBe('malicious');
  expect(deny.score).toBe(15);
});

test('scoring uses domain age buckets and suspicious heuristics', () => {
  const result = scoreFromSignals({
    domainAgeDays: 10,
    hasUncommonPort: true,
    redirectCount: 3,
    isIpLiteral: true,
    hasExecutableExtension: true,
  });
  expect(result.level).toBe('malicious');
  expect(result.score).toBeGreaterThanOrEqual(12);
  expect(result.cacheTtl).toBe(900);
});

test('score clamps at 15 even with stacked blocklists', () => {
  const result = scoreFromSignals({
    gsbThreatTypes: ['MALWARE'],
    phishtankVerified: true,
    urlhausListed: true,
    vtMalicious: 5,
    homoglyph: {
      detected: true,
      riskLevel: 'high',
      confusableChars: [],
      normalizedDomain: 'evil.test',
      isPunycode: false,
      mixedScript: false,
      unicodeHostname: 'evil.test',
      riskReasons: ['High-risk homoglyph attack detected'],
    },
    urlLength: 400,
    wasShortened: true,
    finalUrlMismatch: true,
  });
  expect(result.level).toBe('malicious');
  expect(result.score).toBeLessThanOrEqual(15);
  expect(result.cacheTtl).toBe(900);
});

test('suspicious tier returns 1 hour ttl', () => {
  const result = scoreFromSignals({
    vtMalicious: 1,
    domainAgeDays: 20,
  });
  expect(result.level).toBe('suspicious');
  expect(result.cacheTtl).toBe(3600);
});
