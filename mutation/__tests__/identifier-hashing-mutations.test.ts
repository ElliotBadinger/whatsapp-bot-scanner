import Redis from "ioredis";
import { MessageStore } from "../../services/wa-client/src/message-store";
import { hashChatId, hashMessageId } from "@wbscanner/shared";

describe("Identifier Hashing Mutation Coverage", () => {
  it("should detect if hashing is bypassed", async () => {
    const redis = new Redis();
    const store = new MessageStore(redis as any, 60);

    const chatId = "plain-text-chat@g.us";
    const messageId = "msg-123";
    await store.recordMessageCreate({
      chatId,
      messageId,
      senderIdHash: "sender",
      timestamp: Date.now(),
      normalizedUrls: [],
      urlHashes: [],
    });

    const keys = await redis.keys("wa:message:*");
    const expected = `wa:message:${hashChatId(chatId)}:${hashMessageId(
      messageId,
    )}`;
    expect(keys).toContain(expected);
    expect(keys.some((k) => k.includes(chatId))).toBe(false);
  });

  it("should detect weak hashing algorithms", () => {
    const hash1 = hashChatId("test");
    const hash2 = hashChatId("test");
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("should detect missing namespace separation", () => {
    const chatHash = hashChatId("same");
    const msgHash = hashMessageId("same");
    expect(chatHash).not.toBe(msgHash);
  });
});
