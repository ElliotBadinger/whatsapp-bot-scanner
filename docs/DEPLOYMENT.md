# Deployment Guide (Single VM / Docker Compose)

Prereqs:
- Docker and Docker Compose v2
- Prototype WhatsApp account (consented), VirusTotal and Google Safe Browsing API keys

Steps:
- `cp .env.example .env` and fill in keys
- `make build && make up`
- Watch `docker compose logs -f wa-client` and scan the QR code
- Verify health: `curl http://localhost:8088/healthz` (via reverse proxy)
- Open Grafana `http://localhost:3002` (admin/admin)

Key environment variables:
- `URLSCAN_*` controls private urlscan.io submissions (API key, callback URL, visibility); ensure reverse proxy routes `/urlscan/callback`.
- `URLSCAN_CALLBACK_SECRET` is mandatory when `URLSCAN_ENABLED=true`; configure the same shared secret in urlscan's webhook settings so callbacks are accepted.
- `WHOISXML_*` toggles paid WhoisXML lookups; leave disabled if quota unavailable. `WHOISXML_MONTHLY_QUOTA` should match your subscription tier.
- VirusTotal throttling is now enforced in-code (4 req/min). No manual tuning required unless you upgrade plans.
- `UNSHORTEN_ENDPOINT`, `UNSHORTEN_RETRIES`, `SHORTENER_CACHE_TTL_SECONDS` tune shortener expansion.
- `WA_GLOBAL_REPLY_RATE_PER_HOUR` and `WA_PER_GROUP_HOURLY_LIMIT` keep outbound messaging within WhatsApp policy (defaults: 1000 global, 60 per group).
- `URLSCAN_ARTIFACT_DIR` (optional) relocates screenshot/DOM persistence; ensure the directory exists and is writable.

Production notes:
- Put `reverse-proxy` behind TLS (e.g., nginx with Let’s Encrypt or Caddy). Update environment and mount certs.
- Persist volumes: Postgres (`pgdata`), WA session (`wa_session`).
- Monitor disk usage for `storage/urlscan-artifacts`; rotate/clean periodically if storage is constrained, using `scans.urlscan_artifact_stored_at` to identify stale evidence.
- Configure firewall to restrict Control Plane IPs.
- Scale `scan-orchestrator` by adding `deploy.replicas` or multiple service entries.
- BullMQ queues share Redis; heavy burst traffic may require upgrading Redis instance memory/throughput.

## Queue Naming Constraints

**CRITICAL:** Queue names MUST NOT contain colons (`:`) as BullMQ forbids this character.

Valid examples:
- ✅ `scan-request`
- ✅ `scan-verdict`
- ❌ `scan:request` (will crash)

If changing queue names, update:
- `.env.example`
- Both service queue initializations
- All documentation references
