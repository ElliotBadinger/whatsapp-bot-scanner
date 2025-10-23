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
- Monitor disk usage for `storage/urlscan-artifacts`; rotate/clean periodically if storage is constrained.
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

## Railway Deployment

The repository includes a first-class `railway.toml` that provisions the following managed services inside a Railway project:

| Service             | Description                                           | Default Port |
|---------------------|-------------------------------------------------------|--------------|
| `wa-client`         | WhatsApp automation worker + HTTP health endpoint     | 3000         |
| `scan-orchestrator` | URL expansion, enrichment, and verdict computation    | 3001         |
| `control-plane`     | Administrative API (mute/unmute, overrides, metrics) | 8080         |
| `postgres`          | Primary application database                         | 5432         |
| `redis`             | BullMQ queue backend and caching                      | 6379         |

### Secrets and environment variables

Add the following secrets to the Railway project before deploying:

| Secret name               | Populates environment variable | Purpose                                                  |
|---------------------------|--------------------------------|----------------------------------------------------------|
| `CONTROL_PLANE_API_TOKEN` | `CONTROL_PLANE_API_TOKEN`      | Bearer token used by wa-client to call the control plane.|
| `VT_API_KEY`              | `VT_API_KEY`                   | VirusTotal verdict enrichment.                           |
| `GSB_API_KEY`             | `GSB_API_KEY`                  | Google Safe Browsing lookups.                            |
| `WHOISXML_API_KEY`        | `WHOISXML_API_KEY`             | Domain age and registration context.                     |
| `URLSCAN_API_KEY`         | `URLSCAN_API_KEY`              | Optional urlscan.io submissions.                         |
| `URLSCAN_CALLBACK_SECRET` | `URLSCAN_CALLBACK_SECRET`      | Validates urlscan.io webhook callbacks.                  |

Optional providers—such as `PHISHTANK_APP_KEY`, `OPENAI_API_KEY`, or additional override knobs in `.env.example`—can also be declared as Railway secrets when those integrations are enabled.

The template automatically wires `REDIS_URL`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` from the managed Redis and PostgreSQL services so no manual wiring is required.

### Deploying

1. Create a Railway project and import this repository.
2. Configure the secrets listed above via the Railway dashboard or CLI (`railway variables set <key>=<value>`).
3. Trigger a deploy (`railway up`) which builds each service Dockerfile and boots the five services in parallel.
4. Monitor the deployment with `railway status` or the dashboard until every instance reports `Healthy`.

Each application container exposes a `/healthz` readiness probe which Railway polls every 15 seconds (configured in `railway.toml`). You can manually validate the health checks with:

```bash
curl https://<service-domain>/healthz
```

Replace `<service-domain>` with the hostname displayed in `railway logs --service <name>`.

### Smoke testing

After the deployment finishes you can run the helper script from your workstation to validate HTTP endpoints and database connectivity:

```bash
./scripts/railway-smoke-test.sh \
  --wa "https://<wa-client-domain>" \
  --orchestrator "https://<scan-orchestrator-domain>" \
  --control-plane "https://<control-plane-domain>" \
  --postgres "$RAILWAY_POSTGRES_URL" \
  --redis "$RAILWAY_REDIS_URL"
```

The script issues `curl` requests against `/healthz`, checks PostgreSQL connectivity via `psql`, and performs a `PING` against Redis, exiting non-zero if any check fails. Export `RAILWAY_POSTGRES_URL` and `RAILWAY_REDIS_URL` from the Railway dashboard before running the smoke test.
Ensure `curl`, `psql`, and `redis-cli` are available locally; install `postgresql-client` and `redis-tools` packages if needed.
