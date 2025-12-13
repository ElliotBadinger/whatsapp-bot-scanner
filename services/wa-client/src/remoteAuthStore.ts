import { promises as fs } from "node:fs";
import path from "node:path";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { EncryptionMaterials } from "./crypto/dataKeyProvider.js";
import {
  encryptPayload,
  decryptPayload,
  type EncryptedPayload,
} from "./crypto/secureEnvelope.js";

interface StoreOptions {
  redis: Redis;
  logger: Logger;
  prefix: string;
  materials: EncryptionMaterials;
  clientId: string;
}

interface StorePayload {
  payload: EncryptedPayload;
  updatedAt: number;
  clientId: string;
  version: number;
}

export class RedisRemoteAuthStore {
  private readonly redis: Redis;
  private readonly logger: Logger;
  private readonly prefix: string;
  private readonly materials: EncryptionMaterials;
  private readonly clientId: string;

  constructor(options: StoreOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.prefix = options.prefix.replace(/:+$/, "");
    this.materials = options.materials;
    this.clientId = options.clientId;
  }

  public key(session: string): string {
    return `${this.prefix}:${session}`;
  }

  async sessionExists({ session }: { session: string }): Promise<boolean> {
    const exists = await this.redis.exists(this.key(session));
    return exists === 1;
  }

  async delete({ session }: { session: string }): Promise<void> {
    await this.redis.del(this.key(session));
    this.logger.info(
      { session, clientId: this.clientId },
      "Deleted RemoteAuth session from Redis",
    );
  }

  async save({ session }: { session: string }): Promise<void> {
    const zipPath = path.resolve(`${session}.zip`);
    const contents = await fs.readFile(zipPath);
    const payload = encryptPayload(contents, this.materials);
    const record: StorePayload = {
      payload,
      updatedAt: Date.now(),
      clientId: this.clientId,
      version: payload.version,
    };
    await this.redis.set(this.key(session), JSON.stringify(record));
    this.logger.info(
      { session, clientId: this.clientId },
      "Persisted RemoteAuth session snapshot to Redis",
    );
  }

  async extract({
    session,
    path: zipPath,
  }: {
    session: string;
    path: string;
  }): Promise<void> {
    const raw = await this.redis.get(this.key(session));
    if (!raw) {
      throw new Error(`RemoteAuth session ${session} not found in Redis`);
    }
    let record: StorePayload;
    try {
      record = JSON.parse(raw) as StorePayload;
    } catch (err) {
      throw new Error(
        `Stored RemoteAuth payload is invalid JSON: ${(err as Error).message}`,
      );
    }
    const buffer = decryptPayload(record.payload, this.materials);
    await fs.writeFile(path.resolve(zipPath), buffer);
    this.logger.info(
      { session, clientId: this.clientId },
      "Extracted RemoteAuth session snapshot from Redis",
    );
  }
}

export function createRemoteAuthStore(
  options: StoreOptions,
): RedisRemoteAuthStore {
  return new RedisRemoteAuthStore(options);
}
