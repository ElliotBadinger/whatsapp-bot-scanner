import Redis from 'ioredis';
import crypto from 'crypto';
import { logger } from '../log';
import { metrics } from '../metrics';
import { Counter, Gauge } from 'prom-client';

const threatFeedUpdateTotal = new Counter({
  name: 'threat_feed_update_total',
  help: 'Total number of threat feed updates',
  labelNames: ['source', 'result'],
  registers: [metrics],
});

const threatFeedEntriesGauge = new Gauge({
  name: 'threat_feed_entries',
  help: 'Number of entries in threat feed',
  labelNames: ['source'],
  registers: [metrics],
});

const localThreatHitsTotal = new Counter({
  name: 'local_threat_hits_total',
  help: 'Total number of local threat database hits',
  labelNames: ['match_type'],
  registers: [metrics],
});

const collaborativeLearningTotal = new Counter({
  name: 'collaborative_learning_total',
  help: 'Total number of collaborative learning events',
  labelNames: ['action'],
  registers: [metrics],
});

interface ThreatEntry {
  url: string;
  urlHash: string;
  firstSeen: number;
  lastSeen: number;
  confidence: number;
  tags: string[];
}

interface CollaborativeThreat {
  urlHash: string;
  verdictHistory: Array<{
    verdict: 'benign' | 'suspicious' | 'malicious';
    timestamp: number;
    confidence: number;
  }>;
  reportCount: number;
}

interface LocalThreatResult {
  score: number;
  reasons: string[];
  matchType?: 'exact' | 'domain' | 'collaborative';
  confidence?: number;
}

export class LocalThreatDatabase {
  private redis: Redis;
  private updateInterval?: NodeJS.Timeout;
  private feedUrl: string;
  private updateIntervalMs: number;

  constructor(redis: Redis, config: { feedUrl?: string; updateIntervalMs?: number } = {}) {
    this.redis = redis;
    this.feedUrl = config.feedUrl || 'https://openphish.com/feed.txt';
    this.updateIntervalMs = config.updateIntervalMs || 2 * 60 * 60 * 1000;
  }

  private hashUrl(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex');
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return '';
    }
  }

  async start(): Promise<void> {
    logger.info('Starting local threat database');

    await this.updateOpenPhishFeed();

    this.updateInterval = setInterval(() => {
      this.updateOpenPhishFeed().catch((err) => {
        logger.error({ error: err.message }, 'Failed to update OpenPhish feed');
      });
    }, this.updateIntervalMs);

    logger.info({ updateIntervalMs: this.updateIntervalMs }, 'Local threat database started');
  }

  async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    logger.info('Local threat database stopped');
  }

  async updateOpenPhishFeed(): Promise<void> {
    const startTime = Date.now();
    logger.info({ feedUrl: this.feedUrl }, 'Updating OpenPhish feed');

    try {
      const response = await fetch(this.feedUrl, {
        headers: {
          'User-Agent': 'wbscanner-bot/1.0',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const urls = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.startsWith('http'));

      const pipeline = this.redis.pipeline();
      const now = Date.now();

      for (const url of urls) {
        const urlHash = this.hashUrl(url);
        const domain = this.extractDomain(url);

        const entry: ThreatEntry = {
          url,
          urlHash,
          firstSeen: now,
          lastSeen: now,
          confidence: 0.9,
          tags: ['openphish'],
        };

        const key = `threat:feed:${urlHash}`;
        pipeline.set(key, JSON.stringify(entry), 'EX', 24 * 60 * 60);

        if (domain) {
          const domainKey = `threat:domain:${domain}`;
          pipeline.sadd(domainKey, urlHash);
          pipeline.expire(domainKey, 24 * 60 * 60);
        }
      }

      await pipeline.exec();

      const duration = Date.now() - startTime;
      threatFeedUpdateTotal.labels('openphish', 'success').inc();
      threatFeedEntriesGauge.labels('openphish').set(urls.length);

      logger.info(
        { count: urls.length, durationMs: duration },
        'OpenPhish feed updated successfully'
      );
    } catch (err: any) {
      threatFeedUpdateTotal.labels('openphish', 'error').inc();
      logger.error({ error: err.message, feedUrl: this.feedUrl }, 'Failed to update OpenPhish feed');
      throw err;
    }
  }

  async check(url: string, urlHash?: string): Promise<LocalThreatResult> {
    const hash = urlHash || this.hashUrl(url);
    const domain = this.extractDomain(url);

    const exactKey = `threat:feed:${hash}`;
    const exactMatch = await this.redis.get(exactKey);

    if (exactMatch) {
      localThreatHitsTotal.labels('exact').inc();
      logger.info({ url, hash }, 'Exact URL match in threat feed');

      return {
        score: 0.9,
        reasons: ['Exact match in OpenPhish threat feed'],
        matchType: 'exact',
        confidence: 0.9,
      };
    }

    if (domain) {
      const domainKey = `threat:domain:${domain}`;
      const domainHashes = await this.redis.smembers(domainKey);

      if (domainHashes.length > 0) {
        localThreatHitsTotal.labels('domain').inc();
        logger.info({ url, domain, matchCount: domainHashes.length }, 'Domain match in threat feed');

        return {
          score: 0.4,
          reasons: [`Domain ${domain} found in threat feed (${domainHashes.length} entries)`],
          matchType: 'domain',
          confidence: 0.7,
        };
      }
    }

    const collaborativeResult = await this.checkCollaborativeLearning(hash);
    if (collaborativeResult.score > 0) {
      return collaborativeResult;
    }

    return {
      score: 0,
      reasons: [],
    };
  }

  async recordVerdict(
    url: string,
    verdict: 'benign' | 'suspicious' | 'malicious',
    confidence: number
  ): Promise<void> {
    const hash = this.hashUrl(url);
    const key = `threat:collaborative:${hash}`;

    const existing = await this.redis.get(key);
    let collaborative: CollaborativeThreat;

    if (existing) {
      collaborative = JSON.parse(existing);
    } else {
      collaborative = {
        urlHash: hash,
        verdictHistory: [],
        reportCount: 0,
      };
    }

    collaborative.verdictHistory.push({
      verdict,
      timestamp: Date.now(),
      confidence,
    });
    collaborative.reportCount++;

    collaborative.verdictHistory = collaborative.verdictHistory
      .filter((v) => v.timestamp > Date.now() - 90 * 24 * 60 * 60 * 1000)
      .slice(-20);

    await this.redis.set(key, JSON.stringify(collaborative), 'EX', 90 * 24 * 60 * 60);

    collaborativeLearningTotal.labels('verdict_recorded').inc();

    logger.debug(
      { url, verdict, confidence, reportCount: collaborative.reportCount },
      'Verdict recorded in collaborative learning'
    );
  }

  private async checkCollaborativeLearning(urlHash: string): Promise<LocalThreatResult> {
    const key = `threat:collaborative:${urlHash}`;
    const data = await this.redis.get(key);

    if (!data) {
      return { score: 0, reasons: [] };
    }

    const collaborative: CollaborativeThreat = JSON.parse(data);
    const recentVerdicts = collaborative.verdictHistory.filter(
      (v) => v.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    const maliciousCount = recentVerdicts.filter((v) => v.verdict === 'malicious').length;

    if (maliciousCount >= 3) {
      localThreatHitsTotal.labels('collaborative').inc();
      collaborativeLearningTotal.labels('auto_flagged').inc();

      logger.info(
        { urlHash, maliciousCount, totalReports: collaborative.reportCount },
        'URL auto-flagged by collaborative learning'
      );

      return {
        score: 0.7,
        reasons: [`Auto-flagged by collaborative learning (${maliciousCount} malicious reports in 7 days)`],
        matchType: 'collaborative',
        confidence: 0.8,
      };
    }

    return { score: 0, reasons: [] };
  }

  async getStats(): Promise<{
    openphishCount: number;
    collaborativeCount: number;
  }> {
    const openphishKeys = await this.redis.keys('threat:feed:*');
    const collaborativeKeys = await this.redis.keys('threat:collaborative:*');

    return {
      openphishCount: openphishKeys.length,
      collaborativeCount: collaborativeKeys.length,
    };
  }
}

export type { ThreatEntry, CollaborativeThreat, LocalThreatResult };
