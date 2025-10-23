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
- Global reply saturation: monitor the Redis key named by `WA_GLOBAL_TOKEN_BUCKET_KEY` (default `wa_global_token_bucket`). The bucket refills according to `WA_GLOBAL_REPLY_RATE_PER_HOUR` (1000/hour by default), so bursts beyond the allowance will delay verdict replies until tokens recover.
- urlscan backlog: inspect `scan-urlscan` queue via Redis (`LRANGE bull:scan-urlscan:wait 0 -1`), confirm `URLSCAN_API_KEY` quota, check callback reachability (`/urlscan/callback` logs), and temporarily disable deep scans with `URLSCAN_ENABLED=false` if necessary.
- Whois quota exhausted: toggle `WHOISXML_ENABLED=false` to fall back to RDAP, note reduced domain-age precision in incident report, and plan quota top-up.
- Shortener expansion failures: delete Redis key `url:shortener:{hash}` and rescan; verify `UNSHORTEN_ENDPOINT` is accessible.
- Circuit breaker open: consult Grafana's "External Providers" panel and Prometheus `wbscanner_circuit_breaker_state` gauge. Investigate upstream status, reduce traffic with feature flags (`URLSCAN_ENABLED=false`, `WHOISXML_ENABLED=false`), and rely on cached verdicts until breakers close.
- Rate limiting complaints: adjust `WA_PER_GROUP_REPLY_COOLDOWN_SECONDS`, `WA_PER_GROUP_HOURLY_LIMIT`, or `WA_GLOBAL_REPLY_RATE_PER_HOUR` in `.env`, then `docker compose up -d wa-client` to apply.

Urlscan Deep Scan Workflow:
- Queue renames must follow [Queue Naming Constraints](./DEPLOYMENT.md#queue-naming-constraints) when adjusting `SCAN_*_QUEUE` values.
- Suspicious verdicts (score 4–7) enqueue BullMQ jobs on `scan-urlscan`. Submission state lands in Postgres (`scans.urlscan_status`) and Redis (`urlscan:submitted:{hash}`).
- urlscan callbacks POST to `/urlscan/callback` (reverse proxy path `/urlscan/callback`), authenticated via `URLSCAN_CALLBACK_SECRET`. Callback payload stored in `scans.urlscan_result`.
- Manual rescan: delete `url:analysis:{hash}:*`, `url:shortener:{hash}`, and `urlscan:*:{hash}` keys then add a new `scan-request` job.

Manual Override Management:
- Create override: `POST /overrides` with `status=allow|deny`, `pattern` or `url_hash`, optional `expires_at`. Verify entry with `GET /overrides` and document ticket reference.
- Expire override early: issue SQL `DELETE FROM overrides WHERE id=<id>` followed by cache invalidation (`redis-cli DEL url:analysis:{hash}:*`).

Urlscan Artifact Maintenance:
- Artifacts live under `storage/urlscan-artifacts`. Rotate weekly by archiving files older than 30 days (`find storage/urlscan-artifacts -mtime +30 -delete`) after confirming no open investigations.
- If relocating artifacts, set `URLSCAN_ARTIFACT_DIR` and restart control-plane + scan-orchestrator to pick up new paths.

Observability Health Check:
- Prometheus: `docker compose logs -f prometheus` should show successful scrapes; reload config when updating `observability/prometheus.yml`.
- Grafana: dashboards under "Operational" must display API quotas, queue depth, circuit breaker states, WA session status, and alert list. Re-run provisioning (`docker compose restart grafana`) after dashboard edits.

Rollback:
- `docker compose rollback` (if using compose profiles with tags) or redeploy previous images.
