# WhatsApp Bot Scanner (MVP)

Single-process WhatsApp link scanner for short MVP deployments. It watches group messages, extracts URLs, runs local heuristics, and posts verdicts back to the group.

## Status

- MVP-first: single container, no Redis, no external enrichers by default.
- Advanced stack has been archived into `archive/` to keep the main branch focused.

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

## Archived advanced stack

The Redis/BullMQ pipeline, control-plane, and observability stack are preserved under `archive/` for reference, but the main branch supports MVP only.

## Deploying the MVP (Render/Railway/etc.)

- Deploy a single container using `docker/Dockerfile` with target `wa-client-baileys`.
- Provide the MVP env vars above.
- Persist `services/wa-client/data` if you want to keep WhatsApp sessions between restarts.

## Docs (short list)

- `SETUP_GUIDE.md` — MVP-first setup and troubleshooting
- `docs/SECURITY_SETUP.md` — optional API keys and secrets
- `docs/MVP_PLAN.md` — scope notes for the MVP
