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
    const resp = await controlPlaneFetchWithBearerToken(parsed.data.token, "/status");

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
    if (
      err instanceof ControlPlaneError &&
      err.status === 400 &&
      err.code === "INVALID_INPUT_MISSING_BEARER_TOKEN"
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const logPayload =
      err instanceof ControlPlaneError
        ? { name: err.name, status: err.status, code: err.code }
        : { name: err instanceof Error ? err.name : "UnknownError" };

    console.warn("LOGIN_TOKEN_VALIDATION_FAILED", logPayload);
    return NextResponse.json({ error: "control_plane_unavailable" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
