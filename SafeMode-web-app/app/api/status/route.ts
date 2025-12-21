import { NextResponse } from "next/server";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import type { SystemStatus } from "@/lib/api";
import { requireAdminSession } from "@/lib/api-guards";

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  try {
    const status = await controlPlaneFetchJson<SystemStatus>("/status");
    return NextResponse.json(status);
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "status_unavailable" }, { status });
  }
}

export const dynamic = "force-dynamic";
