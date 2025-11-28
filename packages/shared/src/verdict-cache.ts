import NodeCache from "node-cache";
import type { Logger } from "pino";

export interface VerdictCacheOptions {
  ttlSeconds?: number;
  maxKeys?: number;
  checkPeriodSeconds?: number;
  logger?: Logger;
}

export interface CachedVerdict {
  verdict: "benign" | "suspicious" | "malicious";
  confidence: number;
  timestamp: number;
  sources?: string[];
}

/**
 * In-memory verdict cache using node-cache.
 * Reduces Redis load for frequently scanned URLs.
 * Each service instance maintains its own cache.
 */
export class VerdictCache {
  private cache: NodeCache;
  private logger?: Logger;
  private hits = 0;
  private misses = 0;

  constructor(options: VerdictCacheOptions = {}) {
    const {
      ttlSeconds = 3600,
      maxKeys = 10000,
      checkPeriodSeconds = 600,
      logger,
    } = options;

    this.logger = logger;
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      maxKeys,
      checkperiod: checkPeriodSeconds,
      useClones: false, // Performance optimization
    });

    // Log cache statistics periodically
    if (this.logger) {
      setInterval(() => {
        const stats = this.getStats();
        this.logger?.debug(stats, "Verdict cache statistics");
      }, 60000); // Every minute
    }
  }

  /**
   * Get a cached verdict by URL hash
   */
  get(urlHash: string): CachedVerdict | undefined {
    const value = this.cache.get<CachedVerdict>(urlHash);
    if (value) {
      this.hits++;
      this.logger?.debug({ urlHash, verdict: value.verdict }, "Cache hit");
      return value;
    }
    this.misses++;
    this.logger?.debug({ urlHash }, "Cache miss");
    return undefined;
  }

  /**
   * Set a verdict in the cache
   */
  set(urlHash: string, verdict: CachedVerdict, ttlSeconds?: number): boolean {
    try {
      const success =
        ttlSeconds !== undefined
          ? this.cache.set(urlHash, verdict, ttlSeconds)
          : this.cache.set(urlHash, verdict);
      if (success) {
        this.logger?.debug(
          { urlHash, verdict: verdict.verdict },
          "Cached verdict",
        );
      }
      return success;
    } catch (err) {
      this.logger?.warn({ err, urlHash }, "Failed to cache verdict");
      return false;
    }
  }

  /**
   * Delete a specific verdict from cache
   */
  delete(urlHash: string): number {
    return this.cache.del(urlHash);
  }

  /**
   * Clear all cached verdicts
   */
  clear(): void {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
    this.logger?.info("Verdict cache cleared");
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
    ksize: number;
    vsize: number;
  } {
    const stats = this.cache.getStats();
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      keys: stats.keys,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
      ksize: stats.ksize,
      vsize: stats.vsize,
    };
  }

  /**
   * Check if cache has a specific key
   */
  has(urlHash: string): boolean {
    return this.cache.has(urlHash);
  }

  /**
   * Get TTL for a specific key (in seconds)
   */
  getTtl(urlHash: string): number | undefined {
    const ttl = this.cache.getTtl(urlHash);
    return ttl !== undefined ? ttl : undefined;
  }

  /**
   * Close the cache and cleanup
   */
  close(): void {
    this.cache.close();
    this.logger?.info("Verdict cache closed");
  }
}
