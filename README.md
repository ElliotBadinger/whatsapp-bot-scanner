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

## Security Setup

> [!IMPORTANT]
> **Required API Keys and Secrets**: Before running the application, you must configure API keys and generate secure secrets. The `.env` file does not contain any credentials by default.
>
> See [`docs/SECURITY_SETUP.md`](docs/SECURITY_SETUP.md) for detailed instructions on:
>
> - Obtaining API keys from VirusTotal, Google Safe Browsing, WhoisXML, and urlscan.io
> - Generating secure random secrets for authentication and encryption
> - Quick setup script to generate all required secrets at once

Production-ready, containerized system that ingests WhatsApp group messages, detects URLs, evaluates risk via reputation sources and heuristics, and posts verdicts back to the group.

Quick start:

- Run `./setup.sh` to launch the guided onboarding wizard (Node.js 18+, Docker, and CLI prerequisites required). See [`docs/getting-started.md`](docs/getting-started.md) for a detailed walkthrough.
- After setup completes, open Uptime Kuma at `http://localhost:3001` for GUI monitoring and alerting.
- (Optional) `make test-load` to exercise `/healthz` endpoints; tune with `LOAD_TARGET_URL`, `LOAD_CONCURRENCY`, and `LOAD_DURATION_SECONDS`.

Services:

- `wa-client`: WhatsApp automation client (whatsapp-web.js) with session persistence.
- `scan-orchestrator`: Normalization, expansion, reputation checks, scoring, caching, DB writes.
- `control-plane`: Admin API for overrides, mutes, status, metrics.
- `reverse-proxy`: Nginx fronting the control-plane.
- `who-dat`: Self-hosted WHOIS service (unlimited, quota-free domain lookups).
- `redis`, `postgres`, `prometheus`, `uptime-kuma`.

Operational notes:

- First run requires scanning QR in wa-client logs.
- Migrations and seeds run via helper containers.
- Metrics are Prometheus-compatible under `/metrics` per service.

## SafeMode Web Application

The **SafeMode-web-app** (`SafeMode-web-app/`) is a Next.js web interface providing real-time monitoring, administration, and community features with a retro CRT terminal aesthetic.

This folder is **automatically synchronized** with a standalone repository at [github.com/ElliotBadinger/SafeMode-web-app](https://github.com/ElliotBadinger/SafeMode-web-app). Changes can be made in either location and will sync bidirectionally:

- **Monorepo → Standalone**: Automatic sync on push to `main` (~1 minute)
- **Standalone → Monorepo**: Automatic sync every 15 minutes (or instant with webhook)

**Setup Documentation:**

- [`docs/SAFEMODE_SYNC_SETUP.md`](docs/SAFEMODE_SYNC_SETUP.md) - Complete sync setup and troubleshooting
- [`.github/SYNC_QUICKSTART.md`](.github/SYNC_QUICKSTART.md) - Quick reference guide
- [`SafeMode-web-app/SYNC_INFO.md`](SafeMode-web-app/SYNC_INFO.md) - Developer info

Documentation located in `docs/` covers architecture, security, operations, and runbooks.
See [`docs/COST_MODEL.md`](docs/COST_MODEL.md) for VirusTotal quota guidance and observability metrics.
See [`docs/WHOIS_MIGRATION.md`](docs/WHOIS_MIGRATION.md) for WHOIS service migration details.
See [`docs/MONITORING.md`](docs/MONITORING.md) for monitoring setup with Uptime Kuma.

## Deploying with Railway

The repository ships with a production-ready `railway.toml` that provisions the WhatsApp client, scan orchestrator, control plane, PostgreSQL, and Redis services in a single Railway project. To deploy:

1. Create a new Railway project and import this repository.
2. Add the required secrets listed at the top of `railway.toml` (VirusTotal, Google Safe Browsing, WhoisXML, urlscan.io, and the control-plane token). Optional providers—such as PhishTank or OpenAI—can be added if you plan to enable them.
3. Run `railway up` or trigger a deploy from the dashboard. Railway automatically binds `redis` and `postgres` service URLs to the application containers.
4. After the build finishes, confirm every service reports healthy by curling their `/healthz` endpoints (`railway logs --service <name>` shows the public URL for each service). For example, `curl https://<wa-client-domain>/healthz` should return `{ "ok": true }`.

See `docs/DEPLOYMENT.md` for detailed environment variable mappings, smoke-test automation, and troubleshooting tips.
