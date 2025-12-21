import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  createSignedSessionToken,
  DEFAULT_SESSION_TTL_SECONDS,
  type SessionTokenClaims,
  verifySignedSessionToken,
} from "@/lib/session-token";

export const ADMIN_SESSION_COOKIE_NAME = "safemode_admin_session";

function timingSafeEqualStrings(a: string, b: string): boolean {
  const aHash = crypto.createHash("sha256").update(a, "utf8").digest();
  const bHash = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

export function getSafemodeAdminToken(): string {
  const token = (process.env.SAFEMODE_ADMIN_TOKEN || "").trim();
  if (!token) {
    throw new Error("SAFEMODE_ADMIN_TOKEN is required");
  }
  return token;
}

export function isValidSafemodeAdminToken(candidate: string): boolean {
  return timingSafeEqualStrings(candidate, getSafemodeAdminToken());
}

function getSessionSecret(): string {
  const secret = (process.env.SAFEMODE_SESSION_SECRET || "").trim();
  return secret || getSafemodeAdminToken();
}

function getSessionCookieBaseOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function setAdminSessionCookie(
  response: NextResponse,
  options: { nowMs?: number; ttlSeconds?: number } = {},
): { claims: SessionTokenClaims } {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const { token, claims } = createSignedSessionToken({
    secret: getSessionSecret(),
    ttlSeconds,
    nowMs: options.nowMs,
  });

  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
    ...getSessionCookieBaseOptions(),
    maxAge: ttlSeconds,
    expires: new Date(claims.exp * 1000),
  });

  return { claims };
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", {
    ...getSessionCookieBaseOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function readAdminSessionClaims(
  options: { nowMs?: number } = {},
): Promise<{
  claims: SessionTokenClaims;
} | null> {
  const store = await cookies();
  const cookieValue = store.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return null;
  }

  try {
    const verification = verifySignedSessionToken(cookieValue, {
      secret: getSessionSecret(),
      nowMs: options.nowMs,
    });
    if (!verification.ok) {
      return null;
    }

    return { claims: verification.claims };
  } catch {
    return null;
  }
}

export async function hasValidAdminSession(
  options: { nowMs?: number } = {},
): Promise<boolean> {
  return (await readAdminSessionClaims(options)) !== null;
}
