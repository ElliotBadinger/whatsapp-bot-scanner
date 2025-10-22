# WhatsApp Group Link-Scanning Bot (Dockerized)

Production-ready, containerized system that ingests WhatsApp group messages, detects URLs, evaluates risk via reputation sources and heuristics, and posts verdicts back to the group.

Quick start:

- Copy `.env.example` to `.env` and fill in API keys.
- `make build && make up`
- Open Grafana at `http://localhost:3002` (admin/admin) for dashboards.

Services:

- `wa-client`: WhatsApp automation client (whatsapp-web.js) with session persistence.
- `scan-orchestrator`: Normalization, expansion, reputation checks, scoring, caching, DB writes.
- `control-plane`: Admin API for overrides, mutes, status, metrics.
- `reverse-proxy`: Nginx fronting the control-plane.
- `redis`, `postgres`, `prometheus`, `grafana`.

Operational notes:

- First run requires scanning QR in wa-client logs.
- Migrations and seeds run via helper containers.
- Metrics are Prometheus-compatible under `/metrics` per service.

Documentation located in `docs/` covers architecture, security, operations, and runbooks.

