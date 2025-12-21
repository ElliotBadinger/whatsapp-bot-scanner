import "server-only";

import crypto from "crypto";

export const ADMIN_SESSION_COOKIE = "safemode_admin_session";
export const ADMIN_CSRF_COOKIE = "safemode_admin_csrf";

export type AdminSession = {
  sub: "admin";
  iat: number;
  exp: number;
  csrf: string;
};

type AdminAuthConfig = {
  adminPassword: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
};

export function getAdminAuthConfig():
  | { ok: true; config: AdminAuthConfig }
  | { ok: false; error: string } {
  const adminPassword = (process.env.SAFEMODE_ADMIN_PASSWORD || "").trim();
  if (!adminPassword) {
    return { ok: false, error: "SAFEMODE_ADMIN_PASSWORD is required" };
  }

  const sessionSecret = (process.env.SAFEMODE_SESSION_SECRET || "").trim();
  if (sessionSecret.length < 32) {
    return {
      ok: false,
      error: "SAFEMODE_SESSION_SECRET must be set (>= 32 chars)",
    };
  }

  const ttlRaw = (process.env.SAFEMODE_SESSION_TTL_SECONDS || "43200").trim();
  const ttlParsed = Number.parseInt(ttlRaw, 10);
  const sessionTtlSeconds =
    Number.isFinite(ttlParsed) && ttlParsed > 60 ? ttlParsed : 43200;

  return {
    ok: true,
    config: { adminPassword, sessionSecret, sessionTtlSeconds },
  };
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function hmacSha256Base64Url(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyAdminPassword(
  provided: string,
  expected: string,
): boolean {
  return timingSafeEqualStrings(provided, expected);
}

export function createAdminSessionToken(options: {
  secret: string;
  ttlSeconds: number;
  nowMs?: number;
}): { token: string; session: AdminSession } {
  const nowMs = options.nowMs ?? Date.now();
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + options.ttlSeconds;
  const csrf = crypto.randomBytes(32).toString("base64url");

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({ sub: "admin", iat, exp, csrf }),
  );
  const signingInput = `${header}.${payload}`;
  const sig = hmacSha256Base64Url(options.secret, signingInput);
  return {
    token: `${signingInput}.${sig}`,
    session: { sub: "admin", iat, exp, csrf },
  };
}

export function verifyAdminSessionToken(options: {
  token: string;
  secret: string;
  nowMs?: number;
}): AdminSession | null {
  const parts = options.token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSig) return null;

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = hmacSha256Base64Url(options.secret, signingInput);
  if (!timingSafeEqualStrings(encodedSig, expectedSig)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Partial<AdminSession>;
  if (obj.sub !== "admin") return null;

  const iat = Number(obj.iat);
  const exp = Number(obj.exp);
  const csrf = typeof obj.csrf === "string" ? obj.csrf : "";
  if (!Number.isFinite(iat) || !Number.isFinite(exp) || !csrf) return null;

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (exp <= nowSeconds) return null;

  return { sub: "admin", iat, exp, csrf };
}

export function getCookieFromHeader(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== name) continue;
    return trimmed.slice(eq + 1);
  }
  return null;
}

export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip") || "unknown";
}
