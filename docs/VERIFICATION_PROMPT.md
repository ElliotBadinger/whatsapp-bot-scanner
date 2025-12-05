# WhatsApp Bot Scanner: Comprehensive Verification & Completion

## Agent Mission

You are a **verification and completion agent** responsible for:

1. **Auditing** the Baileys migration implementation for completeness and correctness
2. **Comparing** feature parity between Baileys adapter and the original whatsapp-web.js implementation
3. **Validating** that tests are meaningful and provide real coverage
4. **Ensuring** the setup/onboarding flow is fully functional for the dual-library architecture
5. **Implementing** any missing features, tests, or integrations discovered during audit

**You must be thorough, not superficial.** A surface-level implementation is unacceptable. Every feature from whatsapp-web.js must have a corresponding implementation in Baileys.

---

## Operational Parameters

### Autonomous Operation

You must operate **fully autonomously** without asking for user confirmation. Make decisions, implement changes, and verify results independently.

### Runtime Environment

**ALWAYS use `bun` instead of `npm` or `node`** for all commands:

```bash
bun install          # instead of npm install
bun run build        # instead of npm run build
bun run test         # instead of npm test
bun run dev:adapter  # instead of npm run dev:adapter
bunx <package>       # instead of npx <package>
```

### Sudo Password

When `sudo` is required, use password: `Siya@123`

### Git Workflow

Continue working on the existing feature branch:

```bash
git checkout feat/baileys-migration-dual-library
```

**Commit at every checkpoint**:

- After each successfully verified/fixed item, commit and push
- Use conventional commit format: `type(scope): description`
- Include audit findings in commit messages

Example commits:

```bash
git add -A && git commit -m "fix(baileys): implement missing getContact method"
git add -A && git commit -m "feat(baileys): add channel/newsletter support"
git add -A && git commit -m "test(adapters): add comprehensive adapter parity tests"
git add -A && git commit -m "fix(setup): complete library selection flow"
git push origin feat/baileys-migration-dual-library
```

### Security Scanning (MANDATORY)

At **every step** of implementation:

1. Run `mcp3_snyk_code_scan` on any new or modified code files
2. Run `mcp3_snyk_sca_scan` on the project after dependency changes
3. If security issues are found:
   - Fix them immediately before proceeding
   - Re-scan to verify the fix
   - Document the issue and fix in commit message
4. Do NOT proceed to the next step until security scan passes

### Web Research

Use the **Brave Search MCP server** (`mcp1_brave_web_search`) whenever you need:

- Latest Baileys v7 API documentation or examples
- Solutions to unexpected errors
- Best practices for WhatsApp automation
- Feature implementation patterns

### Documentation References

**CRITICAL**: Always consult the local API documentation before implementing:

- **Baileys v7**: `docs/exports/Baileys/docs/api/` - Contains all functions, interfaces, and types
- **Baileys Migration Guide**: `docs/exports/Baileys/docs/migration/to-v7.0.0.md`
- **whatsapp-web.js**: `docs/exports/wwebjs/` - Reference for feature parity comparison

---

## Phase 1: Feature Parity Audit

### 1.1 Compare whatsapp-web.js Client API vs Baileys Adapter

Review `docs/exports/wwebjs/Client.html.md` and compare against `services/wa-client/src/adapters/baileys-adapter.ts`.

**Required Features Checklist** (verify each is implemented in Baileys adapter):

#### Core Messaging

- [ ] `sendMessage()` - Send text, media, documents
- [ ] `reply()` - Reply to a message with quote
- [ ] `react()` - React to a message with emoji
- [ ] `deleteMessage()` - Delete a message (for me / for everyone)
- [ ] `forwardMessage()` - Forward a message to another chat
- [ ] `starMessage()` - Star/unstar a message
- [ ] `pinMessage()` - Pin/unpin a message in chat

#### Media Handling

- [ ] Send images with caption
- [ ] Send videos with caption
- [ ] Send audio/voice notes
- [ ] Send documents with filename
- [ ] Send stickers
- [ ] Send location
- [ ] Send contacts (vCard)
- [ ] Download media from messages

#### Group Management

- [ ] `getGroupMetadata()` - Get group info
- [ ] `createGroup()` - Create a new group
- [ ] `addParticipants()` - Add members to group
- [ ] `removeParticipants()` - Remove members from group
- [ ] `promoteParticipants()` - Make members admin
- [ ] `demoteParticipants()` - Remove admin status
- [ ] `setGroupSubject()` - Change group name
- [ ] `setGroupDescription()` - Change group description
- [ ] `setGroupIcon()` - Change group picture
- [ ] `leaveGroup()` - Leave a group
- [ ] `getInviteCode()` - Get group invite link

#### Contact & Chat Management

- [ ] `getContacts()` - Get all contacts
- [ ] `getContactById()` - Get specific contact
- [ ] `getChats()` - Get all chats
- [ ] `getChatById()` - Get specific chat
- [ ] `isOnWhatsApp()` - Check if number is on WhatsApp
- [ ] `getProfilePicUrl()` - Get profile picture URL
- [ ] `getStatus()` - Get contact status/about
- [ ] `blockContact()` - Block a contact
- [ ] `unblockContact()` - Unblock a contact

#### Status/Stories

- [ ] `sendStatusUpdate()` - Post a status update
- [ ] `getStatusUpdates()` - Get status updates from contacts

#### Business Features (if applicable)

- [ ] `getBusinessProfile()` - Get business profile
- [ ] `getLabels()` - Get chat labels
- [ ] `getCatalog()` - Get product catalog

#### Events

- [ ] `message` / `messages.upsert` - New message received
- [ ] `message_ack` - Message acknowledgment (sent, delivered, read)
- [ ] `message_revoke_everyone` - Message deleted for everyone
- [ ] `message_revoke_me` - Message deleted for me
- [ ] `message_reaction` - Reaction added/removed
- [ ] `group_join` - User joined group
- [ ] `group_leave` - User left group
- [ ] `group_update` - Group info changed
- [ ] `presence.update` - Typing/online status
- [ ] `call` - Incoming call

### 1.2 Review Baileys API Documentation

Check `docs/exports/Baileys/docs/api/functions/makeWASocket.md` for the full Baileys API.

Key Baileys functions to verify are used:

- `makeWASocket()` - Socket creation
- `fetchLatestBaileysVersion()` - Version management
- `makeCacheableSignalKeyStore()` - Key storage
- `useMultiFileAuthState()` or custom Redis auth
- `downloadMediaMessage()` - Media download
- `generateWAMessage()` - Message generation
- `generateWAMessageContent()` - Content generation
- `prepareWAMessageMedia()` - Media preparation

### 1.3 Document Missing Features

Create a checklist of features that are:

1. **Missing entirely** - Not implemented in Baileys adapter
2. **Partially implemented** - Basic version exists but lacks full functionality
3. **Incorrectly implemented** - Implementation doesn't match expected behavior

---

## Phase 2: Test Validation

### 2.1 Review Existing Tests

Examine all test files in `services/wa-client/src/__tests__/`:

- `commands.test.ts`
- `pairing.test.ts`
- `remoteAuthStore.test.ts`
- `session-cleanup.test.ts`
- `message-store.test.ts`
- etc.

**For each test file, verify:**

1. Tests actually test the adapter interface, not just mocks
2. Tests cover both success and failure paths
3. Tests are not trivially passing (e.g., always returning true)
4. Tests cover edge cases (empty messages, invalid JIDs, network errors)

### 2.2 Required Test Coverage

Ensure tests exist for:

#### Adapter Tests

- [ ] `BaileysAdapter` unit tests with mocked socket
- [ ] `WWebJSAdapter` unit tests with mocked client
- [ ] Adapter factory tests (correct adapter selection)
- [ ] Connection state machine tests
- [ ] Reconnection logic tests
- [ ] Auth state persistence tests

#### Message Handler Tests

- [ ] Command parsing (`!scanner help`, `!scanner scan <url>`)
- [ ] URL extraction and validation
- [ ] Duplicate URL detection
- [ ] Rate limiting
- [ ] Error handling

#### Integration Tests

- [ ] Redis connection and operations
- [ ] Queue operations (BullMQ)
- [ ] Pre-flight checks

### 2.3 Create Missing Tests

If tests are missing or inadequate, create them following this pattern:

```typescript
// services/wa-client/src/__tests__/adapters/baileys-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaileysAdapter } from "../../adapters/baileys-adapter";

// Mock Baileys
vi.mock("@whiskeysockets/baileys", () => ({
  default: vi.fn(),
  makeWASocket: vi.fn(),
  fetchLatestBaileysVersion: vi
    .fn()
    .mockResolvedValue({ version: [2, 3000, 0], isLatest: true }),
  makeCacheableSignalKeyStore: vi.fn(),
  DisconnectReason: { loggedOut: 401 },
  isJidGroup: vi.fn(),
  jidNormalizedUser: vi.fn((jid) => jid),
}));

describe("BaileysAdapter", () => {
  let adapter: BaileysAdapter;
  let mockSocket: any;
  let mockRedis: any;
  let mockLogger: any;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
    };
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    adapter = new BaileysAdapter({
      redis: mockRedis,
      logger: mockLogger,
      clientId: "test-client",
    });
  });

  describe("connect()", () => {
    it("should transition to connecting state", async () => {
      // Test implementation
    });

    it("should handle connection failure gracefully", async () => {
      // Test implementation
    });
  });

  describe("sendMessage()", () => {
    it("should send text messages", async () => {
      // Test implementation
    });

    it("should send media messages", async () => {
      // Test implementation
    });

    it("should throw if not connected", async () => {
      await expect(
        adapter.sendMessage("jid", { type: "text", text: "hi" }),
      ).rejects.toThrow("Socket not connected");
    });
  });

  // ... more tests
});
```

---

## Phase 3: Setup Wizard Verification

### 3.1 Review Current Setup Flow

Examine:

- `scripts/setup/orchestrator.mjs` - Main setup flow
- `scripts/setup/plugins/builtin.mjs` - Library selection plugin
- `scripts/preflight-check.mjs` - Pre-flight verification

### 3.2 Verify Library Selection Flow

The setup wizard must:

1. Prompt user to select WhatsApp library (Baileys or wwebjs)
2. Save selection to `.env` as `WA_LIBRARY=baileys` or `WA_LIBRARY=wwebjs`
3. Display appropriate information about each library
4. Handle non-interactive mode with sensible defaults

### 3.3 Verify Pre-flight Checks

The pre-flight script must verify:

1. Correct library is installed based on `WA_LIBRARY` setting
2. Redis connectivity
3. Required environment variables
4. Docker networking (if applicable)
5. Chromium availability (if wwebjs selected)

### 3.4 Required Setup Wizard Updates

Ensure the setup wizard:

- [ ] Shows library comparison (RAM usage, reliability, etc.)
- [ ] Validates library-specific dependencies
- [ ] Provides migration guidance if switching libraries
- [ ] Updates Docker Compose profiles based on library choice
- [ ] Handles pairing code flow for both libraries

---

## Phase 4: Implementation Gaps

### 4.1 Known Missing Features

Based on initial review, these features may be missing from Baileys adapter:

#### High Priority (Core Functionality)

1. **Message forwarding** - `forwardMessage()` not implemented
2. **Contact management** - `getContacts()`, `getContactById()` not implemented
3. **Chat management** - `getChats()`, `getChatById()` not implemented
4. **Profile pictures** - `getProfilePicUrl()` not implemented
5. **Presence/typing** - `sendPresenceUpdate()` not implemented

#### Medium Priority (Enhanced Features)

1. **Sticker sending** - Not in current `MessageContent` type
2. **Location sending** - Not in current `MessageContent` type
3. **Contact/vCard sending** - Not in current `MessageContent` type
4. **Message starring** - Not implemented
5. **Message pinning** - Not implemented

#### Low Priority (Advanced Features)

1. **Status/Stories** - Not implemented
2. **Business features** - Not implemented
3. **Newsletter/Channel** - Partially implemented in Baileys v7

### 4.2 Implementation Approach

For each missing feature:

1. Check Baileys API docs for the corresponding function
2. Add method to `WhatsAppAdapter` interface if needed
3. Implement in `BaileysAdapter`
4. Implement in `WWebJSAdapter` for parity
5. Add tests
6. Run Snyk scan
7. Commit and push

---

## Phase 5: Verification Checkpoints

### Checkpoint 1: Feature Parity Audit Complete

```bash
# Document all findings in a markdown file
cat > docs/FEATURE_PARITY_AUDIT.md << 'EOF'
# Feature Parity Audit Results
## Date: $(date)
## Auditor: Verification Agent

### Fully Implemented Features
- [ ] List here...

### Partially Implemented Features
- [ ] List here...

### Missing Features
- [ ] List here...

### Implementation Priority
1. ...
2. ...
EOF
```

### Checkpoint 2: Tests Validated and Extended

```bash
bun run test --coverage
# Verify coverage > 80% on adapter code
```

### Checkpoint 3: Setup Wizard Complete

```bash
# Test interactive mode
bun run scripts/setup-wizard.mjs

# Test non-interactive mode
WA_LIBRARY=baileys bun run scripts/setup-wizard.mjs --noninteractive
```

### Checkpoint 4: Pre-flight Checks Pass

```bash
bun run scripts/preflight-check.mjs
```

### Checkpoint 5: Full Integration Test

```bash
# Start services with Baileys
WA_LIBRARY=baileys docker compose up -d wa-client redis

# Check health
curl http://localhost:3001/health

# Check library info
curl http://localhost:3001/library
```

---

## Stopping Criteria

**SUCCESS** is defined as:

1. ✅ Feature parity audit complete with documented findings
2. ✅ All critical missing features implemented
3. ✅ Test coverage > 80% on adapter code
4. ✅ All tests pass with `bun run test`
5. ✅ Setup wizard correctly handles library selection
6. ✅ Pre-flight checks pass for both library modes
7. ✅ All Snyk security scans pass
8. ✅ All changes committed and pushed
9. ✅ `FEATURE_PARITY_AUDIT.md` created with findings

**FAILURE** conditions that require escalation:

- Baileys v7 API doesn't support a critical feature
- Fundamental incompatibility between library interfaces
- Security vulnerabilities that cannot be fixed

---

## Implementation Order

### Step 1: Feature Parity Audit (1 hour)

- Read `docs/exports/wwebjs/Client.html.md` thoroughly
- Compare against `services/wa-client/src/adapters/baileys-adapter.ts`
- Document all gaps in `docs/FEATURE_PARITY_AUDIT.md`
- **Commit**: `docs: add feature parity audit results`

### Step 2: Implement Missing Core Features (2-3 hours)

- Add missing methods to adapter interface
- Implement in Baileys adapter
- Implement in WWebJS adapter
- **Snyk scan** after each file
- **Commit**: `feat(adapters): implement missing core features`

### Step 3: Validate and Extend Tests (1.5 hours)

- Review existing tests for validity
- Add missing adapter tests
- Add missing message handler tests
- Ensure coverage > 80%
- **Snyk scan** on test files
- **Commit**: `test(adapters): add comprehensive parity tests`

### Step 4: Complete Setup Wizard (1 hour)

- Verify library selection flow
- Add any missing prompts
- Test interactive and non-interactive modes
- **Snyk scan** on modified files
- **Commit**: `feat(setup): complete library selection flow`

### Step 5: Verify Pre-flight Checks (30 min)

- Test with `WA_LIBRARY=baileys`
- Test with `WA_LIBRARY=wwebjs`
- Fix any issues
- **Commit**: `fix(preflight): ensure both library modes work`

### Step 6: Final Security Scan (15 min)

- Run `mcp3_snyk_sca_scan` on entire project
- Run `mcp3_snyk_code_scan` on `services/wa-client/src`
- Fix any remaining issues
- **Commit**: `security: address all Snyk findings`

### Step 7: Final Push & Summary (5 min)

```bash
git push origin feat/baileys-migration-dual-library
```

- Create summary of all changes and audit findings

**Total estimated time**: 6-8 hours

---

## Notes for Agent

### Verification Mindset

- **Be skeptical**: Don't assume code works just because it compiles
- **Test edge cases**: Empty inputs, invalid data, network failures
- **Check error handling**: Every async operation should have try/catch
- **Verify types**: Ensure TypeScript types match actual runtime behavior

### Tool Usage

- **Snyk MCP Server**: Use `mcp3_snyk_code_scan` and `mcp3_snyk_sca_scan` at every step
- **Brave Search**: Use `mcp1_brave_web_search` for Baileys v7 examples and patterns
- **Sudo commands**: Use password `Siya@123` when sudo is required
- **Bun**: Always use `bun` instead of `npm` or `node`

### Documentation First

- Always check `docs/exports/Baileys/docs/api/` before implementing
- Always check `docs/exports/wwebjs/` for feature reference
- Use Brave Search only when local docs are insufficient

### Quality Standards

- **TypeScript strict mode**: No `any` types without explicit justification
- **Error handling**: All async operations wrapped in try/catch with logging
- **Logging**: Use pino logger with structured JSON output
- **Testing**: Minimum 80% coverage on new code
- **Documentation**: JSDoc comments on public functions

### Final Deliverable

When complete, you must provide:

1. All code changes committed and pushed
2. `docs/FEATURE_PARITY_AUDIT.md` with complete audit results
3. All Snyk scans passing
4. All tests passing with > 80% coverage
5. Setup wizard fully functional
6. Pre-flight checks passing for both libraries

Good luck! 🔍
