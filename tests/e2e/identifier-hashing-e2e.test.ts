import Redis from "ioredis";
import { MessageStore } from "../../services/wa-client/src/message-store";
import { GroupStore } from "../../services/wa-client/src/group-store";
import { hashChatId, hashMessageId } from "@wbscanner/shared";

describe("Identifier Hashing E2E", () => {
  it("should maintain end-to-end functionality with hashed identifiers", async () => {
    const redis = new Redis();
    const messageStore = new MessageStore(redis as any, 60);
    const groupStore = new GroupStore(redis as any, 60);

    const chatId = "e2e-test-chat@g.us";
    const messageId = "e2e-test-msg-789";

    await messageStore.recordMessageCreate({
      chatId,
      messageId,
      senderIdHash: "sender_hash",
      timestamp: Date.now(),
      normalizedUrls: ["http://malicious.com"],
      urlHashes: ["url_hash_123"],
    });

    await groupStore.recordEvent({
      chatId,
      type: "join",
      timestamp: Date.now(),
      actorId: "admin@c.us",
    });

    const record = await messageStore.getRecord(chatId, messageId);
    expect(record).toBeDefined();

    const keys = await redis.keys("*");
    const expectedMessageKey = `wa:message:${hashChatId(chatId)}:${hashMessageId(
      messageId,
    )}`;
    expect(keys).toContain(expectedMessageKey);
    expect(keys.some((k) => k.includes(chatId))).toBe(false);
  });
});
