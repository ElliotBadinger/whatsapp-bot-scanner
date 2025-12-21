import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { requireCsrf } from "@/lib/api-guards";

const PostBodySchema = z.object({
  token: z.string().trim().min(1),
});

function getExpectedToken(): string {
  return (process.env.CONTROL_PLANE_API_TOKEN ?? "").trim();
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const body = await req.json().catch(() => null);
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const expected = getExpectedToken();
  if (!expected) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  if (!timingSafeEqualString(parsed.data.token, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = createSessionCookieValue();
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return resp;
}
