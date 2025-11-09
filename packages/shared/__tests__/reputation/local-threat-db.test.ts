import { LocalThreatDatabase } from '../../src/reputation/local-threat-db';
import RedisMock from 'ioredis-mock';

describe('Local Threat Database', () => {
  let redis: any;
  let db: LocalThreatDatabase;

  beforeEach(() => {
    redis = new RedisMock();
    db = new LocalThreatDatabase(redis, {
      feedUrl: 'https://example.com/feed.txt',
      updateIntervalMs: 60000,
    });
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

    it('should detect exact URL match', async () => {
      const url = 'https://malicious.example.com/phishing';
      const hash = 'abc123';

      await redis.set(`threat:feed:${hash}`, JSON.stringify({
        url,
        urlHash: hash,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        confidence: 0.9,
        tags: ['openphish'],
      }), 'EX', 86400);

      const result = await db.check(url, hash);

      expect(result.score).toBeGreaterThan(0);
      expect(result.matchType).toBe('exact');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect domain match', async () => {
      const domain = 'malicious.example.com';
      const hash1 = 'hash1';
      const hash2 = 'hash2';

      await redis.sadd(`threat:domain:${domain}`, hash1);
      await redis.sadd(`threat:domain:${domain}`, hash2);

      const result = await db.check(`https://${domain}/different-path`, 'hash3');

      expect(result.score).toBeGreaterThan(0);
      expect(result.matchType).toBe('domain');
    });
  });

  describe('recordVerdict', () => {
    it('should record verdict', async () => {
      const url = 'https://example.com/test';
      
      await db.recordVerdict(url, 'malicious', 0.9);

      const keys = await redis.keys('threat:collaborative:*');
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should accumulate multiple verdicts', async () => {
      const url = 'https://example.com/test';
      
      await db.recordVerdict(url, 'malicious', 0.9);
      await db.recordVerdict(url, 'malicious', 0.8);
      await db.recordVerdict(url, 'malicious', 0.85);

      const keys = await redis.keys('threat:collaborative:*');
      expect(keys.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return stats', async () => {
      const stats = await db.getStats();

      expect(stats).toBeDefined();
      expect(stats.openphishCount).toBeGreaterThanOrEqual(0);
      expect(stats.collaborativeCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('collaborative learning', () => {
    it('should auto-flag after 3 malicious reports', async () => {
      const url = 'https://example.com/suspicious';
      const hash = 'collab123';

      const collaborative = {
        urlHash: hash,
        verdictHistory: [
          { verdict: 'malicious', timestamp: Date.now(), confidence: 0.9 },
          { verdict: 'malicious', timestamp: Date.now(), confidence: 0.85 },
          { verdict: 'malicious', timestamp: Date.now(), confidence: 0.8 },
        ],
        reportCount: 3,
      };

      await redis.set(`threat:collaborative:${hash}`, JSON.stringify(collaborative), 'EX', 7776000);

      const result = await db.check(url, hash);

      expect(result.score).toBeGreaterThan(0);
      expect(result.matchType).toBe('collaborative');
    });

    it('should not auto-flag with insufficient reports', async () => {
      const url = 'https://example.com/maybe-suspicious';
      const hash = 'collab456';

      const collaborative = {
        urlHash: hash,
        verdictHistory: [
          { verdict: 'malicious', timestamp: Date.now(), confidence: 0.9 },
          { verdict: 'benign', timestamp: Date.now(), confidence: 0.7 },
        ],
        reportCount: 2,
      };

      await redis.set(`threat:collaborative:${hash}`, JSON.stringify(collaborative), 'EX', 7776000);

      const result = await db.check(url, hash);

      expect(result.score).toBe(0);
    });
  });
});
