# Test Manifest

## File: packages/shared/src/__tests__/scoring.property.test.ts
- **Coverage:** scoring.ts 91.51% lines, 100% branches, 90% functions (coverage run with `--coverage`).
- **Test Count:** 10 property tests (10,000 randomized cases total).
- **Runtime:** ~7s without coverage, ~12s with coverage.
- **Edge Cases:** monotonic risk increases across threat signals (including VT malicious counts), verdict band consistency, reason de-duplication.
- **Discovered Issues:** coverage instrumentation required switching Jest to `coverageProvider: "v8"` for this workspace.
- **Flakiness:** 0/10 runs failed.

## File: packages/shared/src/__tests__/scoring.unit.test.ts
- **Coverage:** scoring.ts 77.12% lines, 63.26% branches (coverage run with `--coverage`).
- **Test Count:** 10 unit tests.
- **Runtime:** ~4s without coverage, ~11s with coverage.
- **Edge Cases:** domain-age bucket boundaries, redirect and URL length thresholds, heuristics-only reasons and override precedence, homoglyph risk "none", extraHeuristics port/IP/TLD detection.
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/__tests__/external-apis.test.ts
- **Coverage:** index.ts 23.52% lines, 61.17% branches (coverage run with `--coverage`).
- **Test Count:** 6 integration tests.
- **Runtime:** ~7s without coverage, ~16s with coverage.
- **Edge Cases:** cache hit vs miss, GSB error path, VT 429 quota handling, Phishtank/URLhaus cache reuse.
- **Discovered Issues:** scan-orchestrator Jest coverage required `coverageProvider: "v8"`.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/__tests__/scan-flow.e2e.test.ts
- **Coverage:** index.ts 19.46% lines, 54.83% branches (coverage run with `--coverage`).
- **Test Count:** 3 flow tests.
- **Runtime:** ~4s without coverage, ~15s with coverage.
- **Edge Cases:** fast verdict controls deep-scan enqueue, high-confidence enhanced security short-circuit.
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/__tests__/index-helpers.test.ts
- **Coverage:** index.ts 23.46% lines, 83.87% branches (coverage run with `--coverage`).
- **Test Count:** 6 helper tests.
- **Runtime:** ~6s without coverage, ~11s with coverage.
- **Edge Cases:** verdict reason normalization, retry/error classification, urlscan artifact URL validation and de-duplication, provider state synthesis.
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## File: services/control-plane/src/__tests__/control-plane.test.ts
- **Coverage:** index.ts 68.07% lines, 70% branches (coverage run with `--coverage`).
- **Test Count:** 9 HTTP route tests.
- **Runtime:** ~7s without coverage, ~9s with coverage.
- **Edge Cases:** auth enforcement, override validation, rescan cache clearing/queueing, artifact parameter validation and traversal blocking.
- **Discovered Issues:** control-plane Jest coverage required `coverageProvider: "v8"`; added `.js` moduleNameMapper for TS imports.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/__tests__/debounce.test.ts
- **Coverage:** debounce.ts 100% lines/branches/functions (coverage run with `--coverage`).
- **Test Count:** 2 unit tests.
- **Runtime:** ~0.7s without coverage, ~1s with coverage.
- **Edge Cases:** interval suppression, concurrent invocation guard.
- **Discovered Issues:** wa-client Jest coverage required `coverageProvider: "v8"`.
- **Flakiness:** 0/10 runs failed.
