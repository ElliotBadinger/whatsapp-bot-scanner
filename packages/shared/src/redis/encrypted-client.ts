import type { Redis, RedisKey } from "ioredis";
import type { Logger } from "pino";
import {
  encryptValue,
  decryptValue,
  isEncryptedValue,
} from "../crypto/redis-encryption";
import { logger as sharedLogger } from "../log";

/**
 * A Redis client wrapper that automatically encrypts values before storage
 * and decrypts them on retrieval. Only string values are encrypted.
 */
export class EncryptedRedisClient {
  private readonly allowUnencryptedReads: boolean;
  private readonly strictDecryption: boolean;
  private readonly logger: Logger;
  private readonly decryptWarnings = new Set<string>();

  constructor(
    public readonly client: Redis,
    private readonly encryptionEnabled: boolean = true,
    allowUnencryptedReads: boolean = true,
    strictDecryption: boolean = false,
    logger: Logger = sharedLogger,
  ) {
    this.allowUnencryptedReads = allowUnencryptedReads;
    this.strictDecryption = strictDecryption;
    this.logger = logger;
  }

  private encrypt(value: string): string {
    if (!this.encryptionEnabled) {
      return value;
    }
    return encryptValue(value);
  }

  private decrypt(
    value: string | null,
    context?: {
      operation: string;
      key: RedisKey;
      field?: string;
    },
  ): string | null {
    if (value === null) {
      return null;
    }
    if (!this.encryptionEnabled) {
      return value;
    }
    if (!isEncryptedValue(value)) {
      if (this.allowUnencryptedReads) {
        return value;
      }

      this.warnDecryptFailure({
        message: "Redis value is not encrypted",
        operation: context?.operation ?? "unknown",
        key: context?.key,
        field: context?.field,
      });

      if (this.strictDecryption) {
        throw new Error("Redis value is not encrypted");
      }

      return null;
    }
    try {
      return decryptValue(value);
    } catch (err) {
      this.warnDecryptFailure({
        message: "Failed to decrypt redis value",
        operation: context?.operation ?? "unknown",
        key: context?.key,
        field: context?.field,
        err,
      });

      if (this.strictDecryption) {
        throw err;
      }

      return this.allowUnencryptedReads ? value : null;
    }
  }

  private warnDecryptFailure(context: {
    message: string;
    operation: string;
    key?: RedisKey;
    field?: string;
    err?: unknown;
  }): void {
    const key = context.key ? String(context.key) : "unknown";
    const field = context.field ?? "";
    const warnKey = `${context.operation}:${key}:${field}`;

    if (this.decryptWarnings.has(warnKey)) {
      return;
    }
    this.decryptWarnings.add(warnKey);
    if (this.decryptWarnings.size > 1000) {
      this.decryptWarnings.clear();
    }

    this.logger.warn(
      {
        err: context.err,
        operation: context.operation,
        key,
        field: context.field,
      },
      context.message,
    );
  }

  async set(
    key: RedisKey,
    value: string,
    expiryMode?: "EX" | "PX",
    time?: number,
  ): Promise<string | null> {
    const encrypted = this.encrypt(value);
    if (expiryMode === "EX" && time !== undefined) {
      return this.client.set(key, encrypted, "EX", time);
    }
    if (expiryMode === "PX" && time !== undefined) {
      return this.client.set(key, encrypted, "PX", time);
    }
    return this.client.set(key, encrypted);
  }

  async get(key: RedisKey): Promise<string | null> {
    const encrypted = await this.client.get(key);
    return this.decrypt(encrypted, { operation: "get", key });
  }

  async setex(key: RedisKey, seconds: number, value: string): Promise<string> {
    const encrypted = this.encrypt(value);
    return this.client.setex(key, seconds, encrypted);
  }

  async setnx(key: RedisKey, value: string): Promise<number> {
    const encrypted = this.encrypt(value);
    return this.client.setnx(key, encrypted);
  }

  async hset(key: RedisKey, field: string, value: string): Promise<number>;
  async hset(key: RedisKey, data: Record<string, string>): Promise<number>;
  async hset(
    key: RedisKey,
    fieldOrData: string | Record<string, string>,
    value?: string,
  ): Promise<number> {
    if (typeof fieldOrData === "string" && value !== undefined) {
      const encrypted = this.encrypt(value);
      return this.client.hset(key, fieldOrData, encrypted);
    }
    if (typeof fieldOrData === "object") {
      const encryptedData: Record<string, string> = {};
      for (const [field, val] of Object.entries(fieldOrData)) {
        encryptedData[field] = this.encrypt(val);
      }
      return this.client.hset(key, encryptedData);
    }
    throw new Error("Invalid hset arguments");
  }

  async hget(key: RedisKey, field: string): Promise<string | null> {
    const encrypted = await this.client.hget(key, field);
    return this.decrypt(encrypted, { operation: "hget", key, field });
  }

  async hgetall(key: RedisKey): Promise<Record<string, string>> {
    const encrypted = await this.client.hgetall(key);
    const decrypted: Record<string, string> = {};
    for (const [field, value] of Object.entries(encrypted)) {
      const decryptedValue = this.decrypt(value, {
        operation: "hgetall",
        key,
        field,
      });
      if (decryptedValue !== null) {
        decrypted[field] = decryptedValue;
      }
    }
    return decrypted;
  }

  async hmset(key: RedisKey, data: Record<string, string>): Promise<string> {
    const encryptedData: Record<string, string> = {};
    for (const [field, value] of Object.entries(data)) {
      encryptedData[field] = this.encrypt(value);
    }
    return this.client.hmset(key, encryptedData);
  }

  async lpush(key: RedisKey, ...values: string[]): Promise<number> {
    const encrypted = values.map((v) => this.encrypt(v));
    return this.client.lpush(key, ...encrypted);
  }

  async rpush(key: RedisKey, ...values: string[]): Promise<number> {
    const encrypted = values.map((v) => this.encrypt(v));
    return this.client.rpush(key, ...encrypted);
  }

  async lpop(key: RedisKey): Promise<string | null> {
    const encrypted = await this.client.lpop(key);
    return this.decrypt(encrypted, { operation: "lpop", key });
  }

  async rpop(key: RedisKey): Promise<string | null> {
    const encrypted = await this.client.rpop(key);
    return this.decrypt(encrypted, { operation: "rpop", key });
  }

  async lrange(key: RedisKey, start: number, stop: number): Promise<string[]> {
    const encrypted = await this.client.lrange(key, start, stop);
    return encrypted.flatMap((v) => {
      const decrypted = this.decrypt(v, { operation: "lrange", key });
      return decrypted === null ? [] : [decrypted];
    });
  }

  async sadd(key: RedisKey, ...members: string[]): Promise<number> {
    const encrypted = members.map((m) => this.encrypt(m));
    return this.client.sadd(key, ...encrypted);
  }

  async smembers(key: RedisKey): Promise<string[]> {
    const encrypted = await this.client.smembers(key);
    return encrypted.flatMap((v) => {
      const decrypted = this.decrypt(v, { operation: "smembers", key });
      return decrypted === null ? [] : [decrypted];
    });
  }

  async zadd(key: RedisKey, score: number, member: string): Promise<number> {
    const encrypted = this.encrypt(member);
    return this.client.zadd(key, score, encrypted);
  }

  async zrange(key: RedisKey, start: number, stop: number): Promise<string[]> {
    const encrypted = await this.client.zrange(key, start, stop);
    return encrypted.flatMap((v) => {
      const decrypted = this.decrypt(v, { operation: "zrange", key });
      return decrypted === null ? [] : [decrypted];
    });
  }

  async zrem(key: RedisKey, ...members: string[]): Promise<number> {
    const encrypted = members.map((m) => this.encrypt(m));
    return this.client.zrem(key, ...encrypted);
  }

  // Pass-through methods that don't need encryption
  async del(...keys: RedisKey[]): Promise<number> {
    return this.client.del(...keys);
  }

  async exists(...keys: RedisKey[]): Promise<number> {
    return this.client.exists(...keys);
  }

  async expire(key: RedisKey, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async ttl(key: RedisKey): Promise<number> {
    return this.client.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async incr(key: RedisKey): Promise<number> {
    return this.client.incr(key);
  }

  async decr(key: RedisKey): Promise<number> {
    return this.client.decr(key);
  }

  async incrby(key: RedisKey, increment: number): Promise<number> {
    return this.client.incrby(key, increment);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async quit(): Promise<string> {
    return this.client.quit();
  }

  async disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  async connect(): Promise<void> {
    return this.client.connect();
  }

  get status(): string {
    return this.client.status;
  }
}

/**
 * Creates an encrypted Redis client wrapper.
 * If encryption is disabled, values are stored as-is.
 */
export function createEncryptedRedis(
  client: Redis,
  encryptionEnabled = true,
  allowUnencryptedReads = true,
  strictDecryption = false,
): EncryptedRedisClient {
  return new EncryptedRedisClient(
    client,
    encryptionEnabled,
    allowUnencryptedReads,
    strictDecryption,
  );
}
