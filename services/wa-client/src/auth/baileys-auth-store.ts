/**
 * Redis-backed authentication state store for Baileys
 *
 * This module provides a Redis-based implementation of Baileys' auth state,
 * allowing session persistence across restarts and container deployments.
 */

import type Redis from "ioredis";
import type { Logger } from "pino";
import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { initAuthCreds, proto, BufferJSON } from "@whiskeysockets/baileys";

/**
 * Configuration for the Redis auth store
 */
export interface RedisAuthStoreConfig {
  redis: Redis;
  logger: Logger;
  /** Prefix for Redis keys */
  prefix: string;
  /** Session/client ID */
  clientId: string;
}

/**
 * Creates a Redis-backed authentication state for Baileys
 *
 * @param config - Configuration options
 * @returns Authentication state object compatible with Baileys
 */
export async function useRedisAuthState(config: RedisAuthStoreConfig): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}> {
  const { redis, logger, prefix, clientId } = config;

  const keyPrefix = `${prefix}:${clientId}`;
  const credsKey = `${keyPrefix}:creds`;

  /**
   * Get a key for a specific data type and ID
   */
  const getKey = (type: string, id: string): string => {
    return `${keyPrefix}:${type}:${id}`;
  };

  /**
   * Read data from Redis
   */
  const readData = async <T>(key: string): Promise<T | null> => {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data, BufferJSON.reviver) as T;
    } catch (err) {
      logger.warn({ err, key }, "Failed to read auth data from Redis");
      return null;
    }
  };

  /**
   * Write data to Redis
   */
  const writeData = async (key: string, data: unknown): Promise<void> => {
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      await redis.set(key, serialized);
    } catch (err) {
      logger.error({ err, key }, "Failed to write auth data to Redis");
      throw err;
    }
  };

  /**
   * Delete data from Redis
   */
  const removeData = async (key: string): Promise<void> => {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err, key }, "Failed to remove auth data from Redis");
    }
  };

  // Load or initialize credentials
  let creds: AuthenticationCreds;
  const existingCreds = await readData<AuthenticationCreds>(credsKey);
  if (existingCreds) {
    creds = existingCreds;
    logger.info({ clientId }, "Loaded existing Baileys credentials from Redis");
  } else {
    creds = initAuthCreds();
    logger.info({ clientId }, "Initialized new Baileys credentials");
  }

  /**
   * Save credentials to Redis
   */
  const saveCreds = async (): Promise<void> => {
    await writeData(credsKey, creds);
    logger.debug({ clientId }, "Saved Baileys credentials to Redis");
  };

  /**
   * Clear all auth state from Redis
   */
  const clearState = async (): Promise<void> => {
    const pattern = `${keyPrefix}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(
        { clientId, keysDeleted: keys.length },
        "Cleared Baileys auth state from Redis",
      );
    }
  };

  /**
   * Create the authentication state object
   */
  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(
        type: T,
        ids: string[],
      ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};

        for (const id of ids) {
          const key = getKey(type, id);
          const data = await readData<SignalDataTypeMap[T]>(key);
          if (data) {
            result[id] = data;
          }
        }

        return result;
      },

      set: async (
        data: Partial<{
          [T in keyof SignalDataTypeMap]: {
            [id: string]: SignalDataTypeMap[T] | null;
          };
        }>,
      ): Promise<void> => {
        const promises: Promise<void>[] = [];

        for (const type in data) {
          const typeData = data[type as keyof SignalDataTypeMap];
          if (!typeData) continue;

          for (const id in typeData) {
            const key = getKey(type, id);
            const value = typeData[id];

            if (value === null) {
              promises.push(removeData(key));
            } else {
              promises.push(writeData(key, value));
            }
          }
        }

        await Promise.all(promises);
      },
    },
  };

  return {
    state,
    saveCreds,
    clearState,
  };
}

/**
 * Check if a session exists in Redis
 */
export async function sessionExists(
  redis: Redis,
  prefix: string,
  clientId: string,
): Promise<boolean> {
  const credsKey = `${prefix}:${clientId}:creds`;
  const exists = await redis.exists(credsKey);
  return exists === 1;
}
