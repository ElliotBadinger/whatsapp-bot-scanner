import { describe, it, expect, beforeEach } from 'vitest';
import { VerdictCache, type CachedVerdict } from '../src/verdict-cache';

describe('VerdictCache', () => {
    let cache: VerdictCache;

    beforeEach(() => {
        cache = new VerdictCache({
            ttlSeconds: 60,
            maxKeys: 100,
        });
    });

    afterEach(() => {
        cache.close();
    });

    it('should cache and retrieve verdicts', () => {
        const verdict: CachedVerdict = {
            verdict: 'malicious',
            confidence: 0.95,
            timestamp: Date.now(),
            sources: ['virustotal', 'gsb'],
        };

        const urlHash = 'test-hash-123';
        cache.set(urlHash, verdict);

        const retrieved = cache.get(urlHash);
        expect(retrieved).toEqual(verdict);
    });

    it('should return undefined for cache miss', () => {
        const result = cache.get('non-existent-hash');
        expect(result).toBeUndefined();
    });

    it('should track hit and miss statistics', () => {
        const verdict: CachedVerdict = {
            verdict: 'benign',
            confidence: 0.8,
            timestamp: Date.now(),
        };

        cache.set('hash1', verdict);

        cache.get('hash1'); // hit
        cache.get('hash2'); // miss
        cache.get('hash1'); // hit

        const stats = cache.getStats();
        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(1);
        expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should delete cached verdicts', () => {
        const verdict: CachedVerdict = {
            verdict: 'suspicious',
            confidence: 0.6,
            timestamp: Date.now(),
        };

        cache.set('hash1', verdict);
        expect(cache.has('hash1')).toBe(true);

        cache.delete('hash1');
        expect(cache.has('hash1')).toBe(false);
    });

    it('should clear all cached verdicts', () => {
        cache.set('hash1', { verdict: 'benign', confidence: 0.9, timestamp: Date.now() });
        cache.set('hash2', { verdict: 'malicious', confidence: 0.95, timestamp: Date.now() });

        const statsBefore = cache.getStats();
        expect(statsBefore.keys).toBe(2);

        cache.clear();

        const statsAfter = cache.getStats();
        expect(statsAfter.keys).toBe(0);
        expect(statsAfter.hits).toBe(0);
        expect(statsAfter.misses).toBe(0);
    });

    it('should respect TTL', async () => {
        const shortTtlCache = new VerdictCache({
            ttlSeconds: 1, // 1 second TTL
        });

        const verdict: CachedVerdict = {
            verdict: 'benign',
            confidence: 0.8,
            timestamp: Date.now(),
        };

        shortTtlCache.set('hash1', verdict);
        expect(shortTtlCache.has('hash1')).toBe(true);

        // Wait for TTL to expire
        await new Promise(resolve => setTimeout(resolve, 1500));

        expect(shortTtlCache.has('hash1')).toBe(false);

        shortTtlCache.close();
    });

    it('should support custom TTL per entry', () => {
        const verdict: CachedVerdict = {
            verdict: 'malicious',
            confidence: 0.95,
            timestamp: Date.now(),
        };

        cache.set('hash1', verdict, 120); // 2 minutes TTL

        const ttl = cache.getTtl('hash1');
        expect(ttl).toBeDefined();
        expect(ttl).toBeGreaterThan(0);
    });
});
