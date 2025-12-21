import "server-only";

import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "safemode_session";

type SessionPayload = {
  v: 1;
  iat: number;
  exp: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecret(options?: { secret?: string }): string {
  const explicit = (options?.secret ?? "").trim();
  if (explicit) return explicit;

  const safemodeSecret = (process.env.SAFEMODE_SESSION_SECRET ?? "").trim();
  if (safemodeSecret) return safemodeSecret;

  const fallback = (process.env.CONTROL_PLANE_API_TOKEN ?? "").trim();
  if (fallback) return fallback;

  throw new Error(
    "SAFEMODE_SESSION_SECRET or CONTROL_PLANE_API_TOKEN is required for session signing",
  );
}

function computeSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createSessionCookieValue(options?: {
  nowMs?: number;
  ttlMs?: number;
  secret?: string;
}): string {
  const nowMs = options?.nowMs ?? Date.now();
  const ttlMs = options?.ttlMs ?? 7 * 24 * 60 * 60 * 1000;
  const secret = getSessionSecret({ secret: options?.secret });

  const payload: SessionPayload = {
    v: 1,
    iat: nowMs,
    exp: nowMs + ttlMs,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = computeSignature(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function isValidSessionCookieValue(
  value: string,
  options?: { nowMs?: number; secret?: string },
): boolean {
  const nowMs = options?.nowMs ?? Date.now();
  const secret = getSessionSecret({ secret: options?.secret });

  const trimmed = value.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!payloadB64 || !sig) return false;

  const expectedSig = computeSignature(payloadB64, secret);
  if (!timingSafeEqualString(sig, expectedSig)) return false;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64)) as SessionPayload;
  } catch {
    return false;
  }

  if (!payload || payload.v !== 1) return false;
  if (!Number.isFinite(payload.exp) || payload.exp <= nowMs) return false;
  if (!Number.isFinite(payload.iat) || payload.iat > nowMs + 60_000) return false;

  return true;
}
