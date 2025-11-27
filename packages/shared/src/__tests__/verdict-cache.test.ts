import { VerdictCache } from '../verdict-cache';
import type { Logger } from 'pino';

describe('VerdictCache', () => {
  let cache: VerdictCache;
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    cache = new VerdictCache({
      ttlSeconds: 60,
      maxKeys: 100,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    cache.close();
    jest.clearAllMocks();
  });

  test('sets and gets a verdict', () => {
    const hash = 'abc123hash';
    const verdict = {
      verdict: 'malicious' as const,
      confidence: 0.9,
      timestamp: Date.now(),
      sources: ['test'],
    };

    expect(cache.set(hash, verdict)).toBe(true);
    const retrieved = cache.get(hash);
    expect(retrieved).toEqual(verdict);
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ urlHash: hash }), 'Cached verdict');
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ urlHash: hash }), 'Cache hit');
  });

  test('returns undefined for missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ urlHash: 'missing' }), 'Cache miss');
  });

  test('respects ttl', async () => {
    const shortCache = new VerdictCache({ ttlSeconds: 1, checkPeriodSeconds: 1 });
    const hash = 'ttl-test';
    shortCache.set(hash, {
      verdict: 'benign',
      confidence: 1,
      timestamp: Date.now(),
    });

    expect(shortCache.get(hash)).toBeDefined();
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(shortCache.get(hash)).toBeUndefined();
    shortCache.close();
  });

  test('delete removes item', () => {
    const hash = 'del-test';
    cache.set(hash, { verdict: 'benign', confidence: 1, timestamp: Date.now() });
    expect(cache.get(hash)).toBeDefined();
    
    cache.delete(hash);
    expect(cache.get(hash)).toBeUndefined();
  });

  test('clear removes all items', () => {
    cache.set('h1', { verdict: 'benign', confidence: 1, timestamp: Date.now() });
    cache.set('h2', { verdict: 'malicious', confidence: 1, timestamp: Date.now() });
    
    cache.clear();
    expect(cache.get('h1')).toBeUndefined();
    expect(cache.get('h2')).toBeUndefined();
    expect(mockLogger.info).toHaveBeenCalledWith('Verdict cache cleared');
  });

  test('tracks stats correctly', () => {
    cache.set('h1', { verdict: 'benign', confidence: 1, timestamp: Date.now() });
    cache.get('h1'); // hit
    cache.get('h1'); // hit
    cache.get('missing'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(66.67);
    expect(stats.keys).toBe(1);
  });

  test('has checks existence without updating stats', () => {
    cache.set('h1', { verdict: 'benign', confidence: 1, timestamp: Date.now() });
    expect(cache.has('h1')).toBe(true);
    expect(cache.has('missing')).toBe(false);
    
    const stats = cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  test('getTtl returns expiration time', () => {
    const ttl = 100;
    cache.set('h1', { verdict: 'benign', confidence: 1, timestamp: Date.now() }, ttl);
    
    const expiry = cache.getTtl('h1');
    expect(expiry).toBeGreaterThan(Date.now());
    expect(expiry).toBeLessThanOrEqual(Date.now() + ttl * 1000);
  });
});