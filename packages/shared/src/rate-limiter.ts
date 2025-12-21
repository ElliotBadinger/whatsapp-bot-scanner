import type { Redis } from "ioredis";
import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";

export interface RateLimiterConfig {
  points: number;
  duration: number;
  keyPrefix: string;
  blockDuration?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfter?: number;
}

/**
 * Creates a rate limiter for the control plane API.
 * Uses Redis in production and in-memory for tests.
 */
export function createApiRateLimiter(
  redis: Redis | null,
  config: RateLimiterConfig,
) {
  if (process.env.NODE_ENV === "test" || !redis) {
    return new RateLimiterMemory({
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration,
    });
  }

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: config.keyPrefix,
    points: config.points,
    duration: config.duration,
    blockDuration: config.blockDuration,
  });
}

/**
 * Attempts to consume a rate limit token.
 * Returns result indicating if request is allowed.
 */
export async function consumeRateLimit(
  limiter: RateLimiterRedis | RateLimiterMemory,
  key: string,
): Promise<RateLimitResult> {
  try {
    const result = await limiter.consume(key);
    return {
      allowed: true,
      remaining: result.remainingPoints,
      resetMs: result.msBeforeNext,
    };
  } catch (error) {
    const rateLimitError = error as {
      remainingPoints?: number;
      msBeforeNext?: number;
    };
    return {
      allowed: false,
      remaining: rateLimitError.remainingPoints ?? 0,
      resetMs: rateLimitError.msBeforeNext ?? 0,
      retryAfter: Math.ceil((rateLimitError.msBeforeNext ?? 0) / 1000),
    };
  }
}

/**
 * Default rate limit configurations for control plane endpoints.
 */
export const RATE_LIMIT_CONFIGS = {
  api: {
    points: 100,
    duration: 60,
    keyPrefix: "cp:rate:api",
    blockDuration: 0,
  },
  override: {
    points: 20,
    duration: 60,
    keyPrefix: "cp:rate:override",
    blockDuration: 0,
  },
  rescan: {
    points: 10,
    duration: 60,
    keyPrefix: "cp:rate:rescan",
    blockDuration: 0,
  },
} as const;
