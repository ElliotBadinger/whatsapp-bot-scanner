import { NextResponse } from "next/server";
import { z } from "zod";
import {
  controlPlaneFetchWithBearerToken,
  normalizeBearerToken,
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

  const token = normalizeBearerToken(parsed.data.token);
  if (!token) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const resp = await controlPlaneFetchWithBearerToken(token, "/status");

    if (resp.status === 200) {
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

    if (resp.status >= 400 && resp.status < 500) {
      return NextResponse.json(
        { error: "control_plane_client_error", controlPlaneStatus: resp.status },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "unexpected_control_plane_status", controlPlaneStatus: resp.status },
      { status: 502 },
    );
  } catch (err) {
    const logPayload =
      err && typeof err === "object" && "name" in err
        ? { name: String((err as { name?: unknown }).name) }
        : { name: "UnknownError" };

    console.warn("LOGIN_TOKEN_VALIDATION_FAILED", logPayload);
    return NextResponse.json({ error: "control_plane_unavailable" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
