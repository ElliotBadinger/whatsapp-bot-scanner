import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import type { config } from '@wbscanner/shared';

export interface RemoteAuthCryptoConfig {
  store: string;
  clientId: string;
  autoPair?: boolean;
  pairingDelayMs?: number;
  kmsKeyId?: string;
  encryptedDataKey?: string;
  dataKey?: string;
  vaultTransitPath?: string;
  vaultToken?: string;
  vaultAddress?: string;
  phoneNumber?: string;
}

export interface EncryptionMaterials {
  encryptionKey: Buffer;
  hmacKey: Buffer;
  keySource: string;
}

function deriveKey(base: Buffer, context: string): Buffer {
  return createHash('sha256').update(base).update(context).digest();
}

function decodeBase64(value: string, label: string): Buffer {
  try {
    return Buffer.from(value, 'base64');
  } catch (err) {
    throw new Error(`Failed to decode base64 value for ${label}: ${(err as Error).message}`);
  }
}

async function decryptWithKms(ciphertextB64: string, kmsKeyId: string, logger: Logger): Promise<Buffer> {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error('AWS_REGION (or AWS_DEFAULT_REGION) must be set when using KMS decryption for RemoteAuth.');
  }
  const { KMSClient, DecryptCommand } = await import('@aws-sdk/client-kms');
  const client = new KMSClient({ region });
  const ciphertext = decodeBase64(ciphertextB64, 'WA_REMOTE_AUTH_ENCRYPTED_DATA_KEY');
  const command = new DecryptCommand({
    CiphertextBlob: ciphertext,
    KeyId: kmsKeyId,
  });
  const response = await client.send(command);
  if (!response.Plaintext) {
    throw new Error('KMS decrypt response did not include Plaintext.');
  }
  logger.info({ kmsKeyId }, 'Decrypted RemoteAuth data key using AWS KMS');
  return Buffer.from(response.Plaintext);
}

async function decryptWithVault(options: RemoteAuthCryptoConfig, logger: Logger): Promise<Buffer> {
  const { vaultAddress, vaultTransitPath, vaultToken, encryptedDataKey } = options;
  if (!vaultAddress || !vaultTransitPath || !vaultToken || !encryptedDataKey) {
    throw new Error('Vault configuration incomplete; require address, transit path, token, and encrypted data key.');
  }
  const endpoint = `${vaultAddress.replace(/\/$/, '')}/v1/${vaultTransitPath.replace(/^\//, '')}/decrypt`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-Token': vaultToken,
    },
    body: JSON.stringify({ ciphertext: encryptedDataKey }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Vault transit decrypt failed: ${resp.status} ${resp.statusText} - ${body}`);
  }
  const json = await resp.json() as { data?: { plaintext?: string } };
  const plaintext = json?.data?.plaintext;
  if (!plaintext) {
    throw new Error('Vault transit decrypt response missing plaintext field.');
  }
  logger.info('Decrypted RemoteAuth data key using Vault transit');
  return decodeBase64(plaintext, 'vault plaintext');
}

async function resolveDataKey(options: RemoteAuthCryptoConfig, logger: Logger): Promise<{ key: Buffer; source: string }> {
  if (options.dataKey) {
    logger.info('Using raw RemoteAuth data key from WA_REMOTE_AUTH_DATA_KEY');
    return { key: decodeBase64(options.dataKey, 'WA_REMOTE_AUTH_DATA_KEY'), source: 'env' };
  }
  if (options.encryptedDataKey && options.kmsKeyId) {
    const key = await decryptWithKms(options.encryptedDataKey, options.kmsKeyId, logger);
    return { key, source: 'kms' };
  }
  if (options.vaultTransitPath && options.encryptedDataKey) {
    const key = await decryptWithVault(options, logger);
    return { key, source: 'vault' };
  }
  throw new Error('RemoteAuth encryption requires WA_REMOTE_AUTH_DATA_KEY, or KMS/Vault configuration.');
}

let cachedMaterials: EncryptionMaterials | undefined;

export async function loadEncryptionMaterials(
  options: RemoteAuthCryptoConfig,
  logger: Logger
): Promise<EncryptionMaterials> {
  if (cachedMaterials) return cachedMaterials;
  const { key, source } = await resolveDataKey(options, logger);
  const encryptionKey = deriveKey(key, 'wbscanner-wa-enc');
  const hmacKey = deriveKey(key, 'wbscanner-wa-hmac');
  cachedMaterials = {
    encryptionKey,
    hmacKey,
    keySource: source,
  };
  return cachedMaterials;
}

export type WaConfig = typeof config.wa;
