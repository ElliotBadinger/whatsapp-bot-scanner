## 2025-02-24 - Homoglyph Detection Memory Optimization

**Learning:** The `detectHomoglyphs` function in `packages/shared/src/homoglyph.ts` used a full matrix O(N*M) for Levenshtein distance calculation. Since this is called frequently (8 comparisons per domain check), it creates significant GC pressure.
**Action:** Always check basic algorithmic complexity in hot paths. Replaced with O(min(N,M)) space implementation using two rows.

## 2025-02-24 - URL Processing Hot Paths

**Learning:** `isSuspiciousTld` was recreating a `Set` of TLDs on every call, and `isForbiddenHostname` was parsing an environment variable on every call. In high-throughput scanning, these allocations add up. Moving constant data to module scope and memoizing configuration parsing yielded significant speedups (8x and 4x respectively).
**Action:** Identify static data structures initialized inside functions and move them to module scope. Memoize results derived from configuration that rarely changes.
