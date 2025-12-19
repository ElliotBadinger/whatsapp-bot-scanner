import { describe, expect, test } from '@jest/globals';
import { extraHeuristics, scoreFromSignals } from '../scoring';

describe('Scoring Algorithm - Edge Cases', () => {
  test('empty signals are benign with zero score', () => {
    const result = scoreFromSignals({});
    expect(result.score).toBe(0);
    expect(result.level).toBe('benign');
    expect(result.reasons).toHaveLength(0);
    expect(result.cacheTtl).toBe(86400);
  });

  test('domain age buckets apply exact boundary values', () => {
    expect(scoreFromSignals({ domainAgeDays: 6 }).score).toBe(6);
    expect(scoreFromSignals({ domainAgeDays: 7 }).score).toBe(4);
    expect(scoreFromSignals({ domainAgeDays: 13 }).score).toBe(4);
    expect(scoreFromSignals({ domainAgeDays: 14 }).score).toBe(2);
    expect(scoreFromSignals({ domainAgeDays: 29 }).score).toBe(2);
    expect(scoreFromSignals({ domainAgeDays: 30 }).score).toBe(0);
  });

  test('redirect count threshold triggers at 3', () => {
    expect(scoreFromSignals({ redirectCount: 2 }).score).toBe(0);
    expect(scoreFromSignals({ redirectCount: 3 }).score).toBe(2);
  });

  test('URL length threshold triggers above 200 chars', () => {
    expect(scoreFromSignals({ urlLength: 200 }).score).toBe(0);
    expect(scoreFromSignals({ urlLength: 201 }).score).toBe(2);
  });

  test('heuristics-only flag adds a reason without adding score', () => {
    const result = scoreFromSignals({ heuristicsOnly: true });
    expect(result.score).toBe(0);
    expect(result.reasons).toContain(
      'Heuristics-only scan (external providers unavailable)',
    );
  });

  test('detected homoglyph with "none" risk still adds low risk score', () => {
    const result = scoreFromSignals({
      homoglyph: {
        detected: true,
        isPunycode: false,
        mixedScript: false,
        unicodeHostname: 'example.com',
        normalizedDomain: 'example.com',
        confusableChars: [],
        riskLevel: 'none',
        riskReasons: [],
      },
    });
    expect(result.score).toBe(1);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('extraHeuristics', () => {
  test('flags IP literals, uncommon ports, and executables', () => {
    const signals = extraHeuristics(new URL('http://127.0.0.1:8081/file.exe'));
    expect(signals.isIpLiteral).toBe(true);
    expect(signals.hasUncommonPort).toBe(true);
    expect(signals.hasExecutableExtension).toBe(true);
  });

  test('defaults to common ports for http/https', () => {
    const httpSignals = extraHeuristics(new URL('http://example.com/path'));
    const httpsSignals = extraHeuristics(new URL('https://example.com/path'));
    expect(httpSignals.hasUncommonPort).toBe(false);
    expect(httpsSignals.hasUncommonPort).toBe(false);
  });

  test('detects suspicious TLDs in heuristic extraction', () => {
    const signals = extraHeuristics(new URL('http://example.zip'));
    expect(signals.hasSuspiciousTld).toBe(true);
  });
});
