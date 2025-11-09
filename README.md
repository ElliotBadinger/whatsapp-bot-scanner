# WhatsApp Group Link-Scanning Bot (Dockerized)

# WhatsApp Group Link-Scanning Bot (Dockerized)

## About The Project

This project is a production-ready, containerized system designed to enhance the security of WhatsApp groups by automatically scanning links shared within them. It ingests messages, identifies URLs, and evaluates their potential risk using a variety of reputation sources and heuristics. Once a verdict is reached, it is posted back to the group, providing members with timely warnings about potentially malicious links.

The system is built with a microservices architecture and is fully dockerized for easy deployment and scalability. It includes services for WhatsApp automation, URL scanning orchestration, and a control plane for administration, all supported by a robust observability stack.

### Enhanced Security Features

The system includes zero-cost, API-independent threat intelligence layers that operate before querying rate-limited external services:

- **DNS Intelligence:** DNSBL queries (Spamhaus, SURBL, URIBL), DNSSEC validation, fast-flux detection
- **Certificate Analysis:** TLS certificate inspection, self-signed detection, Certificate Transparency logs
- **Advanced Heuristics:** Shannon entropy analysis, keyboard walk detection, suspicious pattern matching
- **Local Threat Database:** OpenPhish feed integration, collaborative learning from historical verdicts
- **HTTP Fingerprinting:** Security header analysis, redirect detection, human-like behavior patterns

These features reduce external API calls by 30-40% while improving scan latency. See [`docs/ENHANCED_SECURITY.md`](docs/ENHANCED_SECURITY.md) for details.

Production-ready, containerized system that ingests WhatsApp group messages, detects URLs, evaluates risk via reputation sources and heuristics, and posts verdicts back to the group.

Quick start:

- Run `./setup.sh` to launch the guided onboarding wizard (Node.js 18+, Docker, and CLI prerequisites required). See [`docs/getting-started.md`](docs/getting-started.md) for a detailed walkthrough.
- After setup completes, open Grafana at `http://localhost:3002` (admin/admin) for dashboards.
- (Optional) `make test-load` to exercise `/healthz` endpoints; tune with `LOAD_TARGET_URL`, `LOAD_CONCURRENCY`, and `LOAD_DURATION_SECONDS`.

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
See [`docs/COST_MODEL.md`](docs/COST_MODEL.md) for VirusTotal quota guidance and observability metrics.

## Deploying with Railway

The repository ships with a production-ready `railway.toml` that provisions the WhatsApp client, scan orchestrator, control plane, PostgreSQL, and Redis services in a single Railway project. To deploy:

1. Create a new Railway project and import this repository.
2. Add the required secrets listed at the top of `railway.toml` (VirusTotal, Google Safe Browsing, WhoisXML, urlscan.io, and the control-plane token). Optional providers—such as PhishTank or OpenAI—can be added if you plan to enable them.
3. Run `railway up` or trigger a deploy from the dashboard. Railway automatically binds `redis` and `postgres` service URLs to the application containers.
4. After the build finishes, confirm every service reports healthy by curling their `/healthz` endpoints (`railway logs --service <name>` shows the public URL for each service). For example, `curl https://<wa-client-domain>/healthz` should return `{ "ok": true }`.

See `docs/DEPLOYMENT.md` for detailed environment variable mappings, smoke-test automation, and troubleshooting tips.
