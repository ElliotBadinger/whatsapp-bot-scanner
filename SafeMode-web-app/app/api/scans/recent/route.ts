import { NextResponse } from "next/server";
import {
  applyAdminSessionCookie,
  requireAdminSession,
} from "@/lib/auth/require-admin-session";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import {
  type ControlPlaneScanRow,
  mapScanRow,
} from "@/lib/control-plane-mappers";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const parsedLimit = Number.parseInt(rawLimit || "10", 10);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 10;

  try {
    const limitParam = encodeURIComponent(String(limit));
    const rows = await controlPlaneFetchJson<ControlPlaneScanRow[]>(
      `/scans/recent?limit=${limitParam}`,
      { timeoutMs: 6000, authToken: auth.session.controlPlaneToken },
    );
    const mapped = rows.map(mapScanRow);
    return applyAdminSessionCookie(NextResponse.json(mapped), auth);
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "scans_unavailable" }, { status });
  }
}
