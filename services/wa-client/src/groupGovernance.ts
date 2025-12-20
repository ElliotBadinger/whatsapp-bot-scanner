import type { Redis } from "ioredis";
import { hashChatId } from "@wbscanner/shared";

export type GroupConsentState = "pending" | "granted" | "denied";

const CONSENT_KEY = (chatId: string) =>
  `wa:group:${hashChatId(chatId)}:consent`;
const LEGACY_CONSENT_KEY = (chatId: string) => `wa:group:${chatId}:consent`;
const AUTO_APPROVE_KEY = (chatId: string) =>
  `wa:group:${hashChatId(chatId)}:auto_approve`;
const LEGACY_AUTO_APPROVE_KEY = (chatId: string) =>
  `wa:group:${chatId}:auto_approve`;
const GOVERNANCE_COUNT_KEY = (chatId: string) =>
  `wa:group:${hashChatId(chatId)}:gov_actions`;
const LEGACY_GOVERNANCE_COUNT_KEY = (chatId: string) =>
  `wa:group:${chatId}:gov_actions`;
const GOVERNANCE_AUDIT_KEY = (chatId: string) =>
  `wa:group:${hashChatId(chatId)}:gov_audit`;
const LEGACY_GOVERNANCE_AUDIT_KEY = (chatId: string) =>
  `wa:group:${chatId}:gov_audit`;
const INVITE_ROTATED_AT_KEY = (chatId: string) =>
  `wa:group:${hashChatId(chatId)}:invite_rotated_at`;
const LEGACY_INVITE_ROTATED_AT_KEY = (chatId: string) =>
  `wa:group:${chatId}:invite_rotated_at`;

const GOVERNANCE_AUDIT_TTL_SECONDS = 60 * 60 * 24 * 7;
const INVITE_ROTATION_TTL_SECONDS = 60 * 60 * 24;

export async function getGroupConsent(
  redis: Redis,
  chatId: string,
): Promise<GroupConsentState | null> {
  let value = await redis.get(CONSENT_KEY(chatId));
  if (!value) {
    value = await redis.get(LEGACY_CONSENT_KEY(chatId));
    if (value) {
      await redis.set(CONSENT_KEY(chatId), value);
      await redis.del(LEGACY_CONSENT_KEY(chatId));
    }
  }
  if (!value) return null;
  if (value === "granted" || value === "denied" || value === "pending")
    return value;
  return null;
}

export async function setGroupConsent(
  redis: Redis,
  chatId: string,
  state: GroupConsentState,
): Promise<void> {
  await redis.set(CONSENT_KEY(chatId), state);
  await redis.del(LEGACY_CONSENT_KEY(chatId));
}

export async function getAutoApprove(
  redis: Redis,
  chatId: string,
  fallback: boolean,
): Promise<boolean> {
  let value = await redis.get(AUTO_APPROVE_KEY(chatId));
  if (value === null) {
    value = await redis.get(LEGACY_AUTO_APPROVE_KEY(chatId));
    if (value !== null) {
      await redis.set(AUTO_APPROVE_KEY(chatId), value);
      await redis.del(LEGACY_AUTO_APPROVE_KEY(chatId));
    }
  }
  if (value === null) return fallback;
  return value === "true";
}

export async function setAutoApprove(
  redis: Redis,
  chatId: string,
  enabled: boolean,
): Promise<void> {
  await redis.set(AUTO_APPROVE_KEY(chatId), enabled ? "true" : "false");
  await redis.del(LEGACY_AUTO_APPROVE_KEY(chatId));
}

export async function recordGovernanceAction(
  redis: Redis,
  chatId: string,
  ttlSeconds: number,
): Promise<number> {
  const key = GOVERNANCE_COUNT_KEY(chatId);
  const legacyKey = LEGACY_GOVERNANCE_COUNT_KEY(chatId);
  const existing = await redis.get(key);
  if (!existing) {
    const legacyValue = await redis.get(legacyKey);
    if (legacyValue) {
      await redis.set(key, legacyValue, "EX", ttlSeconds);
      await redis.del(legacyKey);
    }
  }
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

export async function getGovernanceActionCount(
  redis: Redis,
  chatId: string,
): Promise<number> {
  let raw = await redis.get(GOVERNANCE_COUNT_KEY(chatId));
  if (!raw) {
    raw = await redis.get(LEGACY_GOVERNANCE_COUNT_KEY(chatId));
    if (raw) {
      await redis.set(GOVERNANCE_COUNT_KEY(chatId), raw);
      await redis.del(LEGACY_GOVERNANCE_COUNT_KEY(chatId));
    }
  }
  return raw ? Number(raw) : 0;
}

export async function appendGovernanceLog(
  redis: Redis,
  chatId: string,
  entry: {
    action: string;
    actor?: string | null;
    targets?: string[];
    detail?: string;
    reason?: string;
  },
): Promise<void> {
  const payload = JSON.stringify({
    ...entry,
    action: entry.action,
    actor: entry.actor ?? null,
    targets: entry.targets ?? [],
    detail: entry.detail ?? null,
    reason: entry.reason ?? null,
    at: Date.now(),
  });
  await redis
    .multi()
    .lpush(GOVERNANCE_AUDIT_KEY(chatId), payload)
    .ltrim(GOVERNANCE_AUDIT_KEY(chatId), 0, 49)
    .expire(GOVERNANCE_AUDIT_KEY(chatId), GOVERNANCE_AUDIT_TTL_SECONDS)
    .exec();
  await redis.del(LEGACY_GOVERNANCE_AUDIT_KEY(chatId));
}

export async function recordInviteRotation(
  redis: Redis,
  chatId: string,
): Promise<void> {
  await redis.set(
    INVITE_ROTATED_AT_KEY(chatId),
    Date.now().toString(),
    "EX",
    INVITE_ROTATION_TTL_SECONDS,
  );
  await redis.del(LEGACY_INVITE_ROTATED_AT_KEY(chatId));
}

export async function getLastInviteRotation(
  redis: Redis,
  chatId: string,
): Promise<number | null> {
  let raw = await redis.get(INVITE_ROTATED_AT_KEY(chatId));
  if (!raw) {
    raw = await redis.get(LEGACY_INVITE_ROTATED_AT_KEY(chatId));
    if (raw) {
      await redis.set(INVITE_ROTATED_AT_KEY(chatId), raw);
      await redis.del(LEGACY_INVITE_ROTATED_AT_KEY(chatId));
    }
  }
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}
