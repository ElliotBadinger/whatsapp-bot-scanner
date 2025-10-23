#!/usr/bin/env node
/*
 * Lightweight HTTP load harness for WhatsApp Scanner services.
 *
 * Usage:
 *   LOAD_TARGET_URL=http://localhost:3001/healthz \
 *   LOAD_DURATION_SECONDS=30 \
 *   LOAD_CONCURRENCY=50 \
 *   node tests/load/http-load.js
 */

const { performance } = require('node:perf_hooks');
const { request } = require('undici');

const target = process.env.LOAD_TARGET_URL || 'http://localhost:3001/healthz';
const durationSeconds = Number(process.env.LOAD_DURATION_SECONDS || '30');
const concurrency = Number(process.env.LOAD_CONCURRENCY || '50');
const headerEnv = process.env.LOAD_HEADERS || '';
const headerTuples = headerEnv
  .split(',')
  .map((segment) => segment.trim())
  .filter(Boolean)
  .map((entry) => {
    const idx = entry.indexOf(':');
    if (idx === -1) return null;
    const name = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (!name || !value) return null;
    return [name, value];
  })
  .filter(Boolean);
const headers = Object.fromEntries(headerTuples);

if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
  console.error('LOAD_DURATION_SECONDS must be a positive number');
  process.exit(1);
}

if (!Number.isFinite(concurrency) || concurrency <= 0) {
  console.error('LOAD_CONCURRENCY must be a positive number');
  process.exit(1);
}

const endTime = Date.now() + durationSeconds * 1000;
const latencies = [];
let success = 0;
let failures = 0;

async function worker() {
  while (Date.now() < endTime) {
    const start = performance.now();
    try {
      const response = await request(target, { method: 'GET', headers });
      if (response.body && typeof response.body.text === 'function') {
        await response.body.text();
      } else if (response.body && typeof response.body.resume === 'function') {
        response.body.resume();
      }
      const latency = performance.now() - start;
      latencies.push(latency);
      success += 1;
    } catch (err) {
      failures += 1;
    }
  }
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((percentileValue / 100) * sorted.length));
  return sorted[index];
}

async function main() {
  console.log(`Starting load against ${target}`);
  console.log(`Duration: ${durationSeconds}s, Concurrency: ${concurrency}`);

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalRequests = success + failures;
  const throughput = totalRequests / durationSeconds;
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const avg = latencies.reduce((sum, v) => sum + v, 0) / (latencies.length || 1);

  console.log('\n=== Load Test Summary ===');
  console.log(`Target: ${target}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Success: ${success}`);
  console.log(`Failures: ${failures}`);
  console.log(`Throughput: ${throughput.toFixed(2)} req/s`);
  console.log(`Avg latency: ${avg.toFixed(2)} ms`);
  console.log(`P50 latency: ${p50.toFixed(2)} ms`);
  console.log(`P95 latency: ${p95.toFixed(2)} ms`);
  console.log(`P99 latency: ${p99.toFixed(2)} ms`);
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
