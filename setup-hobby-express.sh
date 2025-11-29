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
command -v docker >/dev/null 2>&1 || error "Docker is required. Install from https://docs.docker.com/get-docker/"
command -v node >/dev/null 2>&1 || error "Node.js 18+ is required. Install from https://nodejs.org/"

# Check Node version
NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  error "Node.js 18 or newer required. Current version: $NODE_VERSION"
fi

# Check Docker daemon
if ! docker info >/dev/null 2>&1; then
  error "Docker daemon is not running. Please start Docker Desktop or the Docker service."
fi

success "Prerequisites verified (Docker + Node.js $NODE_VERSION)"

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
