# Test Suite Recommendations

## Executive Summary

This document provides actionable recommendations for maintaining and improving the test suite based on the comprehensive verification audit.

---

## Priority 1: Critical (Implement Immediately)

### 1.1 Fix Worker Process Leaks
**Issue:** Tests leak timers/handles causing graceful exit failures  
**Impact:** CI reliability  
**Action:**
```bash
npm test -- --detectOpenHandles
```
Then add cleanup in affected test files.

### 1.2 Update ts-jest Configuration
**Issue:** Deprecated `globals` config warning  
**Impact:** Future compatibility  
**Action:** Update jest.config.js files:
```javascript
transform: {
  '^.+\\.tsx?$': ['ts-jest', { /* ts-jest options */ }],
},
```

---

## Priority 2: High (Implement This Sprint)

### 2.1 Improve wa-client Coverage
**Current:** ~87% lines  
**Target:** 90% lines  
**Files needing attention:**
- `session/cleanup.ts` (73.74%)
- `baileys-adapter.ts` (51.04% branches)
- `crypto/dataKeyProvider.ts` (70.37% branches)

### 2.2 Add Integration Tests with Real Dependencies
**Current:** All tests use mocks  
**Recommendation:** Add integration test suite with:
- Real Redis instance (via testcontainers)
- Real PostgreSQL instance
- Actual BullMQ queue processing

### 2.3 Increase Property Test Iterations
**Current:** 1000 runs  
**Recommendation:** 10,000 runs in CI, 100 in local dev
```typescript
const numRuns = process.env.CI ? 10000 : 100;
```

---

## Priority 3: Medium (Implement This Quarter)

### 3.1 Integrate Stryker Mutation Testing
**Current:** Manual mutation testing (84% score)  
**Recommendation:** Add Stryker to CI
```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner
```

### 3.2 Add Contract Tests for External APIs
**APIs needing contracts:**
- VirusTotal API
- Google Safe Browsing API
- URLScan.io API
- Phishtank API

**Tool:** Pact or similar contract testing framework

### 3.3 Add Chaos Testing
**Scenarios:**
- Redis connection failures
- Database timeout simulation
- External API rate limiting
- Queue processing delays

### 3.4 Add Visual Regression Tests
**For:** URLScan artifacts (screenshots, DOM captures)  
**Tool:** Percy or Playwright visual comparisons

---

## Priority 4: Low (Backlog)

### 4.1 Add Benchmark Tests
```typescript
describe('Performance benchmarks', () => {
  it('scoreFromSignals completes in <1ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      scoreFromSignals({ gsbThreatTypes: ['MALWARE'] });
    }
    const elapsed = performance.now() - start;
    expect(elapsed / 1000).toBeLessThan(1);
  });
});
```

### 4.2 Add Fuzz Testing
**Tool:** fast-check with more aggressive generators
**Target:** URL parser, scoring algorithm, validation logic

### 4.3 Add Accessibility Testing
**For:** SafeMode web app components
**Tool:** jest-axe

---

## Test Quality Standards

### Naming Conventions
```typescript
// ✅ Good
test('rejects private IP 10.x.x.x with high risk level')
test('scoreFromSignals returns malicious for GSB threats')

// ❌ Bad
test('test1')
test('should work')
```

### Assertion Quality
```typescript
// ✅ Good - exact value assertions
expect(result.score).toBe(10);
expect(result.level).toBe('malicious');

// ❌ Bad - vague assertions
expect(result.score).toBeGreaterThan(0);
expect(result).toBeTruthy();
```

### Test Isolation
```typescript
describe('MyModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  // tests...
});
```

---

## CI Pipeline Recommendations

### Test Stages
```yaml
test:
  stage: test
  parallel:
    matrix:
      - WORKSPACE: [shared, scan-orchestrator, control-plane, wa-client]
  script:
    - npm test --workspace=packages/$WORKSPACE -- --coverage
```

### Quality Gates
```yaml
coverage:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - npm test -- --coverage
    - |
      COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
      if (( $(echo "$COVERAGE < 90" | bc -l) )); then
        echo "Coverage $COVERAGE% is below 90% threshold"
        exit 1
      fi
```

### Mutation Testing Gate
```yaml
mutation:
  stage: quality
  script:
    - ./scripts/mutation-test.sh
  allow_failure: false
```

---

## Metrics to Track

| Metric | Current | Target | Tracking |
|--------|---------|--------|----------|
| Line Coverage | 90%+ | 95% | Per-commit |
| Branch Coverage | 82%+ | 90% | Per-commit |
| Mutation Score | 84% | 90% | Weekly |
| Test Runtime | ~65s | <45s | Per-commit |
| Flakiness Rate | ~1% | 0% | Weekly |
| Security Tests | 17 | 25+ | Per-sprint |

---

## Next Steps

1. ✅ Commit all new tests and reports
2. Schedule wa-client coverage improvement sprint
3. Set up Stryker mutation testing in CI
4. Add integration test infrastructure
5. Implement contract tests for external APIs

---

## Conclusion

The test suite has been significantly improved with 31 new tests, 84% mutation score, and comprehensive security coverage. Following these recommendations will maintain and further improve test quality.
