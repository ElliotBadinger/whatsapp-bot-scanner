import Redis from "ioredis";
import { config } from "./config";
import { InMemoryRedis } from "./testing/in-memory-redis";

/** Test injection key for custom Redis instances */
export const TEST_REDIS_KEY = "__WBSCANNER_TEST_REDIS__";

/** Test injection key for custom Queue factories */
export const TEST_QUEUE_FACTORY_KEY = "__WBSCANNER_TEST_QUEUE_FACTORY__";

/**
 * Creates a Redis connection based on environment.
 * In test mode, returns an InMemoryRedis instance unless a custom one is injected.
 * In production, creates a real Redis connection.
 */
export function createRedisConnection(): Redis {
  // Allow test injection
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as unknown as Record<string, unknown>)[TEST_REDIS_KEY]
  ) {
    return (globalThis as unknown as Record<string, unknown>)[
      TEST_REDIS_KEY
    ] as Redis;
  }

  // Use in-memory Redis for tests
  if (process.env.NODE_ENV === "test") {
    return new InMemoryRedis() as unknown as Redis;
  }

  // Production Redis connection
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

/**
 * Shared Redis connection singleton for services that need a single connection.
 * Lazy-initialized on first access.
 */
let sharedRedisInstance: Redis | null = null;

export function getSharedRedis(): Redis {
  if (!sharedRedisInstance) {
    sharedRedisInstance = createRedisConnection();
  }
  return sharedRedisInstance;
}

/**
 * Closes the shared Redis connection if it exists.
 * Useful for graceful shutdown.
 */
export async function closeSharedRedis(): Promise<void> {
  if (sharedRedisInstance) {
    await sharedRedisInstance.quit();
    sharedRedisInstance = null;
  }
}

/**
 * Resets the shared Redis instance (useful for tests).
 */
export function resetSharedRedis(): void {
  sharedRedisInstance = null;
}
