# Architecture Overview

Components:

- WA Client Service: Manages WhatsApp session, extracts URLs, deduplicates, enqueues scan jobs, posts verdicts, and enforces rate limits.
- Scan Orchestrator: Normalizes/expands URLs, runs reputation checks (Google Safe Browsing, VirusTotal, URLhaus, Phishtank), enriches with domain intelligence (RDAP/WhoisXML) and shortener expansion, computes heuristics, scores risk, caches results, and persists to Postgres. Suspicious links enqueue asynchronous urlscan.io deep scans via a dedicated BullMQ queue and webhook callback.
  - Google Safe Browsing calls use the v4 Lookup API (not hash prefix). The strategy document prioritises response fidelity over the additional latency of hash-prefix verification, and requests are stripped of PII before submission. Responses are cached per URL hash to respect quota and to avoid re-sending the same URLs.
-   VirusTotal calls are wrapped in a Bottleneck scheduler (4 req/min) and fall back to URLhaus when quota is exhausted. urlscan artifacts (screenshot + DOM) are downloaded to `storage/urlscan-artifacts`, and `scans` persists `urlscan_screenshot_path`, `urlscan_dom_path`, and `urlscan_artifact_stored_at` for retrieval and retention checks.
-   Manual overrides are resolved prior to scoring; `allow`/`deny` instructions override automated verdicts until their expiry.
- Control Plane API: Admin auth via bearer token, overrides, mutes, rescans, and status. Exposes metrics and health.
-   `/rescan` now invalidates Redis cache keys (`scan`, `analysis`, `shortener`) and requeues high-priority jobs. `/scans/:urlHash/urlscan-artifacts/:type` (`type` = `screenshot` | `dom`) streams urlscan evidence from disk with strict path whitelisting.
- Data Stores: Redis (queues + caching), Postgres (persistent records), volumes (WA session).
- Observability: Prometheus scraping, Grafana dashboard.
-   Metrics now span API quota health (remaining tokens, utilization %, reset counters, limiter queue depth), cache efficiency (lookup/write latency, stale hit counters, entry TTL), queue behaviour (wait/processing histograms, active/delayed gauges, failure counters), verdict quality (score distribution, latency, override transitions), WhatsApp session health (drops, session state, verdict delivery latency), and degraded-mode counters when all external intelligence providers are unreachable during a scan.
-   The "WBScanner Operational" Grafana dashboard was expanded with panels for quota utilization + depletion ETA, queue wait/processing p95 trends, cache latency + stale hit surfacing, verdict latency/score traces, WA delivery health, and circuit breaker states alongside the original throughput panels.
-   Prometheus alerts were extended to fire on high quota utilization, limiter backlogs, sustained circuit opens, queue wait regression, verdict latency spikes, cache stale bursts, and WhatsApp drop anomalies in addition to the existing latency/quota/depth monitors.
- Reverse Proxy: Nginx ingress for control-plane.

Data flow:

1. WA client receives a group message, extracts URLs, deduplicates by messageId+urlHash, and enqueues `scan-request`.
2. Orchestrator consumes, runs shortener expansion + normalization, queries blocklists (GSB/Phishtank/URLhaus), reputation meta (VirusTotal), domain intel (RDAP/WhoisXML), records heuristics, aggregates signals → verdict, writes to DB/cache, optionally kicks urlscan.io deep scan jobs, and emits to `scan-verdict` (see [Blocklist Redundancy Strategy](./THREAT_MODEL.md#blocklist-redundancy-strategy) for the fallback rationale).
3. WA client consumes verdicts and posts replies in-group with short, clear guidance; detailed DM to admins is pluggable.

SLOs:

- P50 ≤ 5s end-to-end; cached URLs typically ≤ 2s.
- P95 ≤ 15s for cached; ≤ 60s when VT polling required.

Scaling:

- `scan-orchestrator` is stateless; scale horizontally by increasing replicas (Compose → Swarm/K8s later).
- One `wa-client` per WA account/session.

Security:

- SSRF protection: Shorteners expand via Unshorten.me first, then fall back to url-expand using a guarded `fetch` that enforces redirect/time limits and blocks private hosts.
- Non-root containers, `no-new-privileges`, limited volumes, secrets via env.
- Structured logs with redaction of sensitive values.
