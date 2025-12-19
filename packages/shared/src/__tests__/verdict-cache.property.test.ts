/**
 * Stateful Property-Based Tests for VerdictCache
 *
 * Tests cache behavior over time:
 * - Set/Get consistency
 * - TTL expiration
 * - Hit/miss statistics
 * - Cache eviction
 */

import { describe, expect, test, afterEach } from "@jest/globals";
import fc from "fast-check";
import { VerdictCache, type CachedVerdict } from "../verdict-cache";

const NUM_RUNS = process.env.CI ? 5000 : 500;

const verdictArb: fc.Arbitrary<CachedVerdict> = fc.record({
  verdict: fc.constantFrom("benign", "suspicious", "malicious"),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  timestamp: fc.nat(Date.now()),
  sources: fc.option(fc.array(fc.asciiString({ minLength: 1, maxLength: 20 }), { maxLength: 5 }), {
    nil: undefined,
  }),
});

const urlHashArb = fc.hexaString({ minLength: 64, maxLength: 64 });

describe("VerdictCache - Stateful Property Tests", () => {
  let cache: VerdictCache;

  afterEach(() => {
    if (cache) {
      cache.close();
    }
  });

  describe("Set/Get Consistency", () => {
    test("PROPERTY: Get returns what was set", () => {
      fc.assert(
        fc.property(urlHashArb, verdictArb, (hash, verdict) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          cache.set(hash, verdict);
          const retrieved = cache.get(hash);

          expect(retrieved).toEqual(verdict);
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Get on non-existent key returns undefined", () => {
      fc.assert(
        fc.property(urlHashArb, (hash) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          const retrieved = cache.get(hash);

          expect(retrieved).toBeUndefined();
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Set returns true on success", () => {
      fc.assert(
        fc.property(urlHashArb, verdictArb, (hash, verdict) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          const success = cache.set(hash, verdict);

          expect(success).toBe(true);
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Has returns true after set", () => {
      fc.assert(
        fc.property(urlHashArb, verdictArb, (hash, verdict) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          expect(cache.has(hash)).toBe(false);
          cache.set(hash, verdict);
          expect(cache.has(hash)).toBe(true);
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Delete Operations", () => {
    test("PROPERTY: Delete removes the entry", () => {
      fc.assert(
        fc.property(urlHashArb, verdictArb, (hash, verdict) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          cache.set(hash, verdict);
          expect(cache.has(hash)).toBe(true);
          
          cache.delete(hash);
          expect(cache.has(hash)).toBe(false);
          expect(cache.get(hash)).toBeUndefined();
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Delete on non-existent key returns 0", () => {
      fc.assert(
        fc.property(urlHashArb, (hash) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          const count = cache.delete(hash);
          expect(count).toBe(0);
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Clear Operations", () => {
    test("PROPERTY: Clear removes all entries", () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(urlHashArb, verdictArb), { minLength: 1, maxLength: 10 }),
          (entries) => {
            cache = new VerdictCache({ ttlSeconds: 3600 });
            
            for (const [hash, verdict] of entries) {
              cache.set(hash, verdict);
            }

            const statsBefore = cache.getStats();
            expect(statsBefore.keys).toBe(entries.length);

            cache.clear();

            const statsAfter = cache.getStats();
            expect(statsAfter.keys).toBe(0);
            expect(statsAfter.hits).toBe(0);
            expect(statsAfter.misses).toBe(0);
            cache.close();
          },
        ),
        { numRuns: Math.min(NUM_RUNS, 100) },
      );
    });
  });

  describe("Statistics Properties", () => {
    test("PROPERTY: Hit count increases on cache hit", () => {
      fc.assert(
        fc.property(urlHashArb, verdictArb, fc.nat(10), (hash, verdict, reads) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          cache.set(hash, verdict);
          
          const numReads = Math.min(reads, 10);
          for (let i = 0; i < numReads; i++) {
            cache.get(hash);
          }

          const stats = cache.getStats();
          expect(stats.hits).toBe(numReads);
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Miss count increases on cache miss", () => {
      fc.assert(
        fc.property(urlHashArb, fc.nat(10), (hash, reads) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          const numReads = Math.min(reads, 10);
          for (let i = 0; i < numReads; i++) {
            cache.get(hash);
          }

          const stats = cache.getStats();
          expect(stats.misses).toBe(numReads);
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });

    test("PROPERTY: Hit rate is calculated correctly", () => {
      fc.assert(
        fc.property(
          urlHashArb,
          verdictArb,
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (hash, verdict, hits, misses) => {
            cache = new VerdictCache({ ttlSeconds: 3600 });
            
            cache.set(hash, verdict);

            for (let i = 0; i < hits; i++) {
              cache.get(hash);
            }

            const nonExistentHash = hash.split('').reverse().join('');
            for (let i = 0; i < misses; i++) {
              cache.get(nonExistentHash);
            }

            const stats = cache.getStats();
            const expectedHitRate = (hits / (hits + misses)) * 100;

            expect(stats.hitRate).toBeCloseTo(expectedHitRate, 0);
            cache.close();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Overwrite Properties", () => {
    test("PROPERTY: Later set overwrites earlier set", () => {
      fc.assert(
        fc.property(urlHashArb, verdictArb, verdictArb, (hash, verdict1, verdict2) => {
          cache = new VerdictCache({ ttlSeconds: 3600 });
          
          cache.set(hash, verdict1);
          cache.set(hash, verdict2);

          const retrieved = cache.get(hash);
          expect(retrieved).toEqual(verdict2);
          cache.close();
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("TTL Properties", () => {
    test("PROPERTY: Custom TTL is applied", () => {
      fc.assert(
        fc.property(
          urlHashArb,
          verdictArb,
          fc.integer({ min: 10, max: 3600 }),
          (hash, verdict, ttl) => {
            cache = new VerdictCache({ ttlSeconds: 1 });
            
            cache.set(hash, verdict, ttl);

            const retrievedTtl = cache.getTtl(hash);
            expect(retrievedTtl).toBeDefined();
            cache.close();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe("Sequence Properties", () => {
    test("PROPERTY: Random operations maintain consistency", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.tuple(fc.constant("set" as const), urlHashArb, verdictArb),
              fc.tuple(fc.constant("get" as const), urlHashArb),
              fc.tuple(fc.constant("delete" as const), urlHashArb),
              fc.tuple(fc.constant("has" as const), urlHashArb),
            ),
            { minLength: 1, maxLength: 20 },
          ),
          (operations) => {
            cache = new VerdictCache({ ttlSeconds: 3600 });
            const model = new Map<string, CachedVerdict>();

            for (const op of operations) {
              if (op[0] === "set") {
                const [, hash, verdict] = op as ["set", string, CachedVerdict];
                cache.set(hash, verdict);
                model.set(hash, verdict);
              } else if (op[0] === "get") {
                const [, hash] = op as ["get", string];
                const cacheResult = cache.get(hash);
                const modelResult = model.get(hash);
                expect(cacheResult).toEqual(modelResult);
              } else if (op[0] === "delete") {
                const [, hash] = op as ["delete", string];
                cache.delete(hash);
                model.delete(hash);
              } else if (op[0] === "has") {
                const [, hash] = op as ["has", string];
                expect(cache.has(hash)).toBe(model.has(hash));
              }
            }

            cache.close();
          },
        ),
        { numRuns: Math.min(NUM_RUNS, 500) },
      );
    });
  });
});
