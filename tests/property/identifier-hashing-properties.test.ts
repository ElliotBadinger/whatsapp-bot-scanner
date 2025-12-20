import fc from "fast-check";
import { hashChatId, hashMessageId } from "@wbscanner/shared";

describe("Identifier Hashing Properties", () => {
  it("should ALWAYS hash consistently", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (input) => {
        const hash1 = hashChatId(input);
        const hash2 = hashChatId(input);
        expect(hash1).toBe(hash2);
      }),
      { numRuns: 500 },
    );
  });

  it("should NEVER collide for different inputs", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
        ).filter(([a, b]) => a !== b),
        ([input1, input2]) => {
          const hash1 = hashChatId(input1);
          const hash2 = hashChatId(input2);
          expect(hash1).not.toBe(hash2);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("should isolate chat vs message namespaces", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (input) => {
        const chatHash = hashChatId(input);
        const messageHash = hashMessageId(input);
        expect(chatHash).not.toBe(messageHash);
      }),
      { numRuns: 200 },
    );
  });
});
