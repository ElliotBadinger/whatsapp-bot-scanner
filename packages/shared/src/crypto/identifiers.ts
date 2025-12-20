import crypto from "crypto";

const IDENTIFIER_SECRET_ENV = "IDENTIFIER_HASH_SECRET";

function getIdentifierSecret(): string {
  const secret = process.env[IDENTIFIER_SECRET_ENV];
  if (!secret) {
    throw new Error(`${IDENTIFIER_SECRET_ENV} must be set`);
  }
  return secret;
}

function hmac(value: string): string {
  return crypto
    .createHmac("sha256", getIdentifierSecret())
    .update(value)
    .digest("hex");
}

export function isIdentifierHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function hashChatId(chatId: string): string {
  return hmac(`chat:${chatId}`);
}

export function hashMessageId(messageId: string): string {
  return hmac(`msg:${messageId}`);
}

export function hashIdentifierPair(chatId: string, messageId: string): string {
  return hmac(`pair:${chatId}:${messageId}`);
}
