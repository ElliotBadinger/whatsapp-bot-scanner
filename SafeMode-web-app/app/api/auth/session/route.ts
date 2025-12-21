import { NextResponse } from "next/server";
import { readAdminSessionClaims } from "@/lib/admin-session";

export async function GET() {
  const session = await readAdminSessionClaims();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    expiresAt: new Date(session.claims.exp * 1000).toISOString(),
  });
}

export const dynamic = "force-dynamic";
