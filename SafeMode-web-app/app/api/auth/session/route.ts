import { NextResponse } from "next/server";
import {
  applyAdminSessionCookie,
  requireAdminSession,
} from "@/lib/auth/require-admin-session";

export async function GET() {
  const result = await requireAdminSession();
  if (!result.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const res = NextResponse.json({
    authenticated: true,
    idleTimeoutMs: result.session.idleExpiresAtMs - result.session.lastSeenAtMs,
    expiresAtMs: result.cookieExpiresAtMs,
  });
  return applyAdminSessionCookie(res, result);
}

export const dynamic = "force-dynamic";
