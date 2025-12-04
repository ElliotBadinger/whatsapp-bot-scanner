#!/usr/bin/env bash
# Remote Bootstrap Script - Run directly from curl without cloning first
# Usage: curl -fsSL https://raw.githubusercontent.com/ElliotBadinger/whatsapp-bot-scanner/main/scripts/remote-bootstrap.sh | bash
#
# This script:
# 1. Installs prerequisites (Node.js, Docker, Git)
# 2. Clones the repository
# 3. Runs the full setup wizard

set -euo pipefail

# Color output helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

error() { echo -e "${RED}❌ Error: $1${NC}" >&2; exit 1; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
step() { echo -e "${CYAN}▶ $1${NC}"; }

REPO_URL="${WBSCANNER_REPO:-https://github.com/ElliotBadinger/whatsapp-bot-scanner.git}"
INSTALL_DIR="${WBSCANNER_DIR:-$HOME/whatsapp-bot-scanner}"
BRANCH="${WBSCANNER_BRANCH:-main}"

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  WhatsApp Bot Scanner - Remote Bootstrap                         ║"
echo "║  One-liner installation for fresh systems                        ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# -----------------------------------------------------------------------------
# OS Detection
# -----------------------------------------------------------------------------

detect_os() {
  case "$(uname -s)" in
    Linux*)   echo "linux" ;;
    Darwin*)  echo "macos" ;;
    CYGWIN*|MINGW*|MSYS*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

detect_distro() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "$ID"
  elif [ -f /etc/debian_version ]; then
    echo "debian"
  elif [ -f /etc/redhat-release ]; then
    echo "rhel"
  else
    echo "unknown"
  fi
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

OS=$(detect_os)
DISTRO=$(detect_distro)
PKG_MGR=$(detect_package_manager)

info "Detected OS: $OS ($DISTRO), Package Manager: $PKG_MGR"

if [ "$OS" = "windows" ]; then
  warning "Windows detected. For best results, use WSL2 (Ubuntu)."
  warning "If you're in WSL2, this script should work normally."
  warning "For native Windows, download and run bootstrap.ps1 instead."
  echo ""
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
  fi
fi

# -----------------------------------------------------------------------------
# Prerequisite Installation Functions
# -----------------------------------------------------------------------------

install_system_packages() {
  step "Installing system prerequisites (curl, git, make, unzip)..."
  
  case "$PKG_MGR" in
    apt)
      sudo apt-get update -qq
      sudo apt-get install -y -qq curl git make build-essential unzip ca-certificates gnupg
      ;;
    dnf)
      sudo dnf install -y curl git make unzip @development-tools
      ;;
    yum)
      sudo yum install -y curl git make unzip
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
      warning "Unknown package manager. Please install curl, git, make, and unzip manually."
      return 1
      ;;
  esac
  success "System packages installed."
}

install_node() {
  step "Installing Node.js 20 LTS..."
  
  # Check if we're in a container
  if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    info "Container environment detected. Using NodeSource..."
    case "$PKG_MGR" in
      apt)
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        ;;
      dnf|yum)
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
        sudo dnf install -y nodejs || sudo yum install -y nodejs
        ;;
      *)
        error "Unsupported package manager for container Node.js installation"
        ;;
    esac
  else
    # Use fnm (Fast Node Manager) for bare metal
    info "Installing via fnm (Fast Node Manager)..."
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
    
    export PATH="$HOME/.local/share/fnm:$PATH"
    if command -v fnm >/dev/null 2>&1; then
      eval "$(fnm env --use-on-cd)"
      fnm install 20
      fnm use 20
      fnm default 20
      export PATH="$(fnm env --use-on-cd | grep 'export PATH' | cut -d'"' -f2):$PATH"
    else
      error "Failed to install fnm. Please install Node.js 20+ manually."
    fi
  fi
  
  success "Node.js $(node -v) installed."
}

install_docker() {
  step "Installing Docker..."
  
  # Check for Codespaces
  if [ -n "${CODESPACES:-}" ] || [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
    info "GitHub Codespaces detected. Docker should be pre-installed."
    return 0
  fi
  
  # Check for container environment
  if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    warning "Container environment detected. Docker installation skipped."
    warning "Mount the Docker socket from host if you need Docker-in-Docker."
    return 1
  fi
  
  # Install Docker via official script
  curl -fsSL https://get.docker.com | sh
  
  # Add user to docker group
  if ! getent group docker >/dev/null 2>&1; then
    sudo groupadd docker
  fi
  sudo usermod -aG docker "$USER"
  
  # Start Docker
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable docker
    sudo systemctl start docker
  elif command -v service >/dev/null 2>&1; then
    sudo service docker start
  fi
  
  success "Docker installed."
}

# -----------------------------------------------------------------------------
# Main Installation Flow
# -----------------------------------------------------------------------------

step "Step 1/5: Checking system prerequisites..."

# Ensure curl and git are available
if ! command -v curl >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1; then
  install_system_packages
fi
success "System prerequisites ready."

step "Step 2/5: Checking Node.js..."

if ! command -v node >/dev/null 2>&1; then
  install_node
else
  NODE_VERSION="$(node -v | sed 's/^v//')"
  NODE_MAJOR="${NODE_VERSION%%.*}"
  if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
    warning "Node.js v$NODE_VERSION is too old (requires 20+)."
    install_node
  else
    success "Node.js $(node -v) is ready."
  fi
fi

step "Step 3/5: Checking Docker..."

DOCKER_AVAILABLE=false
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
    success "Docker is available and running."
    DOCKER_AVAILABLE=true
  else
    warning "Docker is installed but daemon is not running."
    if command -v systemctl >/dev/null 2>&1; then
      info "Attempting to start Docker..."
      sudo systemctl start docker && DOCKER_AVAILABLE=true
    fi
  fi
else
  if ! install_docker; then
    warning "Docker installation skipped or failed. Setup wizard will provide guidance."
  else
    DOCKER_AVAILABLE=true
  fi
fi

step "Step 4/5: Cloning repository..."

if [ -d "$INSTALL_DIR" ]; then
  info "Directory $INSTALL_DIR already exists."
  read -p "Remove and re-clone? [y/N] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  else
    info "Using existing directory."
    cd "$INSTALL_DIR"
    git pull origin "$BRANCH" || warning "Could not update repository."
  fi
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
success "Repository cloned to $INSTALL_DIR"

step "Step 5/5: Installing dependencies and launching setup..."

# Install npm dependencies
if command -v npm >/dev/null 2>&1; then
  npm install
elif command -v bun >/dev/null 2>&1; then
  bun install
else
  warning "No package manager found. Setup wizard will handle dependencies."
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  Prerequisites Ready!                                            ║"
echo "║  Launching interactive setup wizard...                           ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Launch the setup wizard
if [ -f "$INSTALL_DIR/scripts/unified-cli.mjs" ]; then
  exec node "$INSTALL_DIR/scripts/unified-cli.mjs" setup "$@"
elif [ -f "$INSTALL_DIR/setup.sh" ]; then
  exec "$INSTALL_DIR/setup.sh" "$@"
else
  error "Could not find setup wizard. Please run manually from $INSTALL_DIR"
fi
