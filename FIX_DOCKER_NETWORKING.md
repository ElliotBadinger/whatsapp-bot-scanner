# BLOCKER-1 FIX PLAN: Docker Networking + WhatsApp Authentication

## Problem Statement

The `wa-client` container cannot connect to WhatsApp Web and Redis, making the entire application non-functional.

**Current Errors:**

```
wa-client: UNHEALTHY
Error: net::ERR_NETWORK_CHANGED at https://web.whatsapp.com/
Connection Error: ECONNREFUSED redis://127.0.0.1:6379
```

## Root Cause Analysis

### Issue 1: Mixed Network Modes

```yaml
# docker-compose.yml (CURRENT - BROKEN)
wa-client:
  network_mode: host # ❌ PROBLEM
  environment:
    - REDIS_URL=redis://localhost:6379 # ❌ Won't work

redis:
  networks: [internal] # ❌ Different network!
```

**Why this breaks:**

- `wa-client` in host mode tries to connect to `localhost:6379`
- `redis` is in bridge network `internal`
- They cannot communicate

### Issue 2: Same Problem with scan-orchestrator

```yaml
scan-orchestrator:
  network_mode: host # ❌ PROBLEM
  environment:
    - REDIS_URL=redis://localhost:6379 # ❌ Won't work
```

### Issue 3: Puppeteer Network Issues

The host networking mode is causing Puppeteer to fail when connecting to WhatsApp Web.

## Solution

### Step 1: Update docker-compose.yml

**Before (lines 25-46):**

```yaml
wa-client:
  build:
    context: .
    dockerfile: services/wa-client/Dockerfile
  env_file: [.env]
  depends_on:
    - redis
  network_mode: host # ❌ REMOVE THIS
  mem_limit: 1g
  environment:
    - NODE_OPTIONS=--max-old-space-size=768
    - REDIS_URL=redis://localhost:6379 # ❌ WRONG
```

**After:**

```yaml
wa-client:
  build:
    context: .
    dockerfile: services/wa-client/Dockerfile
  env_file: [.env]
  depends_on:
    - redis
  networks: [internal] # ✅ ADD THIS
  mem_limit: 1g
  environment:
    - NODE_OPTIONS=--max-old-space-size=768
    - REDIS_URL=redis://redis:6379 # ✅ USE SERVICE NAME
  ports:
    - "3000:3000" # ✅ EXPOSE PORT
```

### Step 2: Fix scan-orchestrator (lines 48-71)

**Before:**

```yaml
scan-orchestrator:
  build:
    context: .
    dockerfile: services/scan-orchestrator/Dockerfile
  env_file: [.env]
  depends_on:
    - redis
    - migrate
  network_mode: host # ❌ REMOVE THIS
  mem_limit: 1g
  environment:
    - NODE_OPTIONS=--max-old-space-size=768
    - SQLITE_DB_PATH=/app/storage/wbscanner.db
    - REDIS_URL=redis://localhost:6379 # ❌ WRONG
```

**After:**

```yaml
scan-orchestrator:
  build:
    context: .
    dockerfile: services/scan-orchestrator/Dockerfile
  env_file: [.env]
  depends_on:
    - redis
    - migrate
  networks: [internal] # ✅ ADD THIS
  mem_limit: 1g
  environment:
    - NODE_OPTIONS=--max-old-space-size=768
    - SQLITE_DB_PATH=/app/storage/wbscanner.db
    - REDIS_URL=redis://redis:6379 # ✅ USE SERVICE NAME
  ports:
    - "3001:3001" # ✅ EXPOSE PORT
```

### Step 3: Update .env file

**Change:**

```bash
# Before
REDIS_URL=redis://localhost:6379

# After (for local Docker)
REDIS_URL=redis://redis:6379
```

**Note:** The `environment` section in docker-compose.yml overrides this, so the fix is primarily in the compose file.

### Step 4: Update health checks

**wa-client healthcheck (line 40-44):**

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/healthz || exit 1"]
  interval: 10s
  timeout: 3s
  retries: 10 # ✅ Already good, but increase start period
  start_period: 60s # ✅ ADD THIS - give WhatsApp time to connect
```

**scan-orchestrator healthcheck (line 65-69):**

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3001/healthz || exit 1"]
  interval: 10s
  timeout: 3s
  retries: 10
  start_period: 30s # ✅ ADD THIS
```

## Implementation Steps

### 1. Backup current configuration

```bash
cd /home/epistemophile/Development/whatsapp-bot-scanner
cp docker-compose.yml docker-compose.yml.backup
cp .env .env.backup
```

### 2. Stop all containers

```bash
docker compose down -v
```

### 3. Apply changes to docker-compose.yml

Use the "After" versions shown above for:

- `wa-client` service
- `scan-orchestrator` service

### 4. Update .env if needed

```bash
# Only if REDIS_URL is hardcoded there
sed -i 's|redis://localhost:6379|redis://redis:6379|g' .env
```

### 5. Rebuild containers

```bash
docker compose build --no-cache wa-client scan-orchestrator
```

### 6. Start fresh

```bash
docker compose up -d
```

### 7. Monitor startup

```bash
# Watch all logs
docker compose logs -f

# Or just wa-client
docker compose logs -f wa-client

# Check health
docker compose ps
```

### 8. Verify Redis connectivity

```bash
# Should see successful Redis connection in logs
docker compose logs wa-client | grep -i redis

# Should see "Connected to Redis" or similar
```

### 9. Verify WhatsApp connection

```bash
# Watch for QR code or pairing code
docker compose logs -f wa-client | grep -i "qr\|pair"
```

## Expected Outcome

### Success Indicators:

1. ✅ No Redis connection errors in logs
2. ✅ wa-client container shows `healthy` status
3. ✅ scan-orchestrator container shows `healthy` status
4. ✅ WhatsApp QR code or pairing code appears in logs
5. ✅ After scanning QR/entering code, session established

### Timeline:

- **Stop/rebuild:** 5 minutes
- **First startup:** 2-3 minutes
- **WhatsApp connection:** 30-60 seconds
- **Total:** ~10 minutes

## Validation Test

After services are healthy:

```bash
# 1. Check all containers healthy
docker compose ps

# Should show:
# wa-client            Up 2 minutes (healthy)
# scan-orchestrator    Up 2 minutes (healthy)
# redis                Up 2 minutes

# 2. Test Redis connectivity manually
docker compose exec wa-client sh -c 'ping -c 1 redis'

# 3. Check healthz endpoints
curl http://localhost:3000/healthz  # wa-client
curl http://localhost:3001/healthz  # scan-orchestrator

# Both should return: {"ok":true}

# 4. Send test message to WhatsApp group with URL
# e.g., "Check this: https://google.com"

# 5. Watch logs for scan activity
docker compose logs -f scan-orchestrator
```

## Rollback Plan

If issues persist:

```bash
# Restore backup
docker compose down -v
cp docker-compose.yml.backup docker-compose.yml
cp .env.backup .env

# Restart with old config
docker compose up -d
```

## Additional Notes

### Why host networking was used initially?

Likely to avoid port mapping complexity or Puppeteer issues. However:

- It breaks service discovery
- It's unnecessary for this use case
- Proper bridge networking works fine with Puppeteer

### Why this fix is safe:

- Standard Docker Compose networking pattern
- Used by thousands of similar projects
- More portable across environments
- Required for Railway/cloud deployment anyway

## Estimated Time

- **Reading this plan:** 10 minutes
- **Making changes:** 15 minutes
- **Testing/validation:** 30 minutes
- **Total:** ~1 hour

## Next Steps After Fix

Once wa-client is healthy and WhatsApp connected:

1. ✅ Mark BLOCKER-1 as complete
2. Move to BLOCKER-2 (test suite fixes)
3. Test end-to-end message scanning
4. Document working setup in quickstart guide

---

**Status:** Ready to implement  
**Risk Level:** Low (easy rollback)  
**Priority:** CRITICAL - blocks all functionality
