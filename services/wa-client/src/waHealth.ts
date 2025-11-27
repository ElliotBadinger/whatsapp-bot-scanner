import { Queue } from "bullmq";
import type Redis from "ioredis";
import type { Logger } from "pino";
import { metrics } from "@wbscanner/shared";

export interface WaHealthEvent {
  event: string;
  state?: string;
  reason?: string;
  details?: Record<string, unknown>;
  version?: string;
}

export interface WaHealthContext {
  queue: Queue;
  redis: Redis;
  clientId: string;
  logger: Logger;
  alertThreshold: number;
  alertCooldownSeconds: number;
  failureWindowSeconds: number;
}

const AUTH_FAILURE_KEY = (clientId: string) => `wa:authfail:${clientId}`;
const AUTH_ALERT_KEY = (clientId: string) => `wa:authfail:alerted:${clientId}`;

export async function publishWaHealth(
  ctx: WaHealthContext,
  payload: WaHealthEvent,
): Promise<void> {
  const now = Date.now();
  const stateLabel = payload.state ?? "unknown";
  metrics.waStateChanges.labels(payload.event, stateLabel).inc();
  await ctx.queue
    .add(
      "state-change",
      {
        ...payload,
        clientId: ctx.clientId,
        timestamp: now,
      },
      { removeOnComplete: true, removeOnFail: 50 },
    )
    .catch((err) => {
      ctx.logger.warn({ err, payload }, "Failed to enqueue wa health event");
    });
  ctx.logger.info({ payload }, "Published WhatsApp health event");
}

export async function incrementAuthFailure(
  ctx: WaHealthContext,
): Promise<{ count: number; alert: boolean }> {
  const key = AUTH_FAILURE_KEY(ctx.clientId);
  const count = await ctx.redis.incr(key);
  await ctx.redis.expire(key, ctx.failureWindowSeconds);
  metrics.waConsecutiveAuthFailures.labels(ctx.clientId).set(count);
  if (count >= ctx.alertThreshold) {
    const alertKey = AUTH_ALERT_KEY(ctx.clientId);
    const alreadyAlerted = await ctx.redis.exists(alertKey);
    if (!alreadyAlerted) {
      await ctx.redis.set(alertKey, "1", "EX", ctx.alertCooldownSeconds);
      return { count, alert: true };
    }
  }
  return { count, alert: false };
}

export async function resetAuthFailures(ctx: WaHealthContext): Promise<void> {
  const key = AUTH_FAILURE_KEY(ctx.clientId);
  await ctx.redis.del(key);
  metrics.waConsecutiveAuthFailures.labels(ctx.clientId).set(0);
}
