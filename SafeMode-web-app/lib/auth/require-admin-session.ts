import { cookies } from "next/headers";
import { NextResponse, type NextResponse as NextResponseType } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  validateAndTouchAdminSession,
  type AdminSession,
} from "@/lib/auth/admin-session";

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export type RequireAdminSessionResult =
  | {
      ok: true;
      session: AdminSession;
      cookieExpiresAtMs: number;
    }
  | { ok: false; response: NextResponseType };

export async function requireAdminSession(
  nowMs = Date.now(),
): Promise<RequireAdminSessionResult> {
  const jar = await cookies();
  const sessionId = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const validated = validateAndTouchAdminSession(sessionId, nowMs);
  if (!validated.ok) {
    const resp = NextResponse.json({ error: "unauthorized" }, { status: 401 });
    resp.cookies.set(ADMIN_SESSION_COOKIE, "", {
      ...baseCookieOptions(),
      maxAge: 0,
    });
    return { ok: false, response: resp };
  }

  return {
    ok: true,
    session: validated.session,
    cookieExpiresAtMs: validated.cookieExpiresAtMs,
  };
}

export function applyAdminSessionCookie(
  response: NextResponseType,
  result: RequireAdminSessionResult & { ok: true },
): NextResponseType {
  const nowMs = Date.now();
  const maxAgeSeconds = Math.max(
    Math.floor((result.cookieExpiresAtMs - nowMs) / 1000),
    0,
  );
  response.cookies.set(ADMIN_SESSION_COOKIE, result.session.id, {
    ...baseCookieOptions(),
    maxAge: maxAgeSeconds,
  });
  return response;
}

export function setAdminSessionCookie(
  response: NextResponseType,
  session: AdminSession,
  nowMs = Date.now(),
): NextResponseType {
  const cookieExpiresAtMs = Math.min(
    session.idleExpiresAtMs,
    session.absoluteExpiresAtMs,
  );
  const maxAgeSeconds = Math.max(
    Math.floor((cookieExpiresAtMs - nowMs) / 1000),
    0,
  );
  response.cookies.set(ADMIN_SESSION_COOKIE, session.id, {
    ...baseCookieOptions(),
    maxAge: maxAgeSeconds,
  });
  return response;
}

export function clearAdminSessionCookie(
  response: NextResponseType,
): NextResponseType {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...baseCookieOptions(),
    maxAge: 0,
  });
  return response;
}
