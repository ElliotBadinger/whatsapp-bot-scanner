import { NextResponse } from "next/server";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import { ChatIdSchema } from "@/lib/chat-id-schema";
import { requireAdminSession, requireCsrf } from "@/lib/api-guards";

export async function POST(
  req: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

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
