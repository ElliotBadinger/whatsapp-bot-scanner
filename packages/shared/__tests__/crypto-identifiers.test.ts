import {
  hashChatId,
  hashMessageId,
  hashIdentifierPair,
} from "../src/crypto/identifiers";

describe("Identifier Hashing", () => {
  it("should produce deterministic hashes", () => {
    const chatId = "123456789-987654321@g.us";
    const hash1 = hashChatId(chatId);
    const hash2 = hashChatId(chatId);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce different hashes for different inputs", () => {
    const hash1 = hashChatId("chat1@g.us");
    const hash2 = hashChatId("chat2@g.us");
    expect(hash1).not.toBe(hash2);
  });

  it("should not be reversible", () => {
    const chatId = "123456789-987654321@g.us";
    const hash = hashChatId(chatId);
    expect(hash).not.toContain(chatId);
    expect(hash).not.toContain("123456789");
  });

  it("should use different namespaces for chat vs message IDs", () => {
    const id = "same_value";
    const chatHash = hashChatId(id);
    const msgHash = hashMessageId(id);
    expect(chatHash).not.toBe(msgHash);
  });

  it("should hash chat/message pairs consistently", () => {
    const pair1 = hashIdentifierPair("chat", "msg");
    const pair2 = hashIdentifierPair("chat", "msg");
    expect(pair1).toBe(pair2);
    expect(pair1).toMatch(/^[a-f0-9]{64}$/);
  });
});
