#!/usr/bin/env bash
# =============================================================================
# WhatsApp Bot Scanner - Universal Bootstrap
# =============================================================================
# This is the SINGLE entry point for all setup scenarios.
# It ensures prerequisites are installed, then delegates to npx setup.
#
# Usage:
#   ./bootstrap.sh              # Interactive setup
#   ./bootstrap.sh --hobby-mode # Hobby/personal mode
#   ./bootstrap.sh --help       # Show help
#
# Flow:
#   1. Install system packages (curl, git, make)
#   2. Install Node.js 20+ (via fnm)
#   3. Install Docker (via official script)
#   4. Install npm dependencies
#   5. Run: npx whatsapp-bot-scanner setup
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

# -----------------------------------------------------------------------------
# Colors & Output Helpers
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

error() { echo -e "${RED}❌ $1${NC}" >&2; exit 1; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
info() { echo -e "${BLUE}ℹ $1${NC}"; }
step() { echo -e "${CYAN}▶ $1${NC}"; }

# -----------------------------------------------------------------------------
# Environment Detection
# -----------------------------------------------------------------------------
detect_os() {
  case "$(uname -s)" in
    Linux*)   echo "linux" ;;
    Darwin*)  echo "macos" ;;
    CYGWIN*|MINGW*|MSYS*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

detect_package_manager() {
  if command -v apt-get >/dev/null 2>&1; then echo "apt";
  elif command -v dnf >/dev/null 2>&1; then echo "dnf";
  elif command -v yum >/dev/null 2>&1; then echo "yum";
  elif command -v pacman >/dev/null 2>&1; then echo "pacman";
  elif command -v apk >/dev/null 2>&1; then echo "apk";
  elif command -v zypper >/dev/null 2>&1; then echo "zypper";
  elif command -v brew >/dev/null 2>&1; then echo "brew";
  else echo "unknown"; fi
}

is_codespaces() {
  [ -n "${CODESPACES:-}" ] || [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]
}

is_container() {
  ! is_codespaces && { [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; }
}

OS=$(detect_os)
PKG_MGR=$(detect_package_manager)

# -----------------------------------------------------------------------------
# Prerequisite Installation
# -----------------------------------------------------------------------------
install_system_packages() {
  step "Installing system packages..."
  case "$PKG_MGR" in
    apt)
      sudo apt-get update -qq
      sudo apt-get install -y -qq curl git make build-essential unzip ca-certificates
      ;;
    dnf|yum)
      sudo $PKG_MGR install -y curl git make unzip
      ;;
    pacman)
      sudo pacman -Sy --noconfirm curl git make base-devel unzip
      ;;
    apk)
      sudo apk add curl git make build-base unzip
      ;;
    zypper)
      sudo zypper install -y curl git make unzip
      ;;
    brew)
      brew install curl git make unzip
      ;;
    *)
      warning "Unknown package manager. Ensure curl, git, make are installed."
      ;;
  esac
}

install_node() {
  step "Installing Node.js 20 LTS..."
  
  if is_container; then
    # Container: use NodeSource
    case "$PKG_MGR" in
      apt)
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        ;;
      dnf|yum)
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
        sudo $PKG_MGR install -y nodejs
        ;;
      *)
        error "Cannot install Node.js in this container. Please install manually."
        ;;
    esac
  else
    # Bare metal: use fnm
    if ! command -v fnm >/dev/null 2>&1; then
      curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
    fi
    
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env --use-on-cd 2>/dev/null || true)"
    
    fnm install 20
    fnm use 20
    fnm default 20
    
    # Update PATH for this session
    export PATH="$(dirname "$(fnm exec --using=20 which node)"):$PATH"
  fi
  
  success "Node.js $(node -v) installed"
}

install_docker() {
  step "Installing Docker..."
  
  if is_codespaces; then
    info "Codespaces detected - Docker should be pre-installed"
    return 0
  fi
  
  if is_container; then
    warning "Container detected - Docker must be mounted from host"
    return 1
  fi
  
  curl -fsSL https://get.docker.com | sh
  
  # Add user to docker group
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  
  # Start Docker
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable docker 2>/dev/null || true
    sudo systemctl start docker 2>/dev/null || true
  elif command -v service >/dev/null 2>&1; then
    sudo service docker start 2>/dev/null || true
  fi
  
  success "Docker installed"
}

# -----------------------------------------------------------------------------
# Main Flow
# -----------------------------------------------------------------------------
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  WhatsApp Bot Scanner - Bootstrap                                ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: System packages
step "Step 1/4: Checking system packages..."
if ! command -v curl >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1; then
  install_system_packages
fi
success "System packages ready"

# Step 2: Node.js
step "Step 2/4: Checking Node.js..."
NODE_OK=false
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node -v | sed 's/^v//')"
  NODE_MAJOR="${NODE_VERSION%%.*}"
  if [ "${NODE_MAJOR:-0}" -ge 20 ]; then
    success "Node.js v$NODE_VERSION ready"
    NODE_OK=true
  else
    warning "Node.js v$NODE_VERSION too old (need 20+)"
  fi
fi

if [ "$NODE_OK" = false ]; then
  install_node
fi

# Step 3: Docker
step "Step 3/4: Checking Docker..."
DOCKER_OK=false
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
    success "Docker ready"
    DOCKER_OK=true
  else
    warning "Docker installed but daemon not running"
    # Try to start it
    if command -v systemctl >/dev/null 2>&1; then
      sudo systemctl start docker 2>/dev/null && DOCKER_OK=true
    fi
  fi
fi

if [ "$DOCKER_OK" = false ]; then
  install_docker || warning "Docker setup incomplete - wizard will guide you"
fi

# Step 4: Dependencies
step "Step 4/4: Installing dependencies..."
cd "$ROOT_DIR"

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    npm install --silent 2>/dev/null || npm install
  fi
fi
success "Dependencies ready"

# -----------------------------------------------------------------------------
# Launch npx setup
# -----------------------------------------------------------------------------
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  Prerequisites complete! Launching setup wizard...               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Pass all arguments to the setup command
cd "$ROOT_DIR"

# Use npx to run the setup (this is the unified entry point)
if command -v npx >/dev/null 2>&1; then
  exec npx whatsapp-bot-scanner setup "$@"
else
  # Fallback: run directly
  exec node "$ROOT_DIR/scripts/unified-cli.mjs" setup "$@"
fi
