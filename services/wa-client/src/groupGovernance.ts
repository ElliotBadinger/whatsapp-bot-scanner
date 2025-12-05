import type { Redis } from "ioredis";

export type GroupConsentState = "pending" | "granted" | "denied";

const CONSENT_KEY = (chatId: string) => `wa:group:${chatId}:consent`;
const AUTO_APPROVE_KEY = (chatId: string) => `wa:group:${chatId}:auto_approve`;
const GOVERNANCE_COUNT_KEY = (chatId: string) =>
  `wa:group:${chatId}:gov_actions`;
const GOVERNANCE_AUDIT_KEY = (chatId: string) => `wa:group:${chatId}:gov_audit`;
const INVITE_ROTATED_AT_KEY = (chatId: string) =>
  `wa:group:${chatId}:invite_rotated_at`;

const GOVERNANCE_AUDIT_TTL_SECONDS = 60 * 60 * 24 * 7;
const INVITE_ROTATION_TTL_SECONDS = 60 * 60 * 24;

export async function getGroupConsent(
  redis: Redis,
  chatId: string,
): Promise<GroupConsentState | null> {
  const value = await redis.get(CONSENT_KEY(chatId));
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
}

export async function getAutoApprove(
  redis: Redis,
  chatId: string,
  fallback: boolean,
): Promise<boolean> {
  const value = await redis.get(AUTO_APPROVE_KEY(chatId));
  if (value === null) return fallback;
  return value === "true";
}

export async function setAutoApprove(
  redis: Redis,
  chatId: string,
  enabled: boolean,
): Promise<void> {
  await redis.set(AUTO_APPROVE_KEY(chatId), enabled ? "true" : "false");
}

export async function recordGovernanceAction(
  redis: Redis,
  chatId: string,
  ttlSeconds: number,
): Promise<number> {
  const key = GOVERNANCE_COUNT_KEY(chatId);
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
  const raw = await redis.get(GOVERNANCE_COUNT_KEY(chatId));
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
}

export async function getLastInviteRotation(
  redis: Redis,
  chatId: string,
): Promise<number | null> {
  const raw = await redis.get(INVITE_ROTATED_AT_KEY(chatId));
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}
