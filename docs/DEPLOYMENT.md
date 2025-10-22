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

Production notes:
- Put `reverse-proxy` behind TLS (e.g., nginx with Let’s Encrypt or Caddy). Update environment and mount certs.
- Persist volumes: Postgres (`pgdata`), WA session (`wa_session`).
- Configure firewall to restrict Control Plane IPs.
- Scale `scan-orchestrator` by adding `deploy.replicas` or multiple service entries.

