# WhatsApp Bot Scanner: Verification & Completion Agent

## Agent Mission

You are a **verification and completion agent** responsible for:
1. **Auditing** the Baileys adapter implementation for completeness against the project's actual needs
2. **Validating** that tests are meaningful and provide real coverage
3. **Testing** the CLI and setup wizard flows work correctly
4. **Implementing** any missing features or fixes discovered during verification

**Focus on what the project actually uses, not theoretical feature parity.** Review the existing codebase to understand which features are actually needed.

**DO NOT CREATE DOCUMENTATION FILES.** Focus on code, tests, and verification.

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

Example commits:
```bash
git add -A && git commit -m "fix(baileys): implement missing feature X"
git add -A && git commit -m "test(adapters): add adapter unit tests"
git add -A && git commit -m "fix(setup): fix library selection in wizard"
git push origin feat/baileys-migration-dual-library
```

### Security Scanning (MANDATORY)
At **every step** of implementation:
1. Run `mcp3_snyk_code_scan` on any new or modified code files
2. Run `mcp3_snyk_sca_scan` on the project after dependency changes
3. If security issues are found:
   - Fix them immediately before proceeding
   - Re-scan to verify the fix
4. Do NOT proceed to the next step until security scan passes

### Web Research
Use the **Brave Search MCP server** (`mcp1_brave_web_search`) whenever you need:
- Latest Baileys v7 API documentation or examples
- Solutions to unexpected errors
- Best practices for WhatsApp automation

### Documentation References
**CRITICAL**: Always consult the local API documentation before implementing:
- **Baileys v7**: `docs/exports/Baileys/docs/api/` - Contains all functions, interfaces, and types
- **whatsapp-web.js**: `docs/exports/wwebjs/` - Reference for feature comparison

---

## Phase 1: Codebase Analysis

### 1.1 Understand What the Project Actually Uses

Before auditing for "missing features", understand what the project needs:

1. **Review the original `services/wa-client/src/index.ts`** - What WhatsApp features does it actually use?
2. **Review `services/wa-client/src/handlers/message-handler.ts`** - What message handling is needed?
3. **Review bot commands** - What commands exist and what do they need from the adapter?

The project is a **URL scanner bot**. It likely only needs:
- Receive messages
- Send text replies
- React to messages
- Basic group metadata (to know if message is from a group)

**Do NOT implement features the project doesn't use.** Focus on what's actually needed.

### 1.2 Review Existing Baileys Adapter

Check `services/wa-client/src/adapters/baileys-adapter.ts`:
- Does it handle all the message types the bot needs?
- Does it properly convert Baileys messages to the adapter interface?
- Are error cases handled correctly?
- Is reconnection logic working?

### 1.3 Review Existing WWebJS Adapter

Check `services/wa-client/src/adapters/wwebjs-adapter.ts`:
- Is it complete and functional?
- Does it match the Baileys adapter's interface?

---

## Phase 2: Test Validation

### 2.1 Review Existing Tests

Examine test files in `services/wa-client/src/__tests__/`:

**For each test file, verify:**
1. Tests actually test real functionality, not just mocks returning mocks
2. Tests cover both success and failure paths
3. Tests are not trivially passing (e.g., `expect(true).toBe(true)`)
4. Tests cover edge cases relevant to the bot's use case

### 2.2 Run Existing Tests

```bash
cd services/wa-client
bun run test
```

- Do all tests pass?
- What is the coverage?
- Are there any skipped tests that should be enabled?

### 2.3 Add Missing Tests

If tests are inadequate, add tests for:
- Adapter connection/disconnection
- Message sending (text, reactions)
- Message receiving and parsing
- Error handling
- Reconnection logic

---

## Phase 3: CLI & Setup Wizard Testing

### 3.1 Test the Unified CLI

The CLI is at `scripts/unified-cli.mjs` and is invoked via:
```bash
bunx whatsapp-bot-scanner <command>
```

**Test each command:**

#### Setup Command
```bash
bunx whatsapp-bot-scanner setup --help
bunx whatsapp-bot-scanner setup --noninteractive --skip-pairing
```

Verify:
- [ ] Prerequisites check works (Node.js, Docker)
- [ ] Configuration step creates/uses `.env`
- [ ] API keys step prompts correctly
- [ ] Services start correctly
- [ ] Pairing step works (or skips correctly)

#### Health Command
```bash
bunx whatsapp-bot-scanner health
```

Verify:
- [ ] Shows container status
- [ ] Health status is accurate

#### Logs Command
```bash
bunx whatsapp-bot-scanner logs wa-client
```

Verify:
- [ ] Streams logs correctly
- [ ] Can filter by service

#### Pair Command
```bash
bunx whatsapp-bot-scanner pair
```

Verify:
- [ ] Requests pairing code from wa-client
- [ ] Displays code correctly
- [ ] Monitors for success/failure

### 3.2 Verify Library Selection

The setup wizard should handle `WA_LIBRARY` selection. Check:

1. **Is library selection in the setup flow?**
   - Check `scripts/setup/plugins/builtin.mjs` for `wa-library-selection` plugin
   - Check `scripts/unified-cli.mjs` for library selection in setup

2. **Does the selection persist to `.env`?**
   - After setup, `.env` should have `WA_LIBRARY=baileys` or `WA_LIBRARY=wwebjs`

3. **Does the wa-client respect the selection?**
   - Check `services/wa-client/src/main.ts` uses the adapter factory
   - Check `services/wa-client/src/adapters/factory.ts` reads `WA_LIBRARY`

### 3.3 Test Pre-flight Checks

```bash
bun run scripts/preflight-check.mjs
```

Verify:
- [ ] Checks Node.js version
- [ ] Checks Docker availability
- [ ] Checks environment variables
- [ ] Checks WhatsApp library setting
- [ ] Checks package dependencies

---

## Phase 4: Fix Issues Found

### 4.1 Implementation Fixes

For any issues found during verification:
1. Identify the root cause
2. Implement the fix
3. Run Snyk scan on modified files
4. Add/update tests if needed
5. Commit and push

### 4.2 Common Issues to Check

Based on the codebase, verify these work correctly:

1. **Adapter Factory**
   - Does `createAdapterFromEnv()` correctly read `WA_LIBRARY`?
   - Does it default to Baileys?

2. **Redis Auth Store**
   - Does `services/wa-client/src/auth/baileys-auth-store.ts` work?
   - Can it save and restore session state?

3. **Message Handler Integration**
   - Does `services/wa-client/src/handlers/message-handler.ts` work with both adapters?
   - Are bot commands (`!scanner help`, `!scanner scan`) working?

4. **Main Entry Point**
   - Does `services/wa-client/src/main.ts` start correctly?
   - Does it connect to Redis?
   - Does it create the correct adapter?

---

## Phase 5: Verification Checkpoints

### Checkpoint 1: Tests Pass
```bash
cd services/wa-client
bun run test
```
All tests must pass.

### Checkpoint 2: Build Succeeds
```bash
bun run build
```
No TypeScript errors.

### Checkpoint 3: CLI Commands Work
```bash
bunx whatsapp-bot-scanner --help
bunx whatsapp-bot-scanner health
bunx whatsapp-bot-scanner setup --noninteractive --skip-pairing
```

### Checkpoint 4: Pre-flight Checks Pass
```bash
bun run scripts/preflight-check.mjs
```

### Checkpoint 5: Services Start
```bash
docker compose up -d redis wa-client
docker compose logs wa-client --tail=50
curl http://localhost:3001/health
```

### Checkpoint 6: Snyk Scans Pass
```bash
# Run via MCP tools
mcp3_snyk_code_scan on services/wa-client/src
mcp3_snyk_sca_scan on services/wa-client
```

---

## Stopping Criteria

**SUCCESS** is defined as:
1. ✅ All tests pass with `bun run test`
2. ✅ Build succeeds with `bun run build`
3. ✅ CLI commands work correctly
4. ✅ Pre-flight checks pass
5. ✅ Services start and health endpoint responds
6. ✅ All Snyk security scans pass
7. ✅ All changes committed and pushed

**FAILURE** conditions that require escalation:
- Baileys v7 API doesn't support a feature the bot actually needs
- Fundamental incompatibility that can't be resolved
- Security vulnerabilities that cannot be fixed

---

## Implementation Order

### Step 1: Codebase Analysis (30 min)
- Review what features the project actually uses
- Identify any gaps in the Baileys adapter
- **Commit**: N/A (analysis only)

### Step 2: Run and Fix Tests (1 hour)
- Run existing tests
- Fix any failing tests
- Add missing tests for core functionality
- **Snyk scan** on test files
- **Commit**: `test(wa-client): fix and extend adapter tests`

### Step 3: Test CLI Commands (30 min)
- Test each CLI command
- Fix any issues found
- **Commit**: `fix(cli): <description of fixes>`

### Step 4: Verify Setup Wizard (30 min)
- Test setup flow with `bunx whatsapp-bot-scanner setup`
- Verify library selection works
- Verify `.env` is updated correctly
- **Commit**: `fix(setup): <description of fixes>`

### Step 5: Verify Pre-flight Checks (15 min)
- Run pre-flight checks
- Fix any issues
- **Commit**: `fix(preflight): <description of fixes>`

### Step 6: Integration Test (30 min)
- Start services with Docker
- Verify health endpoints
- Check logs for errors
- **Commit**: `fix(wa-client): <description of fixes>`

### Step 7: Final Security Scan (15 min)
- Run `mcp3_snyk_sca_scan` on entire project
- Run `mcp3_snyk_code_scan` on `services/wa-client/src`
- Fix any remaining issues
- **Commit**: `security: address Snyk findings`

### Step 8: Final Push (5 min)
```bash
git push origin feat/baileys-migration-dual-library
```

**Total estimated time**: 3-4 hours

---

## Notes for Agent

### Practical Mindset
- **Focus on what's used**: Don't implement features the project doesn't need
- **Test real behavior**: Run the actual commands, don't just read code
- **Fix what's broken**: If something doesn't work, fix it
- **Keep it simple**: Minimal changes to achieve working state

### Tool Usage
- **Snyk MCP Server**: Use `mcp3_snyk_code_scan` and `mcp3_snyk_sca_scan` at every step
- **Brave Search**: Use `mcp1_brave_web_search` for Baileys v7 examples if stuck
- **Sudo commands**: Use password `Siya@123` when sudo is required
- **Bun**: Always use `bun` instead of `npm` or `node`

### Quality Standards
- **TypeScript strict mode**: No `any` types without explicit justification
- **Error handling**: All async operations wrapped in try/catch with logging
- **Testing**: Tests must verify actual behavior, not just mock interactions

### Final Deliverable
When complete, you must have:
1. All code changes committed and pushed
2. All tests passing
3. All CLI commands working
4. All Snyk scans passing
5. Services starting and responding to health checks

Good luck! 🔍
