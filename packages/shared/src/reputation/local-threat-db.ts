import { request } from "undici";
import { logger } from "../log";
import type Redis from "ioredis";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export interface LocalThreatResult {
  score: number;
  reasons: string[];
  openphishMatch?: boolean;
  collaborativeMatch?: boolean;
}

interface LocalThreatDatabaseOptions {
  feedUrl: string;
  updateIntervalMs: number;
}

export class LocalThreatDatabase {
  private redis: Redis;
  private options: LocalThreatDatabaseOptions;
  private updateTimer?: NodeJS.Timeout;
  private readonly OPENPHISH_KEY = "threat_db:openphish";
  private readonly COLLABORATIVE_KEY = "threat_db:collaborative";
  private readonly LAST_UPDATE_KEY = "threat_db:last_update";

  constructor(redis: Redis, options: LocalThreatDatabaseOptions) {
    this.redis = redis;
    this.options = options;
  }

  async start(): Promise<void> {
    try {
      await this.updateOpenPhishFeed();
    } catch (err) {
      logger.warn(
        { err },
        "Initial OpenPhish update failed; will retry on next interval",
      );
    }

    this.updateTimer = setInterval(() => {
      this.updateOpenPhishFeed().catch((err) => {
        logger.warn({ err }, "Failed to update OpenPhish feed");
      });
    }, this.options.updateIntervalMs);

    logger.info("Local threat database started");
  }

  async stop(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    logger.info("Local threat database stopped");
  }

  async check(url: string, _hash?: string): Promise<LocalThreatResult> {
    const result: LocalThreatResult = {
      score: 0,
      reasons: [],
    };

    try {
      const normalizedUrl = this.normalizeUrl(url);

      const openphishMatch = await this.redis.sismember(
        this.OPENPHISH_KEY,
        normalizedUrl,
      );
      if (openphishMatch) {
        result.openphishMatch = true;
        result.score += 2.0;
        result.reasons.push("URL found in OpenPhish feed");
      }

      const collaborativeScore = await this.redis.zscore(
        this.COLLABORATIVE_KEY,
        normalizedUrl,
      );
      if (collaborativeScore !== null && Number(collaborativeScore) > 0.7) {
        result.collaborativeMatch = true;
        result.score += Math.min(1.5, Number(collaborativeScore));
        result.reasons.push("URL flagged by collaborative learning");
      }

      return result;
    } catch (err) {
      logger.warn({ url, err }, "Local threat database check failed");
      return result;
    }
  }

  async ingestThreatUrls(
    source: string,
    urls: string[],
    { ttlSeconds = 24 * 60 * 60 }: { ttlSeconds?: number } = {},
  ): Promise<void> {
    try {
      const normalized = urls
        .map((url) => this.normalizeUrl(url))
        .filter((line) => line && line.startsWith("http"));

      if (normalized.length === 0) {
        return;
      }

      const pipeline = this.redis.pipeline();

      const batchSize = 1000;
      for (let i = 0; i < normalized.length; i += batchSize) {
        const batch = normalized.slice(i, i + batchSize);
        pipeline.sadd(this.OPENPHISH_KEY, ...batch);
      }

      pipeline.set(this.LAST_UPDATE_KEY, Date.now());
      pipeline.expire(this.OPENPHISH_KEY, ttlSeconds);

      await pipeline.exec();
      logger.info(
        { source, count: normalized.length },
        "Threat URLs ingested into local threat database",
      );
    } catch (err) {
      logger.warn({ err, source }, "Failed to ingest threat URLs");
    }
  }

  async updateOpenPhishFeed(): Promise<void> {
    try {
      logger.info("Updating OpenPhish feed...");

      const feedData = await this.loadFeedData(this.options.feedUrl);
      const urls = feedData
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line.startsWith("http"))
        .map((url) => this.normalizeUrl(url));

      if (urls.length === 0) {
        throw new Error("No URLs found in OpenPhish feed");
      }

      const pipeline = this.redis.pipeline();
      pipeline.del(this.OPENPHISH_KEY);

      const batchSize = 1000;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        pipeline.sadd(this.OPENPHISH_KEY, ...batch);
      }

      pipeline.set(this.LAST_UPDATE_KEY, Date.now());
      pipeline.expire(this.OPENPHISH_KEY, 24 * 60 * 60);

      await pipeline.exec();

      logger.info({ count: urls.length }, "OpenPhish feed updated successfully");
    } catch (err) {
      logger.warn({ err }, "Failed to update OpenPhish feed");
    }
  }

  async recordVerdict(
    url: string,
    verdict: "benign" | "suspicious" | "malicious",
    confidence: number,
  ): Promise<void> {
    try {
      const normalizedUrl = this.normalizeUrl(url);

      let score = 0;
      if (verdict === "malicious") {
        score = confidence;
      } else if (verdict === "suspicious") {
        score = confidence * 0.5;
      }

      if (score > 0) {
        await this.redis.zadd(this.COLLABORATIVE_KEY, score, normalizedUrl);
        await this.redis.expire(this.COLLABORATIVE_KEY, 30 * 24 * 60 * 60);
      }
    } catch (err) {
      logger.warn(
        { url, verdict, err },
        "Failed to record verdict in collaborative database",
      );
    }
  }

  async getStats(): Promise<{
    openphishCount: number;
    collaborativeCount: number;
  }> {
    try {
      const [openphishCount, collaborativeCount] = await Promise.all([
        this.redis.scard(this.OPENPHISH_KEY),
        this.redis.zcard(this.COLLABORATIVE_KEY),
      ]);

      return {
        openphishCount: openphishCount || 0,
        collaborativeCount: collaborativeCount || 0,
      };
    } catch (err) {
      logger.warn({ err }, "Failed to get threat database stats");
      return { openphishCount: 0, collaborativeCount: 0 };
    }
  }

  private async loadFeedData(source: string): Promise<string> {
    try {
      const parsed = new URL(source);
      if (parsed.protocol === "file:") {
        return await readFile(fileURLToPath(parsed), "utf8");
      }

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        const response = await request(source, {
          method: "GET",
          headersTimeout: 10000,
          bodyTimeout: 30000,
          maxRedirections: 5,
        });

        if (response.statusCode !== 200) {
          throw new Error(`Feed returned ${response.statusCode}`);
        }

        return await response.body.text();
      }

      return await readFile(fileURLToPath(parsed), "utf8");
    } catch {
      return await readFile(source, "utf8");
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
}

