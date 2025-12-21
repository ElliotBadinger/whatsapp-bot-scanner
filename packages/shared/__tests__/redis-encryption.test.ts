import {
  encryptValue,
  decryptValue,
  isEncryptedValue,
  resetEncryptionKey,
} from "../src/crypto/redis-encryption";

describe("Redis Encryption", () => {
  beforeAll(() => {
    process.env.REDIS_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    resetEncryptionKey();
  });

  afterAll(() => {
    delete process.env.REDIS_ENCRYPTION_KEY;
    resetEncryptionKey();
  });

  it("should encrypt and decrypt values correctly", () => {
    const plaintext = "sensitive_pairing_code_123456";
    const encrypted = encryptValue(plaintext);
    const decrypted = decryptValue(encrypted);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for same plaintext (random IV)", () => {
    const plaintext = "test_value";
    const encrypted1 = encryptValue(plaintext);
    const encrypted2 = encryptValue(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
    expect(decryptValue(encrypted1)).toBe(plaintext);
    expect(decryptValue(encrypted2)).toBe(plaintext);
  });

  it("should throw on tampered ciphertext", () => {
    const plaintext = "test_value";
    const encrypted = encryptValue(plaintext);
    const tampered = encrypted.replace(/[a-f]/i, "x");

    expect(() => decryptValue(tampered)).toThrow();
  });

  it("should handle unicode correctly", () => {
    const plaintext = "你好🔒世界";
    const encrypted = encryptValue(plaintext);
    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle empty strings", () => {
    const plaintext = "";
    const encrypted = encryptValue(plaintext);
    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle long strings", () => {
    const plaintext = "a".repeat(10000);
    const encrypted = encryptValue(plaintext);
    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce correct format (iv:authTag:ciphertext)", () => {
    const encrypted = encryptValue("test");
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);
    expect(parts[0]).toMatch(/^[a-f0-9]{32}$/i); // 16 bytes IV
    expect(parts[1]).toMatch(/^[a-f0-9]{32}$/i); // 16 bytes auth tag
    expect(parts[2]).toMatch(/^[a-f0-9]+$/i); // ciphertext
  });

  it("should detect encrypted values correctly", () => {
    const encrypted = encryptValue("test");
    expect(isEncryptedValue(encrypted)).toBe(true);
    expect(isEncryptedValue("not_encrypted")).toBe(false);
    expect(isEncryptedValue("invalid:format")).toBe(false);
  });

  it("should throw without encryption key", () => {
    const originalKey = process.env.REDIS_ENCRYPTION_KEY;
    delete process.env.REDIS_ENCRYPTION_KEY;
    resetEncryptionKey();

    expect(() => encryptValue("test")).toThrow(
      /REDIS_ENCRYPTION_KEY must be set/,
    );

    process.env.REDIS_ENCRYPTION_KEY = originalKey;
    resetEncryptionKey();
  });

  it("should throw with invalid key length", () => {
    const originalKey = process.env.REDIS_ENCRYPTION_KEY;
    process.env.REDIS_ENCRYPTION_KEY = "tooshort";
    resetEncryptionKey();

    expect(() => encryptValue("test")).toThrow(/64 hex characters/);

    process.env.REDIS_ENCRYPTION_KEY = originalKey;
    resetEncryptionKey();
  });
});
