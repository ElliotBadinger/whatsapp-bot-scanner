import type { Logger } from "pino";
import type { Client, GroupChat } from "whatsapp-web.js";
import { hashChatId } from "@wbscanner/shared";
import {
  describeSession,
  isSessionReady,
  type SessionSnapshot,
} from "../session/guards.js";
import { enrichEvaluationError } from "../session/errors.js";

interface ChatLookupParams {
  client: Client;
  chatId: string;
  snapshot: SessionSnapshot;
  logger: Logger;
  suppressError?: boolean;
}

export async function safeGetGroupChatById(
  params: ChatLookupParams,
): Promise<GroupChat | null> {
  const { client, chatId, snapshot, logger, suppressError } = params;
  if (!isSessionReady(snapshot)) {
    logger.debug(
      { chatIdHash: hashChatId(chatId), session: describeSession(snapshot) },
      "Skipping chat lookup because session is not ready",
    );
    return null;
  }
  try {
    const chat = await client.getChatById(chatId);
    if (chat && (chat as GroupChat).isGroup) {
      return chat as GroupChat;
    }
    return null;
  } catch (err) {
    const wrapped = enrichEvaluationError(err, {
      operation: "getChatById",
      chatId: hashChatId(chatId),
      snapshot,
    });
    if (suppressError) {
      logger.warn(
        { err: wrapped, chatIdHash: hashChatId(chatId) },
        "Chat lookup failed but was suppressed",
      );
      return null;
    }
    throw wrapped;
  }
}
