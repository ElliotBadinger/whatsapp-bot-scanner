import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import type { Override } from "@/lib/api";

type ControlPlaneOverrideRow = {
  id: number | string;
  url_hash: string | null;
  pattern: string | null;
  status: "allow" | "deny";
  scope: string | null;
  scope_id: string | null;
  created_by: string | null;
  created_at: string | Date;
  expires_at: string | Date | null;
  reason: string | null;
};

function mapOverride(row: ControlPlaneOverrideRow): Override {
  return {
    id: String(row.id),
    pattern: row.pattern || row.url_hash || "<missing-pattern>",
    action: row.status === "allow" ? "allow" : "block",
    reason: row.reason || "",
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

const PostBodySchema = z.object({
  pattern: z.string().trim().min(1),
  action: z.enum(["allow", "block"]),
  reason: z.string().trim().optional(),
});

export async function GET() {
  try {
    const rows =
      await controlPlaneFetchJson<ControlPlaneOverrideRow[]>("/overrides");
    return NextResponse.json(rows.map(mapOverride));
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "overrides_unavailable" }, { status });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { pattern, action, reason } = parsed.data;

  try {
    const result = await controlPlaneFetchJson<{ ok: boolean }>("/overrides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pattern,
        status: action === "allow" ? "allow" : "deny",
        reason: reason || undefined,
      }),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "override_create_failed" }, { status });
  }
}
