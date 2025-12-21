import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import type { RescanResult } from "@/lib/api";
import { requireAdminSession, requireCsrf } from "@/lib/api-guards";

const PostBodySchema = z.object({
  url: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const body = await req.json().catch(() => null);
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
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
