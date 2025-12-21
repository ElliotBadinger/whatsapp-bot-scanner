import { NextResponse } from "next/server";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import { ChatIdSchema } from "@/lib/chat-id-schema";
import { hasValidAdminSession } from "@/lib/admin-session";

export async function POST(
  _req: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { chatId } = await context.params;
  const parsedChatId = ChatIdSchema.safeParse(chatId);
  if (!parsedChatId.success) {
    return NextResponse.json({ error: "invalid_chat_id" }, { status: 400 });
  }

  try {
    const result = await controlPlaneFetchJson<{ ok: boolean }>(
      `/groups/${encodeURIComponent(parsedChatId.data)}/unmute`,
      { method: "POST" },
    );
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "unmute_failed" }, { status });
  }
}
