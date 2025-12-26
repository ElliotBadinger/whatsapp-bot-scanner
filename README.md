# WhatsApp Bot Scanner (MVP)

Single-process WhatsApp link scanner for short MVP deployments. It watches group messages, extracts URLs, runs local heuristics, and posts verdicts back to the group. The advanced Redis/BullMQ stack is still available but optional and treated as legacy for now.

## Status

- MVP-first: single container, no Redis, no external enrichers by default.
- Advanced stack (Redis, scan-orchestrator, control-plane, monitoring) is optional and may lag behind MVP docs.

## MVP Quickstart (single container, no Redis)

```bash
cp .env.mvp.example .env
# edit .env and set IDENTIFIER_HASH_SECRET
make up-mvp
```

Or run the client directly:

```bash
cp .env.mvp.example .env
bun run --filter @wbscanner/wa-client dev
```

### Required MVP env vars

- `MVP_MODE=1` (already set in `.env.mvp.example`)
- `IDENTIFIER_HASH_SECRET` (set your own value)
- `WA_LIBRARY` (optional; defaults to `baileys`)
- `WA_REMOTE_AUTH_STORE=memory` (local session storage)

## Advanced (optional) stack

If you want queues, orchestration, or control-plane features:

```bash
# unset MVP_MODE, set Redis, and enable Redis auth store
MVP_MODE=
REDIS_URL=redis://<host>:<port>/<db>
WA_REMOTE_AUTH_STORE=redis
```

Then use the full compose file:

```bash
docker compose up -d --build
```

This path requires additional API keys and services (Redis/Postgres/etc). See `docs/SECURITY_SETUP.md` for key management.

## Deploying the MVP (Render/Railway/etc.)

- Deploy a single container using `docker/Dockerfile` with target `wa-client-baileys`.
- Provide the MVP env vars above.
- Persist `services/wa-client/data` if you want to keep WhatsApp sessions between restarts.

## Docs (short list)

- `SETUP_GUIDE.md` — MVP-first setup and troubleshooting
- `docs/SECURITY_SETUP.md` — optional API keys and secrets
- `docs/MVP_PLAN.md` — scope notes for the MVP
