# WhatsApp Bot Scanner - Setup Guide (MVP-first)

This project is in MVP mode by default: single container, no Redis, no external enrichers. Use the advanced stack only if you explicitly want queues, control-plane, and monitoring.

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

## Advanced Stack (Optional)

Use this only if you need the full multi-service setup (Redis/BullMQ, control-plane, monitoring):

```bash
npx whatsapp-bot-scanner setup
```

Or run the full compose file directly:

```bash
docker compose up -d --build
```

## Troubleshooting (MVP)

- **Docker not running**: start Docker Desktop (macOS/Windows) or `sudo systemctl start docker` (Linux).
- **Port already in use**: set `WA_CLIENT_PORT` in `.env` to a free port.
- **Pairing issues**: use `npx whatsapp-bot-scanner pair` after the container is running.
