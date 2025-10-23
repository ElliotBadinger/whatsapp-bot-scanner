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

test('manual allow forces benign verdict even with malicious signals', () => {
  const result = scoreFromSignals({ gsbThreatTypes: ['MALWARE'], manualOverride: 'allow' });
  expect(result.level).toBe('benign');
  expect(result.score).toBe(0);
  expect(result.reasons).toContain('Manually allowed');
});

test('manual deny forces malicious verdict', () => {
  const result = scoreFromSignals({ manualOverride: 'deny' });
  expect(result.level).toBe('malicious');
  expect(result.score).toBeGreaterThanOrEqual(15);
  expect(result.reasons).toContain('Manually blocked');
});
