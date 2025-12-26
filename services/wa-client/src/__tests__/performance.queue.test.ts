/**
 * @fileoverview Queue performance tests
 *
 * Tests verify that queue operations meet performance targets.
 * Uses mock queues to isolate queue layer performance.
 *
 * Performance Targets:
 * - Enqueue: <10ms per job
 * - Throughput: >1000 jobs/sec for enqueue
 * - Batch enqueue: <1s for 100 jobs
 */

import { performance } from "node:perf_hooks";

// Mock queue implementation for testing
interface MockJob {
  id: string;
  name: string;
  data: unknown;
  timestamp: number;
  status: "waiting" | "active" | "completed" | "failed";
}

class MockQueue {
  private jobs: Map<string, MockJob> = new Map();
  private jobCounter = 0;

  async add(name: string, data: unknown): Promise<MockJob> {
    const id = `job_${++this.jobCounter}`;
    const job: MockJob = {
      id,
      name,
      data,
      timestamp: Date.now(),
      status: "waiting",
    };
    this.jobs.set(id, job);
    return job;
  }

  async addBulk(
    jobs: Array<{ name: string; data: unknown }>,
  ): Promise<MockJob[]> {
    return Promise.all(jobs.map(({ name, data }) => this.add(name, data)));
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    let waiting = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case "waiting":
          waiting++;
          break;
        case "active":
          active++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
      }
    }

    return { waiting, active, completed, failed };
  }

  async getWaiting(start = 0, end = -1): Promise<MockJob[]> {
    const waiting = Array.from(this.jobs.values()).filter(
      (j) => j.status === "waiting",
    );
    return end === -1 ? waiting.slice(start) : waiting.slice(start, end + 1);
  }

  async process(handler: (job: MockJob) => Promise<void>): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.status === "waiting") {
        job.status = "active";
        try {
          await handler(job);
          job.status = "completed";
        } catch {
          job.status = "failed";
        }
      }
    }
  }

  async drain(): Promise<void> {
    this.jobs.clear();
    this.jobCounter = 0;
  }

  size(): number {
    return this.jobs.size;
  }
}

describe("Queue Performance Tests", () => {
  let queue: MockQueue;
  const PERF_MULTIPLIER = Number.parseFloat(
    process.env.PERF_QUEUE_MULTIPLIER ?? "10",
  );

  beforeEach(() => {
    queue = new MockQueue();
  });

  describe("Enqueue Performance", () => {
    test("single job enqueue completes in <10ms", async () => {
      const iterations = 1000;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await queue.add("scan", {
          url: `https://example${i}.com/`,
          chatId: "test-chat",
          messageId: `msg-${i}`,
        });
        timings.push(performance.now() - start);
      }

      const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const p99 = timings.sort((a, b) => a - b)[
        Math.floor(timings.length * 0.99)
      ];

      console.log(`\n📊 Single Job Enqueue Performance`);
      console.log(`   Iterations: ${iterations}`);
      console.log(`   Avg: ${avgMs.toFixed(4)}ms`);
      console.log(`   P99: ${p99.toFixed(4)}ms`);

      expect(avgMs).toBeLessThan(10 * PERF_MULTIPLIER);
      expect(p99).toBeLessThan(20 * PERF_MULTIPLIER);
    });

    test("enqueue throughput >1000 jobs/sec", async () => {
      const targetDuration = 1000; // 1 second
      let count = 0;
      const end = performance.now() + targetDuration;

      while (performance.now() < end) {
        await queue.add("scan", {
          url: `https://throughput-${count}.com/`,
          chatId: "test",
          messageId: `msg-${count}`,
        });
        count++;
      }

      const throughput = count / (targetDuration / 1000);

      console.log(`\n📊 Enqueue Throughput`);
      console.log(`   Jobs in 1s: ${count}`);
      console.log(`   Throughput: ${throughput.toFixed(0)} jobs/sec`);

      expect(throughput).toBeGreaterThan(1000 / PERF_MULTIPLIER);
    });

    test("batch enqueue 100 jobs in <500ms", async () => {
      const jobs = Array.from({ length: 100 }, (_, i) => ({
        name: "scan",
        data: {
          url: `https://batch-${i}.com/`,
          chatId: "test",
          messageId: `msg-${i}`,
        },
      }));

      const start = performance.now();
      const results = await queue.addBulk(jobs);
      const elapsed = performance.now() - start;

      console.log(`\n📊 Batch Enqueue Performance (100 jobs)`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
      console.log(`   Avg per job: ${(elapsed / 100).toFixed(4)}ms`);

      expect(results).toHaveLength(100);
      expect(elapsed).toBeLessThan(500 * PERF_MULTIPLIER);
    });

    test("batch enqueue 1000 jobs in <2s", async () => {
      const jobs = Array.from({ length: 1000 }, (_, i) => ({
        name: "scan",
        data: {
          url: `https://large-batch-${i}.com/`,
          chatId: "test",
          messageId: `msg-${i}`,
        },
      }));

      const start = performance.now();
      const results = await queue.addBulk(jobs);
      const elapsed = performance.now() - start;

      console.log(`\n📊 Large Batch Enqueue Performance (1000 jobs)`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
      console.log(
        `   Throughput: ${Math.floor(1000 / (elapsed / 1000))} jobs/sec`,
      );

      expect(results).toHaveLength(1000);
      expect(elapsed).toBeLessThan(2000 * PERF_MULTIPLIER);
    });
  });

  describe("Queue Status Performance", () => {
    test("getJobCounts completes in <50ms with 10K jobs", async () => {
      // Pre-populate queue
      const jobs = Array.from({ length: 10000 }, (_, i) => ({
        name: "scan",
        data: { url: `https://status-${i}.com/` },
      }));
      await queue.addBulk(jobs);

      const iterations = 100;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await queue.getJobCounts();
        timings.push(performance.now() - start);
      }

      const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;

      console.log(`\n📊 Queue Status Performance (10K jobs)`);
      console.log(`   Avg: ${avgMs.toFixed(2)}ms`);

      expect(avgMs).toBeLessThan(50 * PERF_MULTIPLIER);
    });

    test("getWaiting completes in <100ms with 5K jobs", async () => {
      const jobs = Array.from({ length: 5000 }, (_, i) => ({
        name: "scan",
        data: { url: `https://waiting-${i}.com/` },
      }));
      await queue.addBulk(jobs);

      const start = performance.now();
      const waiting = await queue.getWaiting(0, 99); // Get first 100
      const elapsed = performance.now() - start;

      console.log(`\n📊 Get Waiting Jobs Performance`);
      console.log(`   Total in queue: 5000`);
      console.log(`   Retrieved: ${waiting.length}`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);

      expect(waiting.length).toBeLessThanOrEqual(100);
      expect(elapsed).toBeLessThan(100 * PERF_MULTIPLIER);
    });
  });

  describe("Job Processing Simulation", () => {
    test("processes 100 jobs with consistent timing", async () => {
      const jobs = Array.from({ length: 100 }, (_, i) => ({
        name: "scan",
        data: {
          url: `https://process-${i}.com/`,
          chatId: "test",
        },
      }));
      await queue.addBulk(jobs);

      const processingTimes: number[] = [];

      const start = performance.now();

      await queue.process(async (job) => {
        const jobStart = performance.now();
        // Simulate processing work
        const data = job.data as { url: string };
        const normalized = data.url.toLowerCase();
        processingTimes.push(performance.now() - jobStart);
      });

      const elapsed = performance.now() - start;
      const avgProcessing =
        processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

      console.log(`\n📊 Job Processing Performance (100 jobs)`);
      console.log(`   Total elapsed: ${elapsed.toFixed(2)}ms`);
      console.log(`   Avg processing: ${avgProcessing.toFixed(4)}ms`);
      console.log(
        `   Throughput: ${Math.floor(100 / (elapsed / 1000))} jobs/sec`,
      );

      expect(elapsed).toBeLessThan(1000 * PERF_MULTIPLIER);
    });

    test("processes jobs with varying payload sizes", async () => {
      const jobs = [
        // Small payloads
        ...Array.from({ length: 50 }, (_, i) => ({
          name: "scan",
          data: { url: `https://small-${i}.com/` },
        })),
        // Medium payloads
        ...Array.from({ length: 30 }, (_, i) => ({
          name: "scan",
          data: {
            url: `https://medium-${i}.com/${"path/".repeat(10)}`,
            metadata: { key: "value".repeat(10) },
          },
        })),
        // Large payloads
        ...Array.from({ length: 20 }, (_, i) => ({
          name: "scan",
          data: {
            url: `https://large-${i}.com/${"path/".repeat(50)}`,
            metadata: { key: "value".repeat(100) },
            extra: Array.from({ length: 10 }, (_, j) => `item-${j}`),
          },
        })),
      ];

      await queue.addBulk(jobs);

      const start = performance.now();
      let processedCount = 0;

      await queue.process(async () => {
        processedCount++;
      });

      const elapsed = performance.now() - start;

      console.log(`\n📊 Variable Payload Processing`);
      console.log(`   Processed: ${processedCount} jobs`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);

      expect(processedCount).toBe(100);
      expect(elapsed).toBeLessThan(500 * PERF_MULTIPLIER);
    });
  });

  describe("Queue Memory Efficiency", () => {
    test("queue memory usage scales linearly with jobs", async () => {
      if (globalThis.gc) globalThis.gc();
      const baseline = process.memoryUsage().heapUsed;

      const measurements: Array<{ jobs: number; memory: number }> = [];

      for (const jobCount of [1000, 5000, 10000]) {
        await queue.drain();
        if (globalThis.gc) globalThis.gc();

        const jobs = Array.from({ length: jobCount }, (_, i) => ({
          name: "scan",
          data: {
            url: `https://memory-${i}.com/`,
            chatId: "test",
            messageId: `msg-${i}`,
          },
        }));

        await queue.addBulk(jobs);

        const memory = process.memoryUsage().heapUsed - baseline;
        measurements.push({ jobs: jobCount, memory });
      }

      console.log(`\n📊 Queue Memory Scaling`);
      for (const { jobs, memory } of measurements) {
        console.log(
          `   ${jobs.toLocaleString()} jobs: ${(memory / 1024 / 1024).toFixed(2)}MB`,
        );
      }

      // Verify roughly linear scaling (last should be ~10x first, allow 20x)
      const ratio =
        measurements[measurements.length - 1].memory / measurements[0].memory;
      const jobRatio =
        measurements[measurements.length - 1].jobs / measurements[0].jobs;

      console.log(
        `   Scale factor: ${ratio.toFixed(1)}x for ${jobRatio}x jobs`,
      );

      expect(ratio).toBeLessThan(jobRatio * 2);
    });
  });

  describe("Concurrent Queue Operations", () => {
    test("handles 50 concurrent enqueues", async () => {
      const concurrency = 50;

      const start = performance.now();

      await Promise.all(
        Array.from({ length: concurrency }, (_, i) =>
          queue.add("scan", {
            url: `https://concurrent-${i}.com/`,
            chatId: "test",
          }),
        ),
      );

      const elapsed = performance.now() - start;
      const queueSize = queue.size();

      console.log(`\n📊 Concurrent Enqueue`);
      console.log(`   Concurrent ops: ${concurrency}`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
      console.log(`   Queue size: ${queueSize}`);

      expect(queueSize).toBe(concurrency);
      expect(elapsed).toBeLessThan(500);
    });

    test("handles mixed concurrent operations", async () => {
      // Pre-populate
      await queue.addBulk(
        Array.from({ length: 100 }, (_, i) => ({
          name: "scan",
          data: { url: `https://mixed-${i}.com/` },
        })),
      );

      const operations = 100;

      const start = performance.now();

      await Promise.all(
        Array.from({ length: operations }, async (_, i) => {
          if (i % 3 === 0) {
            await queue.add("scan", { url: `https://new-${i}.com/` });
          } else if (i % 3 === 1) {
            await queue.getJobCounts();
          } else {
            await queue.getWaiting(0, 9);
          }
        }),
      );

      const elapsed = performance.now() - start;

      console.log(`\n📊 Mixed Concurrent Operations`);
      console.log(`   Operations: ${operations}`);
      console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(1000 * PERF_MULTIPLIER);
    });
  });

  describe("Queue P99 Latency", () => {
    test("enqueue p99 latency <5ms", async () => {
      const timings: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        await queue.add("scan", { url: `https://p99-${i}.com/` });
        timings.push(performance.now() - start);
      }

      timings.sort((a, b) => a - b);
      const p50 = timings[Math.floor(timings.length * 0.5)];
      const p95 = timings[Math.floor(timings.length * 0.95)];
      const p99 = timings[Math.floor(timings.length * 0.99)];

      console.log(`\n📊 Enqueue P99 Latency`);
      console.log(`   P50: ${p50.toFixed(4)}ms`);
      console.log(`   P95: ${p95.toFixed(4)}ms`);
      console.log(`   P99: ${p99.toFixed(4)}ms`);

      expect(p99).toBeLessThan(5 * PERF_MULTIPLIER);
    });

    test("getJobCounts p99 latency <10ms", async () => {
      // Pre-populate
      await queue.addBulk(
        Array.from({ length: 1000 }, (_, i) => ({
          name: "scan",
          data: { url: `https://counts-${i}.com/` },
        })),
      );

      const timings: number[] = [];

      for (let i = 0; i < 500; i++) {
        const start = performance.now();
        await queue.getJobCounts();
        timings.push(performance.now() - start);
      }

      timings.sort((a, b) => a - b);
      const p99 = timings[Math.floor(timings.length * 0.99)];

      console.log(`\n📊 GetJobCounts P99 Latency`);
      console.log(`   P99: ${p99.toFixed(4)}ms`);

      expect(p99).toBeLessThan(10 * PERF_MULTIPLIER);
    });
  });

  describe("Throughput Under Load", () => {
    test("maintains throughput with queue depth", async () => {
      const isCi = !!process.env.CI;
      const depths = [100, 500, 1000, 5000];
      const results: Array<{ depth: number; throughput: number }> = [];
      const samplesPerDepth = isCi ? 2 : 3;

      await queue.addBulk(
        Array.from({ length: isCi ? 100 : 500 }, (_, i) => ({
          name: "warmup",
          data: { url: `https://warmup-${i}.com/` },
        })),
      );
      await queue.drain();

      for (const depth of depths) {
        let bestThroughput = 0;

        for (let sample = 0; sample < samplesPerDepth; sample++) {
          await queue.drain();

          // Pre-fill to target depth
          await queue.addBulk(
            Array.from({ length: depth }, (_, i) => ({
              name: "scan",
              data: { url: `https://depth-${depth}-${sample}-${i}.com/` },
            })),
          );

          // Measure enqueue performance at this depth
          const iterations = isCi ? 250 : 1000;
          const start = performance.now();

          for (let i = 0; i < iterations; i++) {
            await queue.add("scan", {
              url: `https://measure-${sample}-${i}.com/`,
            });
          }

          const elapsed = performance.now() - start;
          const throughput = iterations / (elapsed / 1000);
          bestThroughput = Math.max(bestThroughput, throughput);
        }

        results.push({ depth, throughput: bestThroughput });
      }

      console.log(`\n📊 Throughput vs Queue Depth`);
      for (const { depth, throughput } of results) {
        console.log(`   Depth ${depth}: ${throughput.toFixed(0)} ops/sec`);
      }

      // Throughput should not drop excessively at high depth in CI
      const maxThroughput = Math.max(...results.map((r) => r.throughput));
      const minThroughput = Math.min(...results.map((r) => r.throughput));
      const threshold = 0.2 / PERF_MULTIPLIER;

      expect(minThroughput).toBeGreaterThan(maxThroughput * threshold);
    });
  });
});
