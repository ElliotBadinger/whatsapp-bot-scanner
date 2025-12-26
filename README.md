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

## Quick start:

### 🚀 One-Liner Install (Fresh Systems - No Prerequisites Required)

**For Linux, macOS, and WSL2** — run this single command:

```bash
curl -fsSL https://raw.githubusercontent.com/ElliotBadinger/whatsapp-bot-scanner/main/scripts/remote-bootstrap.sh | bash
```

**For Windows PowerShell** — run this single command:

```powershell
irm https://raw.githubusercontent.com/ElliotBadinger/whatsapp-bot-scanner/main/scripts/remote-bootstrap.ps1 | iex
```

These scripts automatically:

- ✅ Install Node.js 20+ (via fnm on Linux/macOS, winget on Windows)
- ✅ Install Docker (via official script on Linux, guidance on Windows)
- ✅ Install Git and other system prerequisites
- ✅ Clone the repository
- ✅ Install project dependencies
- ✅ Launch the interactive setup wizard

> **Note**: The one-liner works on completely fresh systems where nothing is installed. It handles the chicken-and-egg problem of needing Node.js to run `npx`.

### Already Cloned the Repository?

**For Linux, macOS, and WSL2:**

```bash
./bootstrap.sh
```

**For Windows PowerShell:**

```powershell
.\bootstrap.ps1
```

### Alternative Setup Methods

- **If prerequisites are already installed**: Run `npx whatsapp-bot-scanner setup` to launch the guided onboarding wizard. See [`docs/CLI_USER_GUIDE.md`](docs/CLI_USER_GUIDE.md) for detailed instructions.
- **Legacy Setup**: Run `./setup.sh` for the traditional setup wizard. See [`docs/getting-started.md`](docs/getting-started.md) for a detailed walkthrough.

### Post-Setup

- After setup completes, open Uptime Kuma at `http://localhost:3001` for GUI monitoring and alerting.
- (Optional) `make test-load` to exercise `/healthz` endpoints; tune with `LOAD_TARGET_URL`, `LOAD_CONCURRENCY`, and `LOAD_DURATION_SECONDS`.

### MVP Quickstart (single-process, no Redis)

Run the WhatsApp client and heuristic scanner in one process with external enrichers disabled by default.

- **Bun/Node:**

  ```bash
  MVP_MODE=1 WA_REMOTE_AUTH_STORE=memory bun run --filter @wbscanner/wa-client dev:adapter
  ```

- **Docker Compose:**

  ```bash
  MVP_MODE=1 WA_REMOTE_AUTH_STORE=memory docker compose run --rm wa-client bun run dev:adapter
  ```

Required runtime env vars in MVP mode:

- `MVP_MODE=1` – enables the in-process worker pool and disables external enrichers/control-plane calls by default.
- `WA_REMOTE_AUTH_STORE=memory` – keep sessions local instead of Redis (this is the default when `MVP_MODE=1`).
- `WA_LIBRARY` – optional; defaults to `baileys`.

To re-enable the advanced Redis/BullMQ path, unset `MVP_MODE`, set `REDIS_URL` and `WA_REMOTE_AUTH_STORE=redis`, and start Redis alongside the `wa-client` service.

## Services:

- `wa-client`: WhatsApp automation client (whatsapp-web.js) with session persistence.
- `scan-orchestrator`: Normalization, expansion, reputation checks, scoring, caching, DB writes.
- `control-plane`: Admin API for overrides, mutes, status, metrics.
- `reverse-proxy`: Nginx fronting the control-plane.
- `who-dat`: Self-hosted WHOIS service (unlimited, quota-free domain lookups).
- `redis`, `postgres`, `prometheus`, `uptime-kuma`.

## Operational notes:

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

## 📚 Documentation

### Unified CLI Documentation

- **User Guide**: [`docs/CLI_USER_GUIDE.md`](docs/CLI_USER_GUIDE.md) - Getting started, usage examples, and tutorials
- **Technical Documentation**: [`docs/CLI_TECHNICAL_DOCUMENTATION.md`](docs/CLI_TECHNICAL_DOCUMENTATION.md) - Architecture, components, and API reference
- **Migration Guide**: [`docs/CLI_MIGRATION_GUIDE.md`](docs/CLI_MIGRATION_GUIDE.md) - Migration instructions and deprecation timeline
- **Troubleshooting**: [`docs/CLI_TROUBLESHOOTING.md`](docs/CLI_TROUBLESHOOTING.md) - Common issues and solutions
- **Visual Aids**: [`docs/CLI_VISUAL_AIDS.md`](docs/CLI_VISUAL_AIDS.md) - ASCII diagrams, flowcharts, and reference tables

### Legacy Documentation

- **Getting Started**: [`docs/getting-started.md`](docs/getting-started.md) - Traditional setup guide
- **Cost Model**: [`docs/COST_MODEL.md`](docs/COST_MODEL.md) - VirusTotal quota guidance
- **WHOIS Migration**: [`docs/WHOIS_MIGRATION.md`](docs/WHOIS_MIGRATION.md) - WHOIS service details
- **Monitoring**: [`docs/MONITORING.md`](docs/MONITORING.md) - Uptime Kuma setup

### CLI Command Reference

```bash
# Setup and configuration
npx whatsapp-bot-scanner setup                  # Interactive setup wizard
npx whatsapp-bot-scanner setup --hobby-mode     # Hobby/personal configuration
npx whatsapp-bot-scanner setup --noninteractive # Automated CI/CD setup

# Service management
npx whatsapp-bot-scanner status                 # Check service health
npx whatsapp-bot-scanner status --monitor       # Continuous health monitoring
npx whatsapp-bot-scanner logs                   # View all service logs
npx whatsapp-bot-scanner logs wa-client          # View specific service logs

# WhatsApp pairing
npx whatsapp-bot-scanner pair                   # Manual pairing request
npx whatsapp-bot-scanner logs wa-client          # Monitor pairing process

# Migration assistance
npx whatsapp-bot-scanner compatibility         # Show migration information
```

### Migration from Legacy Scripts

The unified CLI replaces multiple legacy scripts with a single interface:

| Legacy Script            | Unified CLI Equivalent                        |
| ------------------------ | --------------------------------------------- |
| `setup.sh`               | `npx whatsapp-bot-scanner setup`              |
| `setup-hobby-express.sh` | `npx whatsapp-bot-scanner setup --hobby-mode` |
| `watch-pairing-code.js`  | `npx whatsapp-bot-scanner logs wa-client`     |
| `pair.sh`                | `npx whatsapp-bot-scanner pair`               |

See [`docs/CLI_MIGRATION_GUIDE.md`](docs/CLI_MIGRATION_GUIDE.md) for complete migration instructions.

## Deploying with Railway

The repository ships with a production-ready `railway.toml` that provisions the WhatsApp client, scan orchestrator, control plane, PostgreSQL, and Redis services in a single Railway project. To deploy:

1. Create a new Railway project and import this repository.
2. Add the required secrets listed at the top of `railway.toml` (VirusTotal, Google Safe Browsing, WhoisXML, urlscan.io, and the control-plane token). Optional providers—such as PhishTank or OpenAI—can be added if you plan to enable them.
3. Run `railway up` or trigger a deploy from the dashboard. Railway automatically binds `redis` and `postgres` service URLs to the application containers.
4. After the build finishes, confirm every service reports healthy by curling their `/healthz` endpoints (`railway logs --service <name>` shows the public URL for each service). For example, `curl https://<wa-client-domain>/healthz` should return `{ "ok": true }`.

See `docs/DEPLOYMENT.md` for detailed environment variable mappings, smoke-test automation, and troubleshooting tips.
