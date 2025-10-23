import { RateLimiterRedis } from 'rate-limiter-flexible';
import type Redis from 'ioredis';

export const GLOBAL_TOKEN_BUCKET_ID = 'wa-global-rate';

export function createGlobalTokenBucket(
  redis: Redis,
  requestsPerHour: number,
  keyPrefix = 'wa_global_rate'
): RateLimiterRedis {
  const points = Math.max(1, requestsPerHour);
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: 3600,
  });
}
