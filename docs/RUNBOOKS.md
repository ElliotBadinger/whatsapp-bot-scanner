# Runbooks

## WhatsApp Authentication End-to-End Validation

### Overview
This section documents the complete WhatsApp authentication flow and provides step-by-step validation procedures to ensure the authentication system is working correctly.

### Prerequisites
- Docker stack running: `make up`
- Required environment variables configured (see `.env.example`)
- Redis connectivity validated
- Control Plane API token configured

### Authentication Methods

#### QR Code Authentication (Default)
1. **Start the stack**: `make up`
2. **Monitor wa-client logs**: `make logs wa-client`
3. **Look for QR code output**:
   ```
   QR Code: [████████████████████████████████]
   ```
4. **Scan with WhatsApp**: Open WhatsApp → Linked Devices → Link a device
5. **Scan the QR code** using your phone camera
6. **Verify connection**: Logs should show "WhatsApp client initialized successfully"

#### Phone Number Authentication (RemoteAuth)
1. **Configure phone pairing** in `.env`:
   ```env
   WA_REMOTE_AUTH_PHONE_NUMBER=12025550123
   WA_REMOTE_AUTH_AUTO_PAIR=true
   WA_REMOTE_AUTH_DISABLE_QR_FALLBACK=true
   ```
2. **Start the stack**: `make up`
3. **Monitor logs** for pairing code request
4. **Open WhatsApp** → Linked Devices → Link with phone number
5. **Enter the pairing code** when prompted
6. **Verify session establishment** in logs

### End-to-End Test Procedure

#### Step 1: Infrastructure Validation
```bash
# Run the comprehensive test script
./scripts/test-wa-auth.sh
```
This script validates:
- Service health endpoints
- Redis connectivity
- Docker container status
- Network connectivity between services
- Required environment variables

#### Step 2: Manual Authentication Test
1. **Clean environment**: `make down && make up`
2. **Choose authentication method** (QR or phone)
3. **Complete authentication** following method-specific steps
4. **Verify session status**:
   ```bash
   curl http://localhost:3000/healthz
   # Should return: {"ok":true,"redis":"connected"}
   ```

#### Step 3: URL Scanning Test
1. **Add bot to a WhatsApp group** (if not already)
2. **Send a test URL**: `https://example.com`
3. **Monitor scan processing**:
   ```bash
   # Check scan queue
   docker exec wbscanner-redis-1 redis-cli LRANGE bull:scan-request:wait 0 -1
   
   # Monitor verdict delivery
   docker logs -f wbscanner-wa-client-1 | grep "verdict"
   ```
4. **Verify verdict response** in the group chat

### Common Failure Patterns & Solutions

#### Redis Connection Issues
**Symptoms**:
- `Redis connectivity check failed during startup`
- Health checks return `{"ok":false,"redis":"disconnected"}`

**Solutions**:
1. Verify Redis container: `docker ps | grep redis`
2. Check Redis logs: `make logs redis`
3. Validate network: `docker network ls`
4. Test connectivity: `docker exec wbscanner-wa-client-1 ping redis`

#### WhatsApp Authentication Failures
**Symptoms**:
- QR code keeps regenerating
- "Max retry attempts reached for WhatsApp initialization"
- Session disconnects repeatedly

**Solutions**:
1. **Clear existing session**:
   ```bash
   docker exec wbscanner-wa-client-1 rm -rf /app/services/wa-client/data/session/*
   ```
2. **Check network connectivity**:
   ```bash
   docker exec wbscanner-wa-client-1 ping -c 3 web.whatsapp.com
   ```
3. **Verify Puppeteer resources**: Increase memory if needed
4. **Retry with exponential backoff**: The system automatically retries with increasing delays

#### Health Check Failures
**Symptoms**:
- Health endpoints returning 503/500
- Docker health status showing "unhealthy"

**Solutions**:
1. **Check service logs**: `make logs <service-name>`
2. **Validate Redis connectivity**: `docker exec <container> redis-cli ping`
3. **Verify port bindings**: `docker ps` to ensure ports are exposed correctly
4. **Check resource limits**: `docker stats` to monitor memory/CPU usage

### Monitoring & Metrics

#### Key Health Indicators
- `wbscanner_wa_session_state` gauge (should be 1 for 'CONNECTED')
- `wbscanner_wa_session_reconnects_total` counter (should be low/stable)
- Redis connection success rate (should be 100%)

#### Alert Thresholds
- WhatsApp session disconnected > 5 minutes
- Redis connection failures > 3 in 1 minute
- Health check failures > 2 consecutive checks

### Troubleshooting Commands

#### Quick Diagnostics
```bash
# Check all services health
curl -s http://localhost:3000/healthz && echo "wa-client OK"
curl -s http://localhost:3001/healthz && echo "scan-orchestrator OK"
curl -s http://localhost:8080/healthz && echo "control-plane OK"

# Verify Redis connectivity
docker exec wbscanner-redis-1 redis-cli ping

# Check queue status
docker exec wbscanner-redis-1 redis-cli llen bull:scan-request:wait
docker exec wbscanner-redis-1 redis-cli llen bull:scan-verdict:wait

# Monitor real-time logs
make logs wa-client | grep -E "(QR|session|connected|error)"
```

#### Session Management
```bash
# Clear WhatsApp session (force re-auth)
docker exec wbscanner-wa-client-1 rm -rf /app/services/wa-client/data/session/*

# Check RemoteAuth session
docker exec wbscanner-redis-1 redis-cli keys "remoteauth:v1:*"

# Force new RemoteAuth session
export WA_REMOTE_AUTH_FORCE_NEW_SESSION=true
make up wa-client
```

### Validation Checklist

Before declaring the authentication system "healthy", verify:

- [ ] All Docker containers running without restarts
- [ ] All health endpoints returning `{"ok":true}`
- [ ] Redis connectivity confirmed from all services
- [ ] WhatsApp session established and stable
- [ ] Test URL processed end-to-end with verdict delivered
- [ ] No error patterns in service logs
- [ ] Metrics collection working (Prometheus/Grafana if enabled)

### Automated Testing Integration

The `scripts/test-wa-auth.sh` script can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Validate WhatsApp Authentication
  run: |
    ./scripts/test-wa-auth.sh
    if [ $? -eq 0 ]; then
      echo "✅ WhatsApp authentication validation passed"
    else
      echo "❌ WhatsApp authentication validation failed"
      exit 1
    fi
```

## Setup Transcript Review
- Ask the operator to upload the latest `logs/setup-YYYYMMDD-HHmm.md` **and** companion `.json` from the run they escalated; both live on the workstation where `./setup.sh` was executed.
- In the Markdown header confirm `Final status`, `Resume hint`, and `Mode changes`. If status is `failed`, advise them to re-run `./setup.sh --resume=<checkpoint>` using the hint (preflight|environment|containers).
- Review the `Decisions` JSON section for toggled integrations, Docker profiles, and quick actions. Share the `--quick=preflight` or `--quick=resume-docker` shortcuts when the same stage needs to be replayed.
- If sensitive values appear, remind operators that secrets are auto-redacted in the transcript; still request they purge caches afterwards with `./setup.sh --quick=purge-caches`.
- Attach the Markdown artifact to Jira/Linear tickets and archive the JSON copy in the Support Ops transcript store for downstream analytics.

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
- Degraded mode alert: raised when `wbscanner_degraded_mode_events_total` increments or WhatsApp surfaces a "Scanner degraded" notice. Check Prometheus for provider-specific errors, verify API quotas (GSB, VirusTotal, Phishtank, URLhaus), and restore connectivity before retrying scans or re-enabling urlscan submissions.
- Shortener expansion failures: delete Redis key `url:shortener:{hash}` and rescan; verify `UNSHORTEN_ENDPOINT` is accessible.
- Circuit breaker open: consult Grafana's "External Providers" panel and Prometheus `wbscanner_circuit_breaker_state` gauge. Investigate upstream status, reduce traffic with feature flags (`URLSCAN_ENABLED=false`, `WHOISXML_ENABLED=false`), and rely on cached verdicts until breakers close.
- Rate limiting complaints: adjust `WA_PER_GROUP_REPLY_COOLDOWN_SECONDS`, `WA_PER_GROUP_HOURLY_LIMIT`, or `WA_GLOBAL_REPLY_RATE_PER_HOUR` in `.env`, then `docker compose up -d wa-client` to apply.

Urlscan Deep Scan Workflow:
- Queue renames must follow [Queue Naming Constraints](./DEPLOYMENT.md#queue-naming-constraints) when adjusting `SCAN_*_QUEUE` values.
- Suspicious verdicts (score 4–7) enqueue BullMQ jobs on `scan-urlscan`. Submission state lands in Postgres (`scans.urlscan_status`) and Redis (`urlscan:submitted:{hash}`).
- urlscan callbacks POST to `/urlscan/callback` (reverse proxy path `/urlscan/callback`), authenticated via `URLSCAN_CALLBACK_SECRET`. Callback payload stored in `scans.urlscan_result`.
- Manual rescan workflow:
  1. POST to the control-plane `/rescan` endpoint with `{ "url": "https://target" }` using the bearer token.
  2. Confirm the JSON response contains `urlHash` and `jobId`; the hash is the Redis suffix for any follow-up spot checks.
  3. Use `redis-cli --scan --pattern "bull:scan-request:wait"` (swap `scan-request` for your `SCAN_REQUEST_QUEUE` override) or the Bull UI to ensure the returned job id is queued and processing.
  4. Optional: `redis-cli ttl url:verdict:{urlHash}` to double-check caches were cleared (should return `-2`).

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

RemoteAuth Operations:
- RemoteAuth is enabled by default (`WA_AUTH_STRATEGY=remote`). Ensure a base64 data key is present (`WA_REMOTE_AUTH_DATA_KEY`) or supply an encrypted key with `WA_REMOTE_AUTH_ENCRYPTED_DATA_KEY` plus the appropriate KMS/Vault settings before deploying wa-client.
- Drive phone-number pairing with `WA_REMOTE_AUTH_AUTO_PAIR=true` and provide a digits-only `WA_REMOTE_AUTH_PHONE_NUMBER`. Use `WA_REMOTE_AUTH_RETRY_DELAY_MS` (default 15s) and `WA_REMOTE_AUTH_MAX_RETRIES` to tune how often wa-client re-requests a code. Set `WA_REMOTE_AUTH_DISABLE_QR_FALLBACK=true` to keep the client in phone-number mode without ever surfacing QR codes (you must open WhatsApp → Linked Devices → Link with phone number on the device to generate the code).
- Set `WA_REMOTE_AUTH_PHONE_NUMBER` (digits only, for example `12025550123`) if you plan to request pairing codes by phone number. Leave it blank to rely on QR-only pairing.
- Opt-in to automatic phone pairing with `WA_REMOTE_AUTH_AUTO_PAIR=true` once you are ready to receive codes immediately after the stack boots. Keep WhatsApp open on the target device and navigate to **Linked Devices** before starting the services. If disabled (default), wa-client emits a QR code for first-time linking.
- Session snapshots live under the Redis key prefix `remoteauth:v1:<WA_AUTH_CLIENT_ID>`; clear a session with `DEL remoteauth:v1:<clientId>:RemoteAuth-<clientId>` before re-pairing.
- Rotate encryption keys by generating a new data key, updating the env var(s), and recycling wa-client pods; old ciphertext becomes unreadable after rotation.
- Health queue `wa-health` carries state transitions; investigate repeated `CONFLICT` events or `reset_state` jobs via Bull board.
- WhatsApp auth failure alerts fire after three consecutive failures in 15 minutes; check Slack/Grafana notifications, inspect wa-client logs, and consider re-pairing or clearing the remote session if failures persist.

WhatsApp Governance & Consent:
- `WA_CONSENT_ON_JOIN`, `WA_AUTO_APPROVE_DEFAULT`, `WA_AUTO_APPROVE_RATE_PER_HOUR`, and `WA_GOVERNANCE_ACTIONS_PER_HOUR` drive default behaviour; tune them per environment and redeploy wa-client.
- Admins can override auto-approval via `!scanner autoapprove on|off|status`; the toggle persists in Redis (`wa:group:<id>:auto_approve`).
- Consent decisions persist under `wa:group:<id>:consent`; `!scanner consent approve|deny|status` updates or queries the value. Denying consent triggers an immediate leave.
- Audit logs for governance actions are emitted via pino; ship them to your log stack for later reviews.

Verdict Delivery Monitoring:
- `wbscanner_wa_verdict_delivery_total{result}` and `wbscanner_wa_verdict_delivery_retries_total` expose successes, failures, and retries. Grafana dashboard tiles and Prometheus alerts are wired to these counters.
- Use `WA_VERDICT_ACK_TIMEOUT_SECONDS` and `WA_VERDICT_ACK_MAX_RETRIES` to balance user experience with WhatsApp rate limits; raise the timeout for slower networks before increasing retry counts.
- Optional verdict attachments require `FEATURE_ATTACH_MEDIA_VERDICTS=true` plus valid assets (e.g., `WA_VERDICT_MEDIA_DIR=/app/media/verdicts` mounted read-only). Attachments default to off to avoid inflated bandwidth costs.
