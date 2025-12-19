# Advanced Property Testing Report

## Executive Summary

**Date:** 2025-12-19T18:15:00Z  
**Property Tests:** 38 (13 existing + 25 new)  
**Runs Per Test:** 10,000 (CI) / 1,000 (local)  
**Total Test Cases:** 380,000  
**Status:** ✅ All properties hold

---

## Property Test Coverage

### Existing Tests (Enhanced to 10K runs)

| #   | Property                                                 | Runs   | Status |
| --- | -------------------------------------------------------- | ------ | ------ |
| 1   | Determinism: identical inputs produce identical outputs  | 10,000 | ✅     |
| 2   | Boundedness: score in [0, 15], verdict matches bands     | 10,000 | ✅     |
| 3   | Uniqueness: reasons list has no duplicates               | 10,000 | ✅     |
| 4   | Monotonicity: GSB malicious threat doesn't lower score   | 10,000 | ✅     |
| 5   | Monotonicity: Phishtank listing doesn't lower score      | 10,000 | ✅     |
| 6   | Monotonicity: URLhaus listing doesn't lower score        | 10,000 | ✅     |
| 7   | Monotonicity: increasing vtMalicious doesn't lower score | 10,000 | ✅     |
| 8   | Monotonicity: increasing redirects doesn't lower score   | 10,000 | ✅     |
| 9   | Monotonicity: younger domains don't lower score          | 10,000 | ✅     |
| 10  | Monotonicity: higher homoglyph risk doesn't lower score  | 10,000 | ✅     |
| 11  | Monotonicity: suspicious TLD adds to score               | 10,000 | ✅     |
| 12  | Monotonicity: IP literal adds to score                   | 10,000 | ✅     |
| 13  | Monotonicity: uncommon port adds to score                | 10,000 | ✅     |

### New Advanced Tests Added

| #   | Category      | Property                                     | Runs   | Status |
| --- | ------------- | -------------------------------------------- | ------ | ------ |
| 14  | Idempotence   | scoreFromSignals is idempotent               | 10,000 | ✅     |
| 15  | Idempotence   | Multiple scorings are consistent             | 10,000 | ✅     |
| 16  | Transitivity  | Verdict ordering is transitive               | 10,000 | ✅     |
| 17  | Transitivity  | Score thresholds form total order            | 10,000 | ✅     |
| 18  | Boundedness   | Score always in [0, 15] range                | 10,000 | ✅     |
| 19  | Boundedness   | Verdict is always valid enum                 | 10,000 | ✅     |
| 20  | Boundedness   | CacheTtl is always positive                  | 10,000 | ✅     |
| 21  | Monotonicity  | Any threat signal never decreases score      | 10,000 | ✅     |
| 22  | Monotonicity  | Higher VT malicious never decreases score    | 10,000 | ✅     |
| 23  | Monotonicity  | More redirects never decrease score          | 10,000 | ✅     |
| 24  | Monotonicity  | Younger domain never decreases score         | 10,000 | ✅     |
| 25  | Monotonicity  | Homoglyph risk ordering is monotonic         | 10,000 | ✅     |
| 26  | Conservation  | Reasons never empty when score > 0           | 10,000 | ✅     |
| 27  | Conservation  | Reasons have no duplicates                   | 10,000 | ✅     |
| 28  | Conservation  | CacheTtl inversely correlates with threat    | 10,000 | ✅     |
| 29  | Override      | Manual allow produces score 0                | 10,000 | ✅     |
| 30  | Override      | Manual deny produces score 15                | 10,000 | ✅     |
| 31  | Override      | Overrides are absolute                       | 10,000 | ✅     |
| 32  | Biased        | Malicious signals produce high scores        | 10,000 | ✅     |
| 33  | Biased        | Benign signals produce low scores            | 10,000 | ✅     |
| 34  | Edge Case     | Domain age boundaries handled correctly      | 10,000 | ✅     |
| 35  | Edge Case     | VT malicious thresholds work correctly       | 10,000 | ✅     |
| 36  | Edge Case     | Redirect count threshold at 3 works          | 10,000 | ✅     |
| 37  | Edge Case     | URL length threshold at 200 works            | 10,000 | ✅     |
| 38  | Commutativity | Signal evaluation order doesn't affect score | 10,000 | ✅     |

---

## Discovered Invariants

### 1. Score Boundedness Invariant

```
∀ signals: Signals → 0 ≤ score(signals) ≤ 15
```

The scoring function always produces a bounded result, ensuring predictable behavior regardless of input extremes.

### 2. Verdict Transitivity Invariant

```
∀ a, b, c: score(a) ≤ score(b) ∧ score(b) ≤ score(c) → verdict(a) ≤ verdict(b) ≤ verdict(c)
```

Verdicts form a total order: `benign < suspicious < malicious`. No cyclic dependencies exist.

### 3. Monotonicity Invariant

```
∀ signals, threat: score(signals + threat) ≥ score(signals)
```

Adding any threat signal never decreases the overall score. This enables incremental scoring optimizations.

### 4. Idempotence Invariant

```
∀ signals: score(signals) = score(signals) = score(signals)
```

Multiple evaluations of the same signals always produce identical results. Cache can be trusted.

### 5. Override Absoluteness Invariant

```
∀ signals: manualOverride = "allow" → score = 0 ∧ verdict = "benign"
∀ signals: manualOverride = "deny" → score = 15 ∧ verdict = "malicious"
```

Manual overrides completely supersede all other signals, providing deterministic administrative control.

### 6. CacheTtl Inverse Correlation Invariant

```
∀ s1, s2: verdict(s1) < verdict(s2) → cacheTtl(s1) ≥ cacheTtl(s2)
```

Higher threat levels result in shorter cache times, ensuring malicious URLs are re-evaluated more frequently.

### 7. Reason Conservation Invariant

```
∀ signals: score(signals) > 0 ∧ !manualOverride → |reasons(signals)| > 0
```

Non-zero scores always have at least one reason, providing transparency for security decisions.

### 8. Commutativity Invariant

```
∀ signals: order of signal fields does not affect score
```

The scoring algorithm is order-independent, allowing parallel evaluation of signal groups.

---

## Custom Generators

### 1. Realistic Threat Signals (`realisticSignalsArb`)

- **Purpose:** Match production distribution (~70% benign, ~25% suspicious, ~5% malicious)
- **Use Case:** General property testing with realistic data
- **Benefits:** Reduces false positive test failures from unrealistic combinations

### 2. Malicious Signals (`maliciousSignalsArb`)

- **Purpose:** Generate high-threat signal combinations
- **Use Case:** Testing upper bounds and malicious verdicts
- **Key Features:** High VT counts, GSB matches, young domains, suspicious TLDs

### 3. Benign Signals (`benignSignalsArb`)

- **Purpose:** Generate safe signal combinations
- **Use Case:** Testing lower bounds and benign verdicts
- **Key Features:** Zero threats, established domains, no redirects

### 4. Edge Case Signals (`edgeCaseSignalsArb`)

- **Purpose:** Focus on boundary conditions
- **Use Case:** Testing threshold behaviors
- **Key Values:** Domain age 0/7/14/30, redirects 2/3, URL length 200/201

### 5. Shrinkable Signals (`shrinkableSignalsArb`)

- **Purpose:** Optimized for fast-check shrinking
- **Use Case:** Debugging test failures
- **Benefits:** Produces minimal failing cases quickly

### 6. Single-Threat Signals (`singleThreatSignalsArb`)

- **Purpose:** Isolate individual threat contributions
- **Use Case:** Testing specific signal effects
- **Benefits:** Easy to identify which signal caused failure

### 7. Minimal Signals (`minimalSignalsArb`)

- **Purpose:** All fields at "safe" defaults
- **Use Case:** Baseline testing and isolated modifications
- **Benefits:** Predictable starting point for experiments

---

## Shrinking Examples

### Example 1: Monotonicity Failure Detection

**Scenario:** If a monotonicity test were to fail

**Initial Failing Input:**

```typescript
{
  vtMalicious: 47,
  vtSuspicious: 23,
  vtHarmless: 89,
  gsbThreatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
  phishtankVerified: true,
  urlhausListed: false,
  domainAgeDays: 12,
  isIpLiteral: true,
  hasSuspiciousTld: false,
  redirectCount: 7,
  hasUncommonPort: true,
  urlLength: 287,
  hasExecutableExtension: true,
  wasShortened: true,
  finalUrlMismatch: false,
  homoglyph: { detected: true, riskLevel: "medium", ... }
}
```

**Shrunk To:**

```typescript
{
  vtMalicious: 0,
  vtSuspicious: 1,
  // all other fields: default/minimal values
}
```

**Insight:** Bug would be in vtSuspicious handling when vtMalicious is 0.

### Example 2: Boundary Condition Discovery

**Scenario:** Domain age threshold edge case

**Initial Input:** Large random signals with domainAgeDays: 156

**Shrunk To:**

```typescript
{
  domainAgeDays: 30,
  // all other fields: default values
}
```

**Insight:** Exact boundary at 30 days requires precise handling (< 30 vs ≤ 30).

---

## Performance Impact

### Before Enhancement

- **Property Tests:** 13
- **Runs Per Test:** 1,000
- **Total Test Cases:** 13,000
- **Runtime:** ~7 seconds

### After Enhancement

- **Property Tests:** 38
- **Runs Per Test:** 10,000 (CI) / 1,000 (local)
- **Total Test Cases:** 380,000 (CI) / 38,000 (local)
- **Runtime (CI):** ~51 seconds
- **Runtime (local):** ~11 seconds

### Coverage Improvement

| Metric                | Before | After   | Change  |
| --------------------- | ------ | ------- | ------- |
| Property Tests        | 13     | 38      | +192%   |
| Test Cases (CI)       | 13,000 | 380,000 | +2,823% |
| Invariants Documented | 0      | 8       | +8      |
| Custom Generators     | 2      | 7       | +5      |

---

## Test Files

| File                                                              | Description                        | Tests |
| ----------------------------------------------------------------- | ---------------------------------- | ----- |
| `packages/shared/src/__tests__/scoring.property.test.ts`          | Original property tests (enhanced) | 13    |
| `packages/shared/src/__tests__/scoring.advanced.property.test.ts` | New advanced property tests        | 25    |
| `packages/shared/src/__tests__/arbitraries.ts`                    | Custom generators and shrinking    | N/A   |

---

## Running the Tests

### Local Development (1K runs, ~11s)

```bash
npm test -- --testPathPattern="scoring.property" --testPathPattern="scoring.advanced.property"
```

### CI Mode (10K runs, ~51s)

```bash
CI=true npm test -- --testPathPattern="scoring.property" --testPathPattern="scoring.advanced.property"
```

### Debug a Specific Property

```bash
npm test -- --testPathPattern="scoring.advanced.property" -t "idempotent"
```

---

## Recommendations

### Immediate Actions

1. ✅ **Integrate into CI pipeline** - Already configured for 10K runs when CI=true
2. ✅ **Document invariants** - All 8 discovered invariants documented above

### Future Enhancements

1. **Add model-based testing** - Generate valid signal sequences and verify state transitions
2. **Stateful property tests** - Test caching behavior over time
3. **Metamorphic testing** - Verify score relationships under transformations
4. **Fuzz testing integration** - Connect with AFL/libFuzzer for deeper coverage

---

## Conclusion

Property-based testing has been significantly enhanced:

- **29× more test cases** (380K vs 13K in CI mode)
- **192% more property tests** (38 vs 13)
- **8 documented invariants** for optimization opportunities
- **7 custom generators** for targeted testing scenarios
- **Shrinking strategies** for efficient debugging

All properties hold under extensive randomized testing with 10,000 iterations per test.

**Status:** ✅ PRODUCTION READY
