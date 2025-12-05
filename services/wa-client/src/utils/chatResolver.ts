import type { Client, GroupChat, Message } from "whatsapp-web.js";
import type { Logger } from "pino";
import { assertSessionReady } from "../state/runtimeSession.js";

export class ChatLookupError extends Error {
  public readonly chatId: string;
  public readonly causeError: unknown;

  constructor(chatId: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Unable to load chat ${chatId}: ${message}`);
    this.name = "ChatLookupError";
    this.chatId = chatId;
    this.causeError = cause;
  }
}

export interface ChatResolutionResult {
  chat: GroupChat;
  targetMessage: Message | null;
}

export interface ChatResolutionOptions {
  client: Pick<Client, "getMessageById" | "getChatById">;
  logger: Pick<Logger, "warn">;
  chatId: string;
  messageId: string;
}

export async function resolveChatForVerdict(
  options: ChatResolutionOptions,
): Promise<ChatResolutionResult> {
  const { client, logger, chatId, messageId } = options;
  assertSessionReady("load chat context");

  let targetMessage: Message | null = null;
  try {
    targetMessage = await client.getMessageById(messageId);
  } catch (err) {
    logger.warn({ err, messageId }, "Failed to hydrate original message by id");
  }

  try {
    if (targetMessage) {
      const chat = (await targetMessage.getChat()) as GroupChat;
      return { chat, targetMessage };
    }
    const chat = (await client.getChatById(chatId)) as GroupChat;
    return { chat, targetMessage };
  } catch (err) {
    throw new ChatLookupError(chatId, err);
  }
}
