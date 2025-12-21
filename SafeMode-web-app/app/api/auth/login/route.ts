import { NextResponse } from "next/server";
import { z } from "zod";
import { controlPlaneFetchWithBearerToken } from "@/lib/control-plane-server";

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
      { timeoutMs: 6000 },
    );

    if (resp.ok) {
      return NextResponse.json({ ok: true });
    }

    if (resp.status === 401) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    return NextResponse.json({ error: "login_failed" }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "login_failed" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
