import { describe, expect, it } from "@jest/globals";
import { ScanRequestSchema } from "../schemas";

describe("ScanRequestSchema", () => {
  it("accepts a rescan job without chat context (chatId/messageId) when required fields are present", () => {
    const rescanJobWithoutChatContext = {
      url: "https://example.com",
      urlHash: "abc123",
      rescan: true,
      priority: 1,
      timestamp: Date.now(),
    };

    const result = ScanRequestSchema.safeParse(rescanJobWithoutChatContext);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.url).toBe("https://example.com");
      // Optional fields should be absent/undefined when not provided
      expect(result.data.chatId).toBeUndefined();
      expect(result.data.messageId).toBeUndefined();
    }
  });

  it("accepts a rescan job with chat context but without timestamp (timestamp is optional; workers can fallback)", () => {
    const rescanJobWithChatContextNoTimestamp = {
      url: "https://example.com",
      urlHash: "abc123",
      rescan: true,
      priority: 1,
      chatId: "some-chat-id",
      messageId: "some-message-id",
      // timestamp intentionally omitted
    };

    const result = ScanRequestSchema.safeParse(
      rescanJobWithChatContextNoTimestamp,
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.chatId).toBe("some-chat-id");
      expect(result.data.messageId).toBe("some-message-id");
      expect(result.data.timestamp).toBeUndefined();
    }
  });

  it("accepts a normal scan request (chat context + timestamp)", () => {
    const normalScanRequest = {
      chatId: "some-chat-id",
      messageId: "some-message-id",
      url: "https://example.com",
      timestamp: Date.now(),
    };

    const result = ScanRequestSchema.safeParse(normalScanRequest);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.chatId).toBe("some-chat-id");
      expect(result.data.messageId).toBe("some-message-id");
      expect(typeof result.data.timestamp).toBe("number");
    }
  });

  it("rejects an invalid URL", () => {
    const invalidUrlJob = {
      url: "not-a-url",
      timestamp: Date.now(),
    };

    const result = ScanRequestSchema.safeParse(invalidUrlJob);
    expect(result.success).toBe(false);

    if (!result.success) {
      // Make sure the error points at `url`
      const urlIssues = result.error.issues.filter(
        (i) => i.path.join(".") === "url",
      );
      expect(urlIssues.length).toBeGreaterThan(0);
    }
  });

  it("rejects missing url", () => {
    const missingUrlJob = {
      timestamp: Date.now(),
    };

    const result = ScanRequestSchema.safeParse(missingUrlJob);
    expect(result.success).toBe(false);

    if (!result.success) {
      const urlIssues = result.error.issues.filter(
        (i) => i.path.join(".") === "url",
      );
      expect(urlIssues.length).toBeGreaterThan(0);
    }
  });
});
