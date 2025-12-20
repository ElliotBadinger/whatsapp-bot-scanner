import type { Logger } from "pino";
import type { Message } from "whatsapp-web.js";
import type { MessageStore } from "../message-store.js";
import { hashChatId, hashMessageId } from "@wbscanner/shared";
import {
  describeSession,
  isSessionReady,
  type SessionSnapshot,
} from "../session/guards.js";
import { enrichEvaluationError } from "../session/errors.js";

export interface SelfRevokeDependencies {
  snapshot: SessionSnapshot;
  logger: Logger;
  messageStore: MessageStore;
  recordMetric: () => void;
  now?: () => number;
}

export type SelfRevokeOutcome = "recorded" | "skipped";

export async function handleSelfMessageRevoke(
  msg: Message,
  deps: SelfRevokeDependencies,
): Promise<SelfRevokeOutcome> {
  const { snapshot, logger, messageStore, recordMetric, now } = deps;
  if (!isSessionReady(snapshot)) {
    logger.debug(
      {
        messageIdHash: msg.id?._serialized
          ? hashMessageId(msg.id._serialized)
          : undefined,
        session: describeSession(snapshot),
      },
      "Skipping self revoke handler because session is not ready",
    );
    return "skipped";
  }

  const rawChatId =
    (msg.id as unknown as { remote?: string })?.remote ?? msg.from ?? "";
  if (typeof rawChatId === "string" && rawChatId.includes("status@broadcast")) {
    logger.debug(
      {
        messageIdHash: msg.id?._serialized
          ? hashMessageId(msg.id._serialized)
          : undefined,
      },
      "Skipping self revoke for status broadcast message",
    );
    return "skipped";
  }

  const chat = await msg.getChat().catch((err) => {
    throw enrichEvaluationError(err, {
      operation: "message_revoke_me:getChat",
      chatId: (msg.id as unknown as { remote?: string })?.remote
        ? hashChatId((msg.id as unknown as { remote?: string }).remote!)
        : undefined,
      messageId: msg.id?._serialized
        ? hashMessageId(msg.id._serialized)
        : undefined,
      snapshot,
    });
  });
  const chatId = chat.id._serialized;
  const messageId = msg.id._serialized || msg.id.id;
  await messageStore.recordRevocation(
    chatId,
    messageId,
    "me",
    now ? now() : Date.now(),
  );
  recordMetric();
  return "recorded";
}
