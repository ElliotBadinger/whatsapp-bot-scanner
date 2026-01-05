/**
 * @fileoverview Stress testing to find breaking points
 *
 * These tests intentionally push the system to its limits
 * to identify maximum capacity and failure modes.
 *
 * Tests focus on:
 * - Memory usage under load
 * - System behavior at capacity
 * - Recovery from stress conditions
 * - Breaking point identification
 */

import { performance } from "node:perf_hooks";
import {
  scoreFromSignals,
  normalizeUrl,
  urlHash,
  extraHeuristics,
  detectHomoglyphs,
  VerdictCache,
  CircuitBreaker,
  CircuitState,
  type Signals,
} from "@wbscanner/shared";

const runPerfBenchmarks = process.env.RUN_PERF_BENCH === "true";

(runPerfBenchmarks ? describe : describe.skip)("Stress Testing", () => {
  describe("Memory Usage Under Load", () => {
    test("does not leak memory with 10K sequential scoring operations", () => {
      const signals: Signals = {
        vtMalicious: 5,
        gsbThreatTypes: ["MALWARE"],
        domainAgeDays: 30,
        homoglyph: {
          detected: true,
          isPunycode: false,
          mixedScript: false,
          unicodeHostname: "test.com",
          normalizedDomain: "test.com",
          confusableChars: [],
          riskLevel: "medium",
          riskReasons: ["Test reason"],
        },
      };

      // Force GC if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      const initialHeap = process.memoryUsage().heapUsed;
      const results: ReturnType<typeof scoreFromSignals>[] = [];

      for (let i = 0; i < 10000; i++) {
        results.push(scoreFromSignals(signals));

        // Force GC every 1000 operations
        if (i % 1000 === 0 && globalThis.gc) {
          globalThis.gc();
        }
      }

      // Clear results to allow GC
      results.length = 0;

      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const leakMB = (finalHeap - initialHeap) / 1024 / 1024;

      console.log(`\n📊 Stress Test: Memory (10K scoring operations)`);
      console.log(
        `   Initial heap: ${(initialHeap / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(`   Final heap: ${(finalHeap / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Difference: ${leakMB.toFixed(2)}MB`);

      // Allow up to 20MB variance (normal GC behavior)
      expect(Math.abs(leakMB)).toBeLessThan(20);
    });

    test("does not leak memory with 5K URL processing operations", () => {
      if (globalThis.gc) {
        globalThis.gc();
      }

      const initialHeap = process.memoryUsage().heapUsed;

      for (let i = 0; i < 5000; i++) {
        const url = `https://example${i}.com/path/${i}?query=${i}`;
        const normalized = normalizeUrl(url);
        if (normalized) {
          urlHash(normalized);
          const parsedUrl = new URL(normalized);
          extraHeuristics(parsedUrl);
          detectHomoglyphs(parsedUrl.hostname);
        }

        if (i % 500 === 0 && globalThis.gc) {
          globalThis.gc();
        }
      }

      if (globalThis.gc) {
        globalThis.gc();
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const leakMB = (finalHeap - initialHeap) / 1024 / 1024;

      console.log(`\n📊 Stress Test: Memory (5K URL processing)`);
      console.log(
        `   Initial heap: ${(initialHeap / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(`   Final heap: ${(finalHeap / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Difference: ${leakMB.toFixed(2)}MB`);

      expect(Math.abs(leakMB)).toBeLessThan(50);
    });

    test("cache handles 10K entries without excessive memory", () => {
      const cache = new VerdictCache({ ttlSeconds: 3600, maxKeys: 15000 });

      if (globalThis.gc) {
        globalThis.gc();
      }

      const initialHeap = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10000; i++) {
        cache.set(`stress_hash_${i}`, {
          verdict:
            i % 3 === 0 ? "malicious" : i % 2 === 0 ? "suspicious" : "benign",
          confidence: 0.8 + (i % 20) / 100,
          timestamp: Date.now(),
          sources: ["test1", "test2"],
        });
      }

      const afterPopulateHeap = process.memoryUsage().heapUsed;
      const memoryUsedMB = (afterPopulateHeap - initialHeap) / 1024 / 1024;
      const stats = cache.getStats();

      console.log(`\n📊 Stress Test: Cache memory (10K entries)`);
      console.log(`   Entries: ${stats.keys}`);
      console.log(`   Memory used: ${memoryUsedMB.toFixed(2)}MB`);
      console.log(
        `   Per entry: ${((memoryUsedMB * 1024) / stats.keys).toFixed(2)}KB`,
      );

      // Should use less than 100MB for 10K entries
      expect(memoryUsedMB).toBeLessThan(100);
      expect(stats.keys).toBe(10000);

      cache.close();
    });
  });

  describe("Cache Stress Tests", () => {
    test("cache handles rapid write/evict cycles", () => {
      const cache = new VerdictCache({ ttlSeconds: 3600, maxKeys: 1000 });

      const start = performance.now();

      // Write 5000 entries - will trigger evictions after 1000
      for (let i = 0; i < 5000; i++) {
        cache.set(`evict_hash_${i}`, {
          verdict: "benign",
          confidence: 0.9,
          timestamp: Date.now(),
        });
      }

      const elapsed = performance.now() - start;
      const stats = cache.getStats();

      console.log(`\n📊 Stress Test: Cache eviction`);
      console.log(`   Writes: 5000`);
      console.log(`   Final keys: ${stats.keys}`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);

      // Should be capped at maxKeys
      expect(stats.keys).toBeLessThanOrEqual(1000);
      expect(elapsed).toBeLessThan(5000);

      cache.close();
    });

    test("cache handles burst read after populate", () => {
      const cache = new VerdictCache({ ttlSeconds: 3600, maxKeys: 5000 });

      // Populate
      for (let i = 0; i < 5000; i++) {
        cache.set(`burst_hash_${i}`, {
          verdict: "benign",
          confidence: 0.95,
          timestamp: Date.now(),
        });
      }

      const start = performance.now();

      // Burst read all entries
      for (let i = 0; i < 5000; i++) {
        cache.get(`burst_hash_${i}`);
      }

      const elapsed = performance.now() - start;
      const stats = cache.getStats();

      console.log(`\n📊 Stress Test: Cache burst read`);
      console.log(`   Reads: 5000`);
      console.log(`   Hits: ${stats.hits}`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
      console.log(`   Avg per read: ${(elapsed / 5000).toFixed(4)}ms`);

      expect(stats.hits).toBe(5000);
      expect(elapsed).toBeLessThan(500); // <0.1ms per read

      cache.close();
    });
  });

  describe("Circuit Breaker Stress", () => {
    test("circuit breaker handles rapid state transitions", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 50,
        windowMs: 100,
        name: "stress-circuit",
      });

      let transitions = 0;
      let failures = 0;
      let successes = 0;

      const start = performance.now();

      for (let cycle = 0; cycle < 10; cycle++) {
        // Trigger failures to open circuit
        for (let i = 0; i < 5; i++) {
          try {
            await breaker.execute(async () => {
              throw new Error("fail");
            });
          } catch {
            failures++;
          }
        }

        // Wait for timeout
        await new Promise((resolve) => setTimeout(resolve, 60));

        // Recover with successes
        for (let i = 0; i < 5; i++) {
          try {
            await breaker.execute(async () => "success");
            successes++;
          } catch {
            failures++;
          }
        }

        transitions++;
      }

      const elapsed = performance.now() - start;

      console.log(`\n📊 Stress Test: Circuit breaker transitions`);
      console.log(`   Cycles: ${transitions}`);
      console.log(`   Failures: ${failures}`);
      console.log(`   Successes: ${successes}`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
      console.log(`   Final state: ${breaker.getState()}`);

      expect(transitions).toBe(10);
    });

    test("circuit breaker handles concurrent access", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 10,
        successThreshold: 5,
        timeoutMs: 1000,
        windowMs: 5000,
        name: "concurrent-circuit",
      });

      const concurrency = 100;
      let completed = 0;

      const start = performance.now();

      const promises = Array.from({ length: concurrency }, async (_, i) => {
        try {
          await breaker.execute(async () => {
            // Simulate varying work
            await new Promise((resolve) => setTimeout(resolve, i % 10));
            return `result-${i}`;
          });
          completed++;
        } catch {
          // Circuit open or other error
        }
      });

      await Promise.all(promises);

      const elapsed = performance.now() - start;

      console.log(`\n📊 Stress Test: Concurrent circuit breaker access`);
      console.log(`   Concurrent requests: ${concurrency}`);
      console.log(`   Completed: ${completed}`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);

      expect(completed).toBe(concurrency);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("Processing Pipeline Stress", () => {
    test("handles 500 URLs in batch without degradation", async () => {
      const urls = Array.from(
        { length: 500 },
        (_, i) =>
          `https://stress-test-${i}.example.com/path/${i}?id=${i}&token=${Math.random()}`,
      );

      const timings: number[] = [];
      const batchSize = 50;

      for (let batch = 0; batch < urls.length / batchSize; batch++) {
        const batchUrls = urls.slice(
          batch * batchSize,
          (batch + 1) * batchSize,
        );
        const start = performance.now();

        await Promise.all(
          batchUrls.map(async (url) => {
            const normalized = normalizeUrl(url);
            if (!normalized) return null;

            const hash = urlHash(normalized);
            const parsedUrl = new URL(normalized);
            const heuristics = extraHeuristics(parsedUrl);
            const homoglyph = detectHomoglyphs(parsedUrl.hostname);

            return scoreFromSignals({
              ...heuristics,
              homoglyph,
              domainAgeDays: parseInt(hash.slice(0, 4), 16) % 365,
            });
          }),
        );

        timings.push(performance.now() - start);
      }

      const avgBatchTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxBatchTime = Math.max(...timings);
      const minBatchTime = Math.min(...timings);

      console.log(`\n📊 Stress Test: Batch processing (500 URLs)`);
      console.log(`   Batches: ${timings.length}`);
      console.log(`   Avg batch time: ${avgBatchTime.toFixed(2)}ms`);
      console.log(`   Min batch time: ${minBatchTime.toFixed(2)}ms`);
      console.log(`   Max batch time: ${maxBatchTime.toFixed(2)}ms`);
      console.log(
        `   Variance: ${(((maxBatchTime - minBatchTime) / avgBatchTime) * 100).toFixed(1)}%`,
      );

      // Performance should be consistent (no more than 3x variance)
      expect(maxBatchTime).toBeLessThan(avgBatchTime * 3);
      expect(avgBatchTime).toBeLessThan(500); // <500ms per batch of 50
    });

    test("handles mixed complexity workload", async () => {
      const workloads = {
        simple: Array.from({ length: 100 }, (_, i) => ({
          url: `https://simple${i}.com/`,
          signals: { domainAgeDays: 365 } as Signals,
        })),
        medium: Array.from({ length: 100 }, (_, i) => ({
          url: `https://medium${i}.com/path/${i}`,
          signals: {
            vtMalicious: i % 3,
            redirectCount: i % 5,
            domainAgeDays: 30,
          } as Signals,
        })),
        complex: Array.from({ length: 100 }, (_, i) => ({
          url: `https://complex${i}.org/deep/path/${i}?many=params&here=true`,
          signals: {
            vtMalicious: i % 5,
            gsbThreatTypes: i % 10 === 0 ? ["MALWARE"] : [],
            phishtankVerified: i % 20 === 0,
            domainAgeDays: i % 30,
            redirectCount: i % 6,
            homoglyph: {
              detected: i % 5 === 0,
              isPunycode: false,
              mixedScript: i % 5 === 0,
              unicodeHostname: `complex${i}.org`,
              normalizedDomain: `complex${i}.org`,
              confusableChars: [],
              riskLevel: "medium" as const,
              riskReasons: [],
            },
          } as Signals,
        })),
      };

      const results: Record<string, { elapsed: number; count: number }> = {};

      for (const [complexity, items] of Object.entries(workloads)) {
        const start = performance.now();

        await Promise.all(
          items.map(async ({ url, signals }) => {
            const normalized = normalizeUrl(url);
            if (!normalized) return null;
            urlHash(normalized);
            return scoreFromSignals(signals);
          }),
        );

        results[complexity] = {
          elapsed: performance.now() - start,
          count: items.length,
        };
      }

      console.log(`\n📊 Stress Test: Mixed complexity workload`);
      for (const [complexity, { elapsed, count }] of Object.entries(results)) {
        console.log(
          `   ${complexity}: ${elapsed.toFixed(2)}ms for ${count} items (${(elapsed / count).toFixed(4)}ms/item)`,
        );
      }

      // All complexity levels should complete in reasonable time
      expect(results.simple.elapsed).toBeLessThan(500);
      expect(results.medium.elapsed).toBeLessThan(500);
      expect(results.complex.elapsed).toBeLessThan(1000);
    });
  });

  describe("Breaking Point Detection", () => {
    test("identifies scoring throughput limit", () => {
      const signals: Signals = {
        vtMalicious: 3,
        gsbThreatTypes: ["MALWARE"],
        domainAgeDays: 15,
        redirectCount: 4,
      };

      const durations = [100, 200, 500, 1000]; // ms
      const throughputs: number[] = [];

      for (const duration of durations) {
        let count = 0;
        const end = performance.now() + duration;

        while (performance.now() < end) {
          scoreFromSignals(signals);
          count++;
        }

        throughputs.push(count / (duration / 1000));
      }

      const avgThroughput =
        throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      const minThroughput = Math.min(...throughputs);

      console.log(`\n📊 Breaking Point: Scoring throughput`);
      console.log(
        `   Throughputs: ${throughputs.map((t) => Math.floor(t).toLocaleString()).join(", ")} ops/sec`,
      );
      console.log(
        `   Average: ${Math.floor(avgThroughput).toLocaleString()} ops/sec`,
      );
      console.log(
        `   Minimum: ${Math.floor(minThroughput).toLocaleString()} ops/sec`,
      );

      // Should maintain at least 100K ops/sec consistently
      expect(minThroughput).toBeGreaterThan(100000);
    });

    test("identifies homoglyph detection limit", () => {
      const domains = [
        "example.com",
        "gооgle.com",
        "раyраl.соm",
        "microsoft.com",
        "xn--n3h.example.com",
      ];

      const iterations = 5000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        detectHomoglyphs(domains[i % domains.length]);
      }

      const elapsed = performance.now() - start;
      const throughput = iterations / (elapsed / 1000);

      console.log(`\n📊 Breaking Point: Homoglyph detection`);
      console.log(`   Iterations: ${iterations.toLocaleString()}`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
      console.log(
        `   Throughput: ${Math.floor(throughput).toLocaleString()} ops/sec`,
      );

      // Should handle at least 1K ops/sec (homoglyph detection is CPU-intensive with confusable library)
      expect(throughput).toBeGreaterThan(1000);
    });

    test("identifies cache capacity limit", () => {
      const cache = new VerdictCache({ ttlSeconds: 3600, maxKeys: 50000 });

      const targetEntries = [1000, 5000, 10000, 25000, 50000];
      const results: Array<{
        entries: number;
        writeTime: number;
        readTime: number;
      }> = [];

      for (const target of targetEntries) {
        // Clear and repopulate
        cache.clear();

        const writeStart = performance.now();
        for (let i = 0; i < target; i++) {
          cache.set(`limit_${target}_${i}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }
        const writeTime = performance.now() - writeStart;

        const readStart = performance.now();
        for (let i = 0; i < Math.min(1000, target); i++) {
          cache.get(`limit_${target}_${i}`);
        }
        const readTime = performance.now() - readStart;

        results.push({ entries: target, writeTime, readTime });
      }

      console.log(`\n📊 Breaking Point: Cache capacity`);
      for (const { entries, writeTime, readTime } of results) {
        console.log(
          `   ${entries.toLocaleString()} entries: write=${writeTime.toFixed(0)}ms, read=${readTime.toFixed(2)}ms`,
        );
      }

      // Write time should scale linearly (not exponentially)
      const scaleFactor =
        results[results.length - 1].writeTime / results[0].writeTime;
      const entriesFactor =
        targetEntries[targetEntries.length - 1] / targetEntries[0];

      console.log(
        `   Scale factor: ${scaleFactor.toFixed(2)}x (entries: ${entriesFactor}x)`,
      );

      // Should not scale worse than 1.5x the linear expectation (allow for GC overhead)
      expect(scaleFactor).toBeLessThan(entriesFactor * 1.5);

      cache.close();
    });
  });

  describe("Recovery Tests", () => {
    test("recovers performance after stress", async () => {
      const signals: Signals = { domainAgeDays: 100 };

      // Baseline
      const baselineStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        scoreFromSignals(signals);
      }
      const baselineTime = performance.now() - baselineStart;

      // Stress phase - heavy allocation
      const heavySignals: Signals = {
        vtMalicious: 10,
        gsbThreatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
        homoglyph: {
          detected: true,
          isPunycode: true,
          mixedScript: true,
          unicodeHostname: "test.com",
          normalizedDomain: "test.com",
          confusableChars: Array.from({ length: 10 }, (_, i) => ({
            original: String.fromCharCode(0x400 + i),
            confusedWith: String.fromCharCode(0x61 + i),
            position: i,
            script: "Cyrillic",
            alternatives: [],
          })),
          riskLevel: "high",
          riskReasons: Array.from({ length: 5 }, (_, i) => `Reason ${i}`),
        },
      };

      for (let i = 0; i < 5000; i++) {
        scoreFromSignals(heavySignals);
      }

      // Force GC if available
      if (globalThis.gc) {
        globalThis.gc();
      }

      // Recovery test
      const recoveryStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        scoreFromSignals(signals);
      }
      const recoveryTime = performance.now() - recoveryStart;

      const degradation = ((recoveryTime - baselineTime) / baselineTime) * 100;

      console.log(`\n📊 Recovery Test: Performance after stress`);
      console.log(`   Baseline: ${baselineTime.toFixed(2)}ms`);
      console.log(`   Recovery: ${recoveryTime.toFixed(2)}ms`);
      console.log(`   Degradation: ${degradation.toFixed(1)}%`);

      // Should recover to within 200% of baseline (allow for GC and JIT variance)
      expect(degradation).toBeLessThan(200);
    });
  });
});
