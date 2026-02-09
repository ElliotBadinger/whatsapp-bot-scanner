import assert from "node:assert/strict";

import {
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  createAdminSession,
  deleteAdminSession,
  validateAndTouchAdminSession,
} from "../lib/auth/admin-session";

function test(name: string, fn: () => void) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (err) {
    process.stderr.write(`not ok - ${name}\n`);
    process.stderr.write(String(err));
    process.stderr.write("\n");
    process.exitCode = 1;
  }
}

test("create session stores token and sets initial expiries", () => {
  const nowMs = 1000;
  const session = createAdminSession("token", nowMs);
  assert.equal(session.controlPlaneToken, "token");
  assert.equal(session.createdAtMs, nowMs);
  assert.equal(session.lastSeenAtMs, nowMs);
  assert.equal(session.idleExpiresAtMs, nowMs + SESSION_IDLE_TIMEOUT_MS);
  assert.equal(
    session.absoluteExpiresAtMs,
    nowMs + SESSION_ABSOLUTE_TIMEOUT_MS,
  );
  deleteAdminSession(session.id);
});

test("touch extends idle expiry", () => {
  const nowMs = 1000;
  const session = createAdminSession("token", nowMs);
  const touchedAt = nowMs + 5000;
  const validated = validateAndTouchAdminSession(session.id, touchedAt);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(validated.session.lastSeenAtMs, touchedAt);
  assert.equal(
    validated.session.idleExpiresAtMs,
    touchedAt + SESSION_IDLE_TIMEOUT_MS,
  );
  deleteAdminSession(session.id);
});

test("idle timeout invalidates sessions", () => {
  const nowMs = 1000;
  const session = createAdminSession("token", nowMs);
  const validated = validateAndTouchAdminSession(
    session.id,
    nowMs + SESSION_IDLE_TIMEOUT_MS + 1,
  );
  assert.equal(validated.ok, false);
  if (validated.ok) return;
  assert.equal(validated.reason, "idle");
});

test("absolute timeout invalidates sessions", () => {
  const nowMs = 1000;
  const session = createAdminSession("token", nowMs);
  const validated = validateAndTouchAdminSession(
    session.id,
    nowMs + SESSION_ABSOLUTE_TIMEOUT_MS + 1,
  );
  assert.equal(validated.ok, false);
  if (validated.ok) return;
  assert.equal(validated.reason, "expired");
});
