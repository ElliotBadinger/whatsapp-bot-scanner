# Threat Model (STRIDE)

Spoofing: Prevented by WA session auth and admin-token auth for Control Plane.

Tampering: Redis queues are internal-only; reverse proxy exposes only Control Plane. DB writes validated.

Repudiation: Audit logs table records admin actions; extend with request IDs.

Information Disclosure: PII minimized; sender IDs hashed; secrets redacted in logs.

Denial of Service: Rate limits per group; global limiter; backoff on 429/5xx; circuit breakers TBD.

Elevation of Privilege: No shell execs; containers run non-root; API token required.

Risk Register (top):
- VT/GSB quota exhaustion – Monitor via metrics; degrade to heuristics.
- WA session bans – Random delays, modest messaging, quiet hours.
- SSRF via URL expansion – DNS/IP checks; block private ranges.

