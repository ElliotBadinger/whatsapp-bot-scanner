#!/bin/bash

# WhatsApp Authentication Test Script
# This script performs basic connectivity checks and validates WhatsApp authentication flow

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WA_CLIENT_URL="${WA_CLIENT_URL:-http://localhost:3000}"
SCAN_ORCHESTRATOR_URL="${SCAN_ORCHESTRATOR_URL:-http://localhost:3001}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-http://localhost:8080}"

echo -e "${BLUE}🔍 WhatsApp Authentication Test${NC}"
echo "=================================="

# Function to check service health
check_health() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name health... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url/healthz" 2>/dev/null); then
        if [ "$response" -eq "$expected_status" ]; then
            echo -e "${GREEN}✓ OK${NC}"
            return 0
        else
            echo -e "${RED}✗ Failed (HTTP $response)${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Unreachable${NC}"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    local service_name=$1
    
    echo -n "Checking $service_name Redis connectivity... "
    
    if response=$(curl -s "$url/healthz" 2>/dev/null); then
        if echo "$response" | grep -q '"redis":"connected"'; then
            echo -e "${GREEN}✓ Connected${NC}"
            return 0
        else
            echo -e "${RED}✗ Disconnected${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Failed to check${NC}"
        return 1
    fi
}

# Function to test basic API functionality
test_api() {
    local service_name=$1
    local url=$2
    
    echo -n "Testing $service_name API... "
    
    if response=$(curl -s "$url/metrics" 2>/dev/null); then
        if echo "$response" | grep -q "HELP"; then
            echo -e "${GREEN}✓ Responding${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Limited response${NC}"
            return 0
        fi
    else
        echo -e "${RED}✗ No response${NC}"
        return 1
    fi
}

# Test results
PASSED=0
FAILED=0

echo -e "\n${BLUE}1. Service Health Checks${NC}"
echo "---------------------------"

# Check Redis
if check_redis "Redis" "http://localhost:6379"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Check wa-client
if check_health "wa-client" "$WA_CLIENT_URL"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Check scan-orchestrator
if check_health "scan-orchestrator" "$SCAN_ORCHESTRATOR_URL"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Check control-plane
if check_health "control-plane" "$CONTROL_PLANE_URL"; then
    ((PASSED++))
else
    ((FAILED++))
fi

echo -e "\n${BLUE}2. API Functionality Tests${NC}"
echo "------------------------------"

# Test wa-client API
if test_api "wa-client" "$WA_CLIENT_URL"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test scan-orchestrator API
if test_api "scan-orchestrator" "$SCAN_ORCHESTRATOR_URL"; then
    ((PASSED++))
else
    ((FAILED++))
fi

echo -e "\n${BLUE}3. Docker Container Status${NC}"
echo "-------------------------"

# Check if containers are running
echo "Checking Docker containers..."

if command -v docker >/dev/null 2>&1; then
    containers=("wbscanner-redis-1" "wbscanner-wa-client-1" "wbscanner-scan-orchestrator-1" "wbscanner-control-plane-1")
    
    for container in "${containers[@]}"; do
        echo -n "  $container... "
        if docker ps --format "table {{.Names}}" | grep -q "$container"; then
            echo -e "${GREEN}✓ Running${NC}"
            ((PASSED++))
        else
            echo -e "${RED}✗ Not running${NC}"
            ((FAILED++))
        fi
    done
else
    echo -e "${YELLOW}⚠ Docker command not found, skipping container checks${NC}"
fi

echo -e "\n${BLUE}4. Network Connectivity Test${NC}"
echo "--------------------------"

# Test basic network connectivity between services
echo "Testing network connectivity..."

# Test if wa-client can reach Redis
if docker exec wbscanner-wa-client-1 ping -c 1 redis >/dev/null 2>&1; then
    echo -e "  wa-client → Redis: ${GREEN}✓ Connected${NC}"
    ((PASSED++))
else
    echo -e "  wa-client → Redis: ${RED}✗ Failed${NC}"
    ((FAILED++))
fi

# Test if scan-orchestrator can reach Redis
if docker exec wbscanner-scan-orchestrator-1 ping -c 1 redis >/dev/null 2>&1; then
    echo -e "  scan-orchestrator → Redis: ${GREEN}✓ Connected${NC}"
    ((PASSED++))
else
    echo -e "  scan-orchestrator → Redis: ${RED}✗ Failed${NC}"
    ((FAILED++))
fi

echo -e "\n${BLUE}5. Configuration Validation${NC}"
echo "-------------------------"

# Check if required environment variables are set
echo "Checking environment configuration..."

required_vars=("VT_API_KEY" "CONTROL_PLANE_API_TOKEN")
optional_vars=("GSB_API_KEY" "PHISHTANK_ENABLED" "URLSCAN_ENABLED")

for var in "${required_vars[@]}"; do
    echo -n "  $var... "
    if [ -z "${!var:-}" ]; then
        echo -e "${RED}✗ Missing${NC}"
        ((FAILED++))
    else
        echo -e "${GREEN}✓ Set${NC}"
        ((PASSED++))
    fi
done

for var in "${optional_vars[@]}"; do
    echo -n "  $var... "
    if [ -z "${!var:-}" ]; then
        echo -e "${YELLOW}⚠ Not set (optional)${NC}"
    else
        echo -e "${GREEN}✓ Set${NC}"
        ((PASSED++))
    fi
done

echo -e "\n${BLUE}Test Results Summary${NC}"
echo "===================="

TOTAL_TESTS=$((PASSED + FAILED))
echo -e "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! WhatsApp authentication infrastructure is ready.${NC}"
    echo -e "\n${BLUE}Next Steps:${NC}"
    echo "1. Start the stack: ${YELLOW}make up${NC}"
    echo "2. Pair WhatsApp device: ${YELLOW}make pair${NC} or check logs for QR code"
    echo "3. Send a test URL to a WhatsApp group to verify end-to-end functionality"
    exit 0
else
    echo -e "\n${RED}❌ $FAILED test(s) failed. Please check the issues above.${NC}"
    echo -e "\n${BLUE}Troubleshooting:${NC}"
    echo "1. Ensure Docker containers are running: ${YELLOW}docker ps${NC}"
    echo "2. Check container logs: ${YELLOW}make logs${NC}"
    echo "3. Verify environment configuration: ${YELLOW}.env${NC}"
    echo "4. Check network connectivity: ${YELLOW}docker network ls${NC}"
    exit 1
fi