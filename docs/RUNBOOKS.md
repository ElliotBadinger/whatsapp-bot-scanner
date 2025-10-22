# Runbooks

WA Session Recovery (QR):
- `docker compose logs -f wa-client` and wait for QR output.
- Scan QR with the prototype device.
- Verify `/healthz` returns ok.

Connector Key Rotation:
- Update `.env` keys; `docker compose up -d --no-deps scan-orchestrator`.

Database Migration:
- `make migrate` locally or redeploy `migrate` one-shot container in production.

Cache Flush:
- `docker exec -it <redis> redis-cli FLUSHDB` (use with caution).

Incident Response:
- Mute noisy groups via Control Plane: `POST /groups/:chatId/mute`.
- Increase thresholds by updating environment and redeploy.

Rollback:
- `docker compose rollback` (if using compose profiles with tags) or redeploy previous images.

