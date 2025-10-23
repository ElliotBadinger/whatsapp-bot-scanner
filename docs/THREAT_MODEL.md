# Threat Model (STRIDE)

Spoofing: Prevented by WA session auth and admin-token auth for Control Plane.

Tampering: Redis queues are internal-only; reverse proxy exposes only Control Plane. DB writes validated.

Repudiation: Audit logs table records admin actions; extend with request IDs.

Information Disclosure: PII minimized; sender IDs hashed; secrets redacted in logs.

Denial of Service: Rate limits per group; hourly global limiter; Bottleneck-bound VirusTotal calls; circuit breakers with Prometheus alerts; queue depth monitoring and rescan cache invalidation to prevent backlog amplification.

Elevation of Privilege: No shell execs; containers run non-root; API token required.

Risk Register (top):
- VT/GSB quota exhaustion – Monitor via metrics; degrade to heuristics.
- WA session bans – Random delays, modest messaging, quiet hours.
- SSRF via URL expansion – DNS/IP checks; block private ranges.

## Blocklist Redundancy Strategy

The scan orchestrator enforces a two-tier blocklist workflow: every URL is checked against Google Safe Browsing first, then the system decides whether to invoke Phishtank as a secondary provider based on the initial verdict, error state, response latency, cache status, API key availability, and feature flag configuration. This ensures that secondary lookups automatically cover clean responses, outages, and quota gaps without duplicating work when the primary provider already reports a threat.【F:services/scan-orchestrator/src/blocklists.ts†L27-L117】

Benefits:

- Resilient detection: redundant Phishtank queries backstop false negatives, transport errors, and missing credentials from Google Safe Browsing, so suspicious links still receive at least one blocklist verdict.【F:services/scan-orchestrator/src/blocklists.ts†L27-L41】【F:services/scan-orchestrator/src/blocklists.ts†L74-L117】
- Operational visibility: structured logs and Prometheus counters fire whenever the fallback runs or hits, preserving auditability of redundancy coverage in production.【F:services/scan-orchestrator/src/blocklists.ts†L86-L114】

Performance trade-off: issuing a secondary lookup adds latency, but the orchestrator limits those calls to the conditions above and skips them for cached hits, quick primary responses, or definitive GSB matches. The fallback latency budget helps bound worst-case response time while still providing redundancy when the primary provider slows down.【F:services/scan-orchestrator/src/blocklists.ts†L37-L41】【F:services/scan-orchestrator/src/blocklists.ts†L70-L117】

