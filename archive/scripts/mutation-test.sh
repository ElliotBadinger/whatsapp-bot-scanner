#!/bin/bash
# Comprehensive Mutation Testing Script v2.0
# Tests 50+ mutations across critical security modules
# Target: 85%+ mutation score

set -e
cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

MUTATIONS_KILLED=0
MUTATIONS_SURVIVED=0
MUTATIONS_ERROR=0
MUTATIONS_TOTAL=0
RESULTS_LOG=""
SURVIVED_LIST=""

# Track results by module
declare -A MODULE_KILLED
declare -A MODULE_TOTAL

log_result() {
    local status="$1"
    local module="$2"
    local description="$3"
    local mutation="$4"
    RESULTS_LOG="${RESULTS_LOG}| ${MUTATIONS_TOTAL} | ${module} | ${description} | ${mutation} | ${status} |\n"
}

test_mutation() {
    local file="$1"
    local search="$2"
    local replace="$3"
    local description="$4"
    local workspace="$5"
    
    MUTATIONS_TOTAL=$((MUTATIONS_TOTAL + 1))
    local module=$(basename "$file" .ts)
    MODULE_TOTAL[$module]=$((${MODULE_TOTAL[$module]:-0} + 1))
    
    printf "${BLUE}[%02d]${NC} Testing: %s\n" "$MUTATIONS_TOTAL" "$description"
    printf "     File: %s\n" "$file"
    printf "     Mutation: '%s' → '%s'\n" "$search" "$replace"
    
    # Create backup
    cp "$file" "${file}.bak" 2>/dev/null || true
    
    # Apply mutation
    if ! sed -i "s|${search}|${replace}|" "$file" 2>/dev/null; then
        echo -e "     ${YELLOW}⚠️  ERROR - sed pattern failed${NC}"
        MUTATIONS_ERROR=$((MUTATIONS_ERROR + 1))
        mv "${file}.bak" "$file" 2>/dev/null || git checkout -- "$file"
        log_result "⚠️ ERROR" "$module" "$description" "\`$search\` → \`$replace\`"
        return
    fi
    
    # Check if file was actually changed
    if diff -q "$file" "${file}.bak" > /dev/null 2>&1; then
        echo -e "     ${YELLOW}⚠️  ERROR - Pattern not found in file${NC}"
        MUTATIONS_ERROR=$((MUTATIONS_ERROR + 1))
        mv "${file}.bak" "$file" 2>/dev/null || git checkout -- "$file"
        log_result "⚠️ ERROR" "$module" "$description" "\`$search\` → \`$replace\`"
        return
    fi
    
    # Run tests for the specific workspace
    local test_output
    local test_exit_code=0
    test_output=$(npm test --workspace="$workspace" 2>&1) || test_exit_code=$?
    
    if [ $test_exit_code -ne 0 ] || echo "$test_output" | grep -qE "(FAIL|failed|Error:)"; then
        echo -e "     ${GREEN}✅ KILLED - Tests caught the mutation${NC}"
        MUTATIONS_KILLED=$((MUTATIONS_KILLED + 1))
        MODULE_KILLED[$module]=$((${MODULE_KILLED[$module]:-0} + 1))
        log_result "✅ KILLED" "$module" "$description" "\`$search\` → \`$replace\`"
    else
        echo -e "     ${RED}❌ SURVIVED - Tests did NOT catch the mutation${NC}"
        MUTATIONS_SURVIVED=$((MUTATIONS_SURVIVED + 1))
        SURVIVED_LIST="${SURVIVED_LIST}\n- **Mutation ${MUTATIONS_TOTAL}:** $description in $file"
        log_result "❌ SURVIVED" "$module" "$description" "\`$search\` → \`$replace\`"
    fi
    
    # Revert mutation
    mv "${file}.bak" "$file" 2>/dev/null || git checkout -- "$file"
}

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     COMPREHENSIVE MUTATION TESTING - WhatsApp Bot Scanner      ║"
echo "║                    Target: 50+ mutations, 85%+ score           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Starting mutation testing at $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ============================================================================
# PRIORITY 1: packages/shared/src/scoring.ts (15 mutations)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MODULE 1: packages/shared/src/scoring.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Domain age thresholds
test_mutation "packages/shared/src/scoring.ts" \
    "domainAgeDays < 7" "domainAgeDays <= 7" \
    "Domain age 7-day boundary (< vs <=)" \
    "packages/shared"

test_mutation "packages/shared/src/scoring.ts" \
    "domainAgeDays < 14" "domainAgeDays <= 14" \
    "Domain age 14-day boundary (< vs <=)" \
    "packages/shared"

test_mutation "packages/shared/src/scoring.ts" \
    "domainAgeDays < 30" "domainAgeDays <= 30" \
    "Domain age 30-day boundary (< vs <=)" \
    "packages/shared"

# Score increments for blocklist signals
test_mutation "packages/shared/src/scoring.ts" \
    "score += 10;" "score += 11;" \
    "GSB malicious score increment (+10 vs +11)" \
    "packages/shared"

test_mutation "packages/shared/src/scoring.ts" \
    "score += 8;" "score += 9;" \
    "VT malicious >=3 score (+8 vs +9)" \
    "packages/shared"

test_mutation "packages/shared/src/scoring.ts" \
    "score += 5;" "score += 6;" \
    "VT malicious 1-2 score (+5 vs +6)" \
    "packages/shared"

test_mutation "packages/shared/src/scoring.ts" \
    "score += 6;" "score += 7;" \
    "Domain age <7 days score (+6 vs +7)" \
    "packages/shared"

test_mutation "packages/shared/src/scoring.ts" \
    "score += 4;" "score += 5;" \
    "Domain age 7-14 days score (+4 vs +5)" \
    "packages/shared"

# Verdict threshold mutations
test_mutation "packages/shared/src/scoring.ts" \
    "finalScore <= 3" "finalScore <= 4" \
    "Benign threshold boundary (<=3 vs <=4)" \
    "packages/shared"

test_mutation "packages/shared/src/scoring.ts" \
    "finalScore <= 7" "finalScore <= 8" \
    "Suspicious threshold boundary (<=7 vs <=8)" \
    "packages/shared"

# VT threshold mutations
test_mutation "packages/shared/src/scoring.ts" \
    "vtMalicious >= 3" "vtMalicious >= 4" \
    "VT malicious threshold (>=3 vs >=4)" \
    "packages/shared"

test_mutation "packages/shared/src/scoring.ts" \
    "vtMalicious >= 1" "vtMalicious >= 2" \
    "VT malicious minimum threshold (>=1 vs >=2)" \
    "packages/shared"

# Redirect count threshold
test_mutation "packages/shared/src/scoring.ts" \
    "redirectCount ?? 0) >= 3" "redirectCount ?? 0) >= 4" \
    "Redirect count threshold (>=3 vs >=4)" \
    "packages/shared"

# Homoglyph score mutations
test_mutation "packages/shared/src/scoring.ts" \
    "score += 3;" "score += 4;" \
    "Homoglyph medium risk score (+3 vs +4)" \
    "packages/shared"

# Manual override return values
test_mutation "packages/shared/src/scoring.ts" \
    "score: 15," "score: 14," \
    "Manual deny override score (15 vs 14)" \
    "packages/shared"

# ============================================================================
# PRIORITY 1: packages/shared/src/validation.ts (10 mutations)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MODULE 2: packages/shared/src/validation.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Protocol validation
test_mutation "packages/shared/src/validation.ts" \
    "'http:', 'https:'" "'https:'" \
    "Remove HTTP protocol from allowed list" \
    "packages/shared"

# Private IP ranges
test_mutation "packages/shared/src/validation.ts" \
    "/^10\\./" "/^11\\./" \
    "Private IP 10.x.x.x regex (10 vs 11)" \
    "packages/shared"

test_mutation "packages/shared/src/validation.ts" \
    "/^192\\.168\\./" "/^192\\.169\\./" \
    "Private IP 192.168.x.x regex (168 vs 169)" \
    "packages/shared"

test_mutation "packages/shared/src/validation.ts" \
    "/^127\\./" "/^128\\./" \
    "Loopback IP 127.x.x.x regex (127 vs 128)" \
    "packages/shared"

test_mutation "packages/shared/src/validation.ts" \
    "/^169\\.254\\./" "/^169\\.255\\./" \
    "Link-local IP 169.254.x.x regex (254 vs 255)" \
    "packages/shared"

# Hostname validation
test_mutation "packages/shared/src/validation.ts" \
    "url.hostname.length > 253" "url.hostname.length > 254" \
    "Hostname length limit (253 vs 254)" \
    "packages/shared"

test_mutation "packages/shared/src/validation.ts" \
    "url.toString().length > 2048" "url.toString().length > 2049" \
    "URL length limit (2048 vs 2049)" \
    "packages/shared"

# Risk level assignment
test_mutation "packages/shared/src/validation.ts" \
    "riskLevel = 'high'" "riskLevel = 'medium'" \
    "Private IP risk level (high vs medium)" \
    "packages/shared"

test_mutation "packages/shared/src/validation.ts" \
    "riskLevel = 'medium'" "riskLevel = 'low'" \
    "Suspicious TLD risk level (medium vs low)" \
    "packages/shared"

test_mutation "packages/shared/src/validation.ts" \
    "errors.length === 0" "errors.length === 1" \
    "Validation success condition (0 vs 1 errors)" \
    "packages/shared"

# ============================================================================
# PRIORITY 1: packages/shared/src/circuit-breaker.ts (8 mutations)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MODULE 3: packages/shared/src/circuit-breaker.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Failure threshold
test_mutation "packages/shared/src/circuit-breaker.ts" \
    "this.failures.length >= this.options.failureThreshold" \
    "this.failures.length > this.options.failureThreshold" \
    "Failure threshold boundary (>= vs >)" \
    "packages/shared"

# Success threshold
test_mutation "packages/shared/src/circuit-breaker.ts" \
    "this.successes >= this.options.successThreshold" \
    "this.successes > this.options.successThreshold" \
    "Success threshold boundary (>= vs >)" \
    "packages/shared"

# Timeout comparison
test_mutation "packages/shared/src/circuit-breaker.ts" \
    "now - this.lastAttempt < this.options.timeoutMs" \
    "now - this.lastAttempt <= this.options.timeoutMs" \
    "Timeout comparison (< vs <=)" \
    "packages/shared"

# State transitions
test_mutation "packages/shared/src/circuit-breaker.ts" \
    "this.changeState(CircuitState.OPEN)" \
    "this.changeState(CircuitState.HALF_OPEN)" \
    "State transition OPEN vs HALF_OPEN" \
    "packages/shared"

test_mutation "packages/shared/src/circuit-breaker.ts" \
    "this.changeState(CircuitState.CLOSED)" \
    "this.changeState(CircuitState.OPEN)" \
    "State transition CLOSED vs OPEN on success" \
    "packages/shared"

# Retry logic
test_mutation "packages/shared/src/circuit-breaker.ts" \
    "attempt <= options.retries" \
    "attempt < options.retries" \
    "Retry count comparison (<= vs <)" \
    "packages/shared"

test_mutation "packages/shared/src/circuit-breaker.ts" \
    "attempt - 1" "attempt + 1" \
    "Retry delay calculation (- vs +)" \
    "packages/shared"

test_mutation "packages/shared/src/circuit-breaker.ts" \
    "ts > threshold" "ts >= threshold" \
    "Failure window threshold (> vs >=)" \
    "packages/shared"

# ============================================================================
# PRIORITY 2: services/scan-orchestrator/src/enhanced-security.ts (8 mutations)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MODULE 4: services/scan-orchestrator/src/enhanced-security.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Tier 1 threshold
test_mutation "services/scan-orchestrator/src/enhanced-security.ts" \
    "tier1Score > 2.0" "tier1Score > 2.5" \
    "Tier 1 malicious threshold (2.0 vs 2.5)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/enhanced-security.ts" \
    "tier1Score > 2.0" "tier1Score >= 2.0" \
    "Tier 1 threshold comparison (> vs >=)" \
    "services/scan-orchestrator"

# Tier 2 threshold
test_mutation "services/scan-orchestrator/src/enhanced-security.ts" \
    "tier2Score > 1.5" "tier2Score > 2.0" \
    "Tier 2 suspicious threshold (1.5 vs 2.0)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/enhanced-security.ts" \
    "tier2Score > 1.5" "tier2Score >= 1.5" \
    "Tier 2 threshold comparison (> vs >=)" \
    "services/scan-orchestrator"

# Verdict assignments
test_mutation "services/scan-orchestrator/src/enhanced-security.ts" \
    "verdict: 'malicious'" "verdict: 'suspicious'" \
    "Tier 1 verdict (malicious vs suspicious)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/enhanced-security.ts" \
    "confidence: 'high'" "confidence: 'medium'" \
    "Tier 1 confidence (high vs medium)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/enhanced-security.ts" \
    "skipExternalAPIs: true" "skipExternalAPIs: false" \
    "Tier 1 skip external APIs flag" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/enhanced-security.ts" \
    "verdict: 'suspicious'" "verdict: null" \
    "Tier 2 verdict (suspicious vs null)" \
    "services/scan-orchestrator"

# ============================================================================
# PRIORITY 2: services/scan-orchestrator/src/blocklists.ts (6 mutations)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MODULE 5: services/scan-orchestrator/src/blocklists.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Phishtank decision logic
test_mutation "services/scan-orchestrator/src/blocklists.ts" \
    "if (!phishtankEnabled) return false" \
    "if (!phishtankEnabled) return true" \
    "Phishtank disabled logic (false vs true)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/blocklists.ts" \
    "if (!gsbHit) return true" \
    "if (!gsbHit) return false" \
    "GSB miss triggers Phishtank (true vs false)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/blocklists.ts" \
    "if (gsbError) return true" \
    "if (gsbError) return false" \
    "GSB error triggers Phishtank (true vs false)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/blocklists.ts" \
    "if (!gsbApiKeyPresent) return true" \
    "if (!gsbApiKeyPresent) return false" \
    "Missing API key triggers Phishtank (true vs false)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/blocklists.ts" \
    "gsbMatches.length > 0" "gsbMatches.length >= 0" \
    "GSB hit detection (> vs >=)" \
    "services/scan-orchestrator"

test_mutation "services/scan-orchestrator/src/blocklists.ts" \
    "gsbDurationMs > fallbackLatencyMs" "gsbDurationMs >= fallbackLatencyMs" \
    "Latency fallback threshold (> vs >=)" \
    "services/scan-orchestrator"

# ============================================================================
# PRIORITY 2: packages/shared/src/homoglyph.ts (6 mutations)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MODULE 6: packages/shared/src/homoglyph.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Brand similarity threshold
test_mutation "packages/shared/src/homoglyph.ts" \
    "> 0.88" "> 0.90" \
    "Brand similarity threshold (0.88 vs 0.90)" \
    "packages/shared"

test_mutation "packages/shared/src/homoglyph.ts" \
    "> 0.88" ">= 0.88" \
    "Brand similarity comparison (> vs >=)" \
    "packages/shared"

# Risk level assignments
test_mutation "packages/shared/src/homoglyph.ts" \
    "RISK_PRIORITY.high" "RISK_PRIORITY.medium" \
    "High risk priority assignment" \
    "packages/shared"

test_mutation "packages/shared/src/homoglyph.ts" \
    "RISK_PRIORITY.medium" "RISK_PRIORITY.low" \
    "Medium risk priority assignment" \
    "packages/shared"

# Mixed script detection
test_mutation "packages/shared/src/homoglyph.ts" \
    "scripts.size > 1" "scripts.size > 2" \
    "Mixed script detection (>1 vs >2)" \
    "packages/shared"

# Confusable character threshold
test_mutation "packages/shared/src/homoglyph.ts" \
    "confusableChars.length >= 2" "confusableChars.length >= 3" \
    "Confusable chars high risk threshold (>=2 vs >=3)" \
    "packages/shared"

# ============================================================================
# PRIORITY 2: packages/shared/src/url-shortener.ts (5 mutations)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MODULE 7: packages/shared/src/url-shortener.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Shortener detection
test_mutation "packages/shared/src/url-shortener.ts" \
    "SHORTENER_HOSTS.has(hostname.toLowerCase())" \
    "SHORTENER_HOSTS.has(hostname)" \
    "Case-insensitive shortener check" \
    "packages/shared"

# HTTP status checks
test_mutation "packages/shared/src/url-shortener.ts" \
    "response.status >= 300 && response.status < 400" \
    "response.status >= 300 && response.status <= 400" \
    "Redirect status range (< vs <=)" \
    "packages/shared"

test_mutation "packages/shared/src/url-shortener.ts" \
    "response.status >= 400" "response.status > 400" \
    "Error status threshold (>= vs >)" \
    "packages/shared"

test_mutation "packages/shared/src/url-shortener.ts" \
    "response.status >= 500" "response.status > 500" \
    "Server error status threshold (>= vs >)" \
    "packages/shared"

# Expansion result flags
test_mutation "packages/shared/src/url-shortener.ts" \
    "wasShortened: true" "wasShortened: false" \
    "Was shortened flag (true vs false)" \
    "packages/shared"

# ============================================================================
# PRIORITY 3: services/control-plane/src/index.ts (4 mutations)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MODULE 8: services/control-plane/src/index.ts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Auth token comparison
test_mutation "services/control-plane/src/index.ts" \
    "token !== expectedToken" "token === expectedToken" \
    "Auth token comparison (!= vs ==)" \
    "services/control-plane"

# URL hash validation regex
test_mutation "services/control-plane/src/index.ts" \
    '/^[a-fA-F0-9]{64}$/' '/^[a-fA-F0-9]{32}$/' \
    "URL hash length validation (64 vs 32)" \
    "services/control-plane"

# Path traversal protection
test_mutation "services/control-plane/src/index.ts" \
    "!relative.startsWith('..')" "relative.startsWith('..')" \
    "Path traversal check (! vs none)" \
    "services/control-plane"

# HTTP status codes
test_mutation "services/control-plane/src/index.ts" \
    "reply.code(401)" "reply.code(403)" \
    "Auth failure status code (401 vs 403)" \
    "services/control-plane"

# ============================================================================
# Generate Summary
# ============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   MUTATION TESTING SUMMARY                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Completed at $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OVERALL RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Mutations:  $MUTATIONS_TOTAL"
echo -e "Killed:           ${GREEN}$MUTATIONS_KILLED${NC}"
echo -e "Survived:         ${RED}$MUTATIONS_SURVIVED${NC}"
echo -e "Errors:           ${YELLOW}$MUTATIONS_ERROR${NC}"
echo ""

EFFECTIVE_TOTAL=$((MUTATIONS_TOTAL - MUTATIONS_ERROR))
if [ $EFFECTIVE_TOTAL -gt 0 ]; then
    SCORE=$((MUTATIONS_KILLED * 100 / EFFECTIVE_TOTAL))
    echo -e "Mutation Score:   ${SCORE}%"
    echo ""
    
    if [ $SCORE -ge 85 ]; then
        echo -e "${GREEN}✅ PASS: Mutation score ${SCORE}% >= 85% target${NC}"
    else
        echo -e "${RED}❌ FAIL: Mutation score ${SCORE}% < 85% target${NC}"
    fi
else
    echo "No effective mutations to calculate score"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULTS BY MODULE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for module in "${!MODULE_TOTAL[@]}"; do
    killed=${MODULE_KILLED[$module]:-0}
    total=${MODULE_TOTAL[$module]}
    if [ $total -gt 0 ]; then
        pct=$((killed * 100 / total))
        echo "  $module: $killed/$total ($pct%)"
    fi
done

if [ -n "$SURVIVED_LIST" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "SURVIVED MUTATIONS (require additional tests)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "$SURVIVED_LIST"
fi

echo ""

# Exit with appropriate code
if [ $EFFECTIVE_TOTAL -gt 0 ] && [ $SCORE -ge 85 ]; then
    exit 0
else
    exit 1
fi
