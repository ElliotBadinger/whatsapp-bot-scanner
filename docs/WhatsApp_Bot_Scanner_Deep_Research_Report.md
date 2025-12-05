# WhatsApp Bot Scanner Infrastructure: Deep Research Report

**Date:** December 5, 2025  
**Research Method:** Parallel Wide Research (4 Independent Investigations)  
**Project Context:** Multi-service WhatsApp bot scanner application on Fedora 42

---

## Executive Summary

This report presents the findings of a comprehensive parallel research investigation into four critical infrastructure and authentication issues affecting a WhatsApp bot scanner application built with Node.js, TypeScript, Docker Compose, and whatsapp-web.js. The research was conducted using parallel processing to independently investigate each issue, gathering root cause analysis, recommended fixes, alternative approaches, and decision matrices.

### Key Findings Overview

| Issue | Confidence | Primary Recommendation | Implementation Effort |
|-------|-----------|----------------------|---------------------|
| **Docker Bridge Networking on Fedora 42** | High | Delegate networking to firewalld native policies | High |
| **whatsapp-web.js RemoteAuth Ready State** | High | Switch to Baileys library | High |
| **ioredis Connection Timing** | High | Use lazyConnect with explicit initialization | Low |
| **Puppeteer/Chrome Stability** | High | Implement comprehensive Chrome flags + health checks | Medium |

---

## Issue 1: Docker Bridge Networking Failure on Fedora 42

### Root Cause Analysis

The inter-container communication failure (ETIMEDOUT) stems from a **network filtering conflict** between Docker's legacy `iptables`-based networking and Fedora 42's modern `nftables`-based firewall architecture managed by `firewalld`.

**Key Technical Details:**

1. **Docker's iptables Dependency:** Docker Engine manages container networking by injecting rules into the host's `iptables` chains (specifically the `FORWARD` chain) to allow traffic between containers on the `docker0` bridge and handle Network Address Translation (NAT) for external access.

2. **Fedora 42's nftables Backend:** Fedora 42 uses `firewalld` with the `nftables` backend by default. The interaction between `firewalld` and Docker's `iptables` rules is complex and often leads to race conditions or incomplete rule application, especially for bridge traffic.

3. **The net.bridge.bridge-nf-call-iptables Parameter:** This kernel parameter controls whether packets traversing a Linux bridge are passed to the `iptables` framework:
   - **Enabled (1):** Docker's rules are applied, but `firewalld` may interfere, causing external connectivity issues
   - **Disabled (0):** Packets bypass `iptables` entirely, blocking inter-container traffic at the kernel level

The observed behavior where disabling the parameter fixes inter-container communication but breaks external DNS indicates a highly inconsistent network state where competing firewall systems are interfering with each other.

### Recommended Fixes (Ranked)

#### 1. Primary Fix: Delegate Networking to firewalld (Effort: High, Risk: Low, Maintainability: High)

This is the most stable and modern solution for Fedora/RHEL systems, making `firewalld` the single source of truth for network filtering.

**Implementation Steps:**

```json
// /etc/docker/daemon.json
{
    "iptables": false
}
```

```bash
# Reboot required to clear pre-existing iptables rules
sudo reboot

# After reboot, configure firewalld
sudo firewall-cmd --permanent --new-zone=docker
sudo firewall-cmd --permanent --zone=docker --add-source=172.17.0.0/16

sudo firewall-cmd --permanent --new-policy dockerToWorld
sudo firewall-cmd --permanent --policy dockerToWorld --add-ingress-zone docker
sudo firewall-cmd --permanent --policy dockerToWorld --add-egress-zone ANY
sudo firewall-cmd --permanent --policy dockerToWorld --set-target ACCEPT
sudo firewall-cmd --permanent --policy dockerToWorld --add-masquerade

sudo firewall-cmd --reload
```

**Note:** External port publishing must now use `firewall-cmd --add-forward-port` instead of Docker's `-p` flag.

#### 2. Quick Fix: Switch firewalld Backend (Effort: Low, Risk: Medium, Maintainability: Medium)

Revert `firewalld` to its legacy `iptables` backend:

```ini
# /etc/firewalld/firewalld.conf
FirewallBackend=iptables
```

```bash
sudo systemctl restart firewalld
sudo systemctl restart docker
```

**Risk:** Goes against the direction of modern Linux networking and may be deprecated in future Fedora releases.

#### 3. Workaround: Re-enable Bridge Filtering (Effort: Low, Risk: High, Maintainability: Low)

```bash
sudo sysctl net.bridge.bridge-nf-call-iptables=1
```

**Risk:** Often overridden by other network configuration tools, leading to instability.

### Alternative Approaches

#### Migrate to Podman

Podman is the native, daemonless container engine for Fedora/RHEL, designed to integrate seamlessly with `firewalld` and SELinux.

| Feature | Podman (Rootless) | Docker Default |
|---------|------------------|----------------|
| firewalld/nftables Integration | Seamless (no conflicts) | Poor (ongoing conflicts) |
| Security | Daemonless architecture | Daemon-based |
| docker-compose Support | Via podman-compose or podman play kube | Native |
| Learning Curve | Requires new commands/workflow | Familiar |

#### Docker with --network=host

Bypasses Docker's internal networking stack entirely.

**Pros:** Eliminates all bridge networking and firewall conflicts  
**Cons:** Eliminates network isolation (major security drawback), not suitable for production

#### Docker with --network=macvlan

Creates virtual network interfaces with unique MAC/IP addresses on the physical network.

**Pros:** Excellent performance and isolation  
**Cons:** Requires dedicated subnet and network infrastructure cooperation

### Decision Matrix

| Feature | Current (Docker Default) | Recommended (Docker + firewalld) | Alternative (Podman) |
|---------|------------------------|--------------------------------|---------------------|
| **Fedora/firewalld Integration** | Poor (conflicts) | Excellent (native capabilities) | Excellent (native to Fedora) |
| **Network Isolation** | High (when working) | High (firewalld policies) | High (Netavark/CNI) |
| **Inter-Container Communication** | Broken (ETIMEDOUT) | Functional | Functional |
| **Implementation Effort** | N/A | Medium (config + reboot) | Low (drop-in replacement) |
| **Maintainability** | Low (breaks on updates) | High (stable) | High (stable) |
| **docker-compose Compatibility** | High | High | Medium (requires podman-compose) |

### Key Sources

- [firewalld.org: Strict Filtering of Docker Containers](https://firewalld.org/2024/04/strictly-filtering-docker-containers) - Official modern configuration
- [GitHub: moby/libnetwork Issue 2647](https://github.com/moby/libnetwork/issues/2647) - Inter-container communication breakdown
- [Fedora Project Wiki: Changes/firewalld default to nftables](https://fedoraproject.org/wiki/Changes/firewalld_default_to_nftables) - Architectural change documentation
- [Red Hat Blog: Podman 4.0's new network stack](https://www.redhat.com/en/blog/podman-new-network-stack) - Podman networking model

**Confidence Level:** High - Well-documented conflict with official solutions from the firewalld project.

---

## Issue 2: whatsapp-web.js RemoteAuth + Pairing Code Flow Never Reaches Ready State

### Root Cause Analysis

The failure of the `ready` event to fire after successful authentication is caused by a **race condition and architectural limitation** in whatsapp-web.js v1.34.x when using RemoteAuth with pairing code authentication.

**Key Technical Details:**

1. **Event Sequence Breakdown:** The library expects this sequence:
   - `qr` or pairing code generation
   - User authentication (QR scan or pairing code entry)
   - `authenticated` event fires
   - WhatsApp Web's internal `onAppStateHasSyncedEvent` triggers
   - `client.info` object is populated
   - `ready` event fires

2. **The Race Condition:** When using RemoteAuth with pairing codes, the library's internal state machine may skip or fail to trigger the `onAppStateHasSyncedEvent` callback, which is responsible for populating `client.info` and emitting the `ready` event. This is exacerbated by timing issues where WhatsApp Web's internal `AuthStore.PairingCodeLinkUtils` may not be fully loaded when the library attempts to interact with it.

3. **Puppeteer Evaluation Errors:** The "Evaluation failed: t" errors occur when the library tries to execute JavaScript in the WhatsApp Web context before the necessary objects are available, indicating that the library's assumptions about WhatsApp Web's loading sequence are no longer valid.

4. **RemoteAuth Complexity:** RemoteAuth adds an additional layer of complexity by serializing and deserializing session state to/from Redis, which can introduce timing issues and state inconsistencies that the library doesn't handle robustly.

### Recommended Fixes (Ranked)

#### 1. Primary Fix: Migrate to Baileys (Effort: High, Risk: Medium, Maintainability: High)

Baileys is a WebSocket-based library that implements the WhatsApp Web protocol directly, avoiding the fragility of browser automation.

**Implementation:**

```typescript
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'

async function connectWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut
            if(shouldReconnect) {
                connectWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('WhatsApp connection ready')
        }
    })
    
    sock.ev.on('creds.update', saveCreds)
    
    return sock
}
```

**Advantages:**
- Direct protocol implementation (no browser overhead)
- Better session management and reconnection logic
- Active maintenance and WhatsApp compatibility updates
- Lower resource consumption

**Migration Effort:**
- Rewrite WhatsApp client logic
- Adapt message handling and event listeners
- Test all bot functionality
- Update session storage mechanism

#### 2. Workaround: Implement Aggressive Polling (Effort: Medium, Risk: Medium, Maintainability: Low)

Extend the current workaround with more robust polling and timeout handling:

```typescript
async function waitForReady(client: Client, maxWaitMs: number = 120000): Promise<void> {
    const startTime = Date.now()
    
    return new Promise((resolve, reject) => {
        // Set up ready event listener
        const readyHandler = () => {
            clearInterval(pollInterval)
            clearTimeout(timeout)
            resolve()
        }
        client.once('ready', readyHandler)
        
        // Aggressive polling for client.info
        const pollInterval = setInterval(async () => {
            try {
                if (client.info?.wid) {
                    clearInterval(pollInterval)
                    clearTimeout(timeout)
                    client.removeListener('ready', readyHandler)
                    resolve()
                }
                
                // Force re-evaluation of WhatsApp Web state
                await client.pupPage?.evaluate(() => {
                    if (window.Store?.Conn?.isLoggedIn()) {
                        window.Store.Conn.trigger('change:info')
                    }
                })
            } catch (error) {
                console.error('Polling error:', error)
            }
        }, 2000)
        
        // Timeout
        const timeout = setTimeout(() => {
            clearInterval(pollInterval)
            client.removeListener('ready', readyHandler)
            reject(new Error('Timeout waiting for ready state'))
        }, maxWaitMs)
    })
}
```

**Risk:** Fragile workaround that may break with WhatsApp Web updates.

#### 3. Alternative: Switch to LocalAuth (Effort: Low, Risk: Low, Maintainability: Medium)

Use LocalAuth with volume-mounted session files instead of RemoteAuth with Redis:

```typescript
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'wa-client-1',
        dataPath: '/app/sessions'
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
})
```

```yaml
# docker-compose.yml
services:
  wa-client:
    volumes:
      - ./sessions:/app/sessions
```

**Advantages:**
- Simpler session management
- Fewer moving parts (no Redis dependency for sessions)
- May avoid RemoteAuth-specific race conditions

**Disadvantages:**
- Loses centralized session storage
- Harder to scale horizontally
- Session files need backup strategy

### Alternative Approaches

#### Complete Library Migration: whatsapp-web.js vs Baileys

| Feature | whatsapp-web.js | Baileys |
|---------|----------------|---------|
| **Architecture** | Puppeteer-based browser automation | Direct WebSocket protocol implementation |
| **Resource Usage** | High (full Chrome instance) | Low (Node.js only) |
| **Reliability** | Fragile (depends on WhatsApp Web UI) | More robust (protocol-level) |
| **Session Management** | LocalAuth, RemoteAuth, NoAuth | Multi-file auth state, Redis integration |
| **Maintenance** | Active but reactive to WhatsApp changes | Active with protocol-level updates |
| **Multi-device Support** | Yes (via WhatsApp Web) | Yes (native) |
| **Pairing Code Support** | Buggy (current issue) | Stable |
| **Learning Curve** | Lower (high-level API) | Higher (protocol knowledge helpful) |
| **Ban Risk** | Medium (browser automation detectable) | Medium (unofficial API usage) |

### Decision Matrix

| Criterion | Current (whatsapp-web.js + RemoteAuth) | Fix 1 (Baileys) | Fix 2 (Aggressive Polling) | Fix 3 (LocalAuth) |
|-----------|--------------------------------------|----------------|---------------------------|------------------|
| **Reliability** | Low (ready event fails) | High (protocol-level) | Medium (workaround) | Medium (simpler) |
| **Implementation Effort** | N/A | High (full rewrite) | Medium (extend current) | Low (config change) |
| **Resource Usage** | High (Chrome) | Low (WebSocket) | High (Chrome) | High (Chrome) |
| **Maintainability** | Low (fragile) | High (stable API) | Low (brittle workaround) | Medium |
| **Scalability** | Medium (Redis sessions) | High (flexible storage) | Medium (Redis sessions) | Low (file-based) |
| **Risk** | N/A | Medium (new library) | Medium (may break) | Low (proven approach) |

### Key Sources

- [GitHub: whatsapp-web.js Issue #2475](https://github.com/pedroslopez/whatsapp-web.js/issues/2475) - RemoteAuth ready event issues
- [GitHub: whatsapp-web.js Issue #2856](https://github.com/pedroslopez/whatsapp-web.js/issues/2856) - Pairing code authentication problems
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys) - Alternative library with direct protocol implementation
- [WhatsApp Web Protocol Analysis](https://github.com/sigalor/whatsapp-web-reveng) - Understanding the underlying protocol

**Confidence Level:** High - Multiple GitHub issues document this exact problem, and Baileys is a proven alternative with better architecture for this use case.

---

## Issue 3: ioredis Connection Timing at Module Load

### Root Cause Analysis

The connection timeout errors occur because `createRedisConnection()` is invoked at **module scope** (top-level), triggering an immediate connection attempt before the application's main initialization logic can execute.

**Key Technical Details:**

1. **Module-Level Execution:** In Node.js, code at the top level of a module executes immediately when the module is imported. If `createRedisConnection()` is called at this level, it attempts to connect to Redis before:
   - Docker Compose has fully started the Redis container
   - Any retry or health check logic in `main()` can execute
   - Environment variables or configuration can be validated

2. **ioredis retryStrategy Limitation:** The `retryStrategy` option in ioredis only applies to **reconnection** attempts after an initial successful connection, not to the very first connection attempt. This means if Redis is not available when the module loads, the connection fails immediately with `ETIMEDOUT` before any retry logic can help.

3. **Docker Compose Startup Race:** Even with `depends_on` in docker-compose.yml, there's no guarantee that Redis is ready to accept connections when dependent services start. The `depends_on` directive only ensures the container is started, not that the service inside is ready.

### Recommended Fixes (Ranked)

#### 1. Primary Fix: Lazy Connection with Explicit Initialization (Effort: Low, Risk: Low, Maintainability: High)

Use ioredis's `lazyConnect` option and explicitly connect in the `main()` function with retry logic.

**Implementation:**

```typescript
// packages/shared/src/redis.ts
import Redis from 'ioredis'

export function createRedisConnection(lazyConnect: boolean = true): Redis {
    return new Redis({
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        lazyConnect: lazyConnect,  // Don't connect immediately
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000)
            return delay
        },
        maxRetriesPerRequest: null,  // Important for BullMQ
        enableReadyCheck: true,
        enableOfflineQueue: true
    })
}

// services/wa-client/src/index.ts
import { createRedisConnection } from '@shared/redis'

async function main() {
    const redis = createRedisConnection(true)  // Lazy connection
    
    // Explicit connection with retry logic
    let connected = false
    let attempts = 0
    const maxAttempts = 10
    
    while (!connected && attempts < maxAttempts) {
        try {
            await redis.connect()
            connected = true
            console.log('Redis connected successfully')
        } catch (error) {
            attempts++
            console.error(`Redis connection attempt ${attempts} failed:`, error.message)
            if (attempts >= maxAttempts) {
                throw new Error('Failed to connect to Redis after maximum attempts')
            }
            await new Promise(resolve => setTimeout(resolve, 2000 * attempts))
        }
    }
    
    // Rest of initialization...
}

main().catch(console.error)
```

**Advantages:**
- Full control over connection timing
- Explicit retry logic with exponential backoff
- Graceful error handling before starting other services
- No module-level side effects

#### 2. Alternative Fix: Health Check Wait Script (Effort: Medium, Risk: Low, Maintainability: Medium)

Add a wait-for-it script to ensure Redis is ready before starting the application.

```dockerfile
# services/wa-client/Dockerfile
FROM node:20-alpine

# Install wait-for-it
ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# ... rest of Dockerfile
```

```yaml
# docker-compose.yml
services:
  wa-client:
    command: sh -c "/wait-for-it.sh redis:6379 --timeout=30 --strict -- node dist/index.js"
    depends_on:
      - redis
```

**Advantages:**
- Ensures Redis is accepting connections before app starts
- Standard pattern in Docker environments
- No code changes required

**Disadvantages:**
- Adds external dependency
- Doesn't handle Redis failures after initial connection

#### 3. Quick Fix: Add Connection Event Handlers (Effort: Low, Risk: Medium, Maintainability: Low)

Add event handlers to manage connection state without changing initialization timing.

```typescript
export function createRedisConnection(): Redis {
    const redis = new Redis({
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        retryStrategy(times) {
            if (times > 10) {
                return null  // Stop retrying after 10 attempts
            }
            return Math.min(times * 100, 3000)
        }
    })
    
    redis.on('error', (err) => {
        console.error('Redis connection error:', err)
    })
    
    redis.on('connect', () => {
        console.log('Redis connecting...')
    })
    
    redis.on('ready', () => {
        console.log('Redis ready')
    })
    
    redis.on('reconnecting', () => {
        console.log('Redis reconnecting...')
    })
    
    return redis
}
```

**Risk:** Doesn't solve the fundamental timing issue, just makes it more observable.

### Alternative Approaches

#### Switch to Official redis Package

The official `redis` package (formerly `node-redis`) has different connection semantics that may be more intuitive.

```typescript
import { createClient } from 'redis'

async function createRedisConnection() {
    const client = createClient({
        socket: {
            host: process.env.REDIS_HOST || 'redis',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            reconnectStrategy: (retries) => {
                if (retries > 10) return new Error('Max retries reached')
                return Math.min(retries * 100, 3000)
            }
        }
    })
    
    client.on('error', err => console.error('Redis Client Error', err))
    
    await client.connect()
    return client
}
```

| Feature | ioredis | redis (official) |
|---------|---------|-----------------|
| **Connection Model** | Auto-connect by default | Explicit connect() required |
| **BullMQ Support** | Native (BullMQ uses ioredis) | Requires adapter |
| **API Style** | Callback + Promise | Promise-first |
| **Cluster Support** | Excellent | Good |
| **Maintenance** | Active | Active (official) |

**Recommendation:** Stick with ioredis due to BullMQ integration, but use `lazyConnect`.

### Decision Matrix

| Criterion | Current (Module-level Init) | Fix 1 (Lazy Connect) | Fix 2 (Wait Script) | Alternative (redis pkg) |
|-----------|---------------------------|---------------------|-------------------|----------------------|
| **Reliability** | Low (race condition) | High (explicit control) | High (guaranteed ready) | High (explicit) |
| **Implementation Effort** | N/A | Low (code change) | Medium (Docker change) | High (rewrite + BullMQ) |
| **Code Clarity** | Low (implicit timing) | High (explicit flow) | Medium (external script) | High (explicit) |
| **BullMQ Compatibility** | High | High | High | Medium (needs adapter) |
| **Maintainability** | Low (fragile) | High (standard pattern) | Medium (external dep) | Medium (different API) |

### Key Sources

- [ioredis Documentation: Lazy Connect](https://github.com/redis/ioredis#connect-to-redis) - Official documentation on lazy connection
- [BullMQ Connection Best Practices](https://docs.bullmq.io/guide/connections) - Recommended patterns for Redis connections with BullMQ
- [Docker Compose Startup Order](https://docs.docker.com/compose/startup-order/) - Official guidance on handling service dependencies
- [wait-for-it Script](https://github.com/vishnubob/wait-for-it) - Popular Docker health check utility

**Confidence Level:** High - This is a well-understood Node.js/Docker pattern with established best practices.

---

## Issue 4: Puppeteer/Chrome Stability in Docker

### Root Cause Analysis

The DNS resolution errors and process management concerns stem from the **inherent complexity of running a full Chrome browser in a containerized environment** for long-running automation tasks.

**Key Technical Details:**

1. **DNS Resolution Issues:** The `net::ERR_NAME_NOT_RESOLVED` errors when navigating to `web.whatsapp.com` are typically caused by:
   - Chrome's DNS resolver not respecting container DNS settings
   - Network namespace isolation issues
   - Chrome's internal DNS cache becoming stale
   - Insufficient Chrome flags for containerized environments

2. **Process Management Challenges:**
   - Chrome spawns multiple child processes (renderer, GPU, etc.) that can become zombies if not properly cleaned up
   - Puppeteer's process lifecycle management can fail in containerized environments, especially during crashes or restarts
   - The container's init system (PID 1) may not properly reap zombie processes

3. **Resource Constraints:** Long-running Chrome instances in containers can experience:
   - Memory leaks in Chrome or Puppeteer
   - Shared memory (`/dev/shm`) exhaustion
   - File descriptor limits being reached

4. **Base Image Considerations:** The `ghcr.io/puppeteer/puppeteer:22.13.1` image is optimized for short-lived automation tasks, not long-running sessions like WhatsApp Web automation.

### Recommended Fixes (Ranked)

#### 1. Primary Fix: Comprehensive Chrome Flags + Health Checks (Effort: Medium, Risk: Low, Maintainability: High)

Implement a robust set of Chrome flags specifically for containerized long-running automation, combined with health checks and automatic restart logic.

**Implementation:**

```typescript
// services/wa-client/src/index.ts
const puppeteerOptions = {
    headless: true,
    args: [
        // Essential for Docker
        '--no-sandbox',
        '--disable-setuid-sandbox',
        
        // DNS and networking
        '--disable-features=NetworkService',
        '--dns-prefetch-disable',
        '--disable-dns-over-https',
        
        // Stability and resource management
        '--disable-dev-shm-usage',  // Use /tmp instead of /dev/shm
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkServiceInProcess2',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-zygote',
        
        // Memory management
        '--memory-pressure-off',
        '--max-old-space-size=4096',
        
        // Process management
        '--single-process',  // Reduces zombie process risk
        
        // User agent
        '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ],
    executablePath: '/usr/bin/google-chrome-stable',
    ignoreHTTPSErrors: true,
    timeout: 30000
}

// Health check and restart logic
async function monitorChromeHealth(client: Client) {
    setInterval(async () => {
        try {
            const page = await client.pupPage
            if (!page || page.isClosed()) {
                console.error('Chrome page is closed, restarting client...')
                await restartClient(client)
                return
            }
            
            // Check if page is responsive
            const isResponsive = await Promise.race([
                page.evaluate(() => true),
                new Promise(resolve => setTimeout(() => resolve(false), 5000))
            ])
            
            if (!isResponsive) {
                console.error('Chrome page is unresponsive, restarting client...')
                await restartClient(client)
            }
        } catch (error) {
            console.error('Health check failed:', error)
            await restartClient(client)
        }
    }, 60000)  // Check every minute
}

async function restartClient(client: Client) {
    try {
        await client.destroy()
    } catch (error) {
        console.error('Error destroying client:', error)
    }
    
    // Kill any remaining Chrome processes
    exec('pkill -9 chrome', (error) => {
        if (error) console.error('Error killing Chrome processes:', error)
    })
    
    // Restart client initialization
    await initializeClient()
}
```

**Docker Configuration:**

```dockerfile
# services/wa-client/Dockerfile
FROM ghcr.io/puppeteer/puppeteer:22.13.1

# Increase shared memory size
RUN echo "tmpfs /dev/shm tmpfs defaults,size=2g 0 0" >> /etc/fstab

# Install dumb-init for proper process management
RUN apt-get update && apt-get install -y dumb-init

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
services:
  wa-client:
    shm_size: '2gb'  # Increase shared memory
    cap_add:
      - SYS_ADMIN  # Required for Chrome sandboxing
    security_opt:
      - seccomp:unconfined  # Required for Chrome
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

#### 2. Alternative Fix: Use Browserless Service (Effort: Medium, Risk: Low, Maintainability: High)

Delegate browser management to a dedicated service like Browserless.io (self-hosted or cloud).

```yaml
# docker-compose.yml
services:
  browserless:
    image: browserless/chrome:latest
    environment:
      - MAX_CONCURRENT_SESSIONS=10
      - CONNECTION_TIMEOUT=600000
      - PREBOOT_CHROME=true
    ports:
      - "3001:3000"
    shm_size: '2gb'
  
  wa-client:
    environment:
      - BROWSERLESS_URL=ws://browserless:3000
```

```typescript
// services/wa-client/src/index.ts
const client = new Client({
    authStrategy: new RemoteAuth({ /* ... */ }),
    puppeteer: {
        browserWSEndpoint: process.env.BROWSERLESS_URL || 'ws://browserless:3000'
    }
})
```

**Advantages:**
- Professional browser management with health checks
- Automatic process cleanup and resource management
- Better isolation between WhatsApp sessions and browser instances
- Built-in monitoring and metrics

**Disadvantages:**
- Additional service dependency
- Slightly higher resource usage
- Cloud version has costs (self-hosted is free)

#### 3. Quick Fix: Add DNS Resolution Workaround (Effort: Low, Risk: Medium, Maintainability: Low)

Force Chrome to use specific DNS servers and pre-resolve domains.

```typescript
const puppeteerOptions = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--host-resolver-rules=MAP web.whatsapp.com 157.240.0.53',  // WhatsApp IP
        '--dns-server=8.8.8.8,8.8.4.4'  // Use Google DNS
    ]
}
```

**Risk:** Hardcoded IPs can become stale; WhatsApp uses CDN with multiple IPs.

### Alternative Approaches

#### Migrate to Playwright

Playwright is a modern alternative to Puppeteer with better containerization support.

```typescript
import { chromium } from 'playwright'

const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
})

const context = await browser.newContext({
    userAgent: 'Mozilla/5.0...'
})

const page = await context.newPage()
```

| Feature | Puppeteer | Playwright |
|---------|-----------|-----------|
| **Container Support** | Good | Excellent |
| **Process Management** | Manual | Better built-in |
| **Multi-browser** | Chrome only | Chrome, Firefox, WebKit |
| **whatsapp-web.js Support** | Native | Requires fork/adaptation |
| **Maintenance** | Google (active) | Microsoft (active) |

**Note:** whatsapp-web.js is tightly coupled to Puppeteer, so migration would require significant refactoring or using a fork.

#### Browser Pool Pattern

Implement a browser instance pool to isolate sessions and enable graceful restarts.

```typescript
class BrowserPool {
    private browsers: Browser[] = []
    private maxBrowsers = 3
    
    async getBrowser(): Promise<Browser> {
        // Round-robin or least-loaded selection
        if (this.browsers.length < this.maxBrowsers) {
            const browser = await puppeteer.launch(puppeteerOptions)
            this.browsers.push(browser)
            return browser
        }
        return this.browsers[Math.floor(Math.random() * this.browsers.length)]
    }
    
    async restartBrowser(browser: Browser) {
        const index = this.browsers.indexOf(browser)
        if (index > -1) {
            await browser.close()
            this.browsers[index] = await puppeteer.launch(puppeteerOptions)
        }
    }
}
```

### Decision Matrix

| Criterion | Current (Basic Setup) | Fix 1 (Comprehensive Flags) | Fix 2 (Browserless) | Alternative (Playwright) |
|-----------|--------------------|---------------------------|-------------------|----------------------|
| **Stability** | Low (DNS errors, zombies) | High (robust flags + health checks) | Very High (managed service) | High (better container support) |
| **Implementation Effort** | N/A | Medium (config + monitoring) | Medium (new service) | High (library migration) |
| **Resource Usage** | Medium | Medium | Medium-High (separate service) | Medium |
| **Process Management** | Poor (manual) | Good (dumb-init + monitoring) | Excellent (built-in) | Good (better APIs) |
| **Maintainability** | Low (fragile) | High (documented flags) | High (managed) | Medium (new library) |
| **whatsapp-web.js Compatibility** | High | High | High | Low (requires fork) |

### Key Sources

- [Puppeteer Troubleshooting: Running in Docker](https://pptr.dev/troubleshooting#running-puppeteer-in-docker) - Official Docker guidance
- [Browserless Documentation](https://www.browserless.io/docs) - Managed browser service
- [Chrome Headless Docker Best Practices](https://github.com/Zenika/alpine-chrome) - Community-maintained Chrome Docker image
- [dumb-init: Proper PID 1 for Containers](https://github.com/Yelp/dumb-init) - Process management for containers
- [Stack Overflow: Chrome DNS Issues in Docker](https://stackoverflow.com/questions/45323271/how-to-run-google-chrome-headless-in-docker) - Community solutions

**Confidence Level:** High - These are well-documented issues with established solutions in the Puppeteer/Docker community.

---

## Overall Recommendations

### Immediate Actions (Low Effort, High Impact)

1. **ioredis Connection Timing** → Implement lazy connection with explicit initialization (Issue 3, Fix 1)
   - **Effort:** Low (1-2 hours)
   - **Impact:** Eliminates connection race conditions
   - **Risk:** Very low

2. **Puppeteer Chrome Flags** → Add comprehensive Chrome flags and health checks (Issue 4, Fix 1)
   - **Effort:** Medium (4-6 hours)
   - **Impact:** Significantly improves Chrome stability
   - **Risk:** Low

### Short-term Actions (Medium Effort, High Impact)

3. **Docker Networking** → Switch firewalld backend to iptables (Issue 1, Fix 2)
   - **Effort:** Low (30 minutes)
   - **Impact:** Immediate fix for inter-container communication
   - **Risk:** Medium (temporary solution)
   - **Note:** Plan for long-term fix (firewalld native policies)

4. **whatsapp-web.js** → Switch to LocalAuth (Issue 2, Fix 3)
   - **Effort:** Low (2-3 hours)
   - **Impact:** May resolve ready state issues
   - **Risk:** Low
   - **Note:** Evaluate if this resolves the issue before committing to Baileys migration

### Long-term Actions (High Effort, High Impact)

5. **Docker Networking** → Implement firewalld native policies OR migrate to Podman (Issue 1, Fix 1 or Alternative)
   - **Effort:** High (1-2 days)
   - **Impact:** Permanent, maintainable solution
   - **Risk:** Low (well-documented approach)

6. **whatsapp-web.js** → Migrate to Baileys (Issue 2, Fix 1)
   - **Effort:** High (3-5 days)
   - **Impact:** More reliable WhatsApp automation
   - **Risk:** Medium (new library, different API)
   - **Trigger:** Only if LocalAuth doesn't resolve ready state issues

### Architectural Considerations

#### Current Architecture Assessment

| Component | Status | Recommendation |
|-----------|--------|---------------|
| **Container Runtime** | Docker on Fedora 42 | Migrate to Podman (native to Fedora) OR implement firewalld policies |
| **WhatsApp Library** | whatsapp-web.js (fragile) | Evaluate Baileys if issues persist after LocalAuth switch |
| **Session Storage** | Redis (RemoteAuth) | Switch to LocalAuth short-term, evaluate needs long-term |
| **Browser Automation** | Puppeteer (basic config) | Implement comprehensive flags + health checks |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **WhatsApp Web UI changes break automation** | High | High | Migrate to Baileys (protocol-level) |
| **Docker networking continues to fail** | Medium | High | Migrate to Podman or implement firewalld policies |
| **Chrome crashes in production** | Medium | Medium | Implement health checks + automatic restart |
| **Session loss during restarts** | Low | Medium | Implement session backup strategy |

---

## Conclusion

This deep research has identified four critical infrastructure issues affecting the WhatsApp bot scanner application, each with well-documented root causes and actionable solutions. The recommended approach is to implement quick wins first (ioredis lazy connection, Chrome flags) while planning for strategic migrations (Podman, potentially Baileys) to address fundamental architectural limitations.

The highest-priority issue is the **Docker networking conflict on Fedora 42**, which is blocking all inter-container communication. The immediate fix is to switch firewalld to iptables backend, followed by a planned migration to either firewalld native policies or Podman for long-term stability.

The **whatsapp-web.js ready state issue** is the most architecturally significant, as it suggests the current browser automation approach may be fundamentally fragile. The recommended path is to first try LocalAuth (low effort) and, if issues persist, commit to a Baileys migration for a more robust, protocol-level solution.

All recommendations are backed by high-confidence research from official documentation, active GitHub issues, and community best practices from 2024-2025.

---

**Research Completed:** December 5, 2025  
**Methodology:** Parallel Wide Research with 4 independent investigation threads  
**Overall Confidence:** High across all four research objectives
