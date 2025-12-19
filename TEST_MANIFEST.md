# Test Manifest

## File: packages/shared/src/**tests**/scoring.property.test.ts

- **Coverage:** scoring.ts 91.51% lines, 100% branches, 90% functions (coverage run with `--coverage`).
- **Test Count:** 10 property tests (10,000 randomized cases total).
- **Runtime:** ~7s without coverage, ~12s with coverage.
- **Edge Cases:** monotonic risk increases across threat signals (including VT malicious counts), verdict band consistency, reason de-duplication.
- **Discovered Issues:** coverage instrumentation required switching Jest to `coverageProvider: "v8"` for this workspace.
- **Flakiness:** 0/10 runs failed.

## File: packages/shared/src/**tests**/scoring.unit.test.ts

- **Coverage:** scoring.ts 77.12% lines, 63.26% branches (coverage run with `--coverage`).
- **Test Count:** 10 unit tests.
- **Runtime:** ~4s without coverage, ~11s with coverage.
- **Edge Cases:** domain-age bucket boundaries, redirect and URL length thresholds, heuristics-only reasons and override precedence, homoglyph risk "none", extraHeuristics port/IP/TLD detection.
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/external-apis.test.ts

- **Coverage:** index.ts 23.52% lines, 61.17% branches (coverage run with `--coverage`).
- **Test Count:** 6 integration tests.
- **Runtime:** ~7s without coverage, ~16s with coverage.
- **Edge Cases:** cache hit vs miss, GSB error path, VT 429 quota handling, Phishtank/URLhaus cache reuse.
- **Discovered Issues:** scan-orchestrator Jest coverage required `coverageProvider: "v8"`.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/scan-flow.e2e.test.ts

- **Coverage:** index.ts 19.46% lines, 54.83% branches (coverage run with `--coverage`).
- **Test Count:** 3 flow tests.
- **Runtime:** ~4s without coverage, ~15s with coverage.
- **Edge Cases:** fast verdict controls deep-scan enqueue, high-confidence enhanced security short-circuit.
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/index-helpers.test.ts

- **Coverage:** index.ts 23.46% lines, 83.87% branches (coverage run with `--coverage`).
- **Test Count:** 6 helper tests.
- **Runtime:** ~6s without coverage, ~11s with coverage.
- **Edge Cases:** verdict reason normalization, retry/error classification, urlscan artifact URL validation and de-duplication, provider state synthesis.
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## File: services/control-plane/src/**tests**/control-plane.test.ts

- **Coverage:** index.ts 68.07% lines, 70% branches (coverage run with `--coverage`).
- **Test Count:** 9 HTTP route tests.
- **Runtime:** ~7s without coverage, ~9s with coverage.
- **Edge Cases:** auth enforcement, override validation, rescan cache clearing/queueing, artifact parameter validation and traversal blocking.
- **Discovered Issues:** control-plane Jest coverage required `coverageProvider: "v8"`; added `.js` moduleNameMapper for TS imports.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/**tests**/debounce.test.ts

- **Coverage:** debounce.ts 100% lines/branches/functions (coverage run with `--coverage`).
- **Test Count:** 2 unit tests.
- **Runtime:** ~0.7s without coverage, ~1s with coverage.
- **Edge Cases:** interval suppression, concurrent invocation guard.
- **Discovered Issues:** wa-client Jest coverage required `coverageProvider: "v8"`.
- **Flakiness:** 0/10 runs failed.

## File: packages/shared/src/**tests**/reputation/local-threat-db.test.ts

- **Coverage:** local-threat-db.ts 83.65% lines, 78.26% branches (coverage run with `--coverage`).
- **Test Count:** 5 unit tests.
- **Runtime:** ~2.6s without coverage, ~6.9s with coverage.
- **Edge Cases:** OpenPhish feed parsing/normalization, collaborative scoring thresholds, feed errors, stats error fallback.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/**tests**/dataKeyProvider.test.ts

- **Coverage:** dataKeyProvider.ts 87.87% lines, 69.23% branches (coverage run with `--coverage`).
- **Test Count:** 4 unit tests.
- **Runtime:** ~0.7s without coverage, ~1.0s with coverage.
- **Edge Cases:** KMS/Vault/env key resolution, cache reuse, missing configuration error.
- **Discovered Issues:** Node emits Experimental VM Modules warning under ESM tests.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/**tests**/baileys-auth-store.test.ts

- **Coverage:** baileys-auth-store.ts 96.41% lines, 83.33% branches (coverage run with `--coverage`).
- **Test Count:** 4 unit tests.
- **Runtime:** ~1.3s without coverage, ~1.8s with coverage.
- **Edge Cases:** existing vs new creds, key store set/get/delete, session existence check.
- **Discovered Issues:** Node emits Experimental VM Modules warning under ESM tests.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/**tests**/pairing-orchestrator.test.ts

- **Coverage:** pairingOrchestrator.ts 74.41% lines, 73.01% branches (coverage run with `--coverage`).
- **Test Count:** 5 unit tests.
- **Runtime:** ~0.6s without coverage, ~1.0s with coverage.
- **Edge Cases:** success scheduling, rate-limit backoff, manual-only guard, max-attempt fallback/forced retry.
- **Discovered Issues:** Node emits Experimental VM Modules warning under ESM tests.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/blocklists.test.ts

- **Coverage:** blocklists.ts 93.89% lines, 66.66% branches (coverage run with `--coverage`).
- **Test Count:** 3 unit tests.
- **Runtime:** ~2.7s without coverage, ~7.2s with coverage.
- **Edge Cases:** GSB clean redundancy, disabled Phishtank path, fallback scenarios with errors/missing API key.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/control-plane/src/**tests**/database.test.ts

- **Coverage:** database.ts 76.92% lines (coverage run with `--coverage`).
- **Test Count:** 4 unit tests.
- **Runtime:** ~2.3s without coverage, ~6.7s with coverage.
- **Edge Cases:** migration lock behavior, pool re-use, retry handling.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/control-plane/src/**tests**/control-plane-extra.test.ts

- **Coverage:** index.ts 55.36% lines (coverage run with `--coverage`).
- **Test Count:** 7 HTTP route tests.
- **Runtime:** ~3.1s without coverage, ~8.3s with coverage.
- **Edge Cases:** scan request schema enforcement, admin auth errors, verdict cache invalidation.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/database.test.ts

- **Coverage:** database.ts 80.89% lines (coverage run with `--coverage`).
- **Test Count:** 5 unit tests.
- **Runtime:** ~2.4s without coverage, ~7.1s with coverage.
- **Edge Cases:** pool creation guard, health check behavior, teardown handling.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/enhanced-security.test.ts

- **Coverage:** enhanced-security.ts 86.98% lines (coverage run with `--coverage`).
- **Test Count:** 6 unit tests.
- **Runtime:** ~2.9s without coverage, ~8.1s with coverage.
- **Edge Cases:** VT positive ratios, early exits when disabled, evidence aggregation.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/index-coverage.test.ts

- **Coverage:** index.ts 39.58% lines (coverage run with `--coverage`).
- **Test Count:** 5 unit tests.
- **Runtime:** ~3.4s without coverage, ~8.2s with coverage.
- **Edge Cases:** cached verdict handling, degraded mode verdict generation, queue metrics updates.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/scan-worker.test.ts

- **Coverage:** overall 20.2% lines in scan-orchestrator for this focused run (coverage run with `--coverage`).
- **Test Count:** 4 unit tests.
- **Runtime:** ~3.2s without coverage, ~8.5s with coverage.
- **Edge Cases:** invalid job metrics, cached verdict short-circuit, deep-scan enqueue behavior.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/urlscan-artifacts.test.ts

- **Coverage:** urlscan-artifacts.ts 85.54% lines, 67.85% branches (coverage run with `--coverage`).
- **Test Count:** 3 unit tests.
- **Runtime:** ~3.7s without coverage, ~7.1s with coverage.
- **Edge Cases:** invalid identifier rejection, partial download failures, null screenshot handling.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/**tests**/verdict-generation.test.ts

- **Coverage:** overall 26.07% lines in scan-orchestrator for this focused run (coverage run with `--coverage`).
- **Test Count:** 5 unit tests.
- **Runtime:** ~3.9s without coverage, ~11.5s with coverage.
- **Edge Cases:** cached verdict routing, retry metrics, manual overrides, degraded mode queueing.
- **Discovered Issues:** ts-jest warns about deprecated `globals` config during runs.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/**tests**/admin-commands.test.ts

- **Coverage:** overall 27.56% lines in wa-client for this focused run (coverage run with `--coverage`).
- **Test Count:** 5 unit tests.
- **Runtime:** ~0.95s without coverage, ~1.5s with coverage.
- **Edge Cases:** non-admin rejection, command routing for mute/rescan/consent/pairing, unknown command fallback.
- **Discovered Issues:** Node emits Experimental VM Modules warning under ESM tests.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/**tests**/baileys-adapter-coverage.test.ts

- **Coverage:** baileys-adapter.ts 79.88% lines, 44% branches (coverage run with `--coverage`).
- **Test Count:** 8 unit tests.
- **Runtime:** ~0.53s without coverage, ~1.0s with coverage.
- **Edge Cases:** connection updates, message conversion, supported send paths, group membership operations.
- **Discovered Issues:** Node emits Experimental VM Modules warning under ESM tests.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/**tests**/index-coverage.test.ts

- **Coverage:** overall 61.07% lines in wa-client for this focused run (coverage run with `--coverage`).
- **Test Count:** 6 unit tests.
- **Runtime:** ~0.68s without coverage, ~1.3s with coverage.
- **Edge Cases:** pairing cache helpers, auth strategy resolution, verdict media attachments, ack retry scheduling.
- **Discovered Issues:** Node emits Experimental VM Modules warning under ESM tests.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/**tests**/index-helpers.test.ts

- **Coverage:** overall 35.61% lines in wa-client for this focused run (coverage run with `--coverage`).
- **Test Count:** 13 unit tests.
- **Runtime:** ~1.1s without coverage, ~1.5s with coverage.
- **Edge Cases:** pairing cache reads, consent tracking, allow-list matching, verdict messaging/attachments.
- **Discovered Issues:** Node emits Experimental VM Modules warning under ESM tests.
- **Flakiness:** 0/10 runs failed.

## File: packages/shared/src/__tests__/validation.test.ts

- **Coverage:** validation.ts 100% lines, 97.22% branches (coverage run with `--coverage`).
- **Test Count:** 32 unit tests.
- **Runtime:** ~3s without coverage, ~6s with coverage.
- **Edge Cases:** protocol validation (HTTP/HTTPS/FTP/file/javascript), private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x), IPv6 addresses, localhost blocking, suspicious TLD detection, URL length limits, custom rule addition, validateAndThrow behavior.
- **Discovered Issues:** IPv6 regex patterns don't match bracketed hostnames from URL parser.
- **Flakiness:** 0/10 runs failed.

## File: services/wa-client/src/__tests__/message-store.comprehensive.test.ts

- **Coverage:** message-store.ts 92% lines (coverage run with `--coverage`).
- **Test Count:** 23 unit tests.
- **Runtime:** ~1.5s without coverage, ~2s with coverage.
- **Edge Cases:** record CRUD operations, edit/revocation/reaction history limits (20/10/25), verdict attempt registration with metadata, pending ack context management, ack history tracking.
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## File: services/scan-orchestrator/src/__tests__/urlscan-artifacts.test.ts (Updated)

- **Coverage:** urlscan-artifacts.ts 97.1% lines, 80.55% branches (coverage run with `--coverage`).
- **Test Count:** 8 unit tests.
- **Runtime:** ~3s without coverage, ~7s with coverage.
- **Edge Cases:** invalid identifier rejection, screenshot/DOM download failures, network errors, both downloads failing, URL hash format validation.
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## File: services/control-plane/src/__tests__/control-plane-extra.test.ts (Updated)

- **Coverage:** index.ts 89.26% lines (coverage run with `--coverage`).
- **Test Count:** 7 HTTP route tests.
- **Runtime:** ~6s without coverage, ~12s with coverage.
- **Edge Cases:** artifact 404 paths, rescan without chat context, mute/unmute validation, file access errors (ENOENT vs EACCES).
- **Discovered Issues:** None.
- **Flakiness:** 0/10 runs failed.

## Suite: npm run test:coverage (Updated Dec 2024)

- **Coverage Summary:**
  - packages/shared: 94.5% statements, 84.35% branches
  - services/scan-orchestrator: 88.93% statements, 82.06% branches
  - services/control-plane: 84.19% statements, 77.39% branches
  - services/wa-client: ~85% statements (estimated from individual test runs)
- **Total Tests:** 439 tests across all workspaces
- **Total Runtime:** ~35 seconds
- **Warnings:** ts-jest `globals` deprecation warning in scan-orchestrator/control-plane; Node Experimental VM Modules warning in wa-client tests; intermittent Jest worker exit warning in shared tests.
