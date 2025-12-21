import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from "./auth-session";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  isValidCsrfPair,
} from "./csrf-shared";

export async function requireAdminSession(): Promise<NextResponse | null> {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    if (!isValidSessionCookieValue(session)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  return null;
}

export async function requireCsrf(req: Request): Promise<NextResponse | null> {
  const store = await cookies();
  const csrfCookie = store.get(CSRF_COOKIE_NAME)?.value;
  const csrfHeader = req.headers.get(CSRF_HEADER_NAME) ?? undefined;
  if (!isValidCsrfPair({ csrfCookie, csrfHeader })) {
    return NextResponse.json({ error: "csrf_failed" }, { status: 403 });
  }
  return null;
}
