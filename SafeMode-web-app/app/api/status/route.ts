import { NextResponse } from "next/server";
import type { SystemStatus } from "@/lib/api";

// Mock status data - in production this would proxy to control-plane
export async function GET() {
  const status: SystemStatus = {
    scansToday: Math.floor(Math.random() * 500) + 1000,
    threatsBlocked: Math.floor(Math.random() * 50) + 20,
    cacheHitRate: Math.floor(Math.random() * 15) + 80,
    groupsProtected: Math.floor(Math.random() * 100) + 300,
    uptime: "99.97%",
    version: "1.0.0",
  };

  return NextResponse.json(status);
}
