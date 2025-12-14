#!/usr/bin/env bash
# =============================================================================
# Environment Validation Script
# =============================================================================
# Validates that all prerequisites are met before attempting setup/build
# Returns 0 if environment is ready, non-zero otherwise
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

error() {
  local message="${1:-}"
  echo -e "${RED}❌ ${message}${NC}"
  ERRORS=$((ERRORS + 1))
  return 0
}

warning() {
  local message="${1:-}"
  echo -e "${YELLOW}⚠️  ${message}${NC}"
  WARNINGS=$((WARNINGS + 1))
  return 0
}

success() {
  local message="${1:-}"
  echo -e "${GREEN}✓ ${message}${NC}"
  return 0
}

info() {
  local message="${1:-}"
  echo -e "${BLUE}ℹ️  ${message}${NC}"
  return 0
}

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  Environment Validation                                           ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# -----------------------------------------------------------------------------
# Check Node.js
# -----------------------------------------------------------------------------
echo "Checking Node.js..."
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node -v | sed 's/^v//')
  NODE_MAJOR="${NODE_VERSION%%.*}"
  if [ "${NODE_MAJOR:-0}" -ge 20 ]; then
    success "Node.js $NODE_VERSION (>= 20 required)"
  else
    error "Node.js $NODE_VERSION is too old (>= 20 required)"
    info "Run: ./bootstrap.sh to install Node.js 20+"
  fi
else
  error "Node.js not found"
  info "Run: ./bootstrap.sh to install Node.js"
fi

# -----------------------------------------------------------------------------
# Check npm
# -----------------------------------------------------------------------------
echo "Checking npm..."
if command -v npm >/dev/null 2>&1; then
  NPM_VERSION=$(npm -v)
  success "npm $NPM_VERSION"
else
  error "npm not found (should come with Node.js)"
fi

# -----------------------------------------------------------------------------
# Check Docker
# -----------------------------------------------------------------------------
echo "Checking Docker..."
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    success "Docker $DOCKER_VERSION (running)"
  elif sudo docker info >/dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    warning "Docker $DOCKER_VERSION (requires sudo)"
    info "Add your user to docker group: sudo usermod -aG docker \$USER"
  else
    error "Docker installed but daemon not running"
    info "Start Docker: sudo systemctl start docker"
  fi
else
  error "Docker not found"
  info "Run: ./bootstrap.sh to install Docker"
fi

# -----------------------------------------------------------------------------
# Check Docker Compose
# -----------------------------------------------------------------------------
echo "Checking Docker Compose..."
if docker compose version >/dev/null 2>&1; then
  COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
  success "Docker Compose $COMPOSE_VERSION"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | tr -d ',')
  success "Docker Compose $COMPOSE_VERSION (standalone)"
else
  error "Docker Compose not found"
  info "Install Docker Compose or use Docker Desktop"
fi

# -----------------------------------------------------------------------------
# Check Git
# -----------------------------------------------------------------------------
echo "Checking Git..."
if command -v git >/dev/null 2>&1; then
  GIT_VERSION=$(git --version | cut -d' ' -f3)
  success "Git $GIT_VERSION"
else
  warning "Git not found (optional for development)"
fi

# -----------------------------------------------------------------------------
# Check Make
# -----------------------------------------------------------------------------
echo "Checking Make..."
if command -v make >/dev/null 2>&1; then
  MAKE_VERSION=$(make --version | head -n1 | cut -d' ' -f3)
  success "Make $MAKE_VERSION"
else
  warning "Make not found (optional, but recommended)"
  info "Install: sudo apt-get install make"
fi

# -----------------------------------------------------------------------------
# Check Network Connectivity
# -----------------------------------------------------------------------------
echo "Checking network connectivity..."
if curl -s --max-time 5 https://registry.npmjs.org >/dev/null 2>&1; then
  success "npm registry accessible"
else
  warning "Cannot reach npm registry (may cause build failures)"
  info "Check your internet connection"
fi

if curl -s --max-time 5 https://hub.docker.com >/dev/null 2>&1; then
  success "Docker Hub accessible"
else
  warning "Cannot reach Docker Hub (may cause build failures)"
  info "Check your internet connection"
fi

# -----------------------------------------------------------------------------
# Check Disk Space
# -----------------------------------------------------------------------------
echo "Checking disk space..."
AVAILABLE_GB=$(df -BG . | tail -1 | awk '{print $4}' | tr -d 'G')
if [ "${AVAILABLE_GB:-0}" -ge 10 ]; then
  success "Disk space: ${AVAILABLE_GB}GB available"
elif [ "${AVAILABLE_GB:-0}" -ge 5 ]; then
  warning "Disk space: ${AVAILABLE_GB}GB available (10GB+ recommended)"
else
  error "Disk space: ${AVAILABLE_GB}GB available (insufficient, need 5GB+)"
fi

# -----------------------------------------------------------------------------
# Check Memory
# -----------------------------------------------------------------------------
echo "Checking memory..."
if command -v free >/dev/null 2>&1; then
  TOTAL_MEM_GB=$(free -g | awk '/^Mem:/{print $2}')
  if [ "${TOTAL_MEM_GB:-0}" -ge 4 ]; then
    success "Memory: ${TOTAL_MEM_GB}GB total"
  else
    warning "Memory: ${TOTAL_MEM_GB}GB total (4GB+ recommended)"
  fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  success "Environment is ready! No issues found."
  echo ""
  echo "Next steps:"
  echo "  1. Run: make build"
  echo "  2. Run: make up"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  warning "$WARNINGS warning(s) found (non-critical)"
  echo ""
  echo "You can proceed, but some features may not work optimally."
  echo "Next steps:"
  echo "  1. Run: make build"
  echo "  2. Run: make up"
  exit 0
else
  error "$ERRORS error(s) and $WARNINGS warning(s) found"
  echo ""
  echo "Please fix the errors before proceeding:"
  echo "  Run: ./bootstrap.sh"
  exit 1
fi
