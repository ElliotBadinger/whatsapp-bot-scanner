import Redis from "ioredis";
import { MessageStore } from "../../services/wa-client/src/message-store";
import { GroupStore } from "../../services/wa-client/src/group-store";

describe("Identifier Hashing Regression Suite", () => {
  it("should maintain message lookup functionality", async () => {
    const redis = new Redis();
    const store = new MessageStore(redis as any, 60);

    const chatId = "regression-chat@g.us";
    const messageId = "regression-msg-001";

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

  it("should maintain group store functionality", async () => {
    const redis = new Redis();
    const groupStore = new GroupStore(redis as any, 60);

    const chatId = "group-regression@g.us";
    await groupStore.recordEvent({
      chatId,
      type: "join",
      timestamp: Date.now(),
      actorId: "admin@c.us",
    });

    const events = await groupStore.listRecentEvents(chatId, 10);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("join");
  });
});
