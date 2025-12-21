import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CSRF_COOKIE, timingSafeEqual } from "@/lib/auth/csrf";
import { cleanupRateLimitBuckets, checkRateLimit } from "@/lib/auth/rate-limit";
import { readJsonWithLimit } from "@/lib/auth/read-json-with-limit";
import { createAdminSession } from "@/lib/auth/admin-session";
import { setAdminSessionCookie } from "@/lib/auth/require-admin-session";
import { ControlPlaneError, controlPlaneFetchJson } from "@/lib/control-plane-server";
import type { SystemStatus } from "@/lib/api";

const LoginBodySchema = z.object({
  token: z.string().trim().min(1).max(2048),
  csrfToken: z.string().trim().min(1).max(256),
});

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(req: NextRequest) {
  const nowMs = Date.now();
  cleanupRateLimitBuckets(nowMs);

  const rawLength = req.headers.get("content-length");
  const length = rawLength ? Number.parseInt(rawLength, 10) : 0;
  if (Number.isFinite(length) && length > 8 * 1024) {
    return NextResponse.json({ error: "invalid_request" }, { status: 413 });
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-login:${ip}`, nowMs, {
    windowMs: 5 * 60 * 1000,
    max: 10,
  });
  if (!rate.ok) {
    const retryAfterSeconds = Math.max(
      Math.ceil((rate.resetAtMs - nowMs) / 1000),
      1,
    );
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  let body: unknown = null;
  try {
    body = await readJsonWithLimit(req, 8 * 1024);
  } catch (err) {
    if (err instanceof Error && err.message === "body_too_large") {
      return NextResponse.json({ error: "invalid_request" }, { status: 413 });
    }
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = LoginBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "csrf_failed" }, { status: 403 });
  }

  const jar = await cookies();
  const csrfCookie = jar.get(CSRF_COOKIE)?.value;
  if (
    !csrfCookie ||
    !timingSafeEqual(csrfCookie, parsed.data.csrfToken)
  ) {
    return NextResponse.json({ error: "csrf_failed" }, { status: 403 });
  }

  try {
    await controlPlaneFetchJson<SystemStatus>("/status", {
      authToken: parsed.data.token,
      timeoutMs: 6000,
    });
  } catch (err) {
    if (err instanceof ControlPlaneError && err.status === 401) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }

  const session = createAdminSession(parsed.data.token, nowMs);
  const res = NextResponse.json({ ok: true });
  setAdminSessionCookie(res, session, nowMs);
  res.cookies.set(CSRF_COOKIE, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0,
  });

  return res;
}

export const dynamic = "force-dynamic";
