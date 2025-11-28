import { LocalThreatDatabase } from '../../src/reputation/local-threat-db';
import RedisMock from 'ioredis-mock';
import { Redis } from 'ioredis';

describe('Local Threat Database', () => {
  let redis: Redis;
  let db: LocalThreatDatabase;

  beforeEach(async () => {
    redis = new RedisMock() as unknown as Redis;
    db = new LocalThreatDatabase(redis, {
      feedUrl: 'https://example.com/feed.txt',
      updateIntervalMs: 60000,
    });
    await redis.flushall();
  });

  afterEach(async () => {
    await db.stop();
    await redis.quit();
  });

  describe('check', () => {
    it('should return zero score for unknown URL', async () => {
      const result = await db.check('https://example.com/test', 'hash123');

      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it('should detect exact URL match in OpenPhish', async () => {
      const url = 'https://malicious.example.com/phishing';
      // Implementation normalizes URL (lowercase, no search/hash)
      const normalizedUrl = url.toLowerCase();

      // Add to OpenPhish set
      await redis.sadd('threat_db:openphish', normalizedUrl);

      const result = await db.check(url, 'hash123');

      expect(result.score).toBeGreaterThan(0);
      expect(result.openphishMatch).toBe(true);
      expect(result.reasons).toContain('URL found in OpenPhish feed');
    });

    // Domain match is not currently implemented in LocalThreatDatabase
    // it('should detect domain match', async () => { ... });
  });

  describe('recordVerdict', () => {
    it('should record verdict', async () => {
      const url = 'https://example.com/test';

      await db.recordVerdict(url, 'malicious', 0.9);

      const score = await redis.zscore('threat_db:collaborative', url.toLowerCase());
      expect(Number(score)).toBe(0.9);
    });

    it('should update score with new verdict', async () => {
      const url = 'https://example.com/test';

      await db.recordVerdict(url, 'malicious', 0.5);
      await db.recordVerdict(url, 'malicious', 0.8);

      const score = await redis.zscore('threat_db:collaborative', url.toLowerCase());
      expect(Number(score)).toBe(0.8);
    });
  });

  describe('getStats', () => {
    it('should return stats', async () => {
      await redis.sadd('threat_db:openphish', 'url1');
      await redis.zadd('threat_db:collaborative', 1, 'url2');

      const stats = await db.getStats();

      expect(stats).toBeDefined();
      expect(stats.openphishCount).toBe(1);
      expect(stats.collaborativeCount).toBe(1);
    });
  });

  describe('collaborative learning', () => {
    it('should flag if collaborative score is high enough', async () => {
      const url = 'https://example.com/suspicious';
      const normalizedUrl = url.toLowerCase();

      // Set score > 0.7
      await redis.zadd('threat_db:collaborative', 0.8, normalizedUrl);

      const result = await db.check(url, 'hash123');

      expect(result.score).toBeGreaterThan(0);
      expect(result.collaborativeMatch).toBe(true);
      expect(result.reasons).toContain('URL flagged by collaborative learning');
    });

    it('should not flag if collaborative score is low', async () => {
      const url = 'https://example.com/maybe-suspicious';
      const normalizedUrl = url.toLowerCase();

      // Set score <= 0.7
      await redis.zadd('threat_db:collaborative', 0.5, normalizedUrl);

      const result = await db.check(url, 'hash123');

      expect(result.score).toBe(0);
      expect(result.collaborativeMatch).toBeUndefined();
    });
  });
});
