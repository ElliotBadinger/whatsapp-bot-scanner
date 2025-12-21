import { NextResponse } from "next/server";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";

export async function POST(
  _req: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await context.params;
  try {
    const result = await controlPlaneFetchJson<{ ok: boolean }>(
      `/groups/${encodeURIComponent(chatId)}/unmute`,
      { method: "POST" },
    );
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "unmute_failed" }, { status });
  }
}
