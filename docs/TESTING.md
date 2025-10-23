# Testing Guide

## Automated Test Suites

| Suite | Command | Scope |
|-------|---------|-------|
| Unit (shared package) | `npm --workspace packages/shared test` | URL utilities, scoring, reputation helpers |
| Integration | `npm --workspace tests/integration test` | Mocked blocklists, rate limiting, shortener fallback |
| E2E | `npm --workspace tests/e2e test` | WhatsApp message → verdict flow, admin controls |

Run `npm test --workspaces` before committing to execute all suites.

## Coverage Expectations

- Core scoring logic: ≥90% branch coverage.
- Rate limiting and quota enforcement: integration tests confirm throttling and quota disablement.
- Shortener fallback: ensures Unshorten → HEAD → library cascade with SSRF guard.

## Manual Smoke Checklist

1. Send benign and malicious URLs in a test group; confirm verdict latency under 15s.
2. Trigger `!scanner rescan <url>`; verify Control Plane responds `{ ok: true }` and Redis keys removed (`redis-cli keys 'url:*<hash>*'`).
3. Retrieve urlscan artifacts via `/artifacts/<hash>/screenshot` and `/artifacts/<hash>/dom`; inspect files under `storage/urlscan-artifacts`.
4. Inspect Grafana dashboard (Operational) to confirm VT/Whois quota gauges and queue depth panels updating.
5. Verify Prometheus alerts (`/api/v1/alerts`) include quota exhaustion rules when gauges hit zero.
