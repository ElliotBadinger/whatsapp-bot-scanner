#!/usr/bin/env bash
# Ultra-Simple Hobby Setup - Get running in under 5 minutes
# This script automates the entire setup process for hobby users

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 WhatsApp Bot Scanner - Express Hobby Setup"
echo "=============================================="
echo ""

# Color output helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error() {
  echo -e "${RED}❌ Error: $1${NC}" >&2
  exit 1
}

success() {
  echo -e "${GREEN}✅ $1${NC}"
}

warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Step 1: Check Prerequisites
echo "Step 1/5: Checking prerequisites..."

# -----------------------------------------------------------------------------
# Environment Detection
# -----------------------------------------------------------------------------

detect_container_env() {
  # Check if running inside a container
  if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    echo "container"
    return 0
  fi
  return 1
}

check_docker_socket() {
  # Check if Docker socket is accessible (common in devcontainers)
  if [ -S /var/run/docker.sock ]; then
    if docker version >/dev/null 2>&1; then
      return 0
    fi
    # Socket exists but might need permissions
    if sudo docker version >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

detect_init_system() {
  if command -v systemctl >/dev/null 2>&1 && systemctl --version >/dev/null 2>&1; then
    echo "systemd"
  elif [ -f /etc/init.d/docker ]; then
    echo "sysvinit"
  elif command -v service >/dev/null 2>&1; then
    echo "service"
  else
    echo "none"
  fi
}

# -----------------------------------------------------------------------------
# Auto-Installation Helpers
# -----------------------------------------------------------------------------

detect_package_manager() {
  if command -v apt-get >/dev/null 2>&1; then echo "apt";
  elif command -v dnf >/dev/null 2>&1; then echo "dnf";
  elif command -v pacman >/dev/null 2>&1; then echo "pacman";
  elif command -v apk >/dev/null 2>&1; then echo "apk";
  elif command -v zypper >/dev/null 2>&1; then echo "zypper";
  elif command -v brew >/dev/null 2>&1; then echo "brew";
  else echo "unknown"; fi
}

install_system_packages() {
  local pm=$(detect_package_manager)
  echo "📦 Detected package manager: $pm"
  echo "Installing system prerequisites (curl, git, make, unzip)..."
  
  case "$pm" in
    apt)
      sudo apt-get update -qq
      sudo apt-get install -y -qq curl git make build-essential unzip
      ;;
    dnf)
      sudo dnf install -y curl git make unzip @development-tools
      ;;
    pacman)
      sudo pacman -Sy --noconfirm curl git make base-devel unzip
      ;;
    apk)
      sudo apk add curl git make build-base unzip
      ;;
    zypper)
      sudo zypper install -y curl git make -t pattern devel_basis unzip
      ;;
    brew)
      brew install curl git make unzip
      ;;
    *)
      # Check for Windows/MinGW
      if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        warning "Windows detected. We recommend running this in WSL2 (Ubuntu) for the best experience."
        warning "If you must use Windows directly, please install Git, Node.js, and Docker Desktop manually."
      else
        warning "Unsupported package manager. Please ensure curl, git, make, and unzip are installed."
      fi
      ;;
  esac
}

install_node() {
  echo "🟢 Node.js not found or too old. Installing via fnm (Fast Node Manager)..."
  if ! command -v curl >/dev/null 2>&1; then install_system_packages; fi
  
  # Install fnm
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
  
  # Load fnm for this session
  export PATH="$HOME/.local/share/fnm:$PATH"
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --use-on-cd)"
    echo "Installing Node.js v20 (LTS)..."
    fnm install 20
    fnm use 20
    fnm default 20
    success "Node.js installed: $(node -v)"
  else
    error "Failed to install fnm. Please install Node.js 18+ manually."
  fi
}

install_docker() {
  # Check if we're in a container environment first
  if detect_container_env; then
    warning "Detected container environment. Docker installation skipped."
    echo "💡 If you need Docker, ensure the Docker socket is mounted from the host."
    echo "   For devcontainers: Add \\\"mounts\\\": [\\\"source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind\\\"]"
    return 1
  fi
  
  echo "🐳 Docker not found. Installing via official script..."
  if ! command -v curl >/dev/null 2>&1; then install_system_packages; fi
  
  curl -fsSL https://get.docker.com | sh
  
  # Add user to docker group
  if ! getent group docker >/dev/null 2>&1; then
    sudo groupadd docker
  fi
  sudo usermod -aG docker $USER
  
  success "Docker installed."
  
  # Attempt to start Docker daemon based on init system
  local init_system=$(detect_init_system)
  case "$init_system" in
    systemd)
      echo "Starting Docker service with systemd..."
      sudo systemctl enable docker
      sudo systemctl start docker
      ;;
    service)
      echo "Starting Docker service..."
      sudo service docker start
      ;;
    sysvinit)
      sudo /etc/init.d/docker start
      ;;
    *)
      warning "Unable to start Docker automatically (no init system detected)."
      echo "   Please start Docker manually."
      ;;
  esac
}

wait_for_docker() {
  echo "Waiting for Docker daemon to be ready..."
  local retries=30
  while [ $retries -gt 0 ]; do
    if docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
      success "Docker daemon is running."
      return 0
    fi
    sleep 1
    retries=$((retries - 1))
  done
  warning "Docker daemon not responding after 30 seconds."
  return 1
}

# Helper to find devcontainer.json
find_devcontainer_json() {
  # Check common locations
  local search_dir="${ROOT_DIR:-.}"
  if [ -f "$search_dir/.devcontainer/devcontainer.json" ]; then
    echo "$search_dir/.devcontainer/devcontainer.json"
    return 0
  elif [ -f "$search_dir/.devcontainer.json" ]; then
    echo "$search_dir/.devcontainer.json"
    return 0
  fi
  return 1
}

show_docker_socket_instructions() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════════╗"
  echo "║  Docker Socket Not Available - Auto-Configuring                  ║"
  echo "╚═══════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "You're running in a devcontainer, but the Docker socket is not mounted."
  echo "This project REQUIRES Docker to function."
  echo ""
  
  local devcontainer_file=$(find_devcontainer_json)
  local modified=false
  
  if [ -n "$devcontainer_file" ]; then
    echo "📝 Found devcontainer config: $devcontainer_file"
    echo ""
    
    # Check if the mount already exists
    if grep -q "var/run/docker.sock" "$devcontainer_file" 2>/dev/null; then
      echo "⚠️  Docker socket mount is already in config, but not available."
      echo "   The container may need to be rebuilt."
    else
      echo "🔧 Attempting to add Docker socket mount automatically..."
      
      # Backup the file
      cp "$devcontainer_file" "$devcontainer_file.backup"
      
      # Try Python-based JSON modification (handles JSONC better)
      if command -v python3 >/dev/null 2>&1; then
        python3 - "$devcontainer_file" << 'PYPYTHON'
import json
import re
import sys

devcontainer_file = sys.argv[1]

# Read the file
with open(devcontainer_file, 'r') as f:
    content = f.read()

# Strip comments (simple approach for JSONC)
# Remove // comments
content_no_comments = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
# Remove /* */ comments
content_no_comments = re.sub(r'/\*.*?\*/', '', content_no_comments, flags=re.DOTALL)

try:
    # Parse JSON
    config = json.loads(content_no_comments)
    
    # Add or update mounts
    mount_entry = "source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"
    
    if 'mounts' not in config:
        config['mounts'] = []
    elif not isinstance(config['mounts'], list):
        config['mounts'] = [config['mounts']]
    
    # Add the mount if not already present
    if mount_entry not in config['mounts']:
        config['mounts'].append(mount_entry)
    
    # Write back (preserving original formatting style)
    with open(devcontainer_file, 'w') as f:
        json.dump(config, f, indent=2)
    
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PYPYTHON
        
        if [ $? -eq 0 ]; then
          success "Successfully added Docker socket mount to $devcontainer_file"
          modified=true
        else
          error "Failed to modify devcontainer.json automatically"
          mv "$devcontainer_file.backup" "$devcontainer_file"
        fi
      else
        warning "'python3' not found. Cannot automatically modify JSON."
        echo "   Installing Python would enable auto-configuration."
      fi
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 REQUIRED: Rebuild your devcontainer"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [ "$modified" = true ]; then
      echo "The configuration has been updated. Now you MUST rebuild:"
    else
      echo "To apply the Docker socket mount, you MUST rebuild:"
    fi
    
    echo ""
    echo "Option 1 - VS Code Command Palette:"
    echo "  1. Press F1 (or Cmd+Shift+P / Ctrl+Shift+P)"
    echo "  2. Type and select: 'Dev Containers: Rebuild Container'"
    echo ""
    
    if [ "$modified" = false ]; then
      echo "If auto-modification failed, manually add this to devcontainer.json:"
      echo '  "mounts": ['
      echo '    "source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"'
      echo '  ]'
      echo ""
    fi
  else
    echo "📝 No devcontainer.json found."
    echo ""
    echo "For VS Code devcontainers, create .devcontainer/devcontainer.json with:"
    echo ""
    echo '{'
    echo '  "name": "WhatsApp Bot Scanner",'
    echo '  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",'
    echo '  "mounts": ['
    echo '    "source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"'
    echo '  ]'
    echo '}'
    echo ""
  fi
  
  echo ""
  echo "For GitHub Codespaces, Docker should already be available."
  echo "If you're in Codespaces and seeing this, please report it as a bug."
  echo ""
}

# -----------------------------------------------------------------------------
# Execution
# -----------------------------------------------------------------------------

# First, check if Docker socket is already available (devcontainer/DinD scenario)
if check_docker_socket; then
  success "Docker socket detected and accessible."
elif ! command -v docker >/dev/null 2>&1; then
  # Docker binary not found, attempt installation
  if ! install_docker; then
    # Installation failed or skipped (e.g., in container)
    if detect_container_env; then
      show_docker_socket_instructions
      error "Cannot proceed without Docker."
    fi
  fi
else
  # Docker binary exists, check if daemon is running
  if ! docker info >/dev/null 2>&1 && ! sudo docker info >/dev/null 2>&1; then
    # Check if we're in a container - if so, socket is probably not mounted
    if detect_container_env; then
      show_docker_socket_instructions
      error "Cannot proceed without Docker."
    fi
    
    # Try to start the daemon (only on bare metal)
    init_system=$(detect_init_system)
    if [ "$init_system" != "none" ]; then
      echo "Docker daemon not running. Attempting to start..."
      case "$init_system" in
        systemd)
          sudo systemctl start docker
          ;;
        service)
          sudo service docker start
          ;;
        sysvinit)
          sudo /etc/init.d/docker start
          ;;
      esac
      wait_for_docker || error "Failed to start Docker daemon."
    else
      error "No init system detected. Cannot start Docker."
    fi
  fi
fi

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  install_node
fi

# Check Node version
NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  warning "Node.js 18 or newer required. Current version: $NODE_VERSION"
  install_node
fi

success "Prerequisites verified (Docker + Node.js $(node -v))"

# Step 2: Install Node Dependencies
echo ""
echo "Step 2/5: Installing Node.js dependencies..."
if [ ! -d "node_modules" ]; then
  echo "Running npm install (this may take 1-2 minutes)..."
  npm install --quiet || error "npm install failed"
  success "Dependencies installed"
else
  success "Dependencies already installed"
fi

# Step 3: Configure Environment
echo ""
echo "Step 3/5: Configuring environment..."
if [ ! -f ".env" ]; then
  echo "Creating .env from hobby template..."
  cp .env.hobby .env || error "Failed to copy .env.hobby"
  
  # Prompt for required VirusTotal API key
  echo ""
  echo "📝 VirusTotal API Key Required (free tier available)"
  echo "   Get yours at: https://www.virustotal.com/gui/join-us"
  echo ""
  read -p "Enter your VirusTotal API key: " VT_KEY
  
  if [ -n "$VT_KEY" ]; then
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|VT_API_KEY=|VT_API_KEY=$VT_KEY|g" .env
    else
      sed -i "s|VT_API_KEY=|VT_API_KEY=$VT_KEY|g" .env
    fi
    success "VirusTotal API key configured"
  else
    warning "No API key provided. Services may fail to start."
    warning "You can add it later by editing .env and restarting services"
  fi
  
  # Optional: Ask for Google Safe Browsing
  echo ""
  read -p "Do you have a Google Safe Browsing API key? (y/N) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your Google Safe Browsing API key: " GSB_KEY
    if [ -n "$GSB_KEY" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|GSB_API_KEY=|GSB_API_KEY=$GSB_KEY|g" .env
      else
        sed -i "s|GSB_API_KEY=|GSB_API_KEY=$GSB_KEY|g" .env
      fi
      success "Google Safe Browsing API key configured"
    fi
  fi
  
  # Phone number and polling configuration
  echo ""
  echo "📱 WhatsApp Remote Auth Configuration (Optional)"
  echo "   You can configure phone numbers for remote authentication."
  echo "   This allows WhatsApp to send pairing codes to your phone(s)."
  echo ""
  read -p "Do you want to configure phone numbers for remote auth? (y/N) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Enter phone numbers (digits only, comma-separated):"
    echo "Example: 12025550123,12025550124"
    read -p "Phone numbers: " PHONE_NUMBERS
    
    if [ -n "$PHONE_NUMBERS" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|WA_REMOTE_AUTH_PHONE_NUMBERS=|WA_REMOTE_AUTH_PHONE_NUMBERS=$PHONE_NUMBERS|g" .env
      else
        sed -i "s|WA_REMOTE_AUTH_PHONE_NUMBERS=|WA_REMOTE_AUTH_PHONE_NUMBERS=$PHONE_NUMBERS|g" .env
      fi
      success "Phone numbers configured"
      
      echo ""
      warning "NOTE: Automatic polling for pairing codes is NOT RECOMMENDED for hobby use"
      warning "It can lead to rate limiting from WhatsApp."
      read -p "Enable automatic polling anyway? (y/N) " -n 1 -r
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Polling interval (minutes, minimum 5, default 10): " INTERVAL
        INTERVAL=${INTERVAL:-10}
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
          sed -i '' "s|WA_REMOTE_AUTH_POLLING_ENABLED=false|WA_REMOTE_AUTH_POLLING_ENABLED=true|g" .env
          sed -i '' "s|WA_REMOTE_AUTH_POLLING_INTERVAL_MINUTES=10|WA_REMOTE_AUTH_POLLING_INTERVAL_MINUTES=$INTERVAL|g" .env
        else
          sed -i "s|WA_REMOTE_AUTH_POLLING_ENABLED=false|WA_REMOTE_AUTH_POLLING_ENABLED=true|g" .env
          sed -i "s|WA_REMOTE_AUTH_POLLING_INTERVAL_MINUTES=10|WA_REMOTE_AUTH_POLLING_INTERVAL_MINUTES=$INTERVAL|g" .env
        fi
        success "Automatic polling enabled (interval: $INTERVAL minutes)"
      else
        success "Automatic polling disabled. Use 'docker compose exec wa-client curl -X POST http://localhost:8080/pair' to request codes manually."
      fi
    fi
  fi
  
  success "Environment configured (.env created)"
else
  success "Environment already configured (.env exists)"
fi

# Step 4: Build and Start Services
echo ""
echo "Step 4/5: Building and starting Docker containers..."
echo "This may take 5-10 minutes on first run (downloading images)..."
echo ""

# Pull images first to show progress
docker compose pull || warning "Image pull failed, will try to build locally"

# Build services (with output)
echo "Building services..."
docker compose build || error "Docker build failed"

# Start services
echo ""
echo "Starting services..."
docker compose up -d || error "Failed to start services"

success "Services started"

# Step 5: Verify and Display Status
echo ""
echo "Step 5/5: Verifying services..."
echo "Waiting for services to become healthy (30 seconds)..."
sleep 30

echo ""
echo "Service Status:"
docker compose ps

# Check for unhealthy services
UNHEALTHY=$(docker compose ps --format json 2>/dev/null | grep -o '"Health":"unhealthy"' | wc -l || echo "0")
if [ "$UNHEALTHY" != "0" ]; then
  warning "Some services are unhealthy. Check logs with: make logs"
fi

# Final Instructions
echo ""
echo "=========================================="
echo "✨ Setup Complete!"
echo "=========================================="
echo ""

# Detect actual ports from running containers
echo "🌐 Service URLs:"
echo ""

# Function to check and display service URL
show_service_url() {
  local service=$1
  local container_port=$2
  local description=$3
  
  local host_port=$(docker compose port "$service" "$container_port" 2>/dev/null | cut -d: -f2)
  if [ -n "$host_port" ]; then
    echo "   $description: http://localhost:${host_port}"
  fi
}

# Check main services
show_service_url "uptime-kuma" "3001" "📊 Monitoring Dashboard (Uptime Kuma)"
show_service_url "reverse-proxy" "8088" "🔧 Control Plane API"

# Check observability stack (if running)
show_service_url "grafana" "3000" "📈 Metrics Dashboard (Grafana)"
show_service_url "prometheus" "9090" "📉 Prometheus"

echo ""
echo "💡 If a service doesn't appear, it may not be running yet."
echo "   Run 'docker compose ps' to check all services."
echo ""
echo "📋 Quick Commands:"
echo ""
echo "1. View WhatsApp authentication (QR code or pairing code):"
echo "   docker compose logs -f wa-client | grep -i 'pairing\\|qr'"
echo ""
echo "2. Request pairing code manually (multi-number rotation):"
echo "   docker compose exec wa-client curl -X POST http://localhost:8080/pair"
echo ""
echo "3. Monitor all services:"
echo "   docker compose logs -f"
echo ""
echo "4. Check service health:"
echo "   docker compose ps"
echo ""
echo "5. Stop services:"
echo "   docker compose down"
echo ""
echo "📚 Documentation: ./docs/"
echo "🐛 Troubleshooting: docker compose logs <service-name>"
echo ""
echo "⚡ Pro tips:"
echo "   • WhatsApp session persists across restarts"
echo "   • Phone number rotation configured in .env: WA_REMOTE_AUTH_PHONE_NUMBERS"
echo "   • Polling disabled by default (use manual /pair endpoint)"
echo ""
