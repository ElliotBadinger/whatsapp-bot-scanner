import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";

const ChatIdSchema = z.string().trim().min(1).max(128);

export async function POST(
  _req: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await context.params;
  const parsedChatId = ChatIdSchema.safeParse(chatId);
  if (!parsedChatId.success) {
    return NextResponse.json({ error: "invalid_chat_id" }, { status: 400 });
  }

  try {
    const result = await controlPlaneFetchJson<{
      ok: boolean;
      muted_until: string;
    }>(`/groups/${encodeURIComponent(parsedChatId.data)}/mute`, {
      method: "POST",
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "mute_failed" }, { status });
  }
}
