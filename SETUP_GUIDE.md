# WhatsApp Bot Scanner - Setup Guide (MVP-first)

This project is MVP-only: single container, no Redis, no external enrichers. The advanced stack is archived under `archive/`.

## MVP Single-Container Setup (Recommended)

```bash
cp .env.mvp.example .env
# edit .env and set IDENTIFIER_HASH_SECRET
make up-mvp
```

Or run the service directly:

```bash
cp .env.mvp.example .env
bun run --filter @wbscanner/wa-client dev
```

## Archived Advanced Stack

The Redis/BullMQ + control-plane stack is archived under `archive/` to keep the main branch MVP-only.

## Troubleshooting (MVP)

- **Docker not running**: start Docker Desktop (macOS/Windows) or `sudo systemctl start docker` (Linux).
- **Port already in use**: set `WA_CLIENT_PORT` in `.env` to a free port.
- **Pairing issues**: use `npx whatsapp-bot-scanner pair` after the container is running.
