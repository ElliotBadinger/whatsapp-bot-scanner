import { InProcessScanQueue } from "../queues/in-process-scan-queue";
import { logger } from "@wbscanner/shared";
import { jest } from "@jest/globals";

const dummyAdapter = {
  sendMessage: async () => ({ success: true }),
} as any;

const scanUrl = async (url: string) => ({
  finalUrl: url,
  verdict: { level: "SAFE", reasons: [] },
});

const formatVerdictMessage = () => "ok";

describe("InProcessScanQueue", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("prunes expired seenUrls entries", async () => {
    let now = 1000;
    jest.spyOn(Date, "now").mockImplementation(() => now);

    const queue = new InProcessScanQueue({
      adapter: dummyAdapter,
      concurrency: 0,
      rateLimit: 10,
      rateWindowMs: 1000,
      logger,
      scanUrl,
      formatVerdictMessage,
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
      adapter: dummyAdapter,
      concurrency: 0,
      rateLimit: 10,
      rateWindowMs: 1000,
      logger,
      scanUrl,
      formatVerdictMessage,
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
