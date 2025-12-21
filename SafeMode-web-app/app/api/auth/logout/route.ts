import { NextResponse } from "next/server";
import {
  clearAdminCookies,
  getAdminSessionFromRequest,
  requireCsrf,
} from "@/lib/admin-guards";

export async function POST(req: Request) {
  const sessionResult = getAdminSessionFromRequest(req);
  if (!sessionResult.ok) {
    return NextResponse.json(
      { error: sessionResult.error },
      { status: sessionResult.status },
    );
  }

  const csrf = requireCsrf(req, sessionResult.session);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: csrf.status });
  }

  const res = NextResponse.json({ ok: true });
  clearAdminCookies(res);
  return res;
}
