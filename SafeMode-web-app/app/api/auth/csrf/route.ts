import { NextResponse } from "next/server";
import { CSRF_COOKIE, generateCsrfToken } from "@/lib/auth/csrf";

export async function GET() {
  const csrfToken = generateCsrfToken();
  const res = NextResponse.json({ csrfToken });
  res.cookies.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 15 * 60,
  });
  return res;
}

export const dynamic = "force-dynamic";
