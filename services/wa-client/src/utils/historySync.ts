import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { Client, GroupChat, Message } from "whatsapp-web.js";
import {
  hashChatId,
  hashMessageId,
  isIdentifierHash,
} from "@wbscanner/shared";
import { safeGetGroupChatById } from "./chatLookup.js";
import type { SessionSnapshot } from "../session/guards.js";

const CHAT_CURSOR_KEY = (chatId: string) =>
  `wa:chat:${hashChatId(chatId)}:cursor`;
const LEGACY_CHAT_CURSOR_KEY = (chatId: string) => `wa:chat:${chatId}:cursor`;
const KNOWN_CHATS_KEY = "wa:chats:known";
const DEFAULT_CURSOR_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function rememberChat(
  redis: Redis,
  chatId: string,
): Promise<void> {
  await redis.sadd(KNOWN_CHATS_KEY, hashChatId(chatId));
  await redis.expire(KNOWN_CHATS_KEY, DEFAULT_CURSOR_TTL_SECONDS);
}

export async function listKnownChats(redis: Redis): Promise<string[]> {
  const members = await redis.smembers(KNOWN_CHATS_KEY);
  const hashed: string[] = [];
  for (const member of members) {
    if (isIdentifierHash(member)) {
      hashed.push(member);
      continue;
    }
    const converted = hashChatId(member);
    hashed.push(converted);
    await redis.srem(KNOWN_CHATS_KEY, member);
    await redis.sadd(KNOWN_CHATS_KEY, converted);
  }
  return hashed;
}

export async function updateChatCursor(
  redis: Redis,
  chatId: string,
  timestampMs: number,
): Promise<void> {
  if (!Number.isFinite(timestampMs)) return;
  await redis.set(
    CHAT_CURSOR_KEY(chatId),
    Math.max(timestampMs, 0).toString(),
    "EX",
    DEFAULT_CURSOR_TTL_SECONDS,
  );
}

export async function getChatCursor(
  redis: Redis,
  chatId: string,
): Promise<number | null> {
  const key = CHAT_CURSOR_KEY(chatId);
  let raw = await redis.get(key);
  if (!raw) {
    const legacyKey = LEGACY_CHAT_CURSOR_KEY(chatId);
    raw = await redis.get(legacyKey);
    if (raw) {
      await redis.set(key, raw, "EX", DEFAULT_CURSOR_TTL_SECONDS);
      await redis.del(legacyKey);
    }
  }
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

interface HistorySyncParams {
  client: Client;
  redis: Redis;
  logger: Logger;
  chatId: string;
  snapshot?: SessionSnapshot;
  limit?: number;
  onMessage: (msg: Message, chat: GroupChat) => Promise<void>;
}

export async function syncChatHistory(
  params: HistorySyncParams,
): Promise<number> {
  const {
    client,
    redis,
    logger,
    chatId,
    snapshot,
    limit = 200,
    onMessage,
  } = params;
  const cursor = await getChatCursor(redis, chatId);
  const effectiveSnapshot: SessionSnapshot = snapshot ?? {
    state: "ready",
    wid: "history-sync",
  };
  const chat = await safeGetGroupChatById({
    client,
    chatId,
    snapshot: effectiveSnapshot,
    logger,
    suppressError: !snapshot,
  });
  if (!chat || !(chat as GroupChat).isGroup) return 0;
  const groupChat = chat as GroupChat;
  await rememberChat(redis, chatId);

  const messages = await groupChat
    .fetchMessages({ limit, fromMe: false })
    .catch((err) => {
      logger.warn(
        { err, chatIdHash: hashChatId(chatId) },
        "Failed to fetch message history for chat",
      );
      return [] as Message[];
    });
  if (!messages || messages.length === 0) return 0;

  const baseline = cursor ?? null;
  if (baseline === null) {
    const latest = messages[messages.length - 1];
    if (latest?.timestamp) {
      await updateChatCursor(redis, chatId, latest.timestamp * 1000);
    }
    return 0;
  }

  let processed = 0;
  for (const msg of messages) {
    const tsMs = (msg.timestamp ?? 0) * 1000;
    if (!tsMs || tsMs <= baseline) continue;
    try {
      await onMessage(msg, groupChat);
      await updateChatCursor(redis, chatId, tsMs);
      processed += 1;
    } catch (err) {
      logger.error(
        {
          err,
          chatIdHash: hashChatId(chatId),
          messageIdHash: msg.id?._serialized
            ? hashMessageId(msg.id._serialized)
            : undefined,
        },
        "Failed to sync historical message",
      );
    }
  }
  return processed;
}
