import { config, logger, metrics } from "@wbscanner/shared";
import { randomBytes } from "node:crypto";
import type { ScanOptions } from "@wbscanner/scanner-core";

import type { WhatsAppAdapter } from "../adapters/index.js";
import type { ScanJobData, ScanRequestQueue } from "../types/scanQueue.js";

type ScanUrlResult = {
  finalUrl: string;
  verdict: {
    level: string;
    reasons: string[];
  };
};

const localJobIdSalt = randomBytes(8).toString("hex");
let lastLocalJobIdMs = 0;
let localJobIdSeq = 0;

function createLocalJobId(now: number): string {
  if (now === lastLocalJobIdMs) {
    localJobIdSeq += 1;
  } else {
    lastLocalJobIdMs = now;
    localJobIdSeq = 0;
  }

  return `local:${now}:${localJobIdSalt}:${localJobIdSeq.toString(36)}`;
}

export class InProcessScanQueue implements ScanRequestQueue {
  private readonly queue: { id: string; data: ScanJobData }[] = [];
  private active = 0;
  private closed = false;
  private readonly ttlMs = config.wa.messageLineageTtlSeconds * 1000;
  private readonly failureReplyTtlMs = 30 * 60_000;
  private readonly seenUrls = new Map<string, number>();
  private readonly failureReplies = new Map<string, number>();
  private readonly rateLimits = new Map<
    string,
    { windowStart: number; count: number }
  >();

  private lastPruneAt = 0;
  private readonly pruneIntervalMs: number;
  private seenUrlsCursor: IterableIterator<[string, number]> | null = null;
  private failureRepliesCursor: IterableIterator<[string, number]> | null =
    null;
  private rateLimitsCursor: IterableIterator<
    [string, { windowStart: number; count: number }]
  > | null = null;

  constructor(
    private readonly opts: {
      adapter: WhatsAppAdapter;
      concurrency: number;
      rateLimit: number;
      rateWindowMs: number;
      logger: typeof logger;
      scanUrl: (url: string, opts: ScanOptions) => Promise<ScanUrlResult>;
      scanOptions: ScanOptions;
      formatVerdictMessage: (
        verdict: string,
        reasons: string[],
        url: string,
      ) => string;
    },
  ) {
    if (opts.concurrency < 1) {
      throw new Error("InProcessScanQueue concurrency must be >= 1");
    }
    if (opts.rateLimit < 1) {
      throw new Error("InProcessScanQueue rateLimit must be >= 1");
    }
    if (opts.rateWindowMs < 1) {
      throw new Error("InProcessScanQueue rateWindowMs must be >= 1");
    }

    this.pruneIntervalMs = Math.min(60_000, this.ttlMs, opts.rateWindowMs);
  }

  async add(
    _name: string,
    data: ScanJobData,
  ): Promise<{ id: string; data: ScanJobData }> {
    if (this.closed) {
      throw new Error("Queue closed");
    }

    const now = Date.now();
    this.maybePrune(now);

    if (this.isDuplicate(now, data)) {
      this.opts.logger.debug(
        { url: data.url, chatId: data.chatId },
        "Skipping duplicate scan request",
      );
      return { id: createLocalJobId(now), data };
    }

    if (this.isRateLimited(now, data)) {
      this.opts.logger.warn(
        { chatId: data.chatId },
        "Rate limit reached for chat; dropping scan request",
      );
      return { id: createLocalJobId(now), data };
    }

    const id = createLocalJobId(now);
    this.queue.push({ id, data });
    this.drain();
    return { id, data };
  }

  async close(): Promise<void> {
    this.closed = true;
    this.queue.length = 0;
    this.seenUrls.clear();
    this.failureReplies.clear();
    this.rateLimits.clear();
    this.seenUrlsCursor = null;
    this.failureRepliesCursor = null;
    this.rateLimitsCursor = null;
  }

  private isDuplicate(now: number, data: ScanJobData): boolean {
    const key = `${data.chatId}:${data.urlHash}`;
    const expiry = this.seenUrls.get(key) ?? 0;
    if (expiry > now) {
      return true;
    }
    this.seenUrls.set(key, now + this.ttlMs);
    return false;
  }

  private isRateLimited(now: number, data: ScanJobData): boolean {
    if (!data.isGroup) return false;

    const existing = this.rateLimits.get(data.chatId);
    if (!existing || now - existing.windowStart > this.opts.rateWindowMs) {
      this.rateLimits.set(data.chatId, { windowStart: now, count: 1 });
      return false;
    }

    if (existing.count >= this.opts.rateLimit) {
      return true;
    }
    this.rateLimits.set(data.chatId, {
      windowStart: existing.windowStart,
      count: existing.count + 1,
    });
    return false;
  }

  private maybePrune(now: number): void {
    if (now - this.lastPruneAt < this.pruneIntervalMs) return;
    this.lastPruneAt = now;
    this.pruneSeenUrls(now);
    this.pruneFailureReplies(now);
    this.pruneRateLimits(now);
  }

  private pruneSeenUrls(now: number): void {
    const maxScans = 500;
    let scanned = 0;
    const cursor = this.seenUrlsCursor ?? this.seenUrls.entries();
    while (scanned < maxScans) {
      const next = cursor.next();
      if (next.done) {
        this.seenUrlsCursor = null;
        return;
      }
      const [key, expiry] = next.value;
      if (expiry <= now) {
        this.seenUrls.delete(key);
      }
      scanned += 1;
    }
    this.seenUrlsCursor = cursor;
  }

  private pruneFailureReplies(now: number): void {
    const maxScans = 500;
    let scanned = 0;
    const cursor = this.failureRepliesCursor ?? this.failureReplies.entries();
    while (scanned < maxScans) {
      const next = cursor.next();
      if (next.done) {
        this.failureRepliesCursor = null;
        return;
      }
      const [key, expiry] = next.value;
      if (expiry <= now) {
        this.failureReplies.delete(key);
      }
      scanned += 1;
    }
    this.failureRepliesCursor = cursor;
  }

  private pruneRateLimits(now: number): void {
    const maxScans = 500;
    let scanned = 0;
    const cursor = this.rateLimitsCursor ?? this.rateLimits.entries();
    while (scanned < maxScans) {
      const next = cursor.next();
      if (next.done) {
        this.rateLimitsCursor = null;
        return;
      }
      const [chatId, entry] = next.value;
      if (now - entry.windowStart > this.opts.rateWindowMs) {
        this.rateLimits.delete(chatId);
      }
      scanned += 1;
    }
    this.rateLimitsCursor = cursor;
  }

  private drain(): void {
    while (!this.closed && this.active < this.opts.concurrency) {
      const job = this.queue.shift();
      if (!job) return;
      this.active += 1;
      void this.process(job);
    }
  }

  private async process(job: { id: string; data: ScanJobData }): Promise<void> {
    try {
      await this.handle(job.data);
    } catch (err) {
      metrics.waVerdictFailures.inc();
      this.opts.logger.error(
        { err, chatId: job.data.chatId, url: job.data.url, jobId: job.id },
        "MVP scan job failed",
      );
      await this.sendFailureReply(job.data);
    } finally {
      this.active -= 1;
      this.drain();
    }
  }

  private shouldSendFailureReply(now: number, data: ScanJobData): boolean {
    const key = `${data.chatId}:${data.messageId}`;
    const expiry = this.failureReplies.get(key) ?? 0;
    if (expiry > now) {
      return false;
    }
    this.failureReplies.set(key, now + this.failureReplyTtlMs);
    return true;
  }

  private async sendFailureReply(data: ScanJobData): Promise<void> {
    const now = Date.now();
    if (!this.shouldSendFailureReply(now, data)) {
      return;
    }

    const text = `Link scan: ERROR\nURL: ${data.url}\nScan failed. Please try again later.`;
    try {
      const sendResult = await this.opts.adapter.sendMessage(
        data.chatId,
        { type: "text", text },
        { quotedMessageId: data.messageId },
      );

      if (!sendResult.success) {
        this.opts.logger.warn(
          { chatId: data.chatId, url: data.url },
          "Failed to send scan failure reply",
        );
      }
    } catch (err) {
      this.opts.logger.warn(
        { err, chatId: data.chatId, url: data.url },
        "Failed to send scan failure reply",
      );
    }
  }

  private async handle(data: ScanJobData): Promise<void> {
    const started = Date.now();
    const result = await this.opts.scanUrl(data.url, this.opts.scanOptions);
    const text = this.opts.formatVerdictMessage(
      result.verdict.level,
      result.verdict.reasons,
      result.finalUrl,
    );

    const sendResult = await this.opts.adapter.sendMessage(
      data.chatId,
      { type: "text", text },
      { quotedMessageId: data.messageId },
    );

    if (!sendResult.success) {
      throw new Error("Failed to send verdict message");
    }

    metrics.waVerdictsSent.inc();
    metrics.waVerdictLatency.observe(
      Math.max(0, (Date.now() - started) / 1000),
    );
    this.opts.logger.info(
      { chatId: data.chatId, url: data.url, verdict: result.verdict.level },
      "MVP verdict dispatched",
    );
  }
}
