import "server-only";

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

// Process-local limiter. For strong abuse prevention in multi-instance
// deployments, use a shared backend (e.g. Redis) instead.
const buckets = new Map<string, Bucket>();

function getNow(): number {
  return Date.now();
}

function cleanup(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
  now = getNow(),
): RateLimitResult {
  const windowMs = Math.max(config.windowMs, 1000);
  const max = Math.max(config.max, 1);

  cleanup(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const next: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return {
      allowed: true,
      remaining: Math.max(0, max - 1),
      resetMs: windowMs,
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  const resetMs = Math.max(0, existing.resetAt - now);
  const remaining = Math.max(0, max - existing.count);
  const allowed = existing.count <= max;

  return {
    allowed,
    remaining,
    resetMs,
    retryAfterSeconds: allowed ? 0 : Math.ceil(resetMs / 1000),
  };
}
