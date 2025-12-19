#!/bin/bash
# Comprehensive Mutation Testing Script
# Tests that mutations in critical code are caught by tests

set -e
cd "$(dirname "$0")/.."

MUTATIONS_KILLED=0
MUTATIONS_SURVIVED=0
MUTATIONS_TOTAL=0

test_mutation() {
    local file="$1"
    local search="$2"
    local replace="$3"
    local description="$4"
    
    MUTATIONS_TOTAL=$((MUTATIONS_TOTAL + 1))
    echo "Testing mutation $MUTATIONS_TOTAL: $description"
    
    # Apply mutation
    sed -i "s|$search|$replace|" "$file"
    
    # Run tests
    if npm test --workspace=packages/shared -- --silent 2>&1 | grep -q "FAIL"; then
        echo "  ✅ KILLED - Tests caught the mutation"
        MUTATIONS_KILLED=$((MUTATIONS_KILLED + 1))
    else
        echo "  ❌ SURVIVED - Tests did NOT catch the mutation"
        MUTATIONS_SURVIVED=$((MUTATIONS_SURVIVED + 1))
    fi
    
    # Revert mutation
    git checkout -- "$file"
}

echo "=== Comprehensive Mutation Testing ==="
echo ""

# Scoring module mutations
echo "--- packages/shared/src/scoring.ts ---"
test_mutation "packages/shared/src/scoring.ts" "domainAgeDays < 7" "domainAgeDays <= 7" "Domain age boundary (< to <=)"
test_mutation "packages/shared/src/scoring.ts" "domainAgeDays < 14" "domainAgeDays < 15" "Domain age 14 day boundary"
test_mutation "packages/shared/src/scoring.ts" "score += 10" "score += 11" "GSB score increment"
test_mutation "packages/shared/src/scoring.ts" "score += 8" "score += 9" "VT malicious score increment"
test_mutation "packages/shared/src/scoring.ts" "finalScore <= 3" "finalScore <= 4" "Benign threshold"
test_mutation "packages/shared/src/scoring.ts" "finalScore <= 7" "finalScore <= 8" "Suspicious threshold"
test_mutation "packages/shared/src/scoring.ts" "vtMalicious >= 3" "vtMalicious >= 4" "VT malicious threshold"
test_mutation "packages/shared/src/scoring.ts" "(signals.redirectCount ?? 0) >= 3" "(signals.redirectCount ?? 0) >= 4" "Redirect count threshold"

# Validation module mutations
echo ""
echo "--- packages/shared/src/validation.ts ---"
test_mutation "packages/shared/src/validation.ts" "http:" "https:" "Protocol check mutation"
test_mutation "packages/shared/src/validation.ts" '/^10\\.\\/,' '/^11\\.\\/,' "Private IP 10.x check"
test_mutation "packages/shared/src/validation.ts" '/^127\\.\\/,' '/^128\\.\\/,' "Loopback IP check"

# Circuit breaker mutations
echo ""
echo "--- packages/shared/src/circuit-breaker.ts ---"
test_mutation "packages/shared/src/circuit-breaker.ts" "this.failures.length >=" "this.failures.length >" "Failure threshold boundary"
test_mutation "packages/shared/src/circuit-breaker.ts" "now - this.lastAttempt" "now + this.lastAttempt" "Recovery time calculation"

echo ""
echo "=== Mutation Testing Summary ==="
echo "Total mutations: $MUTATIONS_TOTAL"
echo "Killed: $MUTATIONS_KILLED"
echo "Survived: $MUTATIONS_SURVIVED"
echo "Mutation Score: $((MUTATIONS_KILLED * 100 / MUTATIONS_TOTAL))%"

if [ $MUTATIONS_SURVIVED -gt 0 ]; then
    echo ""
    echo "⚠️  Some mutations survived - tests need strengthening"
    exit 1
else
    echo ""
    echo "✅ All mutations killed - excellent test coverage"
    exit 0
fi
