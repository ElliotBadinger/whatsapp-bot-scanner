# Architecture Overview

Components:

- WA Client Service: Manages WhatsApp session, extracts URLs, deduplicates, enqueues scan jobs, posts verdicts, and enforces rate limits.
- Scan Orchestrator: Normalizes/expands URLs, runs reputation checks (Google Safe Browsing, VirusTotal, URLhaus, Phishtank), enriches with domain intelligence (RDAP/WhoisXML) and shortener expansion, computes heuristics, scores risk, caches results, and persists to Postgres. Suspicious links enqueue asynchronous urlscan.io deep scans via a dedicated BullMQ queue and webhook callback.
- Control Plane API: Admin auth via bearer token, overrides, mutes, rescans, and status. Exposes metrics and health.
- Data Stores: Redis (queues + caching), Postgres (persistent records), volumes (WA session).
- Observability: Prometheus scraping, Grafana dashboard.
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

- SSRF protection: No private IPs; DNS resolution checked. HEAD-only expansion with redirect and time limits.
- Non-root containers, `no-new-privileges`, limited volumes, secrets via env.
- Structured logs with redaction of sensitive values.
