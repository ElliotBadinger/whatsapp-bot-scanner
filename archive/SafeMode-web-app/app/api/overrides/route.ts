import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
  controlPlaneFetchJsonWithStatus,
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

function toIsoDate(input: string | Date): string | null {
  const date = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapOverride(row: ControlPlaneOverrideRow): Override | null {
  const pattern = row.pattern ?? row.url_hash;
  if (!pattern) {
    console.warn("Override row missing pattern/url_hash", {
      id: String(row.id),
      url_hash: row.url_hash,
      pattern: row.pattern,
    });
    return null;
  }

  const isoCreatedAt = toIsoDate(row.created_at);
  if (!isoCreatedAt) {
    console.warn("Override row has invalid created_at", {
      id: String(row.id),
      created_at: row.created_at,
    });
    return null;
  }

  return {
    id: String(row.id),
    pattern,
    action: row.status === "allow" ? "allow" : "block",
    reason: row.reason || "",
    createdAt: isoCreatedAt,
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

    const overrides = rows
      .map(mapOverride)
      .filter((override): override is Override => override !== null);

    if (overrides.length !== rows.length) {
      console.warn("Some overrides were dropped due to invalid data", {
        total: rows.length,
        returned: overrides.length,
      });
    }

    return NextResponse.json(overrides);
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
    const { status, data } = await controlPlaneFetchJsonWithStatus<{
      ok: boolean;
    }>(
      "/overrides",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pattern,
          status: action === "allow" ? "allow" : "deny",
          reason: reason || undefined,
        }),
      },
      { allowNoContent: true },
    );

    if (status === 204 || status === 205 || data === undefined) {
      return new NextResponse(undefined, { status });
    }

    return NextResponse.json(data, { status });
  } catch (err) {
    if (err instanceof ControlPlaneError) {
      if (err.status === 400 && err.code === "VALIDATION_ERROR") {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      }

      const status =
        typeof err.status === "number" && err.status >= 400 && err.status < 600
          ? err.status
          : 502;

      return NextResponse.json({ error: "override_create_failed" }, { status });
    }

    return NextResponse.json(
      { error: "override_create_failed" },
      { status: 502 },
    );
  }
}
