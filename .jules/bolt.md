## 2025-02-24 - Homoglyph Detection Memory Optimization

**Learning:** The `detectHomoglyphs` function in `packages/shared/src/homoglyph.ts` used a full matrix O(N*M) for Levenshtein distance calculation. Since this is called frequently (8 comparisons per domain check), it creates significant GC pressure.
**Action:** Always check basic algorithmic complexity in hot paths. Replaced with O(min(N,M)) space implementation using two rows.

## 2025-02-26 - Regex and Set Hoisting in Hot Paths

**Learning:** Re-creating `RegExp` objects and `Set` collections inside frequently called functions (like `extractUrls`, `advancedHeuristics`, `isSuspiciousTld`) adds unnecessary allocation overhead.
**Action:** Hoist static regexes and sets to the module scope to reuse instances. This is especially impactful for `extractUrls` which is called on every message.
