# Testing Guide

## Automated Test Suites

| Suite | Command | Scope |
|-------|---------|-------|
<<<<<<< HEAD
| Unit (shared package) | `npm --workspace packages/shared test` | URL utilities, scoring, circuit breaker, reputation helpers |
| Integration | `npm --workspace tests/integration test` | Mocked blocklists, rate limiting, manual overrides, shortener fallback |
| E2E | `npm --workspace tests/e2e test` | WhatsApp message → verdict flow, admin controls |
| Load smoke | `npm run test:load` | Exercise Control Plane rate limiting and queue backpressure via HTTP flood |
=======
| Unit (shared package) | `npm --workspace packages/shared test` | URL utilities, scoring, reputation helpers |
| Integration | `npm run test:integration` | Mocked blocklists, VT throttling, Redis/PG persistence, circuit breakers |
| E2E | `npm run test:e2e` | WhatsApp message → verdict formatting, admin controls, control-plane APIs |
>>>>>>> origin/codex/add-integration-and-e2e-tests

Run `npm test --workspaces` before committing to execute all suites. For a fast pre-commit check that finishes in under two minutes, use `npm run test:fast` (integration + e2e).

## Coverage Expectations

- Core scoring logic: ≥90% branch coverage.
<<<<<<< HEAD
- Rate limiting and quota enforcement: integration tests confirm throttling, quota disablement, and urlscan submission pacing.
- Shortener fallback: ensures Unshorten → HEAD → library cascade with SSRF guard.
- Circuit breaker transitions: shared unit tests assert open/half-open/closed recovery and exponential retry strategy.
=======
- Rate limiting and quota enforcement: integration tests confirm throttling, delay metrics, and quota disablement.
- Shortener fallback and Safe Browsing mocks: ensures Unshorten → HEAD → library cascade with SSRF guard and GSB parsing stays stable.
- Cache and persistence flows: Redis caches are exercised end-to-end and control-plane overrides persist via Postgres inserts.
>>>>>>> origin/codex/add-integration-and-e2e-tests

## Manual Smoke Checklist

1. Send benign and malicious URLs in a test group; confirm verdict latency under 15s.
<<<<<<< HEAD
<<<<<<< HEAD
2. Issue `!scanner mute`/`!scanner status`/`!scanner unmute` to validate admin command responses and 60-minute mute TTL.
3. Trigger `!scanner rescan <url>`; verify Control Plane responds `{ ok: true }` and Redis keys removed (`redis-cli keys 'url:*<hash>*'`).
4. Retrieve urlscan artifacts via `/artifacts/<hash>/screenshot` and `/artifacts/<hash>/dom`; inspect files under `storage/urlscan-artifacts`.
5. Inspect Grafana dashboard (Operational) to confirm VT/Whois quota gauges, circuit breaker panels, and queue depth visualizations updating.
6. Verify Prometheus alerts (`/api/v1/alerts`) include quota and queue-depth rules when gauges breach thresholds.
=======
2. Trigger `!scanner rescan <url>`; verify Control Plane responds `{ ok: true }` and Redis keys removed (`redis-cli keys 'url:*<hash>*'`).
3. Retrieve urlscan artifacts via `/scans/<hash>/urlscan-artifacts/screenshot` and `/scans/<hash>/urlscan-artifacts/dom`; inspect files under `storage/urlscan-artifacts`.
=======
2. Trigger `!scanner rescan <url>`; verify Control Plane responds `{ ok: true, urlHash, jobId }` and Redis keys removed (`redis-cli keys 'url:*<hash>*'`).
3. Retrieve urlscan artifacts via `/artifacts/<hash>/screenshot` and `/artifacts/<hash>/dom`; inspect files under `storage/urlscan-artifacts`.
>>>>>>> origin/codex/implement-rescan-job-and-workflows
4. Inspect Grafana dashboard (Operational) to confirm VT/Whois quota gauges and queue depth panels updating.
5. Verify Prometheus alerts (`/api/v1/alerts`) include quota exhaustion rules when gauges hit zero.
>>>>>>> origin/codex/add-urlscan-artifact-paths-and-handlers
