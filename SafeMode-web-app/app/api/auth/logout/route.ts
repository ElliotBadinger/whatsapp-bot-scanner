import { NextResponse } from "next/server";
import { requireCsrf } from "@/lib/api-guards";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";

export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return resp;
}
