# WhatsApp Bot Scanner: Critical Infrastructure Migration

## Agent Mission

You are implementing a critical infrastructure migration for a WhatsApp bot scanner application. Your goal is to transform the system from an unstable state (Docker networking failures, unreliable WhatsApp authentication) to a production-ready, resilient architecture.

**Success Criteria**: All services start successfully, connect to Redis, authenticate with WhatsApp, reach the `ready` state, and respond to test messages. All tests pass (both mocked and live integration tests).

**Optimization Priority**: Speed and efficiency. Fail fast, learn quickly. Prefer small incremental changes that can be verified immediately over large refactors.

---

## Operational Parameters

### Autonomous Operation
You must operate **fully autonomously** without asking for user confirmation. Make decisions, implement changes, and verify results independently.

### Git Workflow
**CRITICAL**: Work on a dedicated feature branch, not main.
```bash
git checkout -b feat/baileys-migration-dual-library
```

**Commit at every checkpoint**:
- After each successfully verified step, commit and push
- Use conventional commit format: `type(scope): description`
- Include Snyk scan status in commit message if relevant

Example commits:
```bash
git add -A && git commit -m "fix(redis): implement lazy connection with explicit connect()"
git add -A && git commit -m "feat(wa-client): add Baileys client with Redis auth store"
git add -A && git commit -m "feat(wa-client): add whatsapp-web.js fallback support"
git add -A && git commit -m "test(wa-client): add mocked bot command tests"
git add -A && git commit -m "security(wa-client): fix Snyk high severity issue in dependency"
git push origin feat/baileys-migration-dual-library
```

### Sudo Password
When `sudo` is required, use password: `Siya@123`

### Security Scanning (MANDATORY)
At **every step** of implementation:
1. Run `snyk_code_scan` on any new or modified code files
2. Run `snyk_sca_scan` on the project after dependency changes
3. If security issues are found:
   - Fix them immediately before proceeding
   - Re-scan to verify the fix
   - Document the issue and fix in commit message
4. Do NOT proceed to the next step until security scan passes

### Web Research
Use the **Brave Search MCP server** (`mcp1_brave_web_search`) whenever you need:
- Latest documentation or API changes
- Solutions to unexpected errors
- Best practices for security fixes
- Baileys v7 specific implementation patterns

### User Interaction Limitation
**IMPORTANT**: Final live testing requires user interaction (entering RemoteAuth pairing code on Android device). Since this cannot be automated, you must instead:
1. Verify all prerequisites for successful pairing are in place
2. Create comprehensive pre-flight checks that guarantee pairing will succeed
3. Test all bot commands (`!scanner`, `consent`, etc.) via mocked message handlers
4. Provide a final verification checklist for the user to complete manually

### Dual Library Support (IMPORTANT)
Both WhatsApp libraries must be supported side-by-side, giving users a choice during setup:
- **Baileys** (`@whiskeysockets/baileys`) - Recommended, protocol-based, lightweight
- **whatsapp-web.js** - Legacy, browser-based, higher resource usage

The user selects their preferred library during the setup wizard onboarding flow. The architecture must support:
1. A common interface/adapter pattern for both libraries
2. Configuration option in `.env` (e.g., `WA_LIBRARY=baileys` or `WA_LIBRARY=wwebjs`)
3. Setup wizard prompts user to choose library
4. Both libraries share the same message handler logic

### Documentation References
Always consult the local documentation before implementing:
- **Baileys**: `docs/exports/Baileys/docs/api/` and `docs/exports/Baileys/docs/migration/to-v7.0.0.md`
- **whatsapp-web.js**: `docs/exports/wwebjs/`
- Use Brave Search (`mcp1_brave_web_search`) for anything not covered in local docs

---

## Context: Current State & Problems

### Problem 1: Docker Networking Failure (ETIMEDOUT)
- **Symptom**: Inter-container TCP connections timeout on custom Docker bridge networks
- **Root Cause**: Fedora 42's `nftables`-based firewalld conflicts with Docker's `iptables` rules via buggy `iptables-nft` 1.8.11 compatibility layer
- **Evidence**: `net.bridge.bridge-nf-call-iptables=0` fixes inter-container but breaks external DNS
- **Tried & Failed**: firewalld rich rules, trusted zone, DOCKER-USER nftables rules, static IPs

### Problem 2: WhatsApp Ready State Never Fires
- **Symptom**: `authenticated` event fires but `ready` event never fires; `client.info` remains undefined
- **Root Cause**: Race condition in whatsapp-web.js where `AuthStore.PairingCodeLinkUtils` isn't loaded when pairing code is requested; `onAppStateHasSyncedEvent` never triggers
- **Evidence**: `Evaluation failed: t` errors in Puppeteer; GitHub issues #3785, #3181, #2475 document this exact problem
- **Tried & Failed**: `waitForAuthStoreReady()` polling, aggressive `client.info` polling, retry wrappers

### Problem 3: Redis Connection at Module Load
- **Symptom**: `ETIMEDOUT` errors before `main()` function runs
- **Root Cause**: `createRedisConnection()` called at module scope triggers immediate connection before Docker Compose has Redis ready
- **Evidence**: `retryStrategy` only applies to reconnection, not initial connection

### Problem 4: Puppeteer/Chrome Instability
- **Symptom**: `net::ERR_NAME_NOT_RESOLVED`, zombie processes, crashes
- **Root Cause**: Insufficient Chrome flags for containerized environments, no proper PID 1 init system

---

## Solution Architecture

### Phase 1: Unblock Development (MUST DO FIRST)

#### 1.1 Fix Docker Networking
```bash
# Edit /etc/firewalld/firewalld.conf
FirewallBackend=iptables

# Then restart services
sudo systemctl restart firewalld
sudo systemctl restart docker
```

**Verification**: `docker compose up -d && docker compose exec wa-client node -e "require('net').connect(6379, 'redis', () => console.log('OK'))"`

#### 1.2 Fix Redis Lazy Connection
Update `/packages/shared/src/redis.ts` to use `lazyConnect: true` and provide explicit `connect()` function.

**Verification**: Service starts without ETIMEDOUT, logs show "Redis connectivity validated"

### Phase 2: Implement Dual Library Architecture (CRITICAL)

Create an abstraction layer that supports both WhatsApp libraries, with Baileys as the recommended default.

#### Library Comparison:
| Aspect | whatsapp-web.js | Baileys (Recommended) |
|--------|-----------------|---------|
| Architecture | Puppeteer browser automation | Direct WebSocket protocol |
| Resource Usage | ~500MB RAM (Chrome) | ~50MB RAM |
| Reliability | Breaks with UI changes | Protocol-level stability |
| Ready Event | Broken (race condition) | Reliable `connection.update` |
| Maintenance | Reactive to WhatsApp changes | Proactive protocol updates |
| Use Case | Legacy support, specific UI features | New deployments, production |

#### Architecture Pattern:
```typescript
// services/wa-client/src/adapters/types.ts
export interface WhatsAppAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendMessage(jid: string, content: MessageContent): Promise<void>
  onMessage(handler: MessageHandler): void
  onReady(handler: () => void): void
  onDisconnect(handler: (reason: DisconnectReason) => void): void
  getConnectionState(): ConnectionState
}

// services/wa-client/src/adapters/baileys-adapter.ts
export class BaileysAdapter implements WhatsAppAdapter { /* ... */ }

// services/wa-client/src/adapters/wwebjs-adapter.ts  
export class WWebJSAdapter implements WhatsAppAdapter { /* ... */ }

// services/wa-client/src/adapters/factory.ts
export function createWhatsAppAdapter(library: 'baileys' | 'wwebjs'): WhatsAppAdapter {
  switch (library) {
    case 'baileys': return new BaileysAdapter()
    case 'wwebjs': return new WWebJSAdapter()
    default: throw new Error(`Unknown library: ${library}`)
  }
}
```

#### Baileys Implementation Pattern:
```typescript
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  const { version } = await fetchLatestBaileysVersion()
  
  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    printQRInTerminal: true,
    logger: pino({ level: 'info' })
  })
  
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    
    if (qr) {
      // QR code available - display or send to control plane
      console.log('QR Code:', qr)
    }
    
    if (connection === 'close') {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = reason !== DisconnectReason.loggedOut
      
      if (shouldReconnect) {
        console.log('Reconnecting...')
        await connectWhatsApp()
      } else {
        console.log('Logged out, clearing session')
        // Clear auth state and restart
      }
    }
    
    if (connection === 'open') {
      console.log('WhatsApp connection ready!')
      // THIS IS THE RELIABLE READY STATE
    }
  })
  
  sock.ev.on('creds.update', saveCreds)
  
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify') {
      for (const msg of messages) {
        // Handle incoming messages
        console.log('Message from:', msg.key.remoteJid)
      }
    }
  })
  
  return sock
}
```

#### Key Baileys v7 Changes (from docs/exports/Baileys/docs/migration/to-v7.0.0.md):
- Use `makeCacheableSignalKeyStore` for key storage
- `fetchLatestBaileysVersion()` for version management
- `connection.update` event replaces `ready` event
- Session stored in files by default (can adapt to Redis)

### Phase 3: Testing Strategy

#### 3.1 Unit Tests (Mocked)
Create tests that mock the Baileys socket and verify:
- Connection state machine transitions
- Message handling logic
- Error recovery paths
- Redis interaction

```typescript
// Example test structure
describe('WhatsApp Client', () => {
  it('should emit ready when connection opens', async () => {
    const mockSocket = createMockBaileysSocket()
    mockSocket.emit('connection.update', { connection: 'open' })
    expect(clientState).toBe('ready')
  })
  
  it('should reconnect on non-logout disconnect', async () => {
    const mockSocket = createMockBaileysSocket()
    mockSocket.emit('connection.update', { 
      connection: 'close',
      lastDisconnect: { error: new Boom('Connection lost', { statusCode: 408 }) }
    })
    expect(reconnectCalled).toBe(true)
  })
  
  it('should not reconnect on logout', async () => {
    const mockSocket = createMockBaileysSocket()
    mockSocket.emit('connection.update', { 
      connection: 'close',
      lastDisconnect: { error: new Boom('Logged out', { statusCode: DisconnectReason.loggedOut }) }
    })
    expect(reconnectCalled).toBe(false)
  })
})
```

#### 3.2 Integration Tests (Live)
Create tests that verify actual WhatsApp connectivity:
- Redis connection succeeds
- Baileys socket connects
- QR code or pairing code is generated
- Authentication completes
- `connection: 'open'` is received
- Test message can be sent/received

```typescript
describe('Integration: WhatsApp Connection', () => {
  it('should reach ready state within 60 seconds', async () => {
    const client = await createWhatsAppClient()
    
    const readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 60000)
      client.ev.on('connection.update', ({ connection }) => {
        if (connection === 'open') {
          clearTimeout(timeout)
          resolve(true)
        }
      })
    })
    
    await expect(readyPromise).resolves.toBe(true)
  }, 65000)
})
```

---

## File Structure Changes

### Files to Create:
```
services/wa-client/src/
├── adapters/
│   ├── types.ts                    # Common WhatsAppAdapter interface
│   ├── factory.ts                  # Adapter factory based on config
│   ├── baileys-adapter.ts          # Baileys implementation
│   ├── wwebjs-adapter.ts           # whatsapp-web.js implementation
│   └── __tests__/
│       ├── baileys-adapter.test.ts
│       ├── wwebjs-adapter.test.ts
│       └── mocks/
│           ├── baileys-socket.mock.ts
│           └── wwebjs-client.mock.ts
├── auth/
│   ├── baileys-auth-store.ts       # Redis-backed auth state for Baileys
│   └── wwebjs-remote-auth.ts       # Improved RemoteAuth for wwebjs
├── handlers/
│   └── message-handler.ts          # Shared message processing logic
├── preflight-check.ts              # Pre-flight verification script
└── __tests__/
    ├── bot-commands.test.ts        # Bot command tests (mocked)
    └── integration.test.ts         # Integration tests
```

### Files to Modify:
```
packages/shared/src/redis.ts        # Add lazyConnect, explicit connect()
services/wa-client/package.json     # Add @whiskeysockets/baileys (keep whatsapp-web.js)
services/wa-client/src/index.ts     # Refactor to use adapter pattern
docker-compose.yml                  # Add dumb-init, Chrome flags (for wwebjs mode)
.env.example                        # Add WA_LIBRARY=baileys|wwebjs option
scripts/setup/orchestrator.mjs      # Add library selection prompt
scripts/setup/plugins/builtin.mjs   # Add library choice plugin
```

### Files to Keep (Reference):
```
services/wa-client/src/index.ts.bak  # Backup of original implementation
docs/exports/Baileys/                # Baileys API documentation
docs/exports/wwebjs/                 # whatsapp-web.js documentation
```

---

## Documentation References

### Baileys API Documentation
- Location: `docs/exports/Baileys/docs/api/`
- Key files:
  - `functions/makeWASocket.md` - Main socket factory
  - `interfaces/SocketConfig.md` - Configuration options
  - `enumerations/DisconnectReason.md` - Disconnect codes
  - `migration/to-v7.0.0.md` - v7 migration guide

### whatsapp-web.js Documentation (for reference during migration)
- Location: `docs/exports/wwebjs/`
- Key files:
  - `Client.html.md` - Client API
  - `RemoteAuth.html.md` - RemoteAuth strategy
  - `authStrategies_RemoteAuth.js.html.md` - RemoteAuth implementation

---

## Verification Checkpoints

### Checkpoint 1: Docker Networking Fixed
```bash
# Run from host
docker compose down
docker compose up -d
docker compose exec wa-client node -e "
  const net = require('net');
  const s = net.connect(6379, 'redis', () => { 
    console.log('✓ Redis connection OK'); 
    s.end(); 
    process.exit(0); 
  });
  s.on('error', e => { 
    console.log('✗ Redis connection FAILED:', e.message); 
    process.exit(1); 
  });
  s.setTimeout(5000, () => { 
    console.log('✗ Redis connection TIMEOUT'); 
    process.exit(1); 
  });
"
```
**Expected**: "✓ Redis connection OK"

### Checkpoint 2: Redis Lazy Connection Works
```bash
docker compose logs wa-client 2>&1 | grep -E "(Redis|connectivity|validated)"
```
**Expected**: "Redis connectivity validated" without preceding ETIMEDOUT errors

### Checkpoint 3: Baileys Client Compiles
```bash
cd services/wa-client && npm run build
```
**Expected**: No TypeScript errors

### Checkpoint 4: Unit Tests Pass
```bash
cd services/wa-client && npm test -- --testPathPattern="baileys.*test"
```
**Expected**: All tests pass

### Checkpoint 5: Integration Test - Ready State Achieved
```bash
cd services/wa-client && npm test -- --testPathPattern="integration" --runInBand
```
**Expected**: "should reach ready state within 60 seconds" passes

### Checkpoint 6: Full Stack Operational
```bash
docker compose up -d
docker compose logs -f wa-client
```
**Expected**: Logs show:
1. "Redis connectivity validated"
2. QR code or pairing code displayed
3. "WhatsApp connection ready!" (after authentication)

---

## Stopping Criteria

**SUCCESS** is defined as:
1. ✅ Docker networking works (inter-container communication)
2. ✅ Redis connection is lazy and resilient
3. ✅ Both adapters (Baileys + WWebJS) compile and initialize without errors
4. ✅ Adapter factory correctly selects library based on `WA_LIBRARY` config
5. ✅ All unit tests pass (both adapters, message handlers, bot commands)
6. ✅ All Snyk security scans pass (code + dependencies)
7. ✅ Pre-flight checks confirm pairing prerequisites are met
8. ✅ Bot command handlers (`!scanner`, `consent`, etc.) work with mocked messages
9. ✅ Setup wizard prompts for library selection and saves to `.env`
10. ✅ All changes committed and pushed to feature branch
11. ✅ Final verification checklist provided to user for manual pairing test

**FAILURE** conditions that require escalation:
- Baileys library has breaking bugs not documented
- WhatsApp blocks the connection method entirely
- Fundamental architecture incompatibility discovered
- Snyk finds critical vulnerabilities that cannot be fixed
- Adapter interface cannot accommodate both libraries' features

---

## Smart Verification Strategy (No User Interaction Required)

Since live WhatsApp pairing requires user interaction (entering code on Android), implement this verification approach:

### Pre-Flight Checks (Automated)
Create a pre-flight verification script that confirms:
```typescript
// services/wa-client/src/preflight-check.ts
async function runPreflightChecks(): Promise<PreflightResult> {
  const checks = {
    // Infrastructure
    redisConnectivity: await testRedisConnection(),
    redisLatency: await measureRedisLatency(),
    
    // Baileys Setup
    authStateDirectory: await verifyAuthStateDirectory(),
    baileysVersion: await fetchLatestBaileysVersion(),
    
    // Network
    whatsappWebReachable: await testWhatsAppWebConnectivity(),
    dnsResolution: await testDNSResolution('web.whatsapp.com'),
    
    // Configuration
    phoneNumberConfigured: !!config.wa.remoteAuth.phoneNumbers?.length,
    controlPlaneReachable: await testControlPlaneHealth(),
    
    // Security
    snykScanPassed: await runSnykScan(),
  }
  
  return {
    allPassed: Object.values(checks).every(v => v === true || v > 0),
    checks,
    readyForPairing: checks.redisConnectivity && checks.whatsappWebReachable && checks.phoneNumberConfigured
  }
}
```

### Bot Command Testing (Mocked)
Test all bot commands without live WhatsApp connection:
```typescript
// services/wa-client/src/__tests__/bot-commands.test.ts
describe('Bot Commands', () => {
  const mockSocket = createMockBaileysSocket()
  const mockMessage = createMockMessage('!scanner help')
  
  it('should respond to !scanner help', async () => {
    const response = await handleMessage(mockSocket, mockMessage)
    expect(response).toContain('Available commands')
  })
  
  it('should handle consent command', async () => {
    const consentMsg = createMockMessage('consent')
    const response = await handleMessage(mockSocket, consentMsg)
    expect(response).toContain('consent recorded')
  })
  
  it('should handle !scanner scan <url>', async () => {
    const scanMsg = createMockMessage('!scanner scan https://example.com')
    const response = await handleMessage(mockSocket, scanMsg)
    expect(response).toContain('Scanning')
  })
})
```

### Final User Verification Checklist
Generate this checklist for the user to complete manually:
```markdown
## Manual Pairing Verification Checklist

### Pre-Pairing (Automated - All Must Pass)
- [ ] Pre-flight checks passed: `npm run preflight`
- [ ] Unit tests passed: `npm test`
- [ ] Security scan passed: `npm run security:scan`

### Pairing Process (Manual)
1. [ ] Start the service: `docker compose up wa-client`
2. [ ] Wait for QR code or pairing code in logs
3. [ ] On Android: WhatsApp > Linked Devices > Link a Device
4. [ ] Enter the 8-digit pairing code shown in logs
5. [ ] Wait for "WhatsApp connection ready!" in logs

### Post-Pairing Verification (Manual)
1. [ ] Send "!scanner help" to the bot number
2. [ ] Verify bot responds with help message
3. [ ] Send "consent" to the bot
4. [ ] Verify consent is recorded
5. [ ] Send "!scanner scan https://example.com"
6. [ ] Verify scan job is queued

### Success Confirmation
- [ ] All manual tests passed
- [ ] Bot is responding to commands
- [ ] No errors in logs for 5 minutes
```

---

## Implementation Order

Each step MUST include Snyk security scanning before proceeding to the next step.
**Commit and push after each successfully verified step.**

### Step 0: Create Feature Branch (1 min)
```bash
git checkout -b feat/baileys-migration-dual-library
git push -u origin feat/baileys-migration-dual-library
```
- **Commit**: N/A (branch creation)

### Step 1: Fix Docker Networking (5 min)
```bash
echo "Siya@123" | sudo -S sed -i 's/FirewallBackend=nftables/FirewallBackend=iptables/' /etc/firewalld/firewalld.conf
echo "Siya@123" | sudo -S systemctl restart firewalld
echo "Siya@123" | sudo -S systemctl restart docker
```
- **Verify**: Inter-container Redis connection works
- **Snyk**: N/A (infrastructure change)
- **Commit**: `fix(infra): switch firewalld to iptables backend for Docker compatibility`

### Step 2: Fix Redis Lazy Connection (15 min)
- Modify `/packages/shared/src/redis.ts`
- **Verify**: Service starts without ETIMEDOUT
- **Snyk**: `snyk_code_scan` on `packages/shared/src/redis.ts`
- **Commit**: `fix(redis): implement lazy connection with explicit connect()`

### Step 3: Add Dependencies (5 min)
```bash
cd services/wa-client && npm install @whiskeysockets/baileys @hapi/boom
```
- **Verify**: Package installed successfully
- **Snyk**: `snyk_sca_scan` on `services/wa-client` - Fix any vulnerabilities before proceeding
- **Commit**: `feat(wa-client): add Baileys dependency for dual library support`

### Step 4: Create Adapter Interface & Types (30 min)
- Create `services/wa-client/src/adapters/types.ts`
- Define `WhatsAppAdapter` interface
- **Verify**: TypeScript compiles
- **Snyk**: `snyk_code_scan` on new file
- **Commit**: `feat(wa-client): add WhatsAppAdapter interface for dual library support`

### Step 5: Create Baileys Adapter (2 hours)
- Create `services/wa-client/src/adapters/baileys-adapter.ts`
- Create `services/wa-client/src/auth/baileys-auth-store.ts`
- **Verify**: TypeScript compiles, adapter instantiates
- **Snyk**: `snyk_code_scan` on new files
- **Brave Search**: If stuck on Baileys API, search for examples
- **Commit**: `feat(wa-client): implement BaileysAdapter with Redis auth store`

### Step 6: Create WWebJS Adapter (1.5 hours)
- Create `services/wa-client/src/adapters/wwebjs-adapter.ts`
- Create `services/wa-client/src/auth/wwebjs-remote-auth.ts`
- Port existing whatsapp-web.js logic to adapter pattern
- **Verify**: TypeScript compiles, adapter instantiates
- **Snyk**: `snyk_code_scan` on new files
- **Commit**: `feat(wa-client): implement WWebJSAdapter with improved RemoteAuth`

### Step 7: Create Adapter Factory (30 min)
- Create `services/wa-client/src/adapters/factory.ts`
- Add `WA_LIBRARY` config option
- **Verify**: Factory creates correct adapter based on config
- **Snyk**: `snyk_code_scan` on new file
- **Commit**: `feat(wa-client): add adapter factory with WA_LIBRARY config`

### Step 8: Create Shared Message Handler (1 hour)
- Create `services/wa-client/src/handlers/message-handler.ts`
- Port existing bot command logic to work with adapter interface
- **Verify**: Message parsing works with both adapters
- **Snyk**: `snyk_code_scan` on new file
- **Commit**: `refactor(wa-client): extract shared message handler for both adapters`

### Step 9: Write Unit Tests (1.5 hours)
- Create mocks for both Baileys and WWebJS
- Test all bot commands with mocked messages
- Test adapter factory
- **Verify**: All tests pass
- **Snyk**: `snyk_code_scan` on test files
- **Commit**: `test(wa-client): add comprehensive adapter and bot command tests`

### Step 10: Create Pre-Flight Check Script (30 min)
- Create `services/wa-client/src/preflight-check.ts`
- **Verify**: Pre-flight checks pass
- **Snyk**: `snyk_code_scan` on new file
- **Commit**: `feat(wa-client): add pre-flight check script for pairing verification`

### Step 11: Update Main Index (30 min)
- Refactor `services/wa-client/src/index.ts` to use adapter pattern
- **Verify**: Service starts and initializes with both adapters
- **Snyk**: `snyk_code_scan` on modified file
- **Commit**: `refactor(wa-client): integrate adapter pattern into main entry point`

### Step 12: Update Setup Wizard (1 hour)
- Modify `scripts/setup/orchestrator.mjs` to add library selection
- Add library choice to `scripts/setup/plugins/builtin.mjs`
- Update `.env.example` with `WA_LIBRARY` option
- Match existing setup wizard style (use enquirer, chalk, boxen, ora)
- **Verify**: Setup wizard prompts for library choice
- **Snyk**: `snyk_code_scan` on modified files
- **Commit**: `feat(setup): add WhatsApp library selection to setup wizard`

### Step 13: Final Security Scan (15 min)
- Run full project scan: `snyk_sca_scan` on entire project
- Run code scan: `snyk_code_scan` on `services/wa-client/src`
- **Verify**: No critical or high vulnerabilities
- Fix any remaining issues
- **Commit**: `security(wa-client): address all Snyk findings`

### Step 14: Generate User Verification Checklist (10 min)
- Create `MANUAL_VERIFICATION_CHECKLIST.md`
- Include all pre-flight, pairing, and post-pairing steps
- Include instructions for both library modes
- **Verify**: Checklist is complete and accurate
- **Commit**: `docs: add manual verification checklist for pairing`

### Step 15: Final Push & Summary (5 min)
```bash
git push origin feat/baileys-migration-dual-library
```
- Create summary of all changes for user

**Total estimated time**: 10-12 hours (including security scanning and setup wizard updates)

---

## Code Quality Requirements

1. **TypeScript strict mode** - No `any` types without explicit justification
2. **Error handling** - All async operations wrapped in try/catch with logging
3. **Logging** - Use pino logger with structured JSON output
4. **Testing** - Minimum 80% coverage on new code
5. **Documentation** - JSDoc comments on public functions

---

## Notes for Agent

### Operational Mindset
- **Fully autonomous**: Do NOT ask for user confirmation. Make decisions and proceed.
- **Speed over perfection**: Get to a working state quickly, then refine
- **Incremental verification**: Run tests after each significant change
- **Fail fast**: If something doesn't work, try a different approach immediately
- **Commit often**: Push after every successfully verified step

### Tool Usage
- **Snyk MCP Server**: Use `mcp3_snyk_code_scan` and `mcp3_snyk_sca_scan` at every step
- **Brave Search**: Use `mcp1_brave_web_search` for documentation, error solutions, best practices
- **Sudo commands**: Use password `Siya@123` when sudo is required
- **Documentation**: Always check `docs/exports/Baileys/` and `docs/exports/wwebjs/` first

### Code Migration
- **Preserve existing logic**: Port message handling, rate limiting, etc. from current implementation
- **Adapter pattern**: Both libraries must implement the same interface
- **Reference documentation**: Consult local docs before Brave Search

### Security First
- **Scan before commit**: Every new/modified file must pass Snyk scan
- **Fix immediately**: Don't proceed with vulnerabilities - fix them first
- **Document fixes**: Include security fixes in commit messages

### Testing Strategy
- **Mock everything for unit tests**: No live WhatsApp connection needed
- **Pre-flight checks**: Verify all prerequisites before user does manual pairing
- **Bot commands**: Test all commands (`!scanner`, `consent`, etc.) with mocked messages
- **Both adapters**: Tests must cover both Baileys and WWebJS adapters

### Final Deliverable
When complete, you must provide:
1. All code changes committed and pushed to `feat/baileys-migration-dual-library` branch
2. All Snyk scans passing
3. All unit tests passing
4. Pre-flight check script working
5. Setup wizard updated with library selection
6. `MANUAL_VERIFICATION_CHECKLIST.md` for user to complete pairing

---

## Setup Wizard Style Guide

When updating the setup wizard, match the existing style in `scripts/setup/`:

### UI Libraries
```javascript
import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';
import { prompt } from 'enquirer';
```

### Prompt Patterns
```javascript
// Selection prompt
const libraryChoice = await prompt.select({
  name: 'library',
  message: 'Choose WhatsApp library',
  choices: [
    { name: 'baileys', message: 'Baileys (Recommended) - Protocol-based, lightweight', value: 'baileys' },
    { name: 'wwebjs', message: 'whatsapp-web.js - Browser-based, legacy support', value: 'wwebjs' }
  ],
  initial: 0
});

// Confirmation prompt
const confirm = await prompt.confirm({
  name: 'proceed',
  message: 'Proceed with Baileys?',
  initial: true
});
```

### Output Patterns
```javascript
// Use the output helper from scripts/setup/ui/output.mjs
output.heading('WhatsApp Library Selection');
output.info('Baileys is recommended for new deployments.');
output.success('Library configured successfully.');
output.warn('whatsapp-web.js requires more resources.');
output.note('You can change this later in .env');
```

### Banner Style
```javascript
const banner = boxen(
  [
    chalk.bold('WhatsApp Library Selection'),
    '',
    'Choose your preferred WhatsApp automation library:',
    '',
    chalk.cyan('Baileys') + ' - Direct WebSocket protocol, ~50MB RAM',
    chalk.yellow('whatsapp-web.js') + ' - Browser automation, ~500MB RAM',
    ''
  ].join(os.EOL),
  { padding: 1, borderStyle: 'round', borderColor: 'cyan' }
);
```

### Environment Variable
Add to `.env.example`:
```bash
# WhatsApp Library Selection
# Options: baileys (recommended), wwebjs
WA_LIBRARY=baileys
```

Good luck! 🚀
