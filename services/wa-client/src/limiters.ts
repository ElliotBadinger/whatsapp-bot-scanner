import type Redis from 'ioredis';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';

export const GLOBAL_TOKEN_BUCKET_ID = 'global';

export function createGlobalTokenBucket(
  redis: Redis,
  tokensPerHour: number,
  keyPrefix: string
) {
  if (process.env.NODE_ENV === 'test') {
    return new RateLimiterMemory({
      points: tokensPerHour,
      duration: 3600,
      keyPrefix,
    });
  }

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points: tokensPerHour,
    duration: 3600,
  });
}
