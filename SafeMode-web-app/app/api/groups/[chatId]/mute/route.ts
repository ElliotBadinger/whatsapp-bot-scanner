import { NextResponse } from "next/server";
import {
  applyAdminSessionCookie,
  requireAdminSession,
} from "@/lib/auth/require-admin-session";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import { ChatIdSchema } from "@/lib/chat-id-schema";

export async function POST(
  _req: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

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
      authToken: auth.session.controlPlaneToken,
    });
    return applyAdminSessionCookie(NextResponse.json(result), auth);
  } catch (err) {
    const status = err instanceof ControlPlaneError ? err.status : 502;
    return NextResponse.json({ error: "mute_failed" }, { status });
  }
}
