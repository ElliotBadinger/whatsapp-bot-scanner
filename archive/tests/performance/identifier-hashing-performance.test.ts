import { hashChatId, hashMessageId } from "@wbscanner/shared";

describe("Identifier Hashing Performance", () => {
  it("should hash identifiers with minimal overhead", () => {
    const iterations = 5000;
    const start = Date.now();
    for (let i = 0; i < iterations; i += 1) {
      hashChatId(`chat-${i}@g.us`);
      hashMessageId(`msg-${i}`);
    }
    const duration = Date.now() - start;
    const avgMs = duration / (iterations * 2);
    expect(avgMs).toBeLessThan(0.5);
  });
});
