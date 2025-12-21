import { NextResponse } from "next/server";
import type { SystemStatus } from "@/lib/api";

// Cache the status for 5 seconds to reduce computation
let cachedStatus: SystemStatus | null = null;
let cacheTime = 0;
const CACHE_DURATION_MS = 5000;

function generateStatus(): SystemStatus {
  const now = Date.now();

  // Return cached status if still valid
  if (cachedStatus && now - cacheTime < CACHE_DURATION_MS) {
    return cachedStatus;
  }

  // Generate new status
  cachedStatus = {
    scansToday: Math.floor(Math.random() * 500) + 1000,
    threatsBlocked: Math.floor(Math.random() * 50) + 20,
    cacheHitRate: Math.floor(Math.random() * 15) + 80,
    groupsProtected: Math.floor(Math.random() * 100) + 300,
    uptime: "99.97%",
    version: "1.0.0",
  };
  cacheTime = now;

  return cachedStatus;
}

export async function GET() {
  const status = generateStatus();

  return NextResponse.json(status, {
    headers: {
      // Allow caching for 5 seconds at the edge/browser
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
    },
  });
}

// Mark as dynamic to enable proper caching behavior
export const dynamic = "force-dynamic";
