#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
SETUP_WIZARD="$ROOT_DIR/scripts/setup-wizard.mjs"

if [ ! -f "$SETUP_WIZARD" ]; then
  echo "setup-wizard.mjs not found. Ensure you are running from the repository root." >&2
  exit 1
fi


# -----------------------------------------------------------------------------
# Environment Detection
# -----------------------------------------------------------------------------

detect_codespaces() {
  # Check if running in GitHub Codespaces
  if [ -n "$CODESPACES" ] || [ -n "$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN" ]; then
    return 0
  fi
  return 1
}

detect_container_env() {
  # Check if running inside a container (but not Codespaces)
  if detect_codespaces; then
    return 1  # Codespaces is not a container environment for our purposes
  fi
  
  if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    echo "container"
    return 0
  fi
  return 1
}

check_docker_socket() {
  # Check if Docker socket is accessible
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
        echo "⚠️  Windows detected. We recommend running this in WSL2 (Ubuntu) for the best experience."
        echo "   If you must use Windows directly, please install Git, Node.js, and Docker Desktop manually."
      else
        echo "⚠️  Unsupported package manager. Please install curl, git, make, and unzip manually."
      fi
      ;;
  esac
}

install_node() {
  echo "🟢 Node.js not found or too old. Installing..."
  
  # In containers, use system package manager with NodeSource
  if detect_container_env; then
    echo "Detected container environment. Using NodeSource repository..."
    
    # Install prerequisites
    if ! command -v curl >/dev/null 2>&1; then install_system_packages; fi
    
    # Use NodeSource setup script
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    
    local pm=$(detect_package_manager)
    case "$pm" in
      apt)
        sudo apt-get install -y nodejs
        ;;
      dnf)
        sudo dnf install -y nodejs
        ;;
      *)
        echo "⚠️  Unsupported package manager for container Node.js installation"
        echo "Please install Node.js 18+ manually."
        return 1
        ;;
    esac
    
    echo "✅ Node.js installed: $(node -v)"
    return 0
  fi
  
  # On bare metal, use fnm as before
  echo "Installing via fnm (Fast Node Manager)..."
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
    echo "✅ Node.js installed: $(node -v)"
  else
    echo "❌ Failed to install fnm. Please install Node.js 18+ manually."
    exit 1
  fi
}

install_docker() {
  # Codespaces has Docker pre-installed, just needs to be started
  if detect_codespaces; then
    echo "🐳 GitHub Codespaces detected. Docker should be pre-installed."
    return 0
  fi
  
  # Check if we're in a container environment first
  if detect_container_env; then
    echo "⚠️  Detected container environment. Docker installation skipped."
    echo "💡 If you need Docker, ensure the Docker socket is mounted from the host."
    echo "   For devcontainers: Add \"mounts\": [\"source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind\"]"
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
  
  echo "✅ Docker installed."
  
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
      echo "⚠️  Unable to start Docker automatically (no init system detected)."
      echo "   Please start Docker manually."
      ;;
  esac
}

wait_for_docker() {
  echo "Waiting for Docker daemon to be ready..."
  local retries=30
  while [ $retries -gt 0 ]; do
    if docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
      echo "✅ Docker daemon is running."
      return 0
    fi
    sleep 1
    retries=$((retries - 1))
  done
  echo "⚠️  Docker daemon not responding after 30 seconds."
  return 1
}

# -----------------------------------------------------------------------------
# Prerequisite Checks
# -----------------------------------------------------------------------------

NODE_BIN="${NODE_BIN:-node}"

# Check for Node.js
if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  install_node
  NODE_BIN="node" # Update binary path after install
fi

# Verify Node version
NODE_VERSION="$("$NODE_BIN" -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  echo "⚠️  Detected Node.js v$NODE_VERSION (too old)."
  install_node
  NODE_BIN="node"
fi

# Check if dependencies are installed properly
# Use npm list to check if all dependencies from package.json are satisfied
if ! npm list --depth=0 >/dev/null 2>&1; then
  echo "Installing or updating Node.js dependencies (this may take a minute)..."
  cd "$ROOT_DIR"
  npm install || {
    echo "Failed to install dependencies. Please run 'npm install' manually." >&2
    exit 1
  }
  echo "Dependencies installed successfully."
fi


# Check for Docker (Global)
DOCKER_AVAILABLE=false

# Helper to find devcontainer.json
find_devcontainer_json() {
  # Check common locations
  if [ -f "$ROOT_DIR/.devcontainer/devcontainer.json" ]; then
    echo "$ROOT_DIR/.devcontainer/devcontainer.json"
    return 0
  elif [ -f "$ROOT_DIR/.devcontainer.json" ]; then
    echo "$ROOT_DIR/.devcontainer.json"
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
          echo "✅ Successfully added Docker socket mount to $devcontainer_file"
          modified=true
        else
          echo "❌ Failed to modify devcontainer.json automatically"
          mv "$devcontainer_file.backup" "$devcontainer_file"
        fi
      else
        echo "⚠️  'python3' not found. Cannot automatically modify JSON."
        echo "   Installing Python would enable auto-configuration."
      fi
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 REQUIRED: Rebuild your devcontainer"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "" 
    
    if [ "$modified" = true ]; then
      echo "✅ The configuration has been updated automatically!"
      echo ""
      echo "Now you MUST rebuild the container for changes to take effect:"
    else
      echo "To enable Docker access, you MUST rebuild the container:"
    fi
    
    echo ""
    echo "Option 1 - VS Code Command Palette (RECOMMENDED):"
    echo "  1. Press F1 (or Cmd+Shift+P / Ctrl+Shift+P)"
    echo "  2. Type and select: 'Dev Containers: Rebuild Container'"
    echo ""
    echo "Option 2 - Command Line (from your LOCAL machine, not in container):"
    echo "  docker restart \$(docker ps -q --filter 'label=vsch.local.folder=$ROOT_DIR')"
    echo ""
    
    if [ "$modified" = false ]; then
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "⚠️  Auto-modification failed. Please manually edit:"
      echo ""
      echo "Add this to $devcontainer_file:"
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

# First, check if Docker socket is already available
if check_docker_socket; then
  echo "✅ Docker socket detected and accessible."
  DOCKER_AVAILABLE=true
elif ! command -v docker >/dev/null 2>&1; then
  # Docker binary not found, attempt installation
  if ! install_docker; then
    # Installation failed or skipped (e.g., in container)
    if detect_container_env; then
      show_docker_socket_instructions
      echo "❌ Cannot proceed without Docker. Exiting."
      echo ""
      exit 1
    fi
  else
    DOCKER_AVAILABLE=true
  fi
else
  # Docker binary exists, check if daemon is running
  if docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
    echo "\u2705 Docker is available and running."
  else
    # In Codespaces, Docker might just need to be started or use docker group
    if detect_codespaces; then
      echo "🐳 GitHub Codespaces detected. Checking Docker status..."
      
      # Check if Docker is accessible (try without sudo first if in docker group)
      if docker info >/dev/null 2>&1; then
        echo "✅ Docker is running and accessible."
      elif groups | grep -q docker && docker ps >/dev/null 2>&1; then
        echo "✅ Docker is running (via docker group)."
      else
        # Docker daemon might not be running, try to check status
        echo "Docker daemon not responding. This is expected in Codespaces."
        echo "Codespaces manages Docker automatically. Continuing..."
      fi
    # Check if we're in a regular container
    elif detect_container_env; then
      show_docker_socket_instructions
      echo "\u274c Cannot proceed without Docker. Exiting."
      echo ""
      exit 1
    fi
    
    # Try to start the daemon (only on bare metal)
    init_system=$(detect_init_system)
    if [ "$init_system" != "none" ] && ! detect_codespaces && ! detect_container_env; then
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
      
      if wait_for_docker; then
        echo "\u2705 Docker daemon started."
      else
        echo "\u274c Failed to start Docker daemon."
        echo "Please start Docker manually and try again."
        exit 1
      fi
    fi
  fi
fi

# Check for hobby mode flag
if [ "${1:-}" == "--hobby-mode" ]; then
  echo "Activating Hobby Mode..."
  if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "Creating .env from .env.hobby..."
    cp "$ROOT_DIR/.env.hobby" "$ROOT_DIR/.env"
  else
    echo ".env already exists. Skipping creation."
  fi

  # Prompt for VT_API_KEY if missing
  if grep -q "VT_API_KEY=$" "$ROOT_DIR/.env"; then
    echo "VirusTotal API Key is required."
    read -p "Enter your VirusTotal API Key: " VT_KEY
    if [ -n "$VT_KEY" ]; then
      # Use sed to replace the empty key with the provided one
      # We use a different delimiter (|) to avoid issues with special chars in the key if any
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|VT_API_KEY=|VT_API_KEY=$VT_KEY|g" "$ROOT_DIR/.env"
      else
        sed -i "s|VT_API_KEY=|VT_API_KEY=$VT_KEY|g" "$ROOT_DIR/.env"
      fi
      echo "API Key saved."
    else
      echo "Warning: No API Key provided. The scanner may not function correctly."
    fi
  fi

  echo ""
  echo "✅ Hobby Mode configuration complete!"
  echo ""
  echo "Starting services with Docker Compose..."
  
  # Check for Docker
  if ! command -v docker >/dev/null 2>&1; then
    install_docker
  fi
  
  if command -v docker >/dev/null 2>&1; then
    if ! docker info >/dev/null 2>&1; then
      echo "⚠️  Docker daemon is not running. Attempting to start..."
      sudo systemctl start docker || echo "Failed to start Docker service."
    fi
    
    if docker info >/dev/null 2>&1; then
      make up-minimal || {
        echo "⚠️  Warning: Failed to start services automatically."
        echo "Please run manually: make up-minimal"
      }
      echo ""
      echo "📋 Next Steps:"
      echo ""
      
      # Function to check and display service URL
      show_service_url() {
        local service=$1
        local container_port=$2
        local description=$3
        
        local host_port=$(docker compose port "$service" "$container_port" 2>/dev/null | cut -d: -f2)
        if [ -n "$host_port" ]; then
          echo "     $description: http://localhost:${host_port}"
        fi
      }
      
      echo "  Service URLs (if running):"
      show_service_url "uptime-kuma" "3001" "• Monitoring Dashboard"
      show_service_url "reverse-proxy" "8088" "• Control Plane API"
      show_service_url "grafana" "3000" "• Grafana Metrics"
      
      echo ""
      echo "  Quick Commands:"
      echo "  1. Check service status: docker compose ps"
      echo "  2. View logs: docker compose logs -f"
      echo "  3. Find WhatsApp auth: docker compose logs -f wa-client | grep -i 'pairing\\|qr'"
      echo ""
      echo "💡 Tip: Services may take 30-60 seconds to become healthy"
    else
      echo "⚠️  Docker daemon is not running."
      echo "Please start Docker, then run: make up-minimal"
    fi
  else
    echo "❌ Docker installation failed or not found."
    echo "Please install Docker manually and run: make up-minimal"
  fi

  exit 0
fi
# Run the CLI-based setup wizard
# Run the CLI-based setup wizard
# If user is in docker group but current session doesn't have it, use sg
if groups | grep -q "docker"; then
  exec "$NODE_BIN" "$SETUP_WIZARD" "$@"
else
  if getent group docker | grep -q "\b$USER\b"; then
    echo "🔄 Switching to 'docker' group for this session..."
    exec sg docker -c "$NODE_BIN $SETUP_WIZARD $*"
  else
    # Fallback if group membership failed or isn't needed yet
    exec "$NODE_BIN" "$SETUP_WIZARD" "$@"
  fi
fi
