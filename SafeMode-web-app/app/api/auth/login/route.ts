import { NextResponse } from "next/server";
import { z } from "zod";
import { setAdminCookies } from "@/lib/admin-guards";
import {
  createAdminSessionToken,
  getAdminAuthConfig,
  getRequestIp,
  verifyAdminPassword,
} from "@/lib/admin-session";
import { consumeRateLimit } from "@/lib/rate-limit";

const PostBodySchema = z.object({
  password: z.string().trim().min(12).max(256),
});

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rate = consumeRateLimit(`safemode_admin_login:${ip}`, {
    windowMs: 60_000,
    max: 5,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const config = getAdminAuthConfig();
  if (!config.ok) {
    console.error("SafeMode admin auth misconfigured", { error: config.error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const isValid = verifyAdminPassword(
    parsed.data.password,
    config.config.adminPassword,
  );
  if (!isValid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { token, session } = createAdminSessionToken({
    secret: config.config.sessionSecret,
    ttlSeconds: config.config.sessionTtlSeconds,
  });

  const res = NextResponse.json({
    ok: true,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });

  setAdminCookies(res, {
    token,
    csrf: session.csrf,
    ttlSeconds: config.config.sessionTtlSeconds,
  });

  return res;
}
