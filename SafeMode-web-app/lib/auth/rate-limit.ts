type Bucket = {
  resetAtMs: number;
  count: number;
};

const buckets = new Map<string, Bucket>();
let lastCleanupMs = 0;

export type RateLimitResult =
  | { ok: true; remaining: number; resetAtMs: number }
  | { ok: false; resetAtMs: number };

export function checkRateLimit(
  key: string,
  nowMs: number,
  options: { windowMs: number; max: number },
): RateLimitResult {
  const existing = buckets.get(key);
  if (!existing || nowMs >= existing.resetAtMs) {
    const resetAtMs = nowMs + options.windowMs;
    buckets.set(key, { resetAtMs, count: 1 });
    return { ok: true, remaining: options.max - 1, resetAtMs };
  }

  if (existing.count >= options.max) {
    return { ok: false, resetAtMs: existing.resetAtMs };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: Math.max(options.max - existing.count, 0),
    resetAtMs: existing.resetAtMs,
  };
}

export function cleanupRateLimitBuckets(nowMs: number): void {
  if (nowMs - lastCleanupMs < 1000) return;
  lastCleanupMs = nowMs;
  for (const [key, bucket] of buckets.entries()) {
    if (nowMs >= bucket.resetAtMs) {
      buckets.delete(key);
    }
  }
}
