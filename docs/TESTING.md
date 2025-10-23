# Testing Guide

## Automated Test Suites

| Suite | Command | Scope |
|-------|---------|-------|
| Unit (shared package) | `npm --workspace packages/shared test` | URL utilities, scoring, reputation helpers |
| Integration | `npm run test:integration` | Mocked blocklists, VT throttling, Redis/PG persistence, circuit breakers |
| E2E | `npm run test:e2e` | WhatsApp message → verdict formatting, admin controls, control-plane APIs |

Run `npm test --workspaces` before committing to execute all suites. For a fast pre-commit check that finishes in under two minutes, use `npm run test:fast` (integration + e2e).

## Coverage Expectations

- Core scoring logic: ≥90% branch coverage.
- Rate limiting and quota enforcement: integration tests confirm throttling, delay metrics, and quota disablement.
- Shortener fallback and Safe Browsing mocks: ensures Unshorten → HEAD → library cascade with SSRF guard and GSB parsing stays stable.
- Cache and persistence flows: Redis caches are exercised end-to-end and control-plane overrides persist via Postgres inserts.

## Manual Smoke Checklist

1. Send benign and malicious URLs in a test group; confirm verdict latency under 15s.
2. Trigger `!scanner rescan <url>`; verify Control Plane responds `{ ok: true, urlHash, jobId }` and Redis keys removed (`redis-cli keys 'url:*<hash>*'`).
3. Retrieve urlscan artifacts via `/scans/<hash>/urlscan-artifacts/screenshot` and `/scans/<hash>/urlscan-artifacts/dom`; inspect files under `storage/urlscan-artifacts`.
4. Inspect Grafana dashboard (Operational) to confirm VT/Whois quota gauges and queue depth panels updating.
5. Verify Prometheus alerts (`/api/v1/alerts`) include quota exhaustion rules when gauges hit zero.
