import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSafemodeAdminToken,
  isValidSafemodeAdminToken,
  setAdminSessionCookie,
} from "@/lib/admin-session";

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
    getSafemodeAdminToken();
  } catch {
    return NextResponse.json(
      { error: "server_not_configured" },
      { status: 500 },
    );
  }

  if (!isValidSafemodeAdminToken(parsed.data.token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setAdminSessionCookie(response);
  return response;
}

export const dynamic = "force-dynamic";
