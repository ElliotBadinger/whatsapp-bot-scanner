import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "undici";
import { logger } from "../log";
import type Redis from "ioredis";

export interface LocalThreatResult {
  score: number;
  reasons: string[];
  openphishMatch?: boolean;
  collaborativeMatch?: boolean;
}

interface LocalThreatDatabaseOptions {
  feedUrl: string;
  updateIntervalMs: number;
  allowRemoteFeeds?: boolean;
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

  private resolveLocalFeedPath(feedUrl: string): string | null {
    if (!feedUrl) return null;
    if (feedUrl.startsWith("file://")) {
      try {
        return fileURLToPath(feedUrl);
      } catch {
        return null;
      }
    }
    if (feedUrl.startsWith("http://") || feedUrl.startsWith("https://")) {
      return null;
    }
    const normalized = path.resolve(feedUrl);
    return fs.existsSync(normalized) ? normalized : null;
  }

  private async readFeedText(feedUrl: string): Promise<string | null> {
    const localPath = this.resolveLocalFeedPath(feedUrl);
    if (localPath) {
      try {
        return fs.readFileSync(localPath, "utf8");
      } catch (err) {
        logger.warn({ err, path: localPath }, "Failed to read local threat feed");
        return null;
      }
    }
    if (this.options.allowRemoteFeeds === false) {
      logger.warn(
        { feedUrl },
        "Remote threat feed disabled; skipping update",
      );
      return null;
    }
    if (!feedUrl.startsWith("http://") && !feedUrl.startsWith("https://")) {
      return null;
    }

    const response = await request(feedUrl, {
      method: "GET",
      headersTimeout: 10000,
      bodyTimeout: 30000,
      maxRedirections: 5,
    });

    if (response.statusCode !== 200) {
      throw new Error(`OpenPhish feed returned ${response.statusCode}`);
    }

    return response.body.text();
  }

  async start(): Promise<void> {
    // Initial feed update - non-fatal if it fails
    try {
      await this.updateOpenPhishFeed();
    } catch (err) {
      logger.warn(
        { err },
        "Initial OpenPh feed update failed; will retry on next interval",
      );
    }

    // Schedule periodic updates
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

  async check(url: string, _hash: string): Promise<LocalThreatResult> {
    const result: LocalThreatResult = {
      score: 0,
      reasons: [],
    };

    try {
      const normalizedUrl = this.normalizeUrl(url);

      // Check OpenPhish feed
      const openphishMatch = await this.redis.sismember(
        this.OPENPHISH_KEY,
        normalizedUrl,
      );
      if (openphishMatch) {
        result.openphishMatch = true;
        result.score += 2.0;
        result.reasons.push("URL found in OpenPhish feed");
      }

      // Check collaborative learning database
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
    } catch (_err) {
      logger.warn({ url, err: _err }, "Local threat database check failed");
      return result;
    }
  }

  async updateOpenPhishFeed(): Promise<void> {
    try {
      logger.info("Updating OpenPhish feed...");

      const feedData = await this.readFeedText(this.options.feedUrl);
      if (!feedData) {
        return;
      }
      const urls = feedData
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line.startsWith("http"))
        .map((url) => this.normalizeUrl(url));

      if (urls.length === 0) {
        throw new Error("No URLs found in OpenPhish feed");
      }

      // Update Redis with new feed data
      const pipeline = this.redis.pipeline();
      pipeline.del(this.OPENPHISH_KEY);

      // Add URLs in batches to avoid memory issues
      const batchSize = 1000;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        pipeline.sadd(this.OPENPHISH_KEY, ...batch);
      }

      pipeline.set(this.LAST_UPDATE_KEY, Date.now());
      pipeline.expire(this.OPENPHISH_KEY, 24 * 60 * 60); // 24 hours TTL

      await pipeline.exec();

      logger.info(
        { count: urls.length },
        "OpenPhish feed updated successfully",
      );
    } catch (err) {
      logger.warn({ err }, "Failed to update OpenPhish feed");
      // Don't throw - make this non-fatal to allow service to continue running
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
        // Set TTL for collaborative entries (30 days)
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

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove common tracking parameters and fragments
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().toLowerCase();
    } catch (_err) {
      return url.toLowerCase();
    }
  }
}
