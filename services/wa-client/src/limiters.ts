import type Redis from 'ioredis';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';

export const GLOBAL_TOKEN_BUCKET_ID = 'wa-global-rate';

export function createGlobalTokenBucket(
  redis: Redis,
  tokensPerHour: number,
  keyPrefix = 'wa_global_rate'
) {
  const points = Math.max(1, tokensPerHour);

  if (process.env.NODE_ENV === 'test') {
    return new RateLimiterMemory({
      points,
      duration: 3600,
      keyPrefix,
    });
  }

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: 3600,
  });
}
