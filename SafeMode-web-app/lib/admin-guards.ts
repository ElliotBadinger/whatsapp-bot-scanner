import "server-only";

import crypto from "crypto";
import type { NextResponse } from "next/server";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  type AdminSession,
  getAdminAuthConfig,
  getCookieFromHeader,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function getAdminSessionFromRequest(
  req: Request,
):
  | { ok: true; session: AdminSession; sessionTtlSeconds: number }
  | { ok: false; status: number; error: string } {
  const config = getAdminAuthConfig();
  if (!config.ok) {
    return { ok: false, status: 500, error: "server_misconfigured" };
  }

  const cookieHeader = req.headers.get("cookie");
  const token = getCookieFromHeader(cookieHeader, ADMIN_SESSION_COOKIE);
  if (!token) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const session = verifyAdminSessionToken({
    token,
    secret: config.config.sessionSecret,
  });

  if (!session) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  return {
    ok: true,
    session,
    sessionTtlSeconds: config.config.sessionTtlSeconds,
  };
}

export function requireCsrf(
  req: Request,
  session: AdminSession,
): { ok: true } | { ok: false; status: number; error: string } {
  const headerToken = (req.headers.get("x-csrf-token") || "").trim();
  if (!headerToken) {
    return { ok: false, status: 403, error: "csrf_missing" };
  }

  const cookieHeader = req.headers.get("cookie");
  const cookieToken = (getCookieFromHeader(cookieHeader, ADMIN_CSRF_COOKIE) ||
    "")
    .trim();
  if (!cookieToken) {
    return { ok: false, status: 403, error: "csrf_missing" };
  }

  if (
    !timingSafeEqualStrings(headerToken, cookieToken) ||
    !timingSafeEqualStrings(headerToken, session.csrf)
  ) {
    return { ok: false, status: 403, error: "csrf_invalid" };
  }

  return { ok: true };
}

export function setAdminCookies(
  res: NextResponse,
  options: { token: string; csrf: string; ttlSeconds: number },
): void {
  const secure = process.env.NODE_ENV === "production";

  res.cookies.set(ADMIN_SESSION_COOKIE, options.token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: options.ttlSeconds,
  });

  res.cookies.set(ADMIN_CSRF_COOKIE, options.csrf, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: options.ttlSeconds,
  });
}

export function clearAdminCookies(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(ADMIN_CSRF_COOKIE, "", {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
