import { scoreFromSignals } from '../scoring';

test('gsb hit is malicious', () => {
  const { verdict } = scoreFromSignals({ gsbHit: true });
  expect(verdict).toBe('malicious');
});

test('young domain suspicious', () => {
  const { verdict } = scoreFromSignals({ domainAgeDays: 3 });
  expect(verdict).toBe('suspicious');
});

