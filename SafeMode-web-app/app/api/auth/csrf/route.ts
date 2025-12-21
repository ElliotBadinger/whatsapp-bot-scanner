import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME } from "@/lib/csrf-shared";
import { createCsrfToken } from "@/lib/csrf-server";

export async function GET() {
  const token = createCsrfToken();
  const resp = NextResponse.json({ csrfToken: token });
  resp.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return resp;
}
