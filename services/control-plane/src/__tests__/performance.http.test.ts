/**
 * @fileoverview HTTP endpoint load tests for control-plane
 *
 * Tests verify that HTTP endpoints meet performance targets under load.
 * Uses in-memory mocks to isolate HTTP layer performance.
 *
 * Performance Targets:
 * - Health check: <10ms
 * - Status endpoint: <50ms
 * - Metrics endpoint: <100ms
 * - Override creation: <100ms
 */

import { performance } from "node:perf_hooks";
import Fastify, { type FastifyInstance } from "fastify";
import {
  scoreFromSignals,
  normalizeUrl,
  urlHash,
  type Signals,
} from "@wbscanner/shared";

const runPerfBenchmarks = process.env.RUN_PERF_BENCH === "true";

(runPerfBenchmarks ? describe : describe.skip)(
  "HTTP Endpoint Performance Tests",
  () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });

      // Mock health endpoint
      app.get("/healthz", async () => ({ ok: true }));

      // Mock status endpoint with simulated DB query
      app.get("/status", async () => {
        // Simulate lightweight DB query
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          scans: 12345,
          malicious: 234,
        };
      });

      // Mock metrics endpoint
      app.get("/metrics", async (_req, reply) => {
        // Simulate metrics collection
        const metrics = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 12345
# HELP process_cpu_seconds_total Total CPU time
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 123.45`;
        reply.header("Content-Type", "text/plain");
        return metrics;
      });

      // Mock scan endpoint with full processing
      app.post("/scan", async (req) => {
        const { url } = req.body as { url: string };
        const normalized = normalizeUrl(url);
        if (!normalized) {
          return { error: "invalid_url" };
        }

        const hash = urlHash(normalized);
        const parsedUrl = new URL(normalized);

        const signals: Signals = {
          domainAgeDays: 100,
          urlLength: normalized.length,
        };

        const verdict = scoreFromSignals(signals);

        return {
          url: normalized,
          hash,
          verdict: verdict.level,
          score: verdict.score,
        };
      });

      // Mock override endpoint
      app.post("/overrides", async (req) => {
        const body = req.body as { url_hash?: string; status: string };
        // Simulate DB insert
        await new Promise((resolve) => setTimeout(resolve, 2));
        return { ok: true, id: `override_${Date.now()}` };
      });

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    describe("Health Check Performance", () => {
      test("health check responds in <10ms", async () => {
        const iterations = 100;
        const timings: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          const response = await app.inject({
            method: "GET",
            url: "/healthz",
          });
          timings.push(performance.now() - start);
          expect(response.statusCode).toBe(200);
        }

        const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
        const p99 = timings.sort((a, b) => a - b)[
          Math.floor(timings.length * 0.99)
        ];

        console.log(`\n📊 Health Check Performance`);
        console.log(`   Avg: ${avgMs.toFixed(2)}ms`);
        console.log(`   P99: ${p99.toFixed(2)}ms`);

        expect(avgMs).toBeLessThan(10);
      });

      test("health check handles 100 concurrent requests", async () => {
        const concurrency = 100;

        const start = performance.now();

        const responses = await Promise.all(
          Array.from({ length: concurrency }, () =>
            app.inject({ method: "GET", url: "/healthz" }),
          ),
        );

        const elapsed = performance.now() - start;

        console.log(`\n📊 Health Check Concurrency`);
        console.log(`   Requests: ${concurrency}`);
        console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
        console.log(
          `   Throughput: ${Math.floor(concurrency / (elapsed / 1000))} req/sec`,
        );

        expect(responses.every((r) => r.statusCode === 200)).toBe(true);
        expect(elapsed).toBeLessThan(1000);
      });
    });

    describe("Status Endpoint Performance", () => {
      test("status endpoint responds in <50ms", async () => {
        const iterations = 50;
        const timings: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          const response = await app.inject({
            method: "GET",
            url: "/status",
          });
          timings.push(performance.now() - start);
          expect(response.statusCode).toBe(200);
        }

        const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;

        console.log(`\n📊 Status Endpoint Performance`);
        console.log(`   Avg: ${avgMs.toFixed(2)}ms`);

        expect(avgMs).toBeLessThan(50);
      });
    });

    describe("Metrics Endpoint Performance", () => {
      test("metrics endpoint responds in <100ms", async () => {
        const iterations = 50;
        const timings: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          const response = await app.inject({
            method: "GET",
            url: "/metrics",
          });
          timings.push(performance.now() - start);
          expect(response.statusCode).toBe(200);
        }

        const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;

        console.log(`\n📊 Metrics Endpoint Performance`);
        console.log(`   Avg: ${avgMs.toFixed(2)}ms`);

        expect(avgMs).toBeLessThan(100);
      });

      test("metrics endpoint handles 50 concurrent requests", async () => {
        const concurrency = 50;

        const start = performance.now();

        const responses = await Promise.all(
          Array.from({ length: concurrency }, () =>
            app.inject({ method: "GET", url: "/metrics" }),
          ),
        );

        const elapsed = performance.now() - start;

        console.log(`\n📊 Metrics Concurrency`);
        console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);

        expect(responses.every((r) => r.statusCode === 200)).toBe(true);
        expect(elapsed).toBeLessThan(2000);
      });
    });

    describe("Scan Endpoint Performance", () => {
      test("scan endpoint processes single URL in <50ms", async () => {
        const iterations = 100;
        const timings: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          const response = await app.inject({
            method: "POST",
            url: "/scan",
            payload: { url: `https://example${i}.com/path/${i}` },
          });
          timings.push(performance.now() - start);
          expect(response.statusCode).toBe(200);
        }

        const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
        const p99 = timings.sort((a, b) => a - b)[
          Math.floor(timings.length * 0.99)
        ];

        console.log(`\n📊 Scan Endpoint Performance`);
        console.log(`   Avg: ${avgMs.toFixed(2)}ms`);
        console.log(`   P99: ${p99.toFixed(2)}ms`);

        expect(avgMs).toBeLessThan(50);
      });

      test("scan endpoint handles 50 concurrent requests", async () => {
        const concurrency = 50;
        const urls = Array.from(
          { length: concurrency },
          (_, i) => `https://concurrent-test-${i}.com/path`,
        );

        const start = performance.now();

        const responses = await Promise.all(
          urls.map((url) =>
            app.inject({
              method: "POST",
              url: "/scan",
              payload: { url },
            }),
          ),
        );

        const elapsed = performance.now() - start;
        const successCount = responses.filter(
          (r) => r.statusCode === 200,
        ).length;

        console.log(`\n📊 Scan Concurrency`);
        console.log(`   Requests: ${concurrency}`);
        console.log(`   Success: ${successCount}`);
        console.log(`   Elapsed: ${elapsed.toFixed(2)}ms`);
        console.log(
          `   Avg per request: ${(elapsed / concurrency).toFixed(2)}ms`,
        );

        expect(successCount).toBe(concurrency);
        expect(elapsed).toBeLessThan(5000);
      });

      test("scan endpoint throughput >100 req/sec", async () => {
        const targetDuration = 1000; // 1 second
        let count = 0;
        const end = performance.now() + targetDuration;

        while (performance.now() < end) {
          await app.inject({
            method: "POST",
            url: "/scan",
            payload: { url: `https://throughput-${count}.com/` },
          });
          count++;
        }

        const throughput = count / (targetDuration / 1000);

        console.log(`\n📊 Scan Throughput`);
        console.log(`   Requests in 1s: ${count}`);
        console.log(`   Throughput: ${throughput.toFixed(0)} req/sec`);

        expect(throughput).toBeGreaterThan(100);
      });
    });

    describe("Override Endpoint Performance", () => {
      test("override creation responds in <100ms", async () => {
        const iterations = 50;
        const timings: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          const response = await app.inject({
            method: "POST",
            url: "/overrides",
            payload: {
              url_hash: `hash_${i}`,
              status: "allow",
            },
          });
          timings.push(performance.now() - start);
          expect(response.statusCode).toBe(200);
        }

        const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;

        console.log(`\n📊 Override Creation Performance`);
        console.log(`   Avg: ${avgMs.toFixed(2)}ms`);

        expect(avgMs).toBeLessThan(100);
      });
    });

    describe("Request Payload Size Impact", () => {
      test("handles small payloads efficiently", async () => {
        const smallPayload = { url: "https://example.com/" };

        const iterations = 100;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          await app.inject({
            method: "POST",
            url: "/scan",
            payload: smallPayload,
          });
        }

        const elapsed = performance.now() - start;
        const avgMs = elapsed / iterations;

        console.log(`\n📊 Small Payload Performance`);
        console.log(
          `   Payload size: ${JSON.stringify(smallPayload).length} bytes`,
        );
        console.log(`   Avg: ${avgMs.toFixed(2)}ms`);

        expect(avgMs).toBeLessThan(20);
      });

      test("handles large URLs efficiently", async () => {
        const longPath = "a".repeat(1000);
        const largePayload = { url: `https://example.com/${longPath}` };

        const iterations = 50;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          await app.inject({
            method: "POST",
            url: "/scan",
            payload: largePayload,
          });
        }

        const elapsed = performance.now() - start;
        const avgMs = elapsed / iterations;

        console.log(`\n📊 Large Payload Performance`);
        console.log(
          `   Payload size: ${JSON.stringify(largePayload).length} bytes`,
        );
        console.log(`   Avg: ${avgMs.toFixed(2)}ms`);

        expect(avgMs).toBeLessThan(50);
      });
    });

    describe("Sustained Load Performance", () => {
      test("maintains performance over 500 requests", async () => {
        const totalRequests = 500;
        const batchSize = 50;
        const batchTimings: number[] = [];

        for (let batch = 0; batch < totalRequests / batchSize; batch++) {
          const start = performance.now();

          await Promise.all(
            Array.from({ length: batchSize }, (_, i) =>
              app.inject({
                method: "POST",
                url: "/scan",
                payload: { url: `https://sustained-${batch}-${i}.com/` },
              }),
            ),
          );

          batchTimings.push(performance.now() - start);
        }

        const avgBatchTime =
          batchTimings.reduce((a, b) => a + b, 0) / batchTimings.length;
        const firstBatch = batchTimings[0];
        const lastBatch = batchTimings[batchTimings.length - 1];
        const degradation = ((lastBatch - firstBatch) / firstBatch) * 100;

        console.log(`\n📊 Sustained Load Performance`);
        console.log(`   Total requests: ${totalRequests}`);
        console.log(`   Batches: ${batchTimings.length}`);
        console.log(`   Avg batch time: ${avgBatchTime.toFixed(2)}ms`);
        console.log(`   First batch: ${firstBatch.toFixed(2)}ms`);
        console.log(`   Last batch: ${lastBatch.toFixed(2)}ms`);
        console.log(`   Degradation: ${degradation.toFixed(1)}%`);

        // Performance should not degrade more than 50%
        expect(degradation).toBeLessThan(50);
      });
    });

    describe("P99 Latency Tests", () => {
      test("health check p99 latency <20ms", async () => {
        const timings: number[] = [];

        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          await app.inject({ method: "GET", url: "/healthz" });
          timings.push(performance.now() - start);
        }

        timings.sort((a, b) => a - b);
        const p99 = timings[Math.floor(timings.length * 0.99)];

        console.log(`\n📊 Health Check P99`);
        console.log(`   P99: ${p99.toFixed(2)}ms`);

        expect(p99).toBeLessThan(20);
      });

      test("scan endpoint p99 latency <100ms", async () => {
        const timings: number[] = [];

        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          await app.inject({
            method: "POST",
            url: "/scan",
            payload: { url: `https://p99-test-${i}.com/` },
          });
          timings.push(performance.now() - start);
        }

        timings.sort((a, b) => a - b);
        const p99 = timings[Math.floor(timings.length * 0.99)];

        console.log(`\n📊 Scan Endpoint P99`);
        console.log(`   P99: ${p99.toFixed(2)}ms`);

        expect(p99).toBeLessThan(100);
      });
    });
  },
);
