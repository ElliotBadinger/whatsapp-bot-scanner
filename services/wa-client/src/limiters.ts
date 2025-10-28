import type Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';

export const GLOBAL_TOKEN_BUCKET_ID = 'wa-global-rate';

export function createGlobalTokenBucket(
  redis: Redis,
  tokensPerHour: number,
  keyPrefix = 'wa_global_rate'
) {
  const points = Math.max(1, tokensPerHour);

  if (process.env.NODE_ENV === 'test') {
    return new InMemoryRateLimiter(points, 3600, keyPrefix);
  }

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: 3600,
  });
}

class InMemoryRateLimiter {
  private readonly buckets = new Map<string, { remaining: number; resetAt: number }>();

  constructor(
    private readonly points: number,
    private readonly durationSeconds: number,
    private readonly keyPrefix: string,
  ) {}

  async consume(key: string) {
    const bucketKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    let bucket = this.buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { remaining: this.points, resetAt: now + this.durationSeconds * 1000 };
      this.buckets.set(bucketKey, bucket);
    }

    if (bucket.remaining <= 0) {
      const err: any = new Error('Rate limit exceeded');
      err.remainingPoints = bucket.remaining;
      err.msBeforeNext = Math.max(0, bucket.resetAt - now);
      throw err;
    }

    bucket.remaining -= 1;
    return {
      remainingPoints: bucket.remaining,
      msBeforeNext: Math.max(0, bucket.resetAt - now),
    };
  }
}
