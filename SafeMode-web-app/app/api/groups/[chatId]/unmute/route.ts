import { NextResponse } from "next/server";
import { getAdminSessionFromRequest, requireCsrf } from "@/lib/admin-guards";
import { getRequestIp } from "@/lib/admin-session";
import {
  ControlPlaneError,
  controlPlaneFetchJson,
} from "@/lib/control-plane-server";
import { ChatIdSchema } from "@/lib/chat-id-schema";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  context: { params: Promise<{ chatId: string }> },
) {
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

  const ip = getRequestIp(req);
  const rate = consumeRateLimit(`safemode_admin_groups_unmute:${ip}`, {
    windowMs: 60_000,
    max: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
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
