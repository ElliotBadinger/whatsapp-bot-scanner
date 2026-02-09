import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  deleteAdminSession,
} from "@/lib/auth/admin-session";
import { clearAdminSessionCookie } from "@/lib/auth/require-admin-session";

export async function POST() {
  const jar = await cookies();
  const sessionId = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (sessionId) {
    deleteAdminSession(sessionId);
  }

  const res = new NextResponse(undefined, { status: 204 });
  clearAdminSessionCookie(res);
  return res;
}

export const dynamic = "force-dynamic";
