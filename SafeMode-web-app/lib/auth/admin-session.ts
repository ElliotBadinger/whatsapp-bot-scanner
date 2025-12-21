import crypto from "node:crypto";

export const ADMIN_SESSION_COOKIE = "safemode_admin_session";

export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export type AdminSession = {
  id: string;
  controlPlaneToken: string;
  createdAtMs: number;
  lastSeenAtMs: number;
  absoluteExpiresAtMs: number;
  idleExpiresAtMs: number;
};

export type ValidateSessionResult =
  | {
      ok: true;
      session: AdminSession;
      cookieExpiresAtMs: number;
    }
  | { ok: false; reason: "missing" | "expired" | "idle" };

const sessions = new Map<string, AdminSession>();
// This is a per-process in-memory store (sessions are not shared across instances).

function newSessionId(): string {
  return crypto.randomUUID();
}

function computeIdleExpiresAtMs(nowMs: number): number {
  return nowMs + SESSION_IDLE_TIMEOUT_MS;
}

export function createAdminSession(
  controlPlaneToken: string,
  nowMs = Date.now(),
): AdminSession {
  const id = newSessionId();
  const absoluteExpiresAtMs = nowMs + SESSION_ABSOLUTE_TIMEOUT_MS;
  const idleExpiresAtMs = computeIdleExpiresAtMs(nowMs);
  const session: AdminSession = {
    id,
    controlPlaneToken,
    createdAtMs: nowMs,
    lastSeenAtMs: nowMs,
    absoluteExpiresAtMs,
    idleExpiresAtMs,
  };
  sessions.set(id, session);
  return session;
}

export function deleteAdminSession(id: string): void {
  sessions.delete(id);
}

export function getAdminSession(id: string, nowMs = Date.now()): AdminSession | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (nowMs >= session.absoluteExpiresAtMs || nowMs >= session.idleExpiresAtMs) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function validateAndTouchAdminSession(
  id: string,
  nowMs = Date.now(),
): ValidateSessionResult {
  const session = sessions.get(id);
  if (!session) return { ok: false, reason: "missing" };

  if (nowMs >= session.absoluteExpiresAtMs) {
    sessions.delete(id);
    return { ok: false, reason: "expired" };
  }

  if (nowMs >= session.idleExpiresAtMs) {
    sessions.delete(id);
    return { ok: false, reason: "idle" };
  }

  session.lastSeenAtMs = nowMs;
  session.idleExpiresAtMs = computeIdleExpiresAtMs(nowMs);

  const cookieExpiresAtMs = Math.min(
    session.idleExpiresAtMs,
    session.absoluteExpiresAtMs,
  );

  return {
    ok: true,
    session,
    cookieExpiresAtMs,
  };
}
