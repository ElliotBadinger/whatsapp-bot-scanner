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
- `WHOISXML_*` toggles paid WhoisXML lookups; leave disabled if quota unavailable.
- `VT_REQUESTS_PER_MINUTE` + `VT_REQUEST_JITTER_MS` set VirusTotal throttling (default 4 req/min with 0.5s jitter).
- `UNSHORTEN_ENDPOINT`, `UNSHORTEN_RETRIES`, `SHORTENER_CACHE_TTL_SECONDS` tune shortener expansion.

Production notes:
- Put `reverse-proxy` behind TLS (e.g., nginx with Let’s Encrypt or Caddy). Update environment and mount certs.
- Persist volumes: Postgres (`pgdata`), WA session (`wa_session`).
- Configure firewall to restrict Control Plane IPs.
- Scale `scan-orchestrator` by adding `deploy.replicas` or multiple service entries.
