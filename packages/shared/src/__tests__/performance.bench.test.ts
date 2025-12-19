/**
 * @fileoverview Performance benchmarks for critical pure functions
 * 
 * These tests verify that core algorithms meet performance targets.
 * Benchmarks run multiple iterations to get accurate timing.
 * 
 * Performance Targets:
 * - Scoring algorithm: <1ms per call, >1M calls/sec
 * - URL validation: <1ms per call
 * - Homoglyph detection: <2ms per call
 * - URL normalization: <1ms per call
 */

import { performance } from 'perf_hooks';
import { scoreFromSignals, extraHeuristics, type Signals } from '../scoring';
import { UrlValidator } from '../validation';
import { normalizeUrl, extractUrls, urlHash, isSuspiciousTld } from '../url';
import { detectHomoglyphs } from '../homoglyph';
import { CircuitBreaker, CircuitState } from '../circuit-breaker';

describe('Performance Benchmarks', () => {
  const ITERATIONS = 10000;
  const WARMUP = 1000;

  interface BenchmarkResult {
    avgMs: number;
    totalMs: number;
    perSecond: number;
  }

  function benchmark(name: string, fn: () => void, targetMs: number): BenchmarkResult {
    // Warmup phase - JIT optimization
    for (let i = 0; i < WARMUP; i++) {
      fn();
    }

    // Actual benchmark
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      fn();
    }
    const end = performance.now();

    const totalMs = end - start;
    const avgMs = totalMs / ITERATIONS;
    const perSecond = Math.floor(1000 / avgMs);

    console.log(`\n📊 Benchmark: ${name}`);
    console.log(`   Avg: ${avgMs.toFixed(6)}ms per call`);
    console.log(`   Total: ${totalMs.toFixed(2)}ms for ${ITERATIONS.toLocaleString()} iterations`);
    console.log(`   Throughput: ${perSecond.toLocaleString()} calls/sec`);
    console.log(`   Target: <${targetMs}ms ✓`);

    expect(avgMs).toBeLessThan(targetMs);
    return { avgMs, totalMs, perSecond };
  }

  describe('Scoring Algorithm Benchmarks', () => {
    const typicalSignals: Signals = {
      vtMalicious: 5,
      vtSuspicious: 2,
      vtHarmless: 60,
      gsbThreatTypes: ['MALWARE'],
      phishtankVerified: false,
      urlhausListed: false,
      domainAgeDays: 100,
      redirectCount: 2,
      wasShortened: false,
      finalUrlMismatch: false,
      homoglyph: {
        detected: false,
        isPunycode: false,
        mixedScript: false,
        unicodeHostname: 'example.com',
        normalizedDomain: 'example.com',
        confusableChars: [],
        riskLevel: 'none',
        riskReasons: [],
      },
    };

    test('scoreFromSignals() completes in <1ms (typical case)', () => {
      benchmark(
        'scoreFromSignals (typical)',
        () => scoreFromSignals(typicalSignals),
        1.0
      );
    });

    test('scoreFromSignals() completes in <1ms (worst case)', () => {
      const worstCaseSignals: Signals = {
        vtMalicious: 100,
        vtSuspicious: 100,
        vtHarmless: 0,
        gsbThreatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
        phishtankVerified: true,
        urlhausListed: true,
        domainAgeDays: 0,
        redirectCount: 20,
        wasShortened: true,
        finalUrlMismatch: true,
        isIpLiteral: true,
        hasSuspiciousTld: true,
        hasUncommonPort: true,
        urlLength: 500,
        hasExecutableExtension: true,
        homoglyph: {
          detected: true,
          isPunycode: true,
          mixedScript: true,
          unicodeHostname: 'gооgle.com',
          normalizedDomain: 'google.com',
          confusableChars: [
            { original: 'о', confusedWith: 'o', position: 1, script: 'Cyrillic', alternatives: ['o'] },
            { original: 'о', confusedWith: 'o', position: 2, script: 'Cyrillic', alternatives: ['o'] },
          ],
          riskLevel: 'high',
          riskReasons: ['High-risk homoglyph attack detected'],
        },
      };

      benchmark(
        'scoreFromSignals (worst case)',
        () => scoreFromSignals(worstCaseSignals),
        1.0
      );
    });

    test('scoreFromSignals() completes in <1ms (empty signals)', () => {
      benchmark(
        'scoreFromSignals (empty)',
        () => scoreFromSignals({}),
        1.0
      );
    });

    test('scoreFromSignals() completes in <1ms (manual override)', () => {
      benchmark(
        'scoreFromSignals (manual allow)',
        () => scoreFromSignals({ manualOverride: 'allow' }),
        0.5 // Should be faster due to early return
      );
    });

    test('scoreFromSignals() throughput >200K calls/sec', () => {
      const iterations = 500000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        scoreFromSignals(typicalSignals);
      }
      
      const elapsed = (performance.now() - start) / 1000;
      const throughput = iterations / elapsed;

      console.log(`\n📊 Throughput Test: scoreFromSignals`);
      console.log(`   ${throughput.toLocaleString(undefined, { maximumFractionDigits: 0 })} calls/sec`);
      console.log(`   Target: >200,000 calls/sec`);

      expect(throughput).toBeGreaterThan(200000);
    });

    test('extraHeuristics() completes in <1ms', () => {
      const url = new URL('https://example.com/path?query=value');
      benchmark(
        'extraHeuristics',
        () => extraHeuristics(url),
        1.0
      );
    });

    test('extraHeuristics() completes in <1ms (complex URL)', () => {
      const url = new URL('http://192.168.1.1:8081/download/file.exe?token=abc');
      benchmark(
        'extraHeuristics (complex)',
        () => extraHeuristics(url),
        1.0
      );
    });
  });

  describe('URL Validation Benchmarks', () => {
    const validator = new UrlValidator();

    test('validateUrl() completes in <1ms (valid HTTPS)', async () => {
      const iterations = 1000;
      const warmup = 100;

      // Warmup
      for (let i = 0; i < warmup; i++) {
        await validator.validateUrl('https://example.com/path?query=value');
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await validator.validateUrl('https://example.com/path?query=value');
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`\n📊 Benchmark: validateUrl (HTTPS)`);
      console.log(`   Avg: ${avgMs.toFixed(6)}ms per call`);
      console.log(`   Target: <1ms ✓`);

      expect(avgMs).toBeLessThan(1.0);
    });

    test('validateUrl() handles long URLs in <2ms', async () => {
      const longPath = 'a'.repeat(2000);
      const longUrl = `https://example.com/${longPath}`;
      
      const iterations = 500;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await validator.validateUrl(longUrl);
      }
      
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`\n📊 Benchmark: validateUrl (long URL)`);
      console.log(`   Avg: ${avgMs.toFixed(6)}ms per call`);
      console.log(`   Target: <2ms ✓`);

      expect(avgMs).toBeLessThan(2.0);
    });

    test('validateUrl() handles private IPs in <1ms', async () => {
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await validator.validateUrl('http://192.168.1.1/admin');
      }
      
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`\n📊 Benchmark: validateUrl (private IP)`);
      console.log(`   Avg: ${avgMs.toFixed(6)}ms per call`);

      expect(avgMs).toBeLessThan(1.0);
    });
  });

  describe('URL Processing Benchmarks', () => {
    test('normalizeUrl() completes in <1ms', () => {
      benchmark(
        'normalizeUrl',
        () => normalizeUrl('HTTPS://Example.COM/Path/?Query=Value&utm_source=test'),
        1.0
      );
    });

    test('normalizeUrl() handles IDN in <2ms', () => {
      benchmark(
        'normalizeUrl (IDN)',
        () => normalizeUrl('https://münchen.example.com/path'),
        2.0
      );
    });

    test('urlHash() completes in <0.1ms', () => {
      benchmark(
        'urlHash',
        () => urlHash('https://example.com/path?query=value'),
        0.1
      );
    });

    test('extractUrls() completes in <5ms for typical message', () => {
      const message = `
        Check out https://example.com/page and also http://test.org/file.
        Visit www.google.com for more info. Also see example.net/path.
      `;
      
      benchmark(
        'extractUrls (typical)',
        () => extractUrls(message),
        5.0
      );
    });

    test('extractUrls() handles large text in <50ms', () => {
      const urls = Array(50).fill('https://example.com/path?id=').map((u, i) => u + i);
      const largeText = urls.join(' Check this link: ') + ' and more text '.repeat(100);
      
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        extractUrls(largeText);
      }
      
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`\n📊 Benchmark: extractUrls (large text)`);
      console.log(`   Avg: ${avgMs.toFixed(2)}ms per call`);
      console.log(`   Text size: ${largeText.length} chars`);

      expect(avgMs).toBeLessThan(50.0);
    });

    test('isSuspiciousTld() completes in <0.5ms', () => {
      benchmark(
        'isSuspiciousTld (safe)',
        () => isSuspiciousTld('example.com'),
        0.5
      );
    });

    test('isSuspiciousTld() detects suspicious TLD in <0.5ms', () => {
      benchmark(
        'isSuspiciousTld (suspicious)',
        () => isSuspiciousTld('evil.zip'),
        0.5
      );
    });
  });

  describe('Homoglyph Detection Benchmarks', () => {
    test('detectHomoglyphs() completes in <2ms (ASCII domain)', () => {
      benchmark(
        'detectHomoglyphs (ASCII)',
        () => detectHomoglyphs('example.com'),
        2.0
      );
    });

    test('detectHomoglyphs() completes in <5ms (Punycode domain)', () => {
      benchmark(
        'detectHomoglyphs (Punycode)',
        () => detectHomoglyphs('xn--n3h.com'),
        5.0
      );
    });

    test('detectHomoglyphs() completes in <5ms (Cyrillic homoglyph)', () => {
      benchmark(
        'detectHomoglyphs (Cyrillic)',
        () => detectHomoglyphs('gооgle.com'), // Contains Cyrillic 'о'
        5.0
      );
    });

    test('detectHomoglyphs() completes in <10ms (complex mixed script)', () => {
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        detectHomoglyphs('раyраl.соm'); // Mixed Cyrillic and Latin
      }
      
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`\n📊 Benchmark: detectHomoglyphs (mixed script)`);
      console.log(`   Avg: ${avgMs.toFixed(4)}ms per call`);

      expect(avgMs).toBeLessThan(10.0);
    });
  });

  describe('Circuit Breaker Benchmarks', () => {
    test('circuit breaker execute() overhead <0.5ms when closed', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        timeoutMs: 1000,
        windowMs: 10000,
        name: 'bench-test',
      });

      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await breaker.execute(async () => 'success');
      }
      
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`\n📊 Benchmark: CircuitBreaker.execute (closed)`);
      console.log(`   Avg: ${avgMs.toFixed(4)}ms per call`);

      expect(avgMs).toBeLessThan(0.5);
    });

    test('circuit breaker fast-fails in <0.1ms when open', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 2,
        timeoutMs: 60000, // Long timeout to keep circuit open
        windowMs: 10000,
        name: 'bench-fail',
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        try {
          await breaker.execute(async () => 'should not run');
        } catch { /* expected */ }
      }
      
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`\n📊 Benchmark: CircuitBreaker.execute (open - fast fail)`);
      console.log(`   Avg: ${avgMs.toFixed(6)}ms per call`);

      expect(avgMs).toBeLessThan(0.1);
    });
  });

  describe('P99 Latency Tests', () => {
    test('scoreFromSignals() p99 latency <2ms', () => {
      const signals: Signals = {
        vtMalicious: 5,
        vtSuspicious: 2,
        gsbThreatTypes: ['MALWARE'],
        domainAgeDays: 100,
        redirectCount: 2,
      };

      const timings: number[] = [];
      
      // Warmup
      for (let i = 0; i < 100; i++) {
        scoreFromSignals(signals);
      }

      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        scoreFromSignals(signals);
        timings.push(performance.now() - start);
      }

      timings.sort((a, b) => a - b);
      const p50 = timings[Math.floor(timings.length * 0.50)];
      const p95 = timings[Math.floor(timings.length * 0.95)];
      const p99 = timings[Math.floor(timings.length * 0.99)];
      const max = timings[timings.length - 1];

      console.log(`\n📊 P99 Latency: scoreFromSignals`);
      console.log(`   P50: ${p50.toFixed(6)}ms`);
      console.log(`   P95: ${p95.toFixed(6)}ms`);
      console.log(`   P99: ${p99.toFixed(6)}ms`);
      console.log(`   Max: ${max.toFixed(6)}ms`);

      expect(p99).toBeLessThan(2.0);
    });

    test('normalizeUrl() p99 latency <1ms', () => {
      const urls = [
        'https://example.com/path',
        'HTTP://EXAMPLE.ORG/TEST',
        'https://subdomain.example.com:8443/path?query=1&utm_source=test',
      ];

      const timings: number[] = [];
      
      for (let i = 0; i < 1000; i++) {
        const url = urls[i % urls.length];
        const start = performance.now();
        normalizeUrl(url);
        timings.push(performance.now() - start);
      }

      timings.sort((a, b) => a - b);
      const p99 = timings[Math.floor(timings.length * 0.99)];

      console.log(`\n📊 P99 Latency: normalizeUrl`);
      console.log(`   P99: ${p99.toFixed(6)}ms`);

      expect(p99).toBeLessThan(1.0);
    });

    test('detectHomoglyphs() p99 latency <10ms', () => {
      const domains = [
        'example.com',
        'gооgle.com',
        'xn--n3h.com',
        'microsoft.com',
        'раyраl.соm',
      ];

      const timings: number[] = [];
      
      for (let i = 0; i < 500; i++) {
        const domain = domains[i % domains.length];
        const start = performance.now();
        detectHomoglyphs(domain);
        timings.push(performance.now() - start);
      }

      timings.sort((a, b) => a - b);
      const p99 = timings[Math.floor(timings.length * 0.99)];

      console.log(`\n📊 P99 Latency: detectHomoglyphs`);
      console.log(`   P99: ${p99.toFixed(4)}ms`);

      expect(p99).toBeLessThan(10.0);
    });
  });

  describe('Memory Efficiency Tests', () => {
    test('scoring does not leak memory over 10K iterations', () => {
      const signals: Signals = {
        vtMalicious: 5,
        gsbThreatTypes: ['MALWARE'],
        homoglyph: {
          detected: true,
          isPunycode: false,
          mixedScript: false,
          unicodeHostname: 'test.com',
          normalizedDomain: 'test.com',
          confusableChars: [],
          riskLevel: 'low',
          riskReasons: [],
        },
      };

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      const initialHeap = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 10000; i++) {
        scoreFromSignals(signals);
      }

      if (global.gc) {
        global.gc();
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const leakMB = (finalHeap - initialHeap) / 1024 / 1024;

      console.log(`\n📊 Memory Test: scoreFromSignals (10K iterations)`);
      console.log(`   Initial heap: ${(initialHeap / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final heap: ${(finalHeap / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Difference: ${leakMB.toFixed(2)}MB`);

      // Allow up to 10MB growth (normal GC variance)
      expect(Math.abs(leakMB)).toBeLessThan(10);
    });
  });
});
