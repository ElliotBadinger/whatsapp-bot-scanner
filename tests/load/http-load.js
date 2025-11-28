/*
 * Lightweight HTTP load harness for WhatsApp Scanner services.
 *
 * Usage:
 *   LOAD_TARGET_URL=http://localhost:8080/rescan \
 *   LOAD_DURATION_SECONDS=30 \
 *   LOAD_CONCURRENCY=50 \
 *   LOAD_METHOD=POST \
 *   LOAD_BODY='{"url": "http://example.com"}' \
 *   LOAD_HEADERS='Authorization: Bearer token,Content-Type: application/json' \
 *   node tests/load/http-load.js
 */

const { performance } = require("node:perf_hooks");
const { request } = require("undici");

const target = process.env.LOAD_TARGET_URL || "http://localhost:3001/healthz";
const durationSeconds = Number(process.env.LOAD_DURATION_SECONDS || "30");
const concurrency = Number(process.env.LOAD_CONCURRENCY || "50");
const method = process.env.LOAD_METHOD || "GET";
const body = process.env.LOAD_BODY || null;
const headerEnv = process.env.LOAD_HEADERS || "";

const headerTuples = headerEnv
  .split(",")
  .map((segment) => segment.trim())
  .filter(Boolean)
  .map((entry) => {
    const idx = entry.indexOf(":");
    if (idx === -1) return null;
    const name = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (!name || !value) return null;
    return [name, value];
  })
  .filter(Boolean);
const headers = Object.fromEntries(headerTuples);

if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
  console.error("LOAD_DURATION_SECONDS must be a positive number");
  process.exit(1);
}

if (!Number.isFinite(concurrency) || concurrency <= 0) {
  console.error("LOAD_CONCURRENCY must be a positive number");
  process.exit(1);
}

const endTime = Date.now() + durationSeconds * 1000;
const latencies = [];
let success = 0;
let failures = 0;
let statusCodes = {};

async function worker() {
  while (Date.now() < endTime) {
    const start = performance.now();
    try {
      const response = await request(target, {
        method,
        headers,
        body: body ? String(body) : undefined,
      });

      // Consume body to ensure request completes
      if (response.body && typeof response.body.text === "function") {
        await response.body.text();
      } else if (response.body && typeof response.body.resume === "function") {
        response.body.resume();
      }

      const latency = performance.now() - start;
      latencies.push(latency);

      const code = response.statusCode;
      statusCodes[code] = (statusCodes[code] || 0) + 1;

      if (code >= 200 && code < 300) {
        success += 1;
      } else {
        failures += 1;
      }
    } catch (err) {
      failures += 1;
      statusCodes["error"] = (statusCodes["error"] || 0) + 1;
    }
  }
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((percentileValue / 100) * sorted.length),
  );
  return sorted[index];
}

async function main() {
  console.log(`Starting load against ${target}`);
  console.log(`Duration: ${durationSeconds}s, Concurrency: ${concurrency}`);
  console.log(`Method: ${method}`);
  if (body) console.log(`Body: ${body}`);

  // Periodic status updates for long runs
  const statusInterval = setInterval(() => {
    const elapsed = (Date.now() - (endTime - durationSeconds * 1000)) / 1000;
    const remaining = Math.max(0, durationSeconds - elapsed);
    console.log(
      `[Status] Elapsed: ${elapsed.toFixed(0)}s, Remaining: ${remaining.toFixed(0)}s, Requests: ${success + failures}`,
    );

    // Suggest docker stats if running locally
    if (elapsed < 10) {
      console.log(
        'Tip: Run "docker stats" in another terminal to monitor resource usage.',
      );
    }
  }, 5000);

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  clearInterval(statusInterval);

  const totalRequests = success + failures;
  const throughput = totalRequests / durationSeconds;
  const p50 = percentile(latencies, 50);
  const p90 = percentile(latencies, 90);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const avg =
    latencies.reduce((sum, v) => sum + v, 0) / (latencies.length || 1);

  console.log("\n=== Load Test Summary ===");
  console.log(`Target: ${target}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Success: ${success}`);
  console.log(`Failures: ${failures}`);
  console.log(`Throughput: ${throughput.toFixed(2)} req/s`);
  console.log(`Avg latency: ${avg.toFixed(2)} ms`);
  console.log(`P50 latency: ${p50.toFixed(2)} ms`);
  console.log(`P90 latency: ${p90.toFixed(2)} ms`);
  console.log(`P95 latency: ${p95.toFixed(2)} ms`);
  console.log(`P99 latency: ${p99.toFixed(2)} ms`);
  console.log("Status Codes:", JSON.stringify(statusCodes, null, 2));
}

main().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
