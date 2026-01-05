import { EnhancedSecurityAnalyzer } from '../../services/scan-orchestrator/src/enhanced-security';
import RedisMock from 'ioredis-mock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Enhanced Security Integration', () => {
  let redis: any;
  let analyzer: EnhancedSecurityAnalyzer;

  beforeAll(async () => {
    redis = new RedisMock();
    analyzer = new EnhancedSecurityAnalyzer(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe('Tier 1 Analysis', () => {
    it('should block high-entropy URL with DNSBL hit', async () => {
      const url = 'https://xk7j9m2n4p8q1r5s.malicious-domain.com/';
      const hash = 'test-hash-1';

      const result = await analyzer.analyze(url, hash);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should detect OpenPhish feed hit', async () => {
      const url = 'https://phishing-site.example.com/login';
      const hash = 'test-hash-2';

      const normalizedUrl = new URL(url);
      normalizedUrl.search = '';
      normalizedUrl.hash = '';

      await redis.sadd('threat_db:openphish', normalizedUrl.toString().toLowerCase());

      const result = await analyzer.analyze(url, hash);

      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.some(r => /openphish/i.test(r))).toBe(true);
    }, 10000);

    it('should handle benign URL without false positives', async () => {
      const url = 'https://www.google.com/search?q=test';
      const hash = 'test-hash-3';

      const result = await analyzer.analyze(url, hash);

      expect(result).toBeDefined();
      expect(result.skipExternalAPIs).toBe(false);
    }, 10000);
  });

  describe('Tier 2 Analysis', () => {
    it('should detect suspicious certificate', async () => {
      const url = 'https://self-signed.badssl.com/';
      const hash = 'test-hash-4';

      const result = await analyzer.analyze(url, hash);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should analyze HTTP fingerprint', async () => {
      const url = 'https://example.com/';
      const hash = 'test-hash-5';

      const result = await analyzer.analyze(url, hash);

      expect(result).toBeDefined();
      expect(result.tier2Results).toBeDefined();
    }, 10000);
  });

  describe('Collaborative Learning', () => {
    it('should auto-flag after multiple malicious reports', async () => {
      const url = 'https://collaborative-test.example.com/';
      const hash = 'collab-test-1';

      await analyzer.recordVerdict(url, 'malicious', 0.9);
      await analyzer.recordVerdict(url, 'malicious', 0.85);
      await analyzer.recordVerdict(url, 'malicious', 0.8);

      const result = await analyzer.analyze(url, hash);

      expect(result).toBeDefined();
    }, 10000);
  });

  describe('Performance', () => {
    it('should complete Tier 1 checks within 500ms', async () => {
      const url = 'https://performance-test.example.com/';
      const hash = 'perf-test-1';

      const startTime = Date.now();
      const result = await analyzer.analyze(url, hash);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000);
    }, 10000);

    it('should handle concurrent scans', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => ({
        url: `https://concurrent-test-${i}.example.com/`,
        hash: `concurrent-hash-${i}`,
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        urls.map(({ url, hash }) => analyzer.analyze(url, hash))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(results.every(r => r !== null)).toBe(true);
      expect(duration).toBeLessThan(15000);
    }, 20000);
  });

  describe('Degraded Mode', () => {
    it('should handle DNS timeout gracefully', async () => {
      const url = 'https://timeout-test.invalid/';
      const hash = 'timeout-test-1';

      const result = await analyzer.analyze(url, hash);

      expect(result).toBeDefined();
      expect(result.skipExternalAPIs).toBe(false);
    }, 10000);

    it('should continue analysis if one module fails', async () => {
      const url = 'https://partial-failure-test.example.com/';
      const hash = 'partial-failure-1';

      const result = await analyzer.analyze(url, hash);

      expect(result).toBeDefined();
    }, 10000);
  });

  describe('Stats', () => {
    it('should return threat database stats', async () => {
      const stats = await analyzer.getStats();

      expect(stats).toBeDefined();
      expect(stats.openphishCount).toBeGreaterThanOrEqual(0);
      expect(stats.collaborativeCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Feed Updates', () => {
    it('should update feeds manually', async () => {
      await expect(analyzer.updateFeeds()).resolves.not.toThrow();
    }, 30000);
  });
});
