# Autonomous Agent Implementation Prompt — Jira SCRUM-1

## Ticket
- **Jira key**: `SCRUM-1`
- **Title**: `[SPRINT 1] Infrastructure & Backend Integration`
- **Type**: Epic
- **Priority**: Medium
- **Status**: To Do

## Source-of-truth ticket text (copy)
### Overview
Replace mock data implementations with real control-plane API integration. Establish proper communication between the Next.js web app and the backend microservices.

### Goals
- Connect SafeMode web app to the existing control-plane Fastify service
- Implement proper API client with error handling
- Set up environment configuration for different environments
- Enable real-time data flow from scan-orchestrator

### Acceptance Criteria
- [ ] All mock functions in `lib/api.ts` replaced with real API calls
- [ ] Environment variables properly configured for backend URLs
- [ ] Error states handled gracefully with user-friendly messages
- [ ] API requests include proper authentication tokens

### Technical Details
- Backend URL: control-plane service (port 8080)
- Authentication: Bearer token (`CONTROL_PLANE_API_TOKEN`)
- Existing endpoints: `/status`, `/overrides`, `/rescan`, `/groups/:chatId/mute`

---

# Mission
You are an autonomous engineering agent. Implement `SCRUM-1` **fully** in this repository.

You MUST:
- Produce a working SafeMode web app that uses the **real** control-plane API (no random/mock fallbacks).
- Ensure auth tokens are included on requests **without exposing secrets to the browser bundle**.
- Add **comprehensive automated test coverage** (unit + integration) and make it runnable in CI.
- Validate your implementation via deterministic test runs.

You MAY:
- Add small, well-scoped helper modules to improve maintainability.

You MUST NOT:
- Hardcode secrets.
- Leak `CONTROL_PLANE_API_TOKEN` to client-side JS.

---

# Repository orientation (read-only)
## SafeMode web app
- Location: `SafeMode-web-app/`
- Key files:
  - `SafeMode-web-app/lib/api.ts` (currently contains mock fallbacks)
  - `SafeMode-web-app/app/api/status/route.ts` (currently mock status)
  - `SafeMode-web-app/app/api/feed/route.ts` (currently mock SSE)
  - Components consuming `lib/api.ts`:
    - `components/safemode/stats-display.tsx` uses `getStatus`
    - `components/safemode/overrides-table.tsx` uses `getOverrides`/`addOverride`
    - `components/safemode/rescan-form.tsx` uses `rescanUrl`
    - `components/safemode/groups-manager.tsx` uses `muteGroup` (note: groups list is still mocked)

## Control-plane service (authoritative backend)
- Location: `services/control-plane/src/index.ts`
- Auth:
  - Public: `/healthz`, `/metrics`
  - Protected (requires Bearer token): `/status`, `/overrides` (GET/POST), `/rescan`, `/groups/:chatId/mute`, `/groups/:chatId/unmute`, `/scans/:urlHash/urlscan-artifacts/:type`
- Current `/status` response shape is:
  - `{ scans: number, malicious: number }`

**Important mismatch**: SafeMode web app’s `SystemStatus` interface expects:
- `scansToday`, `threatsBlocked`, `cacheHitRate`, `groupsProtected`, `uptime`, `version`

You must resolve this mismatch in a principled way (see “Data contract alignment”).

---

# Architecture requirement (token secrecy)
## Problem
Several SafeMode components run in the browser. If you call `CONTROL_PLANE_URL` directly from client components and attach `CONTROL_PLANE_API_TOKEN`, you will leak the token to the browser.

## Required design
1. Create **server-side Next.js route handlers** under `SafeMode-web-app/app/api/control-plane/*` (or a similar internal namespace) that **proxy** to the control-plane.
2. These Next.js route handlers must:
   - Read `CONTROL_PLANE_URL` and `CONTROL_PLANE_API_TOKEN` from server-only env.
   - Attach `Authorization: Bearer <token>` when calling control-plane.
   - Map control-plane errors into stable JSON error bodies for the UI.
3. Client components must call **only** your internal Next.js routes (no token exposure).

---

# Data contract alignment (mandatory decision)
You must pick ONE approach and implement it consistently:

## Option A (recommended): Web app transforms control-plane responses
- Keep control-plane unchanged.
- Update SafeMode web app types and UI to use data the backend actually provides.
- If UI needs fields not provided (uptime/version/cache hit rate/etc.), either:
  - Remove those UI fields, OR
  - Compute approximations, OR
  - Display “N/A” deterministically (not random mock values).

## Option B: Extend control-plane `/status` to return the UI’s `SystemStatus`
- Update `services/control-plane` `/status` route to return the fields the UI expects.
- Ensure the values are real and derived from DB/config.

**You must document your choice in the PR/commit message and in code (e.g., type names, schema validation).**

---

# Required implementation work
## 1) Replace mock implementations in `SafeMode-web-app/lib/api.ts`
You must remove random/mock fallbacks and instead:
- Make `getStatus`, `getOverrides`, `addOverride`, `rescanUrl`, `muteGroup` call the internal Next routes you create.
- Provide robust error handling:
  - Parse JSON errors.
  - Throw typed errors (e.g., `ApiError` with `status`, `code`, `message`).
  - Ensure UI can show user-friendly error states.

### Additional notes
- `getRecentScans()` currently targets `/scans/recent` on the control-plane, but that endpoint is not currently present.
  - If any UI depends on it, either implement a backend endpoint or remove/replace the call.
  - Do not leave dead/mock logic in place.

## 2) Implement internal Next.js proxy routes
Create Next route handlers that proxy to control-plane endpoints:
- `GET /api/control-plane/status`
- `GET /api/control-plane/overrides`
- `POST /api/control-plane/overrides`
- `POST /api/control-plane/rescan`
- `POST /api/control-plane/groups/:chatId/mute`

Implementation requirements:
- Enforce method + request-body validation with `zod`.
- Return consistent JSON:
  - Success: 2xx with expected payload
  - Error: non-2xx with `{ error: { code, message, details? } }`
- Timeouts:
  - Use an abort controller timeout (e.g., 5–10s) so the UI doesn’t hang.

## 3) Update existing mock Next routes
- `SafeMode-web-app/app/api/status/route.ts` is currently random; either:
  - delete and replace with proxy route(s), or
  - make it a proxy wrapper around your new control-plane routes.

- `SafeMode-web-app/app/api/feed/route.ts` is currently mock SSE.
  - This ticket mentions “Enable real-time data flow from scan-orchestrator”, but the control-plane currently does not expose an SSE endpoint.
  - Do NOT invent a fake backend.
  - Acceptable outcomes for this ticket:
    - Leave feed as-is but explicitly mark as “demo/mock” and ensure `lib/api.ts` no longer provides mock fallbacks (preferred), OR
    - Implement a real feed if a real event source already exists in the repo.

You must ensure you still satisfy acceptance criteria about `lib/api.ts` not returning random mock data.

## 4) Environment configuration
- Add/align SafeMode web app environment variables:
  - `CONTROL_PLANE_URL` (server-only)
  - `CONTROL_PLANE_API_TOKEN` (server-only)
- Update `.env.example` (or add `SafeMode-web-app/.env.example` if that’s the established pattern) **without secrets**.
- Ensure local dev defaults are safe and explicit (don’t default token to `demo-token` in production paths).

---

# Testing requirements (comprehensive)
The SafeMode web app currently has no test runner configured (`SafeMode-web-app/package.json` prints “No tests configured”). You must add a real test stack.

## Choose a test stack
Pick one and implement:
- **Option 1**: `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `msw`
- **Option 2**: `jest` + `@testing-library/react` + `msw`

### Mandatory test coverage
You must add tests for:

#### A) Proxy route handlers (server)
For each proxy route, test:
- **Success**: returns expected status + body when control-plane returns 200/201.
- **Unauthorized**: control-plane 401 maps to stable JSON error.
- **Validation**: invalid body (e.g., `rescan` with invalid URL) returns 400 before calling upstream.
- **Upstream failure**: timeout / network error returns 502/504 with a user-safe message.

Use `msw` (Node mode) to mock upstream control-plane responses.

#### B) `lib/api.ts` client wrapper
Test that each exported function:
- Calls the correct internal route.
- Throws a typed error on non-2xx.
- Does not return random mock data.

#### C) UI components (client)
At minimum:
- `StatsDisplay`
  - renders values from `getStatus`
  - shows a deterministic fallback/“N/A” if fields are missing (depending on your data contract choice)
- `OverridesTable`
  - loads overrides
  - adds an override and updates UI
  - handles server error and displays user-friendly message
- `RescanForm`
  - submits URL
  - renders verdict result
  - renders error state

You may mock `lib/api.ts` at the module level for component tests OR use MSW to mock internal routes.

## Coverage expectations
- Add meaningful assertions, not smoke tests.
- Ensure tests fail if the API contract breaks.

---

# Security requirements
Because this repo has explicit security rules, follow these:
- Run SAST scanning after new first-party code is added/changed (use the project’s configured scanning tools).
- Fix any high/medium findings introduced by your changes.
- Never commit secrets.

---

# Validation checklist (must be completed before you stop)
- [ ] `SafeMode-web-app` can fetch real data from control-plane via internal proxy routes.
- [ ] No browser code contains `CONTROL_PLANE_API_TOKEN`.
- [ ] All functions in `SafeMode-web-app/lib/api.ts` no longer return random/mock fallbacks.
- [ ] New tests added and passing.
- [ ] Type-check passes (`npm run type-check` inside `SafeMode-web-app`).
- [ ] Lint passes (`npm run lint` inside `SafeMode-web-app`).

---

# Deliverables
1. Implementation changes in `SafeMode-web-app` (and control-plane only if you choose Option B).
2. A real test runner + tests with meaningful coverage.
3. Updated env documentation.
4. A short implementation note explaining:
   - which data-contract option you chose
   - why
   - how to run tests locally

---

# Notes for the autonomous agent
- Keep changes minimal but complete.
- Prefer deterministic behavior over “pretty demo values”.
- If you must adjust UI labels due to data contract changes, do so consistently.
