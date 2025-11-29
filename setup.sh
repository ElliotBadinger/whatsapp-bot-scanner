#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
SETUP_WIZARD="$ROOT_DIR/scripts/setup-wizard.mjs"

if [ ! -f "$SETUP_WIZARD" ]; then
  echo "setup-wizard.mjs not found. Ensure you are running from the repository root." >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-node}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "Node.js is required to run the setup wizard. Install Node.js 18+ and try again." >&2
  exit 1
fi

NODE_VERSION="$("$NODE_BIN" -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  echo "Detected Node.js v$NODE_VERSION. Please upgrade to Node.js 18 or newer." >&2
  exit 1
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
  if command -v docker >/dev/null 2>&1; then
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
    echo "⚠️  Docker not found in PATH."
    echo "After installing Docker, run: make up-minimal"
  fi

  exit 0
fi
# Run the CLI-based setup wizard
exec "$NODE_BIN" "$SETUP_WIZARD" "$@"
