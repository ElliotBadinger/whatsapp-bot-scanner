import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { logger } from "@wbscanner/shared";

import { InProcessScanQueue } from "../queues/in-process-scan-queue";

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

describe("InProcessScanQueue", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("passes configured scan options to scanUrl", async () => {
    const adapter = {
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    const scanUrl = jest.fn().mockResolvedValue({
      finalUrl: "https://example.com",
      verdict: { level: "benign", reasons: ["ok"] },
    });

    const formatVerdictMessage = jest.fn().mockReturnValue("ok");

    const queue = new InProcessScanQueue({
      adapter,
      concurrency: 1,
      rateLimit: 10,
      rateWindowMs: 60_000,
      logger,
      scanUrl,
      scanOptions: {
        followRedirects: true,
        timeoutMs: 1234,
        maxRedirects: 2,
        maxContentLength: 999,
      },
      formatVerdictMessage,
    });

    await queue.add("scan", {
      url: "https://example.com",
      urlHash: "h1",
      chatId: "chat-1",
      messageId: "msg-1",
    });
    await nextTick();

    expect(scanUrl).toHaveBeenCalledWith("https://example.com", {
      followRedirects: true,
      timeoutMs: 1234,
      maxRedirects: 2,
      maxContentLength: 999,
    });

    await queue.close();
  });

  it("sends a single failure reply per message when scanUrl fails", async () => {
    const adapter = {
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    const scanUrl = jest.fn().mockRejectedValue(new Error("Timeout"));
    const formatVerdictMessage = jest.fn().mockReturnValue("ok");

    const queue = new InProcessScanQueue({
      adapter,
      concurrency: 2,
      rateLimit: 10,
      rateWindowMs: 60_000,
      logger,
      scanUrl,
      scanOptions: { followRedirects: false },
      formatVerdictMessage,
    });

    await queue.add("scan", {
      url: "https://bad.example",
      urlHash: "h1",
      chatId: "chat-1",
      messageId: "msg-1",
    });
    await queue.add("scan", {
      url: "https://bad2.example",
      urlHash: "h2",
      chatId: "chat-1",
      messageId: "msg-1",
    });

    await nextTick();
    await nextTick();

    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
    expect(adapter.sendMessage).toHaveBeenCalledWith(
      "chat-1",
      {
        type: "text",
        text: expect.stringContaining("Scan failed"),
      },
      { quotedMessageId: "msg-1" },
    );

    await queue.close();
  });

  it("prunes expired seenUrls entries", async () => {
    let now = 1000;
    jest.spyOn(Date, "now").mockImplementation(() => now);

    const queue = new InProcessScanQueue({
      adapter: { sendMessage: async () => ({ success: true }) } as any,
      concurrency: 1,
      rateLimit: 10,
      rateWindowMs: 1000,
      logger,
      scanUrl: async (url: string) => ({
        finalUrl: url,
        verdict: { level: "benign", reasons: [] },
      }),
      scanOptions: { followRedirects: false },
      formatVerdictMessage: () => "ok",
    });

    await queue.add("scan", {
      url: "https://example.com",
      urlHash: "h1",
      chatId: "c1",
      messageId: "m1",
    });

    (queue as any).seenUrls.set("c1:h1", 0);

    now = 2500;
    await queue.add("scan", {
      url: "https://example.net",
      urlHash: "h2",
      chatId: "c2",
      messageId: "m2",
    });

    expect((queue as any).seenUrls.has("c1:h1")).toBe(false);
    await queue.close();
  });

  it("prunes expired rateLimits entries", async () => {
    let now = 1000;
    jest.spyOn(Date, "now").mockImplementation(() => now);

    const queue = new InProcessScanQueue({
      adapter: { sendMessage: async () => ({ success: true }) } as any,
      concurrency: 1,
      rateLimit: 10,
      rateWindowMs: 1000,
      logger,
      scanUrl: async (url: string) => ({
        finalUrl: url,
        verdict: { level: "benign", reasons: [] },
      }),
      scanOptions: { followRedirects: false },
      formatVerdictMessage: () => "ok",
    });

    await queue.add("scan", {
      url: "https://example.com",
      urlHash: "h1",
      chatId: "g1",
      messageId: "m1",
      isGroup: true,
    });

    (queue as any).rateLimits.set("g1", { windowStart: 0, count: 1 });

    now = 2500;
    await queue.add("scan", {
      url: "https://example.net",
      urlHash: "h2",
      chatId: "g2",
      messageId: "m2",
      isGroup: true,
    });

    expect((queue as any).rateLimits.has("g1")).toBe(false);
    await queue.close();
  });
});
