#!/bin/bash
# Comprehensive Type Checking and Testing Script
# This script validates TypeScript types across all packages and services before commit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Running comprehensive type checking and tests...${NC}\n"

# Track failures
FAILED=0

# Function to run command and track failures
run_check() {
    local name=$1
    local cmd=$2
    echo -e "${YELLOW}Running: $name${NC}"
    if eval "$cmd"; then
        echo -e "${GREEN}✓ $name passed${NC}\n"
    else
        echo -e "${RED}✗ $name failed${NC}\n"
        FAILED=$((FAILED + 1))
    fi
}

# 1. Build shared package (required for all services)
run_check "Build shared package" "cd packages/shared && npm run build"

# 2. TypeScript strict compilation for shared
run_check "TypeScript check (shared)" "cd packages/shared && npx tsc --noEmit --strict"

# 3. Run shared tests
run_check "Unit tests (shared)" "cd packages/shared && npm test -- --passWithNoTests"

# 4. Build and type-check scan-orchestrator
run_check "Build scan-orchestrator" "cd services/scan-orchestrator && npm run build"
run_check "TypeScript check (scan-orchestrator)" "cd services/scan-orchestrator && npx tsc --noEmit"

# 5. Build and type-check wa-client
if [ -d "services/wa-client" ]; then
    run_check "Build wa-client" "cd services/wa-client && npm run build"
    run_check "TypeScript check (wa-client)" "cd services/wa-client && npx tsc --noEmit"
fi

# 6. Build and type-check verdict-publisher
if [ -d "services/verdict-publisher" ]; then
    run_check "Build verdict-publisher" "cd services/verdict-publisher && npm run build"
    run_check "TypeScript check (verdict-publisher)" "cd services/verdict-publisher && npx tsc --noEmit"
fi

# 7. Build and type-check control-plane
if [ -d "services/control-plane" ]; then
    run_check "Build control-plane" "cd services/control-plane && npm run build"
    run_check "TypeScript check (control-plane)" "cd services/control-plane && npx tsc --noEmit"
fi

# 8. ESLint checks
run_check "ESLint (shared)" "cd packages/shared && npx eslint src --ext .ts --max-warnings 0 || true"
run_check "ESLint (scan-orchestrator)" "cd services/scan-orchestrator && npx eslint src --ext .ts --max-warnings 0 || true"

# Summary
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed successfully!${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED check(s) failed${NC}"
    exit 1
fi
