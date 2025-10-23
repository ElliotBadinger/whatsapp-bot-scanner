# WhatsApp Group Link-Scanning Bot (Dockerized)

# WhatsApp Group Link-Scanning Bot (Dockerized)

## About The Project

This project is a production-ready, containerized system designed to enhance the security of WhatsApp groups by automatically scanning links shared within them. It ingests messages, identifies URLs, and evaluates their potential risk using a variety of reputation sources and heuristics. Once a verdict is reached, it is posted back to the group, providing members with timely warnings about potentially malicious links.

The system is built with a microservices architecture and is fully dockerized for easy deployment and scalability. It includes services for WhatsApp automation, URL scanning orchestration, and a control plane for administration, all supported by a robust observability stack.

Production-ready, containerized system that ingests WhatsApp group messages, detects URLs, evaluates risk via reputation sources and heuristics, and posts verdicts back to the group.

Quick start:

- Copy `.env.example` to `.env` and fill in API keys.
- `make build && make up`
- Open Grafana at `http://localhost:3002` (admin/admin) for dashboards.
- (Optional) `make test-load` to exercise `/healthz` endpoints; tune with `LOAD_TARGET_URL`, `LOAD_CONCURRENCY`, and `LOAD_DURATION_SECONDS`.

### Quality checks

- `npm run check` runs linting, type checking, and tests across every workspace.
- `npm run lint`/`npm run typecheck` run the respective scripts for workspaces that implement them.
- Scope to a single package with `npm run <script> --workspace <name>` (see `TESTING.md` for examples).

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
