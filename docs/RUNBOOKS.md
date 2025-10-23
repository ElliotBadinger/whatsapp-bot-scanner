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
- urlscan backlog: inspect `scan-urlscan` queue via Redis (`LRANGE bull:scan-urlscan:wait 0 -1`), confirm `URLSCAN_API_KEY` quota, check callback reachability (`/urlscan/callback` logs), and temporarily disable deep scans with `URLSCAN_ENABLED=false` if necessary.
- Whois quota exhausted: toggle `WHOISXML_ENABLED=false` to fall back to RDAP, note reduced domain-age precision in incident report, and plan quota top-up.
- Shortener expansion failures: delete Redis key `url:shortener:{hash}` and rescan; verify `UNSHORTEN_ENDPOINT` is accessible.

Urlscan Deep Scan Workflow:
- Queue renames must follow [Queue Naming Constraints](./DEPLOYMENT.md#queue-naming-constraints) when adjusting `SCAN_*_QUEUE` values.
- Suspicious verdicts (score 4–7) enqueue BullMQ jobs on `scan-urlscan`. Submission state lands in Postgres (`scans.urlscan_status`) and Redis (`urlscan:submitted:{hash}`).
- urlscan callbacks POST to `/urlscan/callback` (reverse proxy path `/urlscan/callback`), authenticated via `URLSCAN_CALLBACK_SECRET`. Callback payload stored in `scans.urlscan_result`.
- Manual rescan: delete `url:analysis:{hash}:*`, `url:shortener:{hash}`, and `urlscan:*:{hash}` keys then add a new `scan-request` job.

Rollback:
- `docker compose rollback` (if using compose profiles with tags) or redeploy previous images.
