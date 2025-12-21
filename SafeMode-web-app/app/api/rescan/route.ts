import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFromRequest, requireCsrf } from "@/lib/admin-guards";
import { getRequestIp } from "@/lib/admin-session";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import type { RescanResult } from "@/lib/api";
import { consumeRateLimit } from "@/lib/rate-limit";

function isValidHttpUrl(raw: string): boolean {
  if (!raw || raw.length > 2048) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const PostBodySchema = z.object({
  url: z.string().trim().min(1).max(2048).refine(isValidHttpUrl),
});

export async function POST(req: Request) {
  const sessionResult = getAdminSessionFromRequest(req);
  if (!sessionResult.ok) {
    return NextResponse.json(
      { error: sessionResult.error },
      { status: sessionResult.status },
    );
  }

  const csrf = requireCsrf(req, sessionResult.session);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: csrf.status });
  }

  const ip = getRequestIp(req);
  const rate = consumeRateLimit(`safemode_admin_rescan:${ip}`, {
    windowMs: 60_000,
    max: 60,
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
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  try {
    const result = await controlPlaneFetchJson<RescanResult>("/rescan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: parsed.data.url }),
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    const errorCode = err instanceof ControlPlaneError ? err.code : undefined;
    if (status === 400 && errorCode === "invalid_url") {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }
    return NextResponse.json({ error: "rescan_failed" }, { status });
  }
}
