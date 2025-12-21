import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import type { SystemStatus } from "@/lib/api";
import {
  ADMIN_SESSION_COOKIE,
  validateAndTouchAdminSession,
} from "@/lib/auth/admin-session";

export async function GET() {
  try {
    const jar = await cookies();
    const sessionId = jar.get(ADMIN_SESSION_COOKIE)?.value;
    const session = sessionId ? validateAndTouchAdminSession(sessionId) : null;

    const status = await controlPlaneFetchJson<SystemStatus>("/status", {
      authToken: session && session.ok ? session.session.controlPlaneToken : undefined,
    });
    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "status_unavailable" }, { status });
  }
}

export const dynamic = "force-dynamic";
