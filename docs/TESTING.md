# Testing Guide

## Automated Test Suites

| Suite | Command | Scope |
|-------|---------|-------|
| Unit (shared package) | `npm --workspace packages/shared test` | URL utilities, scoring, circuit breaker, reputation helpers |
| Integration | `npm --workspace tests/integration test` | Mocked blocklists, rate limiting, manual overrides, shortener fallback |
| E2E | `npm --workspace tests/e2e test` | WhatsApp message → verdict flow, admin controls |
| Load smoke | `npm run test:load` | Exercise Control Plane rate limiting and queue backpressure via HTTP flood |

Run `npm test --workspaces` before committing to execute all suites.

## Coverage Expectations

- Core scoring logic: ≥90% branch coverage.
- Rate limiting and quota enforcement: integration tests confirm throttling, quota disablement, and urlscan submission pacing.
- Shortener fallback: ensures Unshorten → HEAD → library cascade with SSRF guard.
- Circuit breaker transitions: shared unit tests assert open/half-open/closed recovery and exponential retry strategy.

## Manual Smoke Checklist

1. Send benign and malicious URLs in a test group; confirm verdict latency under 15s.
2. Issue `!scanner mute`/`!scanner status`/`!scanner unmute` to validate admin command responses and 60-minute mute TTL.
3. Trigger `!scanner rescan <url>`; verify Control Plane responds `{ ok: true }` and Redis keys removed (`redis-cli keys 'url:*<hash>*'`).
4. Retrieve urlscan artifacts via `/artifacts/<hash>/screenshot` and `/artifacts/<hash>/dom`; inspect files under `storage/urlscan-artifacts`.
5. Inspect Grafana dashboard (Operational) to confirm VT/Whois quota gauges, circuit breaker panels, and queue depth visualizations updating.
6. Verify Prometheus alerts (`/api/v1/alerts`) include quota and queue-depth rules when gauges breach thresholds.
