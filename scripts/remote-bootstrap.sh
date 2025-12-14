#!/usr/bin/env bash
# =============================================================================
# WhatsApp Bot Scanner - Remote Bootstrap
# =============================================================================
# One-liner installation for fresh systems (no prerequisites required).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ElliotBadinger/whatsapp-bot-scanner/main/scripts/remote-bootstrap.sh | bash
#
# Flow:
#   1. Install minimal prerequisites (curl, git)
#   2. Clone the repository
#   3. Delegate to ./bootstrap.sh (which handles Node.js, Docker, and npx setup)
# =============================================================================

set -euo pipefail

# Configuration (can be overridden via environment)
REPO_URL="${WBSCANNER_REPO:-https://github.com/ElliotBadinger/whatsapp-bot-scanner.git}"
INSTALL_DIR="${WBSCANNER_DIR:-$HOME/whatsapp-bot-scanner}"
BRANCH="${WBSCANNER_BRANCH:-main}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

error() { echo -e "${RED}❌ $1${NC}" >&2; exit 1; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
step() { echo -e "${CYAN}▶ $1${NC}"; }

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  WhatsApp Bot Scanner - Remote Bootstrap                         ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# -----------------------------------------------------------------------------
# Detect package manager and install git if needed
# -----------------------------------------------------------------------------
install_git() {
  step "Installing git..."
  
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y -qq git curl
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y git curl
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y git curl
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm git curl
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add git curl
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper install -y git curl
  elif command -v brew >/dev/null 2>&1; then
    brew install git curl
  else
    error "Cannot install git. Please install git manually and try again."
  fi
  
  success "Git installed"
  return 0
}

# -----------------------------------------------------------------------------
# Main Flow
# -----------------------------------------------------------------------------

# Step 1: Ensure git is available
step "Step 1/2: Checking git..."
if ! command -v git >/dev/null 2>&1; then
  install_git
else
  success "Git available"
fi

# Step 2: Clone repository
step "Step 2/2: Cloning repository..."

if [[ -d "$INSTALL_DIR" ]]; then
  warning "Directory $INSTALL_DIR already exists"
  
  # Check if it's a git repo
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    cd "$INSTALL_DIR"
    git fetch origin "$BRANCH" 2>/dev/null || true
    git reset --hard "origin/$BRANCH" 2>/dev/null || git pull origin "$BRANCH" || true
    success "Repository updated"
  else
    # Not a git repo, ask to remove
    echo -n "Remove and re-clone? [y/N] "
    read -r reply
    if [[ $reply =~ ^[Yy]$ ]]; then
      rm -rf "$INSTALL_DIR"
      git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
      success "Repository cloned to $INSTALL_DIR"
    fi
  fi
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  success "Repository cloned to $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# -----------------------------------------------------------------------------
# Delegate to local bootstrap.sh
# -----------------------------------------------------------------------------
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  Repository ready! Running local bootstrap...                    ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Make bootstrap executable and run it
chmod +x "$INSTALL_DIR/bootstrap.sh"
exec "$INSTALL_DIR/bootstrap.sh" "$@"
