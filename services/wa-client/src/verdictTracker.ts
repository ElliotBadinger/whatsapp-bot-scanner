import type { Redis } from "ioredis";
import type { Message } from "whatsapp-web.js";
import type { Logger } from "pino";
import { config, metrics } from "@wbscanner/shared";

export interface PendingVerdictRecord {
  verdictMessageId: string;
  originalMessageId: string;
  chatId: string;
  verdictText: string;
  urlHash: string;
  sentAt: number;
  retries: number;
  level: string;
  payload: Record<string, unknown>;
}

const pendingTimers = new Map<string, NodeJS.Timeout>();

function pendingKey(verdictMessageId: string): string {
  return `wa:verdict:pending:${verdictMessageId}`;
}

function resolveTimeoutMs(): number {
  return config.wa.verdictAckTimeoutSeconds * 1000;
}

export async function storePendingVerdict(
  redis: Redis,
  record: PendingVerdictRecord,
  resendFn: (
    record: PendingVerdictRecord,
  ) => Promise<PendingVerdictRecord | null>,
  logger: Logger,
): Promise<void> {
  await redis.set(
    pendingKey(record.verdictMessageId),
    JSON.stringify(record),
    "EX",
    Math.ceil(resolveTimeoutMs() / 1000) * 5,
  );
  scheduleTimeout(redis, record.verdictMessageId, resendFn, logger);
}

function stopTimer(verdictMessageId: string) {
  const timer = pendingTimers.get(verdictMessageId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(verdictMessageId);
  }
}

async function discardPendingVerdict(
  redis: Redis,
  verdictMessageId: string,
): Promise<void> {
  await redis.del(pendingKey(verdictMessageId));
  stopTimer(verdictMessageId);
}

export async function clearPendingVerdict(
  redis: Redis,
  verdictMessageId: string,
  outcome: "success" | "failed",
): Promise<void> {
  await discardPendingVerdict(redis, verdictMessageId);
  metrics.waVerdictDelivery.labels(outcome).inc();
}

export async function loadPendingVerdict(
  redis: Redis,
  verdictMessageId: string,
): Promise<PendingVerdictRecord | null> {
  const raw = await redis.get(pendingKey(verdictMessageId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingVerdictRecord;
  } catch {
    return null;
  }
}

function scheduleTimeout(
  redis: Redis,
  verdictMessageId: string,
  resendFn: (
    record: PendingVerdictRecord,
  ) => Promise<PendingVerdictRecord | null>,
  logger: Logger,
) {
  if (pendingTimers.has(verdictMessageId)) {
    clearTimeout(pendingTimers.get(verdictMessageId)!);
  }
  const timeout = setTimeout(async () => {
    pendingTimers.delete(verdictMessageId);
    const record = await loadPendingVerdict(redis, verdictMessageId);
    if (!record) return;
    if (record.retries >= config.wa.verdictAckMaxRetries) {
      await clearPendingVerdict(redis, verdictMessageId, "failed");
      logger.warn(
        { verdictMessageId, chatId: record.chatId, retries: record.retries },
        "Verdict delivery failed after max retries",
      );
      return;
    }
    metrics.waVerdictDeliveryRetries.labels("timeout").inc();
    logger.warn(
      { verdictMessageId, chatId: record.chatId, retries: record.retries },
      "Verdict ack timeout, retrying delivery",
    );
    const updated = await resendFn({ ...record, retries: record.retries + 1 });
    if (updated) {
      await discardPendingVerdict(redis, verdictMessageId);
      await redis.set(
        pendingKey(updated.verdictMessageId),
        JSON.stringify(updated),
        "EX",
        Math.ceil(resolveTimeoutMs() / 1000) * 5,
      );
      scheduleTimeout(redis, updated.verdictMessageId, resendFn, logger);
    } else {
      await clearPendingVerdict(redis, verdictMessageId, "failed");
    }
  }, resolveTimeoutMs());
  pendingTimers.set(verdictMessageId, timeout);
}

export async function restorePendingVerdicts(
  redis: Redis,
  resendFn: (
    record: PendingVerdictRecord,
  ) => Promise<PendingVerdictRecord | null>,
  logger: Logger,
): Promise<void> {
  let cursor = "0";
  do {
    const [nextCursor, keys] = (await redis.scan(
      cursor,
      "MATCH",
      "wa:verdict:pending:*",
      "COUNT",
      25,
    )) as unknown as [string, string[]];
    cursor = nextCursor;
    for (const key of keys) {
      const verdictId = key.split(":").pop();
      if (!verdictId) continue;
      scheduleTimeout(redis, verdictId, resendFn, logger);
    }
  } while (cursor !== "0");
}

export async function deletePendingForMessage(
  redis: Redis,
  message: Message,
): Promise<void> {
  await clearPendingVerdict(redis, message.id._serialized, "failed");
}

export async function triggerVerdictRetry(
  redis: Redis,
  verdictMessageId: string,
  resendFn: (
    record: PendingVerdictRecord,
  ) => Promise<PendingVerdictRecord | null>,
  logger: Logger,
): Promise<void> {
  const record = await loadPendingVerdict(redis, verdictMessageId);
  if (!record) return;
  if (record.retries >= config.wa.verdictAckMaxRetries) {
    await clearPendingVerdict(redis, verdictMessageId, "failed");
    logger.warn(
      { verdictMessageId, chatId: record.chatId },
      "Skipped verdict retry due to max retries",
    );
    return;
  }
  const next = await resendFn({ ...record, retries: record.retries + 1 });
  if (next) {
    stopTimer(verdictMessageId);
    await redis.del(pendingKey(verdictMessageId));
    await storePendingVerdict(redis, next, resendFn, logger);
  } else {
    await clearPendingVerdict(redis, verdictMessageId, "failed");
  }
}
