/**
 * @fileoverview Cache performance tests
 *
 * Tests verify that caching operations meet performance targets
 * and maintain high hit ratios under various access patterns.
 *
 * Performance Targets:
 * - Cache lookup: <1ms
 * - Cache write: <2ms
 * - Hit ratio: >95% for typical workloads
 */

import { performance } from "node:perf_hooks";
import { VerdictCache, type CachedVerdict } from "@wbscanner/shared";

const runPerfBenchmarks = process.env.RUN_PERF_BENCH === "true";

(runPerfBenchmarks ? describe : describe.skip)(
  "Cache Performance Tests",
  () => {
    let cache: VerdictCache;

    beforeEach(() => {
      cache = new VerdictCache({ ttlSeconds: 3600, maxKeys: 10000 });
    });

    afterEach(() => {
      cache.close();
    });

    describe("Cache Lookup Performance", () => {
      test("cache lookup completes in <1ms (hit)", () => {
        // Pre-populate cache
        cache.set("test_hash", {
          verdict: "benign",
          confidence: 0.95,
          timestamp: Date.now(),
        });

        const iterations = 10000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          cache.get("test_hash");
        }

        const elapsed = performance.now() - start;
        const avgMs = elapsed / iterations;

        console.log(`\n📊 Cache Lookup Performance (hit)`);
        console.log(`   Iterations: ${iterations.toLocaleString()}`);
        console.log(`   Total: ${elapsed.toFixed(2)}ms`);
        console.log(`   Avg: ${avgMs.toFixed(6)}ms per lookup`);
        console.log(
          `   Throughput: ${Math.floor(iterations / (elapsed / 1000)).toLocaleString()} ops/sec`,
        );

        expect(avgMs).toBeLessThan(1);
      });

      test("cache lookup completes in <1ms (miss)", () => {
        const iterations = 10000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          cache.get(`missing_hash_${i}`);
        }

        const elapsed = performance.now() - start;
        const avgMs = elapsed / iterations;

        console.log(`\n📊 Cache Lookup Performance (miss)`);
        console.log(`   Avg: ${avgMs.toFixed(6)}ms per lookup`);

        expect(avgMs).toBeLessThan(1);
      });

      test("cache lookup throughput >1M ops/sec", () => {
        cache.set("throughput_test", {
          verdict: "benign",
          confidence: 0.9,
          timestamp: Date.now(),
        });

        const iterations = 1000000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          cache.get("throughput_test");
        }

        const elapsed = (performance.now() - start) / 1000;
        const throughput = iterations / elapsed;

        console.log(`\n📊 Cache Lookup Throughput`);
        console.log(
          `   ${throughput.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec`,
        );

        expect(throughput).toBeGreaterThan(1000000);
      });
    });

    describe("Cache Write Performance", () => {
      test("cache write completes in <2ms", () => {
        const iterations = 10000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          cache.set(`write_hash_${i}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }

        const elapsed = performance.now() - start;
        const avgMs = elapsed / iterations;

        console.log(`\n📊 Cache Write Performance`);
        console.log(`   Iterations: ${iterations.toLocaleString()}`);
        console.log(`   Total: ${elapsed.toFixed(2)}ms`);
        console.log(`   Avg: ${avgMs.toFixed(6)}ms per write`);

        expect(avgMs).toBeLessThan(2);
      });

      test("cache write with custom TTL completes in <2ms", () => {
        const iterations = 5000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          cache.set(
            `ttl_hash_${i}`,
            {
              verdict: "suspicious",
              confidence: 0.7,
              timestamp: Date.now(),
              sources: ["test"],
            },
            1800,
          ); // 30 min TTL
        }

        const elapsed = performance.now() - start;
        const avgMs = elapsed / iterations;

        console.log(`\n📊 Cache Write Performance (custom TTL)`);
        console.log(`   Avg: ${avgMs.toFixed(6)}ms per write`);

        expect(avgMs).toBeLessThan(2);
      });

      test("cache write throughput >50K ops/sec", () => {
        const iterations = 50000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          cache.set(`throughput_write_${i % 10000}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }

        const elapsed = (performance.now() - start) / 1000;
        const throughput = iterations / elapsed;

        console.log(`\n📊 Cache Write Throughput`);
        console.log(
          `   ${throughput.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec`,
        );

        expect(throughput).toBeGreaterThan(50000);
      });
    });

    describe("Cache Hit Ratio Tests", () => {
      test("achieves >95% hit ratio with Zipf distribution", () => {
        const cacheSize = 1000;
        const accessCount = 10000;

        // Populate cache
        for (let i = 0; i < cacheSize; i++) {
          cache.set(`zipf_${i}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }

        // Simulate Zipf distribution (80/20 rule)
        // 80% of accesses go to 20% of keys
        for (let i = 0; i < accessCount; i++) {
          const rand = Math.random();
          let key: string;

          if (rand < 0.8) {
            // 80% access top 20% of keys
            key = `zipf_${Math.floor(Math.random() * (cacheSize * 0.2))}`;
          } else {
            // 20% access remaining 80% of keys
            key = `zipf_${Math.floor(cacheSize * 0.2 + Math.random() * (cacheSize * 0.8))}`;
          }

          cache.get(key);
        }

        const stats = cache.getStats();

        console.log(`\n📊 Cache Hit Ratio (Zipf distribution)`);
        console.log(`   Accesses: ${accessCount.toLocaleString()}`);
        console.log(`   Hits: ${stats.hits.toLocaleString()}`);
        console.log(`   Misses: ${stats.misses.toLocaleString()}`);
        console.log(`   Hit Rate: ${stats.hitRate}%`);

        expect(stats.hitRate).toBeGreaterThan(95);
      });

      test("achieves >90% hit ratio with uniform distribution", () => {
        const cacheSize = 500;
        const accessCount = 5000;

        // Populate cache
        for (let i = 0; i < cacheSize; i++) {
          cache.set(`uniform_${i}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }

        // Uniform random access
        for (let i = 0; i < accessCount; i++) {
          const key = `uniform_${Math.floor(Math.random() * cacheSize)}`;
          cache.get(key);
        }

        const stats = cache.getStats();

        console.log(`\n📊 Cache Hit Ratio (Uniform distribution)`);
        console.log(`   Hit Rate: ${stats.hitRate}%`);

        expect(stats.hitRate).toBeGreaterThan(90);
      });

      test("handles working set larger than cache", () => {
        const smallCache = new VerdictCache({ ttlSeconds: 3600, maxKeys: 100 });

        const workingSetSize = 500;
        const accessCount = 2000;

        // Access pattern that exceeds cache size
        for (let i = 0; i < accessCount; i++) {
          const key = `overflow_${i % workingSetSize}`;

          // Check cache first
          const cached = smallCache.get(key);

          if (!cached) {
            // Cache miss - simulate fetch and cache
            smallCache.set(key, {
              verdict: "benign",
              confidence: 0.9,
              timestamp: Date.now(),
            });
          }
        }

        const stats = smallCache.getStats();

        console.log(`\n📊 Cache Hit Ratio (overflow scenario)`);
        console.log(`   Cache size: 100`);
        console.log(`   Working set: ${workingSetSize}`);
        console.log(`   Hit Rate: ${stats.hitRate}%`);

        // Hit rate will be lower due to evictions, but should still be reasonable
        expect(stats.hitRate).toBeGreaterThan(10);

        smallCache.close();
      });
    });

    describe("Cache P99 Latency", () => {
      test("cache read p99 latency <0.5ms", () => {
        // Pre-populate
        for (let i = 0; i < 100; i++) {
          cache.set(`p99_${i}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }

        const timings: number[] = [];

        for (let i = 0; i < 1000; i++) {
          const start = performance.now();
          cache.get(`p99_${i % 100}`);
          timings.push(performance.now() - start);
        }

        timings.sort((a, b) => a - b);
        const p50 = timings[Math.floor(timings.length * 0.5)];
        const p95 = timings[Math.floor(timings.length * 0.95)];
        const p99 = timings[Math.floor(timings.length * 0.99)];

        console.log(`\n📊 Cache Read P99 Latency`);
        console.log(`   P50: ${p50.toFixed(6)}ms`);
        console.log(`   P95: ${p95.toFixed(6)}ms`);
        console.log(`   P99: ${p99.toFixed(6)}ms`);

        expect(p99).toBeLessThan(0.5);
      });

      test("cache write p99 latency <1ms", () => {
        const timings: number[] = [];

        for (let i = 0; i < 1000; i++) {
          const start = performance.now();
          cache.set(`p99_write_${i}`, {
            verdict: "suspicious",
            confidence: 0.7,
            timestamp: Date.now(),
          });
          timings.push(performance.now() - start);
        }

        timings.sort((a, b) => a - b);
        const p99 = timings[Math.floor(timings.length * 0.99)];

        console.log(`\n📊 Cache Write P99 Latency`);
        console.log(`   P99: ${p99.toFixed(6)}ms`);

        expect(p99).toBeLessThan(1);
      });
    });

    describe("Cache Memory Efficiency", () => {
      test("cache memory usage scales linearly", () => {
        const testCache = new VerdictCache({
          ttlSeconds: 3600,
          maxKeys: 100000,
        });

        const measurements: Array<{ entries: number; memory: number }> = [];

        if (globalThis.gc) globalThis.gc();
        const baseline = process.memoryUsage().heapUsed;

        for (const count of [1000, 5000, 10000, 25000]) {
          for (
            let i = measurements[measurements.length - 1]?.entries || 0;
            i < count;
            i++
          ) {
            testCache.set(`mem_${i}`, {
              verdict: "benign",
              confidence: 0.9,
              timestamp: Date.now(),
              sources: ["source1", "source2"],
            });
          }

          const currentMemory = process.memoryUsage().heapUsed - baseline;
          measurements.push({ entries: count, memory: currentMemory });
        }

        console.log(`\n📊 Cache Memory Scaling`);
        for (const { entries, memory } of measurements) {
          const perEntry = memory / entries;
          console.log(
            `   ${entries.toLocaleString()} entries: ${(memory / 1024 / 1024).toFixed(2)}MB (${perEntry.toFixed(0)} bytes/entry)`,
          );
        }

        // Verify roughly linear scaling
        const firstRatio = measurements[0].memory / measurements[0].entries;
        const lastRatio =
          measurements[measurements.length - 1].memory /
          measurements[measurements.length - 1].entries;

        // Memory per entry should not increase more than 2x
        expect(lastRatio / firstRatio).toBeLessThan(2);

        testCache.close();
      });

      test("cache stats operation is fast", () => {
        // Populate cache
        for (let i = 0; i < 5000; i++) {
          cache.set(`stats_${i}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }

        // Access some entries to build up stats
        for (let i = 0; i < 1000; i++) {
          cache.get(`stats_${i % 5000}`);
        }

        const iterations = 10000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          cache.getStats();
        }

        const elapsed = performance.now() - start;
        const avgMs = elapsed / iterations;

        console.log(`\n📊 Cache Stats Operation`);
        console.log(`   Avg: ${avgMs.toFixed(6)}ms`);

        expect(avgMs).toBeLessThan(0.1);
      });
    });

    describe("Cache Concurrent Access", () => {
      test("handles concurrent reads efficiently", async () => {
        // Pre-populate
        for (let i = 0; i < 100; i++) {
          cache.set(`concurrent_${i}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
        }

        const concurrency = 100;
        const readsPerWorker = 1000;

        const start = performance.now();

        await Promise.all(
          Array.from({ length: concurrency }, async (_, worker) => {
            for (let i = 0; i < readsPerWorker; i++) {
              cache.get(`concurrent_${(worker + i) % 100}`);
            }
          }),
        );

        const elapsed = performance.now() - start;
        const totalOps = concurrency * readsPerWorker;
        const throughput = totalOps / (elapsed / 1000);

        console.log(`\n📊 Concurrent Cache Reads`);
        console.log(`   Workers: ${concurrency}`);
        console.log(`   Total ops: ${totalOps.toLocaleString()}`);
        console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
        console.log(
          `   Throughput: ${throughput.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec`,
        );

        expect(throughput).toBeGreaterThan(100000);
      });

      test("handles mixed concurrent read/write", async () => {
        const concurrency = 50;
        const opsPerWorker = 500;

        const start = performance.now();

        await Promise.all(
          Array.from({ length: concurrency }, async (_, worker) => {
            for (let i = 0; i < opsPerWorker; i++) {
              if (i % 3 === 0) {
                cache.set(`mixed_${worker}_${i}`, {
                  verdict: "benign",
                  confidence: 0.9,
                  timestamp: Date.now(),
                });
              } else {
                cache.get(`mixed_${worker}_${i % (opsPerWorker / 3)}`);
              }
            }
          }),
        );

        const elapsed = performance.now() - start;
        const totalOps = concurrency * opsPerWorker;

        console.log(`\n📊 Mixed Concurrent Read/Write`);
        console.log(`   Total ops: ${totalOps.toLocaleString()}`);
        console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
        console.log(
          `   Throughput: ${Math.floor(totalOps / (elapsed / 1000)).toLocaleString()} ops/sec`,
        );

        expect(elapsed).toBeLessThan(5000);
      });
    });

    describe("Cache Eviction Performance", () => {
      test("eviction does not cause performance spikes", () => {
        const smallCache = new VerdictCache({ ttlSeconds: 3600, maxKeys: 100 });

        const timings: number[] = [];

        // Write more entries than cache can hold
        for (let i = 0; i < 500; i++) {
          const start = performance.now();
          smallCache.set(`evict_${i}`, {
            verdict: "benign",
            confidence: 0.9,
            timestamp: Date.now(),
          });
          timings.push(performance.now() - start);
        }

        timings.sort((a, b) => a - b);
        const median = timings[Math.floor(timings.length / 2)];
        const p99 = timings[Math.floor(timings.length * 0.99)];
        const max = timings[timings.length - 1];

        console.log(`\n📊 Cache Eviction Performance`);
        console.log(`   Median write: ${median.toFixed(6)}ms`);
        console.log(`   P99 write: ${p99.toFixed(6)}ms`);
        console.log(`   Max write: ${max.toFixed(6)}ms`);

        // Max should not be more than 10x the median (no spikes)
        expect(max).toBeLessThan(median * 10 + 1); // +1ms buffer

        smallCache.close();
      });
    });
  },
);
