import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-guards";

export async function GET() {
  const error = await requireAdminSession();
  if (error) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({ authenticated: true }, { status: 200 });
}
