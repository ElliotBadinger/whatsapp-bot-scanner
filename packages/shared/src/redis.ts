import Redis from "ioredis";
import { config } from "./config";
import { InMemoryRedis } from "./testing/in-memory-redis";
import { logger } from "./log";

/** Test injection key for custom Redis instances */
export const TEST_REDIS_KEY = "__WBSCANNER_TEST_REDIS__";

/** Test injection key for custom Queue factories */
export const TEST_QUEUE_FACTORY_KEY = "__WBSCANNER_TEST_QUEUE_FACTORY__";

/**
 * Creates a Redis connection based on environment.
 * In test mode, returns an InMemoryRedis instance unless a custom one is injected.
 * In production, creates a real Redis connection with lazy connect enabled.
 *
 * IMPORTANT: Call `connectRedis()` explicitly before using the connection
 * to avoid ETIMEDOUT errors during module initialization.
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

  // Production Redis connection with retry configuration
  // Uses lazyConnect: true to defer connection until explicitly called
  // This prevents ETIMEDOUT errors during module initialization
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
      // Retry with exponential backoff, max 30 seconds
      const delay = Math.min(times * 1000, 30000);
      logger.warn({ attempt: times, delay }, "Redis connection retry");
      return delay;
    },
    reconnectOnError: (err: Error) => {
      // Reconnect on connection errors
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return 1; // Reconnect for other errors too
    },
    connectTimeout: 30000, // 30 second connection timeout
    lazyConnect: true, // Defer connection until connect() is called
  });
}

/**
 * Explicitly connects a Redis instance and validates connectivity.
 * Should be called during service initialization, not at module load time.
 *
 * @param redis - Redis instance to connect
 * @param serviceName - Name of the service for logging
 * @throws Error if connection fails after retries
 */
export async function connectRedis(
  redis: Redis,
  serviceName = "unknown",
): Promise<void> {
  // Skip for test environment (InMemoryRedis doesn't need connection)
  if (process.env.NODE_ENV === "test") {
    return;
  }

  try {
    logger.info({ service: serviceName }, "Connecting to Redis...");
    await redis.connect();

    // Validate connectivity with a ping
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error(`Redis ping failed: expected PONG, got ${pong}`);
    }

    logger.info({ service: serviceName }, "Redis connectivity validated");
  } catch (error) {
    // Check if already connected (ioredis throws if connect() called twice)
    if (error instanceof Error && error.message.includes("already")) {
      logger.debug({ service: serviceName }, "Redis already connected");
      return;
    }
    logger.error({ service: serviceName, error }, "Failed to connect to Redis");
    throw error;
  }
}

/**
 * Shared Redis connection singleton for services that need a single connection.
 * Lazy-initialized on first access.
 */
let sharedRedisInstance: Redis | null = null;
let sharedRedisConnected = false;

export function getSharedRedis(): Redis {
  if (!sharedRedisInstance) {
    sharedRedisInstance = createRedisConnection();
  }
  return sharedRedisInstance;
}

/**
 * Gets the shared Redis instance and ensures it's connected.
 * This is the recommended way to get a Redis connection in service initialization.
 *
 * @param serviceName - Name of the service for logging
 * @returns Connected Redis instance
 */
export async function getConnectedSharedRedis(
  serviceName = "unknown",
): Promise<Redis> {
  const redis = getSharedRedis();

  if (!sharedRedisConnected) {
    await connectRedis(redis, serviceName);
    sharedRedisConnected = true;
  }

  return redis;
}

/**
 * Closes the shared Redis connection if it exists.
 * Useful for graceful shutdown.
 */
export async function closeSharedRedis(): Promise<void> {
  if (sharedRedisInstance) {
    await sharedRedisInstance.quit();
    sharedRedisInstance = null;
    sharedRedisConnected = false;
  }
}

/**
 * Resets the shared Redis instance (useful for tests).
 */
export function resetSharedRedis(): void {
  sharedRedisInstance = null;
  sharedRedisConnected = false;
}
