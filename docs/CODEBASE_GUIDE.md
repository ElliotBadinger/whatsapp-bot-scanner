# Codebase Internal Guide

_Last updated: October 29, 2025. Keep this file current when you add new integrations or change service boundaries._

## How to Use This Document

- Start with the **Architecture Snapshot** for a mental model of the runtime topology.
- Jump to the service or package you are touching to understand the call graph, supporting queues, and persistence guarantees.
- Use the **Extension Playbooks** sections when wiring new reputation sources, heuristics, or Fastify routes.
- Cross‑reference the existing docs in this folder for security, cost, and runbook specifics; this guide focuses on “how the code works.”

## Architecture Snapshot

The system is three Fastify services, a shared TypeScript library, and supporting infrastructure (Redis, Postgres, Prometheus, Grafana, nginx). Everything is wired together through BullMQ queues in Redis and the helpers exported from `@wbscanner/shared` (`packages/shared`).

```
WhatsApp -> wa-client  --scan-request-->  scan-orchestrator  --scan-verdict-->  wa-client
                                    \--urlscan--> urlscan worker -> callback -> scan-orchestrator
```

- **Queues** live in Redis under names configured by `SCAN_REQUEST_QUEUE`, `SCAN_VERDICT_QUEUE`, and `SCAN_URLSCAN_QUEUE` (defaults: `scan-request`, `scan-verdict`, `scan-urlscan`).
- **Redis** also backs short‑term storage for message metadata, URL analysis caches, remote authentication blobs, rate limiters, and consent governance state.
- **Postgres** keeps durable scan records, message → verdict joins, overrides, quotas, group metadata, urlscan artifacts, and audit logs (`db/migrations`).
- **File storage**:
  - `storage/urlscan-artifacts` holds DOM dumps + screenshots pulled by the orchestrator.
  - `services/wa-client` writes RemoteAuth snapshots to Redis, not disk, when the encrypted store is enabled.

## Services

### WA Client – `services/wa-client`

**Purpose.** Manages the WhatsApp session (`whatsapp-web.js`), enforces onboarding consent, extracts URLs, queues scans, consumes verdicts, and exposes operational endpoints.

**Entrypoint.** `services/wa-client/src/index.ts` wires Fastify, the WhatsApp client, and BullMQ workers. Startup asserts configuration via `assertEssentialConfig` and `assertControlPlaneToken`, refreshes consent gauges, resolves remote auth, and initializes the client before registering event handlers.

#### Message ingestion pipeline

1. `client.on('message_create', …)` parses each inbound message (`services/wa-client/src/index.ts:954`).
   - Tracks per‑chat consent (`getConsentStatus`), drops non‑group chats, and deduplicates URLs using a Redis idempotency key `wa:processed:<chat>:<msg>:<hash>`.
   - Normalizes URLs with `normalizeUrl` and checks host allowlists via `isUrlAllowedForScanning`, which wraps `isForbiddenHostname` (`packages/shared/src/url.ts`).
   - Applies global reply rate limiting through `RateLimiterRedis` + `createGlobalTokenBucket` (`services/wa-client/src/limiters.ts`).
   - Enqueues jobs on `scan-request` with the chat/message context and sender hash; BullMQ options limit retries and set exponential backoff.
   - Persists message metadata and URL hashes through `MessageStore.recordMessageCreate` (`services/wa-client/src/message-store.ts:52`), giving later edits/reactions a consistent view.

2. `client.on('message_edit', …)` re-evaluates URLs, compares against the existing hash list, and queues rescans only for newly introduced URLs (`services/wa-client/src/index.ts:1104`).

3. `client.on('message_revoke_me/for_me', …)` tracks deletions (`MessageStore.appendRevocation`), ensuring future governance or replay logic knows the message was retracted.

#### Verdict delivery

- BullMQ worker `new Worker(config.queues.scanVerdict, …)` consumes verdict payloads (`services/wa-client/src/index.ts:1432`).
- Message duplication prevention relies on a Redis key `verdict:<chatId>:<urlHash>` and per-group token buckets before actually sending.
- `deliverVerdictMessage` replies to the original WhatsApp message when possible, formats the summary (`formatGroupVerdict`), reacts with ⚠️ for malicious results, and conditionally uploads:
  - urlscan screenshot (PNG) and DOM artifacts packaged as documents if attachments are flagged in the verdict payload.
  - IOC detail text file constructed in `collectVerdictMedia` (`services/wa-client/src/index.ts:356`).
- `MessageStore.registerVerdictAttempt` records ack status, attachments, and redirect chains — providing durable telemetry for health endpoints and debugging.

#### Group governance & admin commands

- Consent, mute, and governance data is cached in Redis via `GroupStore` (`services/wa-client/src/group-store.ts:7`) and helper functions in `groupGovernance.ts`.
- `handleAdminCommand` interprets `!scanner` directives (`services/wa-client/src/index.ts:1585`):
  - `mute/unmute` toggle Postgres `groups.muted_until` through the control-plane API.
  - `rescan` invalidates Redis caches and requeues priority jobs.
  - `consent` flips the consent flag, re-enables messaging, and appends an audit event.
  - `approve` surfaces membership approvals by bridging to the WhatsApp API.
  - `governance` dumps the recent Redis audit log for transparency.
- Event listeners `group_join`, `group_leave`, `group_admin_changed`, and `group_update` track membership churn and governance actions, writing capped lists to Redis for runbook visibility.

#### Remote authentication & crypto

- `resolveAuthStrategy` toggles LocalAuth vs RemoteAuth (Redis store).
- Encryption materials are lazily derived in `loadEncryptionMaterials` with either KMS, Vault transit, or a base64 key (`services/wa-client/src/crypto/dataKeyProvider.ts:53`). AES‑GCM + HMAC sealing is defined in `secureEnvelope.ts`.
- `RedisRemoteAuthStore` wraps encrypted ZIP storage for session handoffs (`services/wa-client/src/remoteAuthStore.ts:25`).
- Automatic phone pairing retries leverage `client.requestPairingCode` with configurable cooldowns. Fallback to QR is logged and metrics (`metrics.waSessionReconnects`) track reconnects.

#### Rate limiting & safety

- Global token bucket: `createGlobalTokenBucket` enforces an hourly send limit per deployment. Per-group hourly + burst controls rely on `RateLimiterRedis` instances scoped per chat.
- Forbidden hostnames are enforced before queueing using `WA_FORBIDDEN_HOSTNAMES`, complementing SSRF protections already present in URL expansion.
- Additional watchdog metrics (`waSessionStatusGauge`, `waMessagesDropped`, `waIncomingCalls`) expose WhatsApp client health for Grafana.

#### HTTP surface

- `Fastify` instance exposes `/healthz` and `/metrics`. Health includes consent and remote-auth telemetry.
- There is no expansive public API; all administrative action occurs via WhatsApp commands or the control-plane service.

### Scan Orchestrator – `services/scan-orchestrator`

**Purpose.** Validates and enriches URLs, performs reputation lookups, computes risk scores, persists outcomes, triggers urlscan.io submissions, and pushes verdicts back to WhatsApp.

**Entrypoint.** `services/scan-orchestrator/src/index.ts` configures Redis, Postgres, queue metrics, and BullMQ workers.

#### Workers & queues

- `scan-request` worker (`services/scan-orchestrator/src/index.ts:901`) handles JSON jobs `{chatId,messageId,url, timestamp, rescan}`:
  1. Checks Redis cache `scan:<hash>`; if present, short-circuits and re-emits the cached verdict to `scan-verdict` to bound latency and Redis load.
  2. Expands shorteners via `resolveShortenerWithCache`, merges redirect chains from both the shortener and HTTP HEAD expansion (`packages/shared/src/url.ts:30`).
  3. Executes blocklist redundancy (`checkBlocklistsWithRedundancy`) covering Google Safe Browsing and Phishtank with fallback heuristics (`services/scan-orchestrator/src/blocklists.ts:47`).
  4. Queries URLhaus, VirusTotal (through an internal Bottleneck rate limiter), WhoisXML (after RDAP check), and homogenizes signals.
  5. Derives heuristics (`extraHeuristics`) such as suspicious TLDs, IP literals, executable extensions, shortener misdirection, and homoglyph risk (`packages/shared/src/scoring.ts:33`).
  6. Evaluates manual overrides (`loadManualOverride`) for url‑hash or hostname matches prior to scoring, guaranteeing deterministic allow/deny behaviour.
  7. Generates a `RiskVerdict` (score, level, reasons, cache TTL) via `scoreFromSignals`.
  8. Persists scan metadata into Postgres `scans` and `messages` tables with UPSERT semantics and TTL fields for caching. TTL selection factors in verdict severity and `config.orchestrator.cacheTtl`.
  9. Writes cached responses to Redis (`scan:<hash>` et al.) for reuse and observational metrics (cache hit ratios, entry size, TTL) through `metrics.cache*` gauges.
  10. Enqueues urlscan.io submissions when configured and the verdict is suspicious/malicious.
- `scan-verdict` queue is only produced here; consumption happens inside the WA client worker noted above.
- `scan-urlscan` worker (`services/scan-orchestrator/src/index.ts:1211`) submits URLs to urlscan.io, records UUIDs in Redis for callback correlation, updates `scans.urlscan_*` columns, and respects concurrency/ circuit breaker thresholds.

#### urlscan callback handler

- Fastify route `/urlscan/callback` validates the shared secret, sanitizes artifact URLs to prevent arbitrary file fetch, and refreshes stored scan records before downloading artifacts via `downloadUrlscanArtifacts` (`services/scan-orchestrator/src/urlscan-artifacts.ts:9`).
- Artifact downloads enforce host allowlists (`config.urlscan.allowedArtifactHosts`), 10s timeouts, and content‑type guard rails; failures increment Prometheus counters for alerting.

#### Circuit breaking & retries

- Each external integration (GSB, VirusTotal, urlscan, WhoisXML, Phishtank, URLhaus) has a dedicated `CircuitBreaker` (`packages/shared/src/circuit-breaker.ts:20`).
- `withRetry` applies exponential backoff, logging non-retryable errors and surfacing quota exhaustion via `QuotaExceededError`. Open circuits emit metrics (`circuitStates`, `circuitBreakerTransitionCounter`) and degrade gracefully by marking the scan as “degraded mode.”

#### Caching strategy

- Redis keys share the prefix `url:analysis:<hash>:<provider>` for per-provider caches and `url:shortener:<hash>` for resolved shorteners.
- Cache instrumentation (hit/miss counts, stale detection, latency) is emitted on every lookup; stale determination kicks in when TTL < 20% of the intended cache window.
- Verdict caching stores the entire payload, including reasons, score, redirect chain, and attachments metadata for the WA client to reuse.

#### Persistence

- Postgres writes rely on the connection pool defined near the top of the file. Insert/update statements are intentionally tolerant of duplicates (ON CONFLICT DO NOTHING) to allow idempotent job retries.
- `scans` table columns map closely to orchestrator output (Verdict, TTL, urlscan artifact paths). Additional fields such as `whois_source` and `shortener_provider` are maintained for audit.

#### Metrics & health

- `/metrics` exposes Prometheus metrics registered in `packages/shared/src/metrics.ts` (queue depth, API utilization, cache ratios, verdict distribution).
- `queueMetricsInterval` polls BullMQ counts every 10 seconds to keep queue gauges fresh even without job throughput.
- Circuit open durations, quota projections, and homogenized reason codes (`normalizeVerdictReason`) back Grafana panels and alert thresholds defined under `observability/`.

### Control Plane – `services/control-plane`

**Purpose.** Provides authenticated administrative APIs, retrieval of urlscan artifacts, and background data hygiene.

**Entrypoint.** `services/control-plane/src/index.ts` bootstraps Fastify, Postgres, Redis, and queue handles with shared singletons to reduce connection churn.

#### Authentication & middleware

- `createAuthHook` ensures every protected route enforces the bearer token from `CONTROL_PLANE_API_TOKEN` (`assertControlPlaneToken`). Optional CSRF headers allow the bundled web UI to interact safely.

#### Routes

- `GET /healthz` & `GET /metrics` (Prometheus).
- `GET /status` aggregates basic scan totals (`scans` table).
- `POST /overrides` + `GET /overrides` persist manual allow/deny rules; overrides support URL hashes or hostname patterns with optional expiry.
- `POST /groups/:chatId/mute|unmute` updates `groups.muted_until`, consumed by the WA client consent logic.
- `POST /rescan` normalizes the provided URL, nukes Redis caches (`scan:`, `url:analysis:`, `url:shortener:`), identifies the most recent chat/message context, and enqueues a priority rescan job.
- `GET /scans/:hash/urlscan-artifacts/:type` streams stored screenshot (`image/png`) or DOM HTML while guarding against path traversal (`isWithinArtifactRoot`).

#### Background maintenance

- Daily cleanup (non-test only) deletes stale rows older than 30 days from `scans` and `messages`.

#### Dependencies

- Shares BullMQ queue connections with the orchestrator for rescans.
- Reads `storage/urlscan-artifacts` (relative to `URLSCAN_ARTIFACT_DIR`) for artifact streaming.

## Shared Packages

### `@wbscanner/shared` – `packages/shared`

This package centralizes configuration, logging, telemetry, and all security-conscious helpers.

- **Configuration loader** (`packages/shared/src/config.ts:6`). Parses `.env`, validates required secrets (control-plane token, urlscan callback when enabled), converts numeric fields, and exposes structured getters for Redis, Postgres, queue names, API quotas, features, and WA RemoteAuth.
- **Logging** (`packages/shared/src/log.ts:1`). Sets up `pino` with redaction rules to avoid leaking auth tokens and API keys.
- **Metrics** (`packages/shared/src/metrics.ts:1`). Declares all Prometheus counters/gauges/histograms used by services, including queue telemetry, cache health, API quota utilisation, verdict score distributions, WhatsApp session status, and governance actions. Each service simply imports this module to register with the shared registry.
- **URL helpers** (`packages/shared/src/url.ts:1`). Normalizes URLs (lowercases host, strips default ports/fragments/tracking params), extracts URLs from text, expands redirect chains (HEAD requests with SSRF guard), and identifies suspicious TLDs or known shorteners.
- **Shortener resolution** (`packages/shared/src/url-shortener.ts:1`). Attempts Unshorten.me first, then guarded fetches with hard SSRF protection (private host detection) and content-length limits. Emits metrics for method / result to monitor fallback behaviour.
- **SSRF guard** (`packages/shared/src/ssrf.ts:3`). Resolves DNS to block private ranges; failure is fail‑closed to err on the safe side.
- **Scoring & heuristics** (`packages/shared/src/scoring.ts:21`). Aggregates blocklist hits, VT stats, domain age, heuristics (long URL, suspicious TLD, uncommon port, homoglyph), and manual overrides into a bounded 0‑15 score with TTL hints.
- **Homoglyph detection** (`packages/shared/src/homoglyph.ts:1`). Uses the `confusable` dataset to classify domain lookalikes, flag mixed scripts, and annotate risk reasons for reporting.
- **Reputation connectors** (`packages/shared/src/reputation/*`). Each integration pairs fetch logic with metrics and quota enforcement:
  - `virustotal.ts` applies Bottleneck scheduling, jitter, and quota projection.
  - `gsb.ts` wraps threatMatches lookup.
  - `phishtank.ts`, `urlhaus.ts`, `whoisxml.ts`, `rdap.ts`, and `urlscan.ts` each encapsulate API request/response parsing and common retry semantics.
- **Circuit breaker utilities** (`packages/shared/src/circuit-breaker.ts:20`). Lightweight breaker with sliding window failure tracking and `withRetry` helper for exponential backoff.
- **Error types** (`packages/shared/src/errors.ts:1`). Distinguishes quota exhaustion and feature toggles.
- **Types** (`packages/shared/src/types`). Shared discriminated unions for queue payloads, urlscan responses, and verdict envelopes.

### `packages/confusable`

Tiny wrapper around the `confusable` dataset with type definitions, ensuring homoglyph detection works in strict TypeScript mode.

## Persistence Layer

### Postgres schema

Defined via `db/migrations` (run by `scripts/run-migrations.js`). Key tables:

- `scans`: canonical record of every URL (hash, normalized URL, verdict, score, TTL, blocklist hits, VT stats, domain intel, shortener provider, urlscan metadata, and artifact paths).
- `messages`: linking table tying chats/messages to URL hashes, verdicts, and delivery timestamps.
- `overrides`: manual allow/deny rules scoped globally or per group with optional expiry and audit metadata.
- `groups`: tracks consent status, muted state, and JSON settings payloads for future feature toggles.
- `quotas`: stores API consumption snapshots (WhoisXML monthly counts, etc.).
- `audit_logs`: structured log of admin actions triggered via control-plane or automated workflows.
- `urlscan_artifacts`: legacy binary store; kept for backward compatibility even though artifacts now live on disk with pointer columns (`urlscan_screenshot_path`, `urlscan_dom_path`).

### Redis keyspace

- `scan:<hash>` – cached verdict payloads.
- `url:analysis:<hash>:vt|gsb|phishtank|urlhaus|whois` – provider-specific analysis caches.
- `url:shortener:<hash>` – expanded shortener metadata.
- `wa:message:<chat>:<msg>` – serialized `MessageRecord` for WA message history.
- `wa:verdict:message:<verdictId>` – maps verdict messages back to original context.
- `wa:verdict:pending_ack` – set tracking unacknowledged verdict deliveries.
- `wa:group:*` keys – consent, auto-approve toggles, governance counts, invite rotation timestamps.
- `wa_global_rate:*`, per-group limiters – rate limiting tokens.
- `urlscan:uuid:<uuid>` – correlation of urlscan callbacks.

## Asynchronous Flow Details

1. **Message ingestion → scanning**
   - WA client enqueues `scan-request` jobs with deduped URL hashes.
   - Orchestrator consumes, caches, enriches, persists, and optionally enqueues urlscan.

2. **urlscan deep dive**
   - Orchestrator enqueues `scan-urlscan` jobs for suspicious links.
   - Worker submits to urlscan.io, stores UUID, updates DB.
   - Callback (webhook) downloads artifacts, writes file paths back to `scans`, updates caches.

3. **Verdict emission**
   - Orchestrator pushes to `scan-verdict` queue with chat/message context when known.
   - WA client worker enforces rate limits, ensures dedupe, delivers WhatsApp replies, tracks metrics, and registers verdict attempts.

4. **Rescans**
   - Triggered via control-plane API or CLI script. Clearing caches ensures the orchestrator recompute signals fresh rather than returning stale verdicts.

## Observability & Operations

- **Prometheus** configuration (`observability/prometheus.yml`) scrapes the three services, Redis, Postgres exporter, and BullMQ metrics. Alert rules in `observability/alerts.yml` cover queue backlogs, cache staleness, circuit open durations, quota depletion, WhatsApp disconnects, and verdict latency regressions.
- **Grafana** dashboards live in `grafana/dashboards`. Provisioning YAML in `grafana/provisioning/` auto-imports them when `make up` boots the stack.
- **Metrics of note**
  - `wbscanner_queue_job_wait_seconds` & `wbscanner_queue_processing_duration_seconds` – pipeline latency.
  - `wbscanner_api_quota_remaining` / `projected_depletion` – external service health.
  - `wbscanner_wa_session_status` – WhatsApp client readiness gauge (for alerting on disconnects).
  - `wbscanner_verdict_score` & `wbscanner_verdict_reasons_total` – feed anomaly detection panels.
- **Health checks**: every service publishes `/healthz` for docker-compose and `railway` deploys.
- **Reverse proxy**: `reverse-proxy/nginx.conf` routes control-plane traffic, enforcing TLS headers and buffering guidelines for large artifact downloads.

## Supporting Tooling & Scripts

- `Makefile` orchestrates Docker workflows (`make build/up/down/logs`).
- `scripts/run-migrations.js` & `scripts/run-seeds.js` provide CLI wrappers for applying migrations and seeds inside the container stack.
- `scripts/railway-smoke-test.sh` performs post-deploy curl checks against health endpoints.
- `scripts/validate-config.js` ensures `.env` completeness before boot.
- `scripts/export-wwebjs-docs.mjs` syncs WhatsApp automation doc stubs into `docs/exports/`.

## Testing & Quality Gates

- Unit tests live inside each workspace (`__tests__` folders) and leverage Jest config from `packages/shared/jest.config.js`.
- Higher-level suites under `tests/` are grouped by `e2e`, `integration`, `load`, and `stubs` to mock third-party APIs.
- The WA client includes targeted tests around message store behaviour to guard against regressions in dedupe logic and verdict attempts.
- CI expectation: run `npm test --workspaces` before opening PRs (see `docs/TESTING.md` for command matrix).

## Extension Playbooks

### Adding a new reputation provider

1. Implement the fetcher in `packages/shared/src/reputation/<provider>.ts`, returning structured data and latency.
2. Register quota/latency metrics in `packages/shared/src/metrics.ts` as needed.
3. Instantiate a `CircuitBreaker` in the orchestrator, mirroring the existing providers.
4. Wire fetch logic into the scan worker, update `scoreFromSignals` mapping, and add reasons to `normalizeVerdictReason`.
5. Create migrations if additional data needs to be persisted (e.g., provider-specific UUIDs).

### Introducing a new admin command

1. Extend the `handleAdminCommand` switch block (`services/wa-client/src/index.ts:1585`).
2. Surface a control-plane route when backend state changes are required.
3. Update `docs/ADMIN_COMMANDS.md` and add coverage to the WA client command handler tests.

### Adding a new queue consumer

1. Define queue name in `packages/shared/src/config.ts` with validation.
2. Instantiate the queue alongside existing ones in the relevant service.
3. Register queue metrics and integrate into the periodic `refreshQueueMetrics` poller.
4. Add Grafana/Prometheus rules if the queue’s SLO differs from existing ones.

## Quick Reference

- WhatsApp session data encryption: AES‑256‑GCM + HMAC (`services/wa-client/src/crypto/secureEnvelope.ts`).
- SSRF guard: DNS resolution + private CIDR reject (`packages/shared/src/ssrf.ts`).
- Cache key prefixes: `scan:`, `url:analysis:`, `url:shortener:`, `wa:*`, `urlscan:*`.
- Primary queues: `scan-request`, `scan-verdict`, `scan-urlscan` (configurable via env).
- Primary Fastify endpoints: `/healthz`, `/metrics`, `/urlscan/callback`, `/overrides`, `/rescan`, `/status`.

Keep this guide aligned with implementation commits; stale architecture docs are a leading indicator of operational surprises.
