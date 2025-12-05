import { randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto';
import type { EncryptionMaterials } from './dataKeyProvider.js';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  hmac: string;
  version: number;
}

const CIPHER_ALGO = 'aes-256-gcm';
const HMAC_ALGO = 'sha256';
const PAYLOAD_VERSION = 1;

function buildMacInput(iv: Buffer, authTag: Buffer, ciphertext: Buffer): Buffer {
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function encryptPayload(plaintext: Buffer, materials: EncryptionMaterials): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGO, materials.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = buildMacInput(iv, authTag, ciphertext);
  const mac = createHmac(HMAC_ALGO, materials.hmacKey).update(payload).digest();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    hmac: mac.toString('base64'),
    version: PAYLOAD_VERSION,
  };
}

function verifyMac(iv: Buffer, authTag: Buffer, ciphertext: Buffer, macB64: string, materials: EncryptionMaterials): void {
  const payload = buildMacInput(iv, authTag, ciphertext);
  const expected = createHmac(HMAC_ALGO, materials.hmacKey).update(payload).digest();
  const provided = Buffer.from(macB64, 'base64');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('Encrypted payload failed HMAC verification');
  }
}

export function decryptPayload(payload: EncryptedPayload, materials: EncryptionMaterials): Buffer {
  if ((payload.version ?? PAYLOAD_VERSION) !== PAYLOAD_VERSION) {
    throw new Error(`Unsupported RemoteAuth payload version: ${payload.version}`);
  }
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  verifyMac(iv, authTag, ciphertext, payload.hmac, materials);
  const decipher = createDecipheriv(CIPHER_ALGO, materials.encryptionKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
