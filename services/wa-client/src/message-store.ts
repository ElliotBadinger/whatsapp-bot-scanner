import type { Redis } from "ioredis";
import {
  hashChatId,
  hashMessageId,
  isIdentifierHash,
} from "@wbscanner/shared";

export type VerdictStatus =
  | "pending"
  | "sent"
  | "retrying"
  | "failed"
  | "retracted";

export interface VerdictAttemptPayload {
  chatId: string;
  messageId: string;
  url: string;
  urlHash: string;
  verdict: string;
  reasons: string[];
  decidedAt?: number;
  verdictMessageId?: string;
  ack?: number | null;
  attachments?: { screenshot?: boolean; ioc?: boolean };
  redirectChain?: string[];
  shortener?: { provider: string; chain: string[] } | null;
  degradedProviders?: Array<{ name: string; reason: string }> | null;
}

export interface VerdictRecord {
  url: string;
  urlHash: string;
  verdict: string;
  reasons: string[];
  decidedAt?: number;
  status: VerdictStatus;
  attemptCount: number;
  lastAttemptAt?: number;
  verdictMessageId?: string;
  ack?: number | null;
  lastAckAt?: number;
  ackHistory: Array<{ ack: number | null; at: number }>;
  attachments?: { screenshot?: boolean; ioc?: boolean };
  redirectChain?: string[];
  shortener?: { provider: string; chain: string[] } | null;
  degradedProviders?: Array<{ name: string; reason: string }> | null;
}

export interface MessageEditRecord {
  body: string;
  normalizedUrls: string[];
  urlHashes: string[];
  timestamp: number;
}

export interface MessageReactionRecord {
  reaction: string;
  senderId: string;
  timestamp: number;
}

export interface MessageRevocationRecord {
  scope: "everyone" | "me";
  timestamp: number;
}

export interface MessageRecord {
  chatId: string;
  messageId: string;
  senderId?: string | null;
  senderIdHash?: string | null;
  timestamp?: number;
  body?: string;
  normalizedUrls: string[];
  urlHashes: string[];
  createdAt: number;
  edits: MessageEditRecord[];
  reactions: MessageReactionRecord[];
  revocations: MessageRevocationRecord[];
  verdicts: Record<string, VerdictRecord>;
}

export interface VerdictContext {
  chatId: string;
  messageId: string;
  urlHash: string;
}

const MESSAGE_KEY_PREFIX = "wa:message:";
const VERDICT_MAP_PREFIX = "wa:verdict:message:";
const PENDING_ACK_SET_KEY = "wa:verdict:pending_ack";

export class MessageStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
  ) {}

  private messageKey(chatId: string, messageId: string): string {
    const chatHash = isIdentifierHash(chatId) ? chatId : hashChatId(chatId);
    const messageHash = isIdentifierHash(messageId)
      ? messageId
      : hashMessageId(messageId);
    return `${MESSAGE_KEY_PREFIX}${chatHash}:${messageHash}`;
  }

  private legacyMessageKey(chatId: string, messageId: string): string {
    return `${MESSAGE_KEY_PREFIX}${chatId}:${messageId}`;
  }

  private verdictMappingKey(verdictMessageId: string): string {
    const verdictHash = isIdentifierHash(verdictMessageId)
      ? verdictMessageId
      : hashMessageId(verdictMessageId);
    return `${VERDICT_MAP_PREFIX}${verdictHash}`;
  }

  private legacyVerdictMappingKey(verdictMessageId: string): string {
    return `${VERDICT_MAP_PREFIX}${verdictMessageId}`;
  }

  private serializeContext(context: VerdictContext): string {
    return JSON.stringify({
      chatId: context.chatId,
      messageId: context.messageId,
      urlHash: context.urlHash,
    });
  }

  private async loadRecord(key: string): Promise<MessageRecord | null> {
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as MessageRecord;
      parsed.edits ??= [];
      parsed.reactions ??= [];
      parsed.revocations ??= [];
      parsed.verdicts ??= {};
      return parsed;
    } catch {
      return null;
    }
  }

  private async loadRecordWithFallback(
    chatId: string,
    messageId: string,
  ): Promise<{ record: MessageRecord | null; key: string }> {
    const key = this.messageKey(chatId, messageId);
    const record = await this.loadRecord(key);
    if (record) {
      return { record, key };
    }
    const legacyKey = this.legacyMessageKey(chatId, messageId);
    const legacyRecord = await this.loadRecord(legacyKey);
    if (!legacyRecord) {
      return { record: null, key };
    }
    await this.saveRecord(key, legacyRecord);
    await this.redis.del(legacyKey);
    return { record: legacyRecord, key };
  }

  private async saveRecord(key: string, record: MessageRecord): Promise<void> {
    await this.redis.set(key, JSON.stringify(record), "EX", this.ttlSeconds);
  }

  async getRecord(
    chatId: string,
    messageId: string,
  ): Promise<MessageRecord | null> {
    const { record } = await this.loadRecordWithFallback(chatId, messageId);
    return record;
  }

  async setRecord(record: MessageRecord): Promise<void> {
    const key = this.messageKey(record.chatId, record.messageId);
    await this.saveRecord(key, record);
  }

  async ensureRecord(details: {
    chatId: string;
    messageId: string;
    senderId?: string | null;
    senderIdHash?: string | null;
    timestamp?: number;
    body?: string;
    normalizedUrls?: string[];
    urlHashes?: string[];
  }): Promise<MessageRecord> {
    const { record: existing, key } = await this.loadRecordWithFallback(
      details.chatId,
      details.messageId,
    );
    if (existing) {
      return existing;
    }
    const normalizedUrls = details.normalizedUrls ?? [];
    const urlHashes = details.urlHashes ?? [];
    const record: MessageRecord = {
      chatId: details.chatId,
      messageId: details.messageId,
      senderId: details.senderId ?? null,
      senderIdHash: details.senderIdHash ?? null,
      timestamp: details.timestamp,
      body: details.body,
      normalizedUrls,
      urlHashes,
      createdAt: Date.now(),
      edits: [],
      reactions: [],
      revocations: [],
      verdicts: {},
    };
    await this.saveRecord(key, record);
    return record;
  }

  async recordMessageCreate(details: {
    chatId: string;
    messageId: string;
    senderId?: string | null;
    senderIdHash?: string | null;
    timestamp?: number;
    body?: string;
    normalizedUrls: string[];
    urlHashes: string[];
  }): Promise<MessageRecord> {
    const record = await this.ensureRecord({
      chatId: details.chatId,
      messageId: details.messageId,
      senderId: details.senderId,
      senderIdHash: details.senderIdHash,
      timestamp: details.timestamp,
    });
    record.body = details.body;
    record.normalizedUrls = details.normalizedUrls;
    record.urlHashes = details.urlHashes;
    record.timestamp = details.timestamp ?? record.timestamp;
    record.senderId = details.senderId ?? record.senderId;
    record.senderIdHash = details.senderIdHash ?? record.senderIdHash;
    await this.saveRecord(this.messageKey(details.chatId, details.messageId), record);
    return record;
  }

  async appendEdit(
    chatId: string,
    messageId: string,
    edit: MessageEditRecord,
  ): Promise<MessageRecord | null> {
    const { record, key } = await this.loadRecordWithFallback(chatId, messageId);
    if (!record) {
      return null;
    }
    record.body = edit.body;
    record.normalizedUrls = edit.normalizedUrls;
    record.urlHashes = edit.urlHashes;
    record.edits.push(edit);
    if (record.edits.length > 20) {
      record.edits = record.edits.slice(record.edits.length - 20);
    }
    await this.saveRecord(key, record);
    return record;
  }

  async recordRevocation(
    chatId: string,
    messageId: string,
    scope: "everyone" | "me",
    timestamp: number,
  ): Promise<MessageRecord | null> {
    const { record, key } = await this.loadRecordWithFallback(chatId, messageId);
    if (!record) {
      return null;
    }
    record.revocations.push({ scope, timestamp });
    if (record.revocations.length > 10) {
      record.revocations = record.revocations.slice(
        record.revocations.length - 10,
      );
    }
    await this.saveRecord(key, record);
    return record;
  }

  async recordReaction(
    chatId: string,
    messageId: string,
    reaction: MessageReactionRecord,
  ): Promise<MessageRecord | null> {
    const { record, key } = await this.loadRecordWithFallback(chatId, messageId);
    if (!record) {
      return null;
    }
    record.reactions.push(reaction);
    if (record.reactions.length > 25) {
      record.reactions = record.reactions.slice(record.reactions.length - 25);
    }
    await this.saveRecord(key, record);
    return record;
  }

  async registerVerdictAttempt(
    payload: VerdictAttemptPayload,
  ): Promise<VerdictRecord | null> {
    const record = await this.ensureRecord({
      chatId: payload.chatId,
      messageId: payload.messageId,
    });
    record.verdicts ??= {};
    const existing = record.verdicts[payload.urlHash];
    const now = Date.now();
    const nextAttemptCount = (existing?.attemptCount ?? 0) + 1;
    const verdictRecord: VerdictRecord = {
      url: payload.url,
      urlHash: payload.urlHash,
      verdict: payload.verdict,
      reasons: payload.reasons,
      decidedAt: payload.decidedAt,
      status: "sent",
      attemptCount: nextAttemptCount,
      lastAttemptAt: now,
      verdictMessageId: payload.verdictMessageId ?? existing?.verdictMessageId,
      ack: payload.ack ?? existing?.ack ?? null,
      lastAckAt: payload.ack != null ? now : existing?.lastAckAt,
      ackHistory: existing?.ackHistory ? [...existing.ackHistory] : [],
      attachments: payload.attachments ?? existing?.attachments,
      redirectChain: payload.redirectChain ?? existing?.redirectChain,
      shortener: payload.shortener ?? existing?.shortener ?? null,
      degradedProviders:
        payload.degradedProviders ?? existing?.degradedProviders ?? null,
    };
    if (payload.ack !== undefined) {
      verdictRecord.ackHistory.push({ ack: payload.ack ?? null, at: now });
    } else if (existing?.ackHistory) {
      verdictRecord.ackHistory = existing.ackHistory.slice();
    }
    record.verdicts[payload.urlHash] = verdictRecord;
    await this.saveRecord(
      this.messageKey(payload.chatId, payload.messageId),
      record,
    );
    if (payload.verdictMessageId) {
      await this.setVerdictMapping(payload.verdictMessageId, {
        chatId: payload.chatId,
        messageId: payload.messageId,
        urlHash: payload.urlHash,
      });
    }
    return verdictRecord;
  }

  async addPendingAckContext(context: VerdictContext): Promise<void> {
    const serialized = this.serializeContext(context);
    await this.redis.zadd(PENDING_ACK_SET_KEY, Date.now(), serialized);
    await this.redis.expire(PENDING_ACK_SET_KEY, this.ttlSeconds);
  }

  async removePendingAckContext(context: VerdictContext): Promise<void> {
    const serialized = this.serializeContext(context);
    await this.redis.zrem(PENDING_ACK_SET_KEY, serialized);
  }

  async listPendingAckContexts(limit = 50): Promise<VerdictContext[]> {
    if (limit <= 0) {
      return [];
    }
    const entries = await this.redis.zrange(PENDING_ACK_SET_KEY, 0, limit - 1);
    const contexts: VerdictContext[] = [];
    for (const entry of entries) {
      try {
        const parsed = JSON.parse(entry) as VerdictContext;
        if (parsed.chatId && parsed.messageId && parsed.urlHash) {
          contexts.push(parsed);
        }
      } catch {
        await this.redis
          .zrem(PENDING_ACK_SET_KEY, entry)
          .catch(() => undefined);
      }
    }
    return contexts;
  }

  async updateVerdictAck(
    context: VerdictContext,
    ack: number | null,
    timestamp: number,
  ): Promise<{ verdict: VerdictRecord; previousAck: number | null } | null> {
    const key = this.messageKey(context.chatId, context.messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    const verdict = record.verdicts[context.urlHash];
    if (!verdict) {
      return null;
    }
    const prevAck = verdict.ack ?? null;
    verdict.ack = ack;
    verdict.lastAckAt = timestamp;
    if (!Array.isArray(verdict.ackHistory)) {
      verdict.ackHistory = [];
    }
    verdict.ackHistory.push({ ack, at: timestamp });
    if (verdict.ackHistory.length > 20) {
      verdict.ackHistory = verdict.ackHistory.slice(
        verdict.ackHistory.length - 20,
      );
    }
    record.verdicts[context.urlHash] = verdict;
    await this.saveRecord(key, record);
    return { verdict, previousAck: prevAck };
  }

  async markVerdictStatus(
    context: VerdictContext,
    status: VerdictStatus,
  ): Promise<VerdictRecord | null> {
    const key = this.messageKey(context.chatId, context.messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    const verdict = record.verdicts[context.urlHash];
    if (!verdict) {
      return null;
    }
    verdict.status = status;
    if (status === "failed") {
      verdict.lastAttemptAt = Date.now();
    }
    record.verdicts[context.urlHash] = verdict;
    await this.saveRecord(key, record);
    return verdict;
  }

  async getVerdictRecord(
    context: VerdictContext,
  ): Promise<VerdictRecord | null> {
    const { record } = await this.loadRecordWithFallback(
      context.chatId,
      context.messageId,
    );
    if (!record) {
      return null;
    }
    return record.verdicts[context.urlHash] ?? null;
  }

  async setVerdictMessageId(
    context: VerdictContext,
    verdictMessageId: string,
  ): Promise<VerdictRecord | null> {
    const { record, key } = await this.loadRecordWithFallback(
      context.chatId,
      context.messageId,
    );
    if (!record) {
      return null;
    }
    const verdict = record.verdicts[context.urlHash];
    if (!verdict) {
      return null;
    }
    verdict.verdictMessageId = verdictMessageId;
    record.verdicts[context.urlHash] = verdict;
    await this.saveRecord(key, record);
    await this.setVerdictMapping(verdictMessageId, context);
    return verdict;
  }

  async setVerdictMapping(
    verdictMessageId: string,
    context: VerdictContext,
  ): Promise<void> {
    await this.redis.set(
      this.verdictMappingKey(verdictMessageId),
      JSON.stringify(context),
      "EX",
      this.ttlSeconds,
    );
    await this.redis.del(this.legacyVerdictMappingKey(verdictMessageId));
  }

  async getVerdictMapping(
    verdictMessageId: string,
  ): Promise<VerdictContext | null> {
    const key = this.verdictMappingKey(verdictMessageId);
    let raw = await this.redis.get(key);
    if (!raw) {
      const legacyKey = this.legacyVerdictMappingKey(verdictMessageId);
      raw = await this.redis.get(legacyKey);
      if (raw) {
        await this.redis.set(key, raw, "EX", this.ttlSeconds);
        await this.redis.del(legacyKey);
      }
    }
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as VerdictContext;
      return parsed;
    } catch {
      return null;
    }
  }
}
