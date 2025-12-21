import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ControlPlaneError,
  controlPlaneFetchWithBearerToken,
} from "@/lib/control-plane-server";

const PostBodySchema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const resp = await controlPlaneFetchWithBearerToken(
      parsed.data.token,
      "/status",
    );

    if (resp.ok) {
      return NextResponse.json({ ok: true });
    }

    if (resp.status === 401) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    if (resp.status >= 500) {
      return NextResponse.json(
        { error: "control_plane_unavailable" },
        { status: 502 },
      );
    }

    if (resp.status >= 400) {
      return NextResponse.json({ error: "control_plane_error" }, { status: 502 });
    }

    return NextResponse.json({ error: "login_failed" }, { status: 502 });
  } catch (err) {
    if (
      err instanceof ControlPlaneError &&
      err.status === 400 &&
      err.code === "MISSING_BEARER_TOKEN"
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const name = err instanceof Error ? err.name : "UnknownError";
    const message = err instanceof Error ? err.message : undefined;
    console.warn("Control-plane token validation failed", { name, message });
    return NextResponse.json({ error: "control_plane_unavailable" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
