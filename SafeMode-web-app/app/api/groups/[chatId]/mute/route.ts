import { NextResponse } from "next/server";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";

export async function POST(
  _req: Request,
  context: { params: { chatId: string } },
) {
  const { chatId } = context.params;
  try {
    const result = await controlPlaneFetchJson<{ ok: boolean; muted_until: string }>(
      `/groups/${encodeURIComponent(chatId)}/mute`,
      { method: "POST" },
    );
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "mute_failed" }, { status });
  }
}
