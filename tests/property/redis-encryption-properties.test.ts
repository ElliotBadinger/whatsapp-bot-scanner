import fc from "fast-check";
import {
  encryptValue,
  decryptValue,
  resetEncryptionKey,
} from "@wbscanner/shared";

describe("Redis Encryption Properties", () => {
  beforeAll(() => {
    process.env.REDIS_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    resetEncryptionKey();
  });

  afterAll(() => {
    delete process.env.REDIS_ENCRYPTION_KEY;
    resetEncryptionKey();
  });

  it("should ALWAYS decrypt to original value", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 5000 }), (plaintext) => {
        const encrypted = encryptValue(plaintext);
        const decrypted = decryptValue(encrypted);
        expect(decrypted).toBe(plaintext);
      }),
      { numRuns: 500 },
    );
  });

  it("should NEVER expose plaintext in ciphertext", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 10, maxLength: 100 }), (plaintext) => {
        const encrypted = encryptValue(plaintext);
        expect(encrypted).not.toContain(plaintext);

        // Check for partial leakage (4+ char substrings)
        for (let i = 0; i <= plaintext.length - 4; i++) {
          const substring = plaintext.substring(i, i + 4);
          // Skip if substring looks like hex (could appear in output)
          if (!/^[a-f0-9]+$/i.test(substring)) {
            expect(encrypted.toLowerCase()).not.toContain(
              substring.toLowerCase(),
            );
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("should produce unique ciphertexts for same plaintext (random IV)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (plaintext) => {
        const encrypted1 = encryptValue(plaintext);
        const encrypted2 = encryptValue(plaintext);
        expect(encrypted1).not.toBe(encrypted2);
      }),
      { numRuns: 200 },
    );
  });

  it("should handle all unicode characters correctly", () => {
    fc.assert(
      fc.property(fc.fullUnicode(), (char) => {
        const plaintext = char.repeat(10);
        const encrypted = encryptValue(plaintext);
        const decrypted = decryptValue(encrypted);
        expect(decrypted).toBe(plaintext);
      }),
      { numRuns: 200 },
    );
  });

  it("should detect tampering of any part of ciphertext", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 0, max: 2 }),
        (plaintext, partToTamper) => {
          const encrypted = encryptValue(plaintext);
          const parts = encrypted.split(":");
          
          // Tamper with one character in the selected part
          const part = parts[partToTamper];
          if (part.length > 0) {
            const charIndex = Math.floor(Math.random() * part.length);
            const originalChar = part[charIndex];
            const tamperedChar = originalChar === "a" ? "b" : "a";
            parts[partToTamper] =
              part.substring(0, charIndex) +
              tamperedChar +
              part.substring(charIndex + 1);
            
            const tampered = parts.join(":");
            
            expect(() => decryptValue(tampered)).toThrow();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
