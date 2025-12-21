import crypto from "crypto";

const REDIS_ENCRYPTION_KEY_ENV = "REDIS_ENCRYPTION_KEY";

let keyBuffer: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (keyBuffer) {
    return keyBuffer;
  }

  const keyHex = process.env[REDIS_ENCRYPTION_KEY_ENV];
  if (!keyHex) {
    throw new Error(
      `${REDIS_ENCRYPTION_KEY_ENV} must be set for Redis encryption`,
    );
  }

  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error(
      `${REDIS_ENCRYPTION_KEY_ENV} must be 64 hex characters (32 bytes)`,
    );
  }

  keyBuffer = Buffer.from(keyHex, "hex");
  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all hex-encoded)
 */
export function encryptValue(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted string produced by encryptValue.
 * Expected format: iv:authTag:ciphertext (all hex-encoded)
 */
export function decryptValue(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Checks if a value appears to be encrypted (matches our format).
 */
export function isEncryptedValue(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) {
    return false;
  }
  const [ivHex, authTagHex, ciphertext] = parts;
  // IV is 16 bytes = 32 hex chars, auth tag is 16 bytes = 32 hex chars
  return (
    /^[a-fA-F0-9]{32}$/.test(ivHex) &&
    /^[a-fA-F0-9]{32}$/.test(authTagHex) &&
    /^[a-fA-F0-9]+$/.test(ciphertext)
  );
}

/**
 * Resets the cached encryption key (useful for testing).
 */
export function resetEncryptionKey(): void {
  keyBuffer = null;
}
