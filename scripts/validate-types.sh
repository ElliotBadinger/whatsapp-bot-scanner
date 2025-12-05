#!/bin/bash
# Comprehensive Type Checking and Testing Script
# This script validates TypeScript types across all packages and services before commit

# Don't exit on first error - we want to collect all failures
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${YELLOW}🔍 Running comprehensive type checking and tests...${NC}\n"

# Track failures
FAILED=0

# Detect package manager (prefer bun)
if command -v bun &> /dev/null; then
    PKG_MGR="bun"
    PKG_RUN="bun run"
    PKG_X="bunx"
else
    PKG_MGR="npm"
    PKG_RUN="npm run"
    PKG_X="npx"
fi

echo -e "${YELLOW}Using package manager: $PKG_MGR${NC}\n"

# Function to run command and track failures
run_check() {
    local name=$1
    local dir=$2
    local cmd=$3
    echo -e "${YELLOW}Running: $name${NC}"
    if (cd "$PROJECT_ROOT/$dir" && eval "$cmd"); then
        echo -e "${GREEN}✓ $name passed${NC}\n"
    else
        echo -e "${RED}✗ $name failed${NC}\n"
        FAILED=$((FAILED + 1))
    fi
}

# 1. Build shared package (required for all services)
run_check "Build shared package" "packages/shared" "$PKG_RUN build"

# 2. TypeScript strict compilation for shared
run_check "TypeScript check (shared)" "packages/shared" "$PKG_X tsc --noEmit --strict"

# 3. Run shared tests
run_check "Unit tests (shared)" "packages/shared" "$PKG_RUN test -- --passWithNoTests"

# 4. Build and type-check scan-orchestrator
run_check "Build scan-orchestrator" "services/scan-orchestrator" "$PKG_RUN build"
run_check "TypeScript check (scan-orchestrator)" "services/scan-orchestrator" "$PKG_X tsc --noEmit"

# 5. Build and type-check wa-client
if [ -d "$PROJECT_ROOT/services/wa-client" ]; then
    run_check "Build wa-client" "services/wa-client" "$PKG_RUN build"
    run_check "TypeScript check (wa-client)" "services/wa-client" "$PKG_X tsc --noEmit"
fi

# 6. Build and type-check verdict-publisher
if [ -d "$PROJECT_ROOT/services/verdict-publisher" ]; then
    run_check "Build verdict-publisher" "services/verdict-publisher" "$PKG_RUN build"
    run_check "TypeScript check (verdict-publisher)" "services/verdict-publisher" "$PKG_X tsc --noEmit"
fi

# 7. Build and type-check control-plane
if [ -d "$PROJECT_ROOT/services/control-plane" ]; then
    run_check "Build control-plane" "services/control-plane" "$PKG_RUN build"
    run_check "TypeScript check (control-plane)" "services/control-plane" "$PKG_X tsc --noEmit"
fi

# 8. ESLint checks
run_check "ESLint (shared)" "packages/shared" "$PKG_X eslint src --ext .ts --max-warnings 0 || true"
run_check "ESLint (scan-orchestrator)" "services/scan-orchestrator" "$PKG_X eslint src --ext .ts --max-warnings 0 || true"

# Summary
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed successfully!${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED check(s) failed${NC}"
    exit 1
fi
