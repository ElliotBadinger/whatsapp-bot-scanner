import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin-guards";

export async function GET(req: Request) {
  const sessionResult = getAdminSessionFromRequest(req);
  if (!sessionResult.ok) {
    if (sessionResult.status === 401) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    return NextResponse.json(
      { error: sessionResult.error },
      { status: sessionResult.status },
    );
  }

  return NextResponse.json({
    authenticated: true,
    expiresAt: new Date(sessionResult.session.exp * 1000).toISOString(),
  });
}
