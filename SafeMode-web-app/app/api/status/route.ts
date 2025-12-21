import { NextResponse } from "next/server";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import type { SystemStatus } from "@/lib/api";

export async function GET() {
  try {
    const status = await controlPlaneFetchJson<SystemStatus>("/status");
    return NextResponse.json(status, {
      headers: {
        // Allow caching for 5 seconds at the edge/browser
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
      },
    });
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "status_unavailable" }, { status });
  }
}

export const dynamic = "force-dynamic";
