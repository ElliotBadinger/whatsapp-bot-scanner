import Redis from "ioredis";
import { MessageStore } from "../../services/wa-client/src/message-store";
import { hashChatId, hashMessageId } from "@wbscanner/shared";

describe("Identifier Hashing Integration", () => {
  it("should store only hashed identifiers in Redis keys", async () => {
    const redis = new Redis();
    const store = new MessageStore(redis as any, 60);

    const chatId = "test-chat@g.us";
    const messageId = "test-message-123";

    await store.recordMessageCreate({
      chatId,
      messageId,
      senderIdHash: "sender_hash",
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
    expect(keys.some((k) => k.includes(messageId))).toBe(false);
  });

  it("should retrieve messages using hashed identifiers", async () => {
    const redis = new Redis();
    const store = new MessageStore(redis as any, 60);

    const chatId = "test-chat@g.us";
    const messageId = "test-message-456";

    await store.recordMessageCreate({
      chatId,
      messageId,
      senderIdHash: "sender_hash",
      timestamp: Date.now(),
      normalizedUrls: ["http://example.com"],
      urlHashes: ["url_hash_1"],
    });

    const record = await store.getRecord(chatId, messageId);
    expect(record).toBeDefined();
    expect(record?.urlHashes).toContain("url_hash_1");
  });
});
