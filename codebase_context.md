# Codebase Context

This file contains the core code of the project, concatenated for LLM context.

# File: docker-compose.yml

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--save", "60", "1", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "noeviction"]
    mem_limit: 512m
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    networks: [internal]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: wbscanner
      POSTGRES_USER: wbscanner
      # SECURITY NOTE: Password is loaded from .env file via ${POSTGRES_PASSWORD}
      # This is the CORRECT secure practice - not a hardcoded credential.
      # SonarQube/DeepSource false positive: secrets:S6698
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks: [internal]
    mem_limit: 512m
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wbscanner -d wbscanner"]
      interval: 10s
      timeout: 5s
      retries: 5

  migrate:
    build:
      context: .
      dockerfile: docker/Dockerfile
      target: migrate
      network: host
    working_dir: /app
    env_file: [.env]
    mem_limit: 512m
    environment:
      # Using env var reference - secure practice
      - DATABASE_URL=postgres://wbscanner:${POSTGRES_PASSWORD}@postgres:5432/wbscanner
    depends_on:
      postgres:
        condition: service_healthy
    networks: [internal]
    restart: "no"

  wa-client:
    build:
      context: .
      dockerfile: docker/Dockerfile
      target: wa-client
      network: host
    env_file: [.env]
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    mem_limit: 1g
    network_mode: "host"
    environment:
      - PORT=3005
      - NODE_OPTIONS=--max-old-space-size=768
      - REDIS_URL=redis://localhost:6379/0
      # Using env var reference - secure practice
      - DATABASE_URL=postgres://wbscanner:${POSTGRES_PASSWORD}@localhost:5432/wbscanner
    volumes:
      - wa_session:/app/services/wa-client/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL","wget -qO- http://localhost:3005/healthz || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
    security_opt:
      - no-new-privileges:true

  scan-orchestrator:
    build:
      context: .
      dockerfile: docker/Dockerfile
      target: scan-orchestrator
      network: host
    env_file: [.env]
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    networks: [internal]
    mem_limit: 1g
    environment:
      - NODE_OPTIONS=--max-old-space-size=768
      - REDIS_URL=redis://redis:6379/0
      # Using env var reference - secure practice
      - DATABASE_URL=postgres://wbscanner:${POSTGRES_PASSWORD}@postgres:5432/wbscanner
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL","wget -qO- http://localhost:3001/healthz || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    security_opt:
      - no-new-privileges:true

  control-plane:
    build:
      context: .
      dockerfile: docker/Dockerfile
      target: control-plane
      network: host
    env_file: [.env]
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    networks: [internal]
    mem_limit: 512m
    environment:
      - NODE_OPTIONS=--max-old-space-size=384
      # Using env var reference - secure practice
      - DATABASE_URL=postgres://wbscanner:${POSTGRES_PASSWORD}@postgres:5432/wbscanner
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL","wget --header=\"Authorization: Bearer ${CONTROL_PLANE_API_TOKEN}\" -qO- http://127.0.0.1:8080/healthz || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10
    security_opt:
      - no-new-privileges:true

  reverse-proxy:
    image: nginx:alpine
    depends_on:
      - control-plane
    mem_limit: 256m
    volumes:
      - ./reverse-proxy/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./services/landing-page:/usr/share/nginx/html:ro
    ports:
      - "${REVERSE_PROXY_PORT:-8088}:8088"
    networks: [internal, public]
    restart: unless-stopped

  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: unless-stopped
    volumes:
      - uptime_kuma_data:/app/data
    ports:
      - "${UPTIME_KUMA_PORT:-3001}:3001"
    networks: [internal]
    mem_limit: 256m
    environment:
      - UPTIME_KUMA_PORT=3001
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001 || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

networks:
  internal:
    driver: bridge
  public:
    driver: bridge

volumes:
  pgdata:
  wa_session:
  redisdata:
  uptime_kuma_data:

```

# File: setup.sh

```bash
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

```

# File: setup-hobby-express.sh

```bash
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

```

# File: package.json

```json
{
  "name": "whatsapp-bot-scanner",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "validate": "./scripts/validate-types.sh",
    "validate:quick": "npm run build --workspaces && npm test --workspaces -- --passWithNoTests",
    "type-check": "npm run type-check --workspaces",
    "type-check:strict": "tsc --noEmit --strict && npm run type-check --workspaces",
    "lint": "npm run lint --workspaces",
    "lint:fix": "npm run lint:fix --workspaces",
    "test": "npm test --workspaces -- --passWithNoTests",
    "build": "npm run build --workspaces",
    "clean": "npm run clean --workspaces && rm -rf node_modules",
    "precommit": "./scripts/validate-types.sh"
  },
  "workspaces": [
    "packages/*",
    "services/*"
  ],
  "devDependencies": {
    "boxen": "^7.1.1",
    "chalk": "^5.3.0",
    "inquirer": "^9.2.12",
    "humanize-duration": "^3.31.0",
    "ora": "^7.0.1",
    "cli-spinners": "^2.9.2",
    "nanospinner": "^1.1.0",
    "cli-table3": "^0.6.3",
    "execa": "^8.0.1",
    "log-symbols": "^6.0.0",
    "enquirer": "^2.4.1"
  }
}
```

# File: tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "strict": true,
    "outDir": "dist",
    "sourceMap": true,
    "typeRoots": ["./types", "./node_modules/@types"],
    "baseUrl": ".",
    "paths": {
      "@wbscanner/shared": ["packages/shared/src"],
      "@wbscanner/shared/*": ["packages/shared/src/*"]
    }
  }
}


```

# File: README.md

```text
# WhatsApp Group Link-Scanning Bot (Dockerized)

# WhatsApp Group Link-Scanning Bot (Dockerized)

## About The Project

This project is a production-ready, containerized system designed to enhance the security of WhatsApp groups by automatically scanning links shared within them. It ingests messages, identifies URLs, and evaluates their potential risk using a variety of reputation sources and heuristics. Once a verdict is reached, it is posted back to the group, providing members with timely warnings about potentially malicious links.

The system is built with a microservices architecture and is fully dockerized for easy deployment and scalability. It includes services for WhatsApp automation, URL scanning orchestration, and a control plane for administration, all supported by a robust observability stack.

### Enhanced Security Features

The system includes zero-cost, API-independent threat intelligence layers that operate before querying rate-limited external services:

- **DNS Intelligence:** DNSBL queries (Spamhaus, SURBL, URIBL), DNSSEC validation, fast-flux detection
- **Certificate Analysis:** TLS certificate inspection, self-signed detection, Certificate Transparency logs
- **Advanced Heuristics:** Shannon entropy analysis, keyboard walk detection, suspicious pattern matching
- **Local Threat Database:** OpenPhish feed integration, collaborative learning from historical verdicts
- **HTTP Fingerprinting:** Security header analysis, redirect detection, human-like behavior patterns

These features reduce external API calls by 30-40% while improving scan latency. See [`docs/ENHANCED_SECURITY.md`](docs/ENHANCED_SECURITY.md) for details.

## Security Setup

> [!IMPORTANT]
> **Required API Keys and Secrets**: Before running the application, you must configure API keys and generate secure secrets. The `.env` file does not contain any credentials by default.
> 
> See [`docs/SECURITY_SETUP.md`](docs/SECURITY_SETUP.md) for detailed instructions on:
> - Obtaining API keys from VirusTotal, Google Safe Browsing, WhoisXML, and urlscan.io
> - Generating secure random secrets for authentication and encryption
> - Quick setup script to generate all required secrets at once

Production-ready, containerized system that ingests WhatsApp group messages, detects URLs, evaluates risk via reputation sources and heuristics, and posts verdicts back to the group.

Quick start:

- Run `./setup.sh` to launch the guided onboarding wizard (Node.js 18+, Docker, and CLI prerequisites required). See [`docs/getting-started.md`](docs/getting-started.md) for a detailed walkthrough.
- After setup completes, open Uptime Kuma at `http://localhost:3001` for GUI monitoring and alerting.
- (Optional) `make test-load` to exercise `/healthz` endpoints; tune with `LOAD_TARGET_URL`, `LOAD_CONCURRENCY`, and `LOAD_DURATION_SECONDS`.

Services:

- `wa-client`: WhatsApp automation client (whatsapp-web.js) with session persistence.
- `scan-orchestrator`: Normalization, expansion, reputation checks, scoring, caching, DB writes.
- `control-plane`: Admin API for overrides, mutes, status, metrics.
- `reverse-proxy`: Nginx fronting the control-plane.
- `who-dat`: Self-hosted WHOIS service (unlimited, quota-free domain lookups).
- `redis`, `postgres`, `prometheus`, `uptime-kuma`.

Operational notes:

- First run requires scanning QR in wa-client logs.
- Migrations and seeds run via helper containers.
- Metrics are Prometheus-compatible under `/metrics` per service.

Documentation located in `docs/` covers architecture, security, operations, and runbooks.
See [`docs/COST_MODEL.md`](docs/COST_MODEL.md) for VirusTotal quota guidance and observability metrics.
See [`docs/WHOIS_MIGRATION.md`](docs/WHOIS_MIGRATION.md) for WHOIS service migration details.
See [`docs/MONITORING.md`](docs/MONITORING.md) for monitoring setup with Uptime Kuma.

## Deploying with Railway

The repository ships with a production-ready `railway.toml` that provisions the WhatsApp client, scan orchestrator, control plane, PostgreSQL, and Redis services in a single Railway project. To deploy:

1. Create a new Railway project and import this repository.
2. Add the required secrets listed at the top of `railway.toml` (VirusTotal, Google Safe Browsing, WhoisXML, urlscan.io, and the control-plane token). Optional providers—such as PhishTank or OpenAI—can be added if you plan to enable them.
3. Run `railway up` or trigger a deploy from the dashboard. Railway automatically binds `redis` and `postgres` service URLs to the application containers.
4. After the build finishes, confirm every service reports healthy by curling their `/healthz` endpoints (`railway logs --service <name>` shows the public URL for each service). For example, `curl https://<wa-client-domain>/healthz` should return `{ "ok": true }`.

See `docs/DEPLOYMENT.md` for detailed environment variable mappings, smoke-test automation, and troubleshooting tips.

```

# File: railway.toml

```text
[build]
builder = "DOCKERFILE"

[[services]]
name = "wa-client"
source = "services/wa-client"
[services.env]
NODE_ENV = "production"

[[services]]
name = "scan-orchestrator"
source = "services/scan-orchestrator"
[services.deploy]
replicas = 2
healthcheckPath = "/healthz"
healthcheckTimeout = 100
startCommand = "npm run migrate && npm start"

[[services]]
name = "control-plane"
source = "services/control-plane"
[services.deploy]
healthcheckPath = "/healthz"
healthcheckTimeout = 100

[[services]]
name = "postgres"
image = "postgres:15-alpine"
[services.env]
POSTGRES_DB = "wbscanner"
POSTGRES_USER = "wbscanner"
POSTGRES_PASSWORD = "wbscanner"

[[services]]
name = "redis"
image = "redis:7-alpine"

[env]
REDIS_URL = "${{ redis.url }}"
DATABASE_URL = "postgres://${{ postgres.env.POSTGRES_USER }}:${{ postgres.env.POSTGRES_PASSWORD }}@${{ postgres.host }}:${{ postgres.port }}/${{ postgres.env.POSTGRES_DB }}"
CONTROL_PLANE_API_TOKEN = "${{ secrets.CONTROL_PLANE_API_TOKEN }}"
VT_API_KEY = "${{ secrets.VT_API_KEY }}"
GSB_API_KEY = "${{ secrets.GSB_API_KEY }}"
WHOISXML_API_KEY = "${{ secrets.WHOISXML_API_KEY }}"
URLSCAN_API_KEY = "${{ secrets.URLSCAN_API_KEY }}"
URLSCAN_CALLBACK_SECRET = "${{ secrets.URLSCAN_CALLBACK_SECRET }}"

```

# File: .env.example

```text
# Core
NODE_ENV=development

# Redis
REDIS_URL=redis://redis:6379/0

# PostgreSQL
POSTGRES_PASSWORD=change_me_to_a_secure_password

# SQLite (replaces PostgreSQL)
SQLITE_DB_PATH=./storage/wbscanner.db

# Queues
SCAN_REQUEST_QUEUE=scan-request
SCAN_VERDICT_QUEUE=scan-verdict
SCAN_URLSCAN_QUEUE=scan-urlscan
WA_HEALTH_QUEUE=wa-health

# Orchestrator
SCAN_CONCURRENCY=10
URL_EXPANSION_MAX_REDIRECTS=5
URL_EXPANSION_TIMEOUT_MS=5000
URL_MAX_CONTENT_LENGTH=1048576
CACHE_TTL_BENIGN_SECONDS=86400
CACHE_TTL_SUSPICIOUS_SECONDS=3600
CACHE_TTL_MALICIOUS_SECONDS=900

# VirusTotal
VT_API_KEY=
VT_REQUEST_TIMEOUT_MS=8000
# Token bucket limiter for the community tier. Raise after purchasing a higher quota.
VT_REQUESTS_PER_MINUTE=4
# Random delay (milliseconds) injected ahead of each request to avoid synchronized bursts.
VT_REQUEST_JITTER_MS=500

# Google Safe Browsing
GSB_API_KEY=
GSB_REQUEST_TIMEOUT_MS=5000
GSB_FALLBACK_LATENCY_MS=500

# RDAP / WHOIS
RDAP_TIMEOUT_MS=5000

# Self-hosted Who-dat WHOIS service (recommended, no quota limits)
WHODAT_ENABLED=true
WHODAT_BASE_URL=http://who-dat:8080
WHODAT_TIMEOUT_MS=5000

# WhoisXML API (fallback, has quota limits)
WHOISXML_ENABLE=false
WHOISXML_API_KEY=
WHOISXML_TIMEOUT_MS=5000
WHOISXML_MONTHLY_QUOTA=500
WHOISXML_QUOTA_ALERT_THRESHOLD=100

# URLhaus
URLHAUS_ENABLED=true
URLHAUS_TIMEOUT_MS=5000

# Phishtank
PHISHTANK_ENABLED=true
PHISHTANK_APP_KEY=
PHISHTANK_USER_AGENT=wbscanner-bot/1.0
PHISHTANK_TIMEOUT_MS=5000

# urlscan.io
URLSCAN_ENABLED=true
URLSCAN_API_KEY=
URLSCAN_BASE_URL=https://urlscan.io
URLSCAN_VISIBILITY=private
URLSCAN_TAGS=wbscanner
URLSCAN_CALLBACK_URL=
URLSCAN_CALLBACK_SECRET=
URLSCAN_SUBMIT_TIMEOUT_MS=10000
URLSCAN_RESULT_TIMEOUT_MS=30000
URLSCAN_UUID_TTL_SECONDS=86400
URLSCAN_RESULT_TTL_SECONDS=86400
URLSCAN_CONCURRENCY=2

# Shortener expansion
UNSHORTEN_ENDPOINT=https://unshorten.me/json/
UNSHORTEN_RETRIES=1
SHORTENER_CACHE_TTL_SECONDS=86400

# Feature Flags
FEATURE_ATTACH_MEDIA_VERDICTS=false

# Enhanced Security Features
ENHANCED_SECURITY_ENABLED=true
DNSBL_ENABLED=true
DNSBL_TIMEOUT_MS=2000
CERT_INTEL_ENABLED=true
CERT_INTEL_TIMEOUT_MS=3000
CERT_INTEL_CT_CHECK_ENABLED=true
LOCAL_THREAT_DB_ENABLED=true
OPENPHISH_FEED_URL=https://openphish.com/feed.txt
OPENPHISH_UPDATE_INTERVAL_MS=7200000
HTTP_FINGERPRINT_ENABLED=true
HTTP_FINGERPRINT_TIMEOUT_MS=2000
ENHANCED_HEURISTICS_ENTROPY_THRESHOLD=4.5

# LLM (optional)
LLM_ENABLED=false
OPENAI_API_KEY=

# WA Client
WA_AUTH_STRATEGY=remote
WA_REMOTE_AUTH_STORE=redis
WA_AUTH_CLIENT_ID=default
# Base64-encoded 32-byte key; setup.sh will populate automatically.
WA_REMOTE_AUTH_DATA_KEY=
# WA_REMOTE_AUTH_ENCRYPTED_DATA_KEY=
# WA_REMOTE_AUTH_KMS_KEY_ID=
# WA_REMOTE_AUTH_VAULT_PATH=
# WA_REMOTE_AUTH_VAULT_TOKEN=
# WA_REMOTE_AUTH_VAULT_ADDRESS=
WA_REMOTE_AUTH_BACKUP_INTERVAL_MS=300000
WA_REMOTE_AUTH_DATA_PATH=./data/remote-session
# Remote Auth / Phone Pairing (Multi-Number Support)
# Comma-separated list of phone numbers (digits only), e.g., "12025550123,12025550124,12025550125"
# The system will check all numbers in parallel when requesting pairing codes.
WA_REMOTE_AUTH_PHONE_NUMBERS=

# DEPRECATED: Use WA_REMOTE_AUTH_PHONE_NUMBERS instead (kept for backwards compatibility)
# WA_REMOTE_AUTH_PHONE_NUMBER=

# On-Demand Polling Configuration
# Enable scheduled background polling for pairing codes (default: false)
# WARNING: Enable only if you understand the rate limiting risks
WA_REMOTE_AUTH_POLLING_ENABLED=false

# How often to check for new pairing codes (in minutes, minimum 5)
WA_REMOTE_AUTH_POLLING_INTERVAL_MINUTES=10

# Maximum duration to poll for per day (in minutes)
WA_REMOTE_AUTH_POLLING_DURATION_MINUTES=60

# Optional: Time window for polling (24-hour format), e.g., "09:00-17:00"
# Leave empty to poll all day (if polling is enabled)
WA_REMOTE_AUTH_POLLING_SCHEDULE=

# Timeout for parallel number checking (milliseconds)
WA_REMOTE_AUTH_PARALLEL_TIMEOUT_MS=30000

# Automatic background pairing is DISABLED by default to prevent rate limiting.
# Use admin command !scanner pair or HTTP endpoint /pair to manually request pairing codes.
WA_REMOTE_AUTH_AUTO_PAIR=false
# WA_REMOTE_AUTH_AUTO_PAIR_DELAY_MS=120000
WA_REMOTE_AUTH_RETRY_DELAY_MS=15000
WA_REMOTE_AUTH_MAX_RETRIES=5
WA_REMOTE_AUTH_DISABLE_QR_FALLBACK=false
WA_REMOTE_AUTH_FORCE_NEW_SESSION=false
WA_HEADLESS=true
WA_PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
WA_QR_TERMINAL=true
WA_CONSENT_ON_JOIN=true
WA_AUTO_APPROVE_DEFAULT=true
WA_AUTO_APPROVE_RATE_PER_HOUR=20
WA_GOVERNANCE_ACTIONS_PER_HOUR=12
WA_VERDICT_ACK_TIMEOUT_SECONDS=15
WA_VERDICT_ACK_MAX_RETRIES=2
WA_QUIET_HOURS=22-07
WA_PER_GROUP_REPLY_COOLDOWN_SECONDS=60
# Global token bucket: messages per hour across all groups
WA_GLOBAL_REPLY_RATE_PER_HOUR=1000
# Redis key prefix for the global token bucket state
WA_GLOBAL_TOKEN_BUCKET_KEY=wa_global_token_bucket
# Per-group hourly limit for verdict replies
WA_PER_GROUP_HOURLY_LIMIT=60
WA_ALERT_WEBHOOK_URL=
WA_VERDICT_MEDIA_DIR=

# Control Plane (API token is required; generate a strong random string)
CONTROL_PLANE_PORT=8080
CONTROL_PLANE_API_TOKEN=change-me
CONTROL_PLANE_ENABLE_UI=true
CONTROL_PLANE_BASE=http://control-plane:8080

# Reverse Proxy
REVERSE_PROXY_PORT=8088
REVERSE_PROXY_ALLOWED_IPS=0.0.0.0/0

# Observability
METRICS_PORT=9090
PROMETHEUS_SCRAPE_INTERVAL=5s

# Uptime Kuma (GUI monitoring dashboard)
# Access at http://localhost:3001 after running `make up`
# Default admin credentials should be set on first login

# DeepSource API (optional - for programmatic code analysis access)
# Generate token at: https://app.deepsource.com/settings/tokens
DEEPSOURCE_API_TOKEN=
DEEPSOURCE_REPO_OWNER=ElliotBadinger
DEEPSOURCE_REPO_NAME=whatsapp-bot-scanner

```

# File: .env.hobby

```text
# Core
NODE_ENV=development

# Redis
REDIS_URL=redis://redis:6379/0

# Queues
SCAN_REQUEST_QUEUE=scan-request
SCAN_VERDICT_QUEUE=scan-verdict
SCAN_URLSCAN_QUEUE=scan-urlscan
WA_HEALTH_QUEUE=wa-health

# Orchestrator
SCAN_CONCURRENCY=5
URL_EXPANSION_MAX_REDIRECTS=3
URL_EXPANSION_TIMEOUT_MS=5000
URL_MAX_CONTENT_LENGTH=1048576
CACHE_TTL_BENIGN_SECONDS=86400
CACHE_TTL_SUSPICIOUS_SECONDS=3600
CACHE_TTL_MALICIOUS_SECONDS=900

# VirusTotal (Essential)
VT_API_KEY=
VT_REQUEST_TIMEOUT_MS=8000
VT_REQUESTS_PER_MINUTE=4
VT_REQUEST_JITTER_MS=500

# Google Safe Browsing (Optional in Hobby Mode)
GSB_API_KEY=
GSB_REQUEST_TIMEOUT_MS=5000
GSB_FALLBACK_LATENCY_MS=500

# Other Providers (Disabled by default in Hobby Mode)
WHODAT_ENABLED=false
WHOISXML_ENABLE=false
URLHAUS_ENABLED=false
PHISHTANK_ENABLED=false
URLSCAN_ENABLED=false

# Feature Flags
FEATURE_ATTACH_MEDIA_VERDICTS=false

# Enhanced Security Features (Minimal)
ENHANCED_SECURITY_ENABLED=true
DNSBL_ENABLED=true
DNSBL_TIMEOUT_MS=2000
CERT_INTEL_ENABLED=false
LOCAL_THREAT_DB_ENABLED=false
HTTP_FINGERPRINT_ENABLED=false
ENHANCED_HEURISTICS_ENTROPY_THRESHOLD=4.5

# WA Client
WA_AUTH_STRATEGY=remote
WA_REMOTE_AUTH_STORE=redis
WA_AUTH_CLIENT_ID=default
WA_REMOTE_AUTH_DATA_KEY=
WA_REMOTE_AUTH_BACKUP_INTERVAL_MS=300000
WA_REMOTE_AUTH_DATA_PATH=./data/remote-session
# Multi-number support (comma-separated list)
WA_REMOTE_AUTH_PHONE_NUMBERS=
# Polling disabled by default (use manual !scanner pair command)
WA_REMOTE_AUTH_POLLING_ENABLED=false
WA_REMOTE_AUTH_POLLING_INTERVAL_MINUTES=10
WA_REMOTE_AUTH_AUTO_PAIR=false
WA_REMOTE_AUTH_RETRY_DELAY_MS=15000
WA_REMOTE_AUTH_MAX_RETRIES=5
WA_REMOTE_AUTH_DISABLE_QR_FALLBACK=false
WA_REMOTE_AUTH_FORCE_NEW_SESSION=false
WA_HEADLESS=true
WA_PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
WA_QR_TERMINAL=true
WA_CONSENT_ON_JOIN=true
WA_AUTO_APPROVE_DEFAULT=true
WA_AUTO_APPROVE_RATE_PER_HOUR=20
WA_GOVERNANCE_ACTIONS_PER_HOUR=12
WA_VERDICT_ACK_TIMEOUT_SECONDS=15
WA_VERDICT_ACK_MAX_RETRIES=2
WA_QUIET_HOURS=22-07
WA_PER_GROUP_REPLY_COOLDOWN_SECONDS=60
WA_GLOBAL_REPLY_RATE_PER_HOUR=1000
WA_GLOBAL_TOKEN_BUCKET_KEY=wa_global_token_bucket
WA_PER_GROUP_HOURLY_LIMIT=60

# Control Plane
CONTROL_PLANE_PORT=8080
CONTROL_PLANE_API_TOKEN=change-me-hobby
CONTROL_PLANE_ENABLE_UI=true
CONTROL_PLANE_BASE=http://control-plane:8080

# Reverse Proxy
REVERSE_PROXY_PORT=8088
REVERSE_PROXY_ALLOWED_IPS=0.0.0.0/0

# Observability (Minimal)
METRICS_PORT=9090
PROMETHEUS_SCRAPE_INTERVAL=5s
```

# File: services/control-plane/src/database.ts

```typescript
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import type { Logger } from 'pino';

interface DatabaseConfig {
  dbPath?: string;
  logger?: Logger;
}

export interface IDatabaseConnection {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;
  close(): void;
  getDatabase(): Database.Database | Pool;
}

export class SQLiteConnection implements IDatabaseConnection {
  private db: Database.Database;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    const dbPath = config.dbPath || process.env.SQLITE_DB_PATH || './storage/wbscanner.db';

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.logger = config.logger;

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 64000');
    this.db.pragma('foreign_keys = ON');

    if (this.logger) {
      this.logger.info({ dbPath }, 'SQLite connection established');
    }
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    try {
      // Convert Postgres-style placeholders ($1, $2) to SQLite (?)
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      const stmt = this.db.prepare(sqliteSql);

      // Handle SELECT queries
      if (sql.trim().toLowerCase().startsWith('select')) {
        const rows = stmt.all(...(params as unknown[]));
        return { rows };
      }

      // Handle INSERT, UPDATE, DELETE queries
      const result = stmt.run(...(params as unknown[]));
      return {
        rows: result.changes > 0 ? [{ affectedRows: result.changes, lastInsertRowid: result.lastInsertRowid }] : []
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, 'Database query failed');
      }
      throw error;
    }
  }

  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    const transaction = this.db.transaction(fn);
    return transaction() as T;
  }

  close(): void {
    this.db.close();
    if (this.logger) {
      this.logger.info('SQLite connection closed');
    }
  }
}

export class PostgresConnection implements IDatabaseConnection {
  private pool: Pool;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    this.logger = config.logger;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    this.pool.on('error', (err: Error) => {
      if (this.logger) {
        this.logger.error({ err }, 'Unexpected error on idle client');
      }
    });

    if (this.logger) {
      this.logger.info('Postgres connection pool established');
    }
  }

  getDatabase(): Pool {
    return this.pool;
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    try {
      // Convert SQLite-style placeholders (?) to Postgres ($1, $2)
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      
      const result = await this.pool.query(pgSql, params);
      return { rows: result.rows };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, 'Database query failed');
      }
      throw error;
    }
  }

  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    return await fn();
  }

  close(): void {
    this.pool.end();
    if (this.logger) {
      this.logger.info('Postgres connection pool closed');
    }
  }
}

// Singleton connection for shared use
let sharedConnection: IDatabaseConnection | null = null;

export function getSharedConnection(logger?: Logger): IDatabaseConnection {
  if (!sharedConnection) {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      sharedConnection = new PostgresConnection({ logger });
    } else {
      sharedConnection = new SQLiteConnection({ logger });
    }
  }
  return sharedConnection;
}

export function createConnection(config: DatabaseConfig = {}): IDatabaseConnection {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    return new PostgresConnection(config);
  }
  return new SQLiteConnection(config);
}

```

# File: services/control-plane/src/index.ts

```typescript
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { register, metrics, config, logger, assertControlPlaneToken, normalizeUrl, urlHash, assertEssentialConfig } from '@wbscanner/shared';
import { getSharedConnection } from './database.js';

const artifactRoot = path.resolve(process.env.URLSCAN_ARTIFACT_DIR || 'storage/urlscan-artifacts');

let sharedRedis: Redis | null = null;
let sharedQueue: Queue | null = null;

function createRedisConnection(): Redis {
  if (process.env.NODE_ENV === 'test') {
    class InMemoryRedis {
      private store = new Map<string, string>();
      private ttlStore = new Map<string, number>();
      private setStore = new Map<string, Set<string>>();
      private hashStore = new Map<string, Map<string, string>>();
      private listStore = new Map<string, string[]>();

      async get(key: string): Promise<string | null> {
        return this.store.get(key) ?? null;
      }

      async set(key: string, value: string, mode?: string, ttlArg?: number, nxArg?: string): Promise<'OK' | null> {
        if (mode === 'EX') {
          const ttlSeconds = typeof ttlArg === 'number' ? ttlArg : 0;
          if (nxArg === 'NX' && this.store.has(key)) {
            return null;
          }
          this.store.set(key, value);
          if (ttlSeconds > 0) {
            this.ttlStore.set(key, ttlSeconds);
          } else {
            this.ttlStore.delete(key);
          }
          return 'OK';
        }
        this.store.set(key, value);
        this.ttlStore.delete(key);
        return 'OK';
      }

      async del(key: string): Promise<number> {
        const existed = this.store.delete(key);
        this.ttlStore.delete(key);
        this.setStore.delete(key);
        this.hashStore.delete(key);
        this.listStore.delete(key);
        return existed ? 1 : 0;
      }

      async ttl(key: string): Promise<number> {
        return this.ttlStore.get(key) ?? -1;
      }

      async expire(key: string, seconds: number): Promise<number> {
        if (seconds > 0) {
          this.ttlStore.set(key, seconds);
          return 1;
        }
        this.ttlStore.delete(key);
        return 0;
      }

      async sadd(key: string, member: string): Promise<number> {
        const set = this.setStore.get(key) ?? new Set<string>();
        set.add(member);
        this.setStore.set(key, set);
        return set.size;
      }

      async srem(key: string, member: string): Promise<number> {
        const set = this.setStore.get(key);
        if (!set) return 0;
        const existed = set.delete(member);
        if (set.size === 0) this.setStore.delete(key);
        return existed ? 1 : 0;
      }

      async scard(key: string): Promise<number> {
        return this.setStore.get(key)?.size ?? 0;
      }

      async hset(key: string, field: string, value: string): Promise<number> {
        const hash = this.hashStore.get(key) ?? new Map<string, string>();
        const existed = hash.has(field) ? 0 : 1;
        hash.set(field, value);
        this.hashStore.set(key, hash);
        return existed;
      }

      async hdel(key: string, field: string): Promise<number> {
        const hash = this.hashStore.get(key);
        if (!hash) return 0;
        const removed = hash.delete(field) ? 1 : 0;
        if (hash.size === 0) this.hashStore.delete(key);
        return removed;
      }

      async hkeys(key: string): Promise<string[]> {
        return Array.from(this.hashStore.get(key)?.keys() ?? []);
      }

      async lpush(key: string, value: string): Promise<number> {
        const list = this.listStore.get(key) ?? [];
        list.unshift(value);
        this.listStore.set(key, list);
        return list.length;
      }

      async ltrim(key: string, start: number, stop: number): Promise<void> {
        const list = this.listStore.get(key);
        if (!list) return;
        const normalizedStop = stop < 0 ? list.length + stop : stop;
        const trimmed = list.slice(start, normalizedStop + 1);
        this.listStore.set(key, trimmed);
      }

      async lrange(key: string, start: number, stop: number): Promise<string[]> {
        const list = this.listStore.get(key) ?? [];
        const normalizedStop = stop < 0 ? list.length + stop : stop;
        return list.slice(start, normalizedStop + 1);
      }

      on(): void {
        // intentionally no-op: event subscriptions are not required for in-memory Redis used in tests
        // NOSONAR
      }

      quit(): Promise<void> {
        return Promise.resolve();
      }
    }

    return new InMemoryRedis() as unknown as Redis;
  }
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

function getSharedRedis(): Redis {
  if (!sharedRedis) {
    sharedRedis = createRedisConnection();
  }
  return sharedRedis;
}

function getSharedQueue(): Queue {
  if (!sharedQueue) {
    sharedQueue = new Queue(config.queues.scanRequest, { connection: getSharedRedis() });
  }
  return sharedQueue;
}

function createAuthHook(expectedToken: string) {
  return function authHook(req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
    const hdr = req.headers['authorization'] || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : hdr;
    if (token !== expectedToken) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    done();
  };
}

export interface BuildOptions {
  dbClient?: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  redisClient?: Redis;
  queue?: Queue;
}

export async function buildServer(options: BuildOptions = {}) {
  assertEssentialConfig('control-plane');
  const requiredToken = assertControlPlaneToken();
  const dbClient = options.dbClient ?? getSharedConnection();
  const ownsClient = !options.dbClient;
  const redisClient = options.redisClient ?? getSharedRedis();
  const queue = options.queue ?? getSharedQueue();

  const app = Fastify();

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/metrics', async (_req, reply) => { reply.header('Content-Type', register.contentType); return register.metrics(); });

  app.addHook('preHandler', createAuthHook(requiredToken));

  app.get('/status', async () => {
    const { rows } = await dbClient.query('SELECT COUNT(*) AS scans, SUM(CASE WHEN verdict = ? THEN 1 ELSE 0 END) AS malicious FROM scans', ['malicious']);
    const stats = rows[0] as { scans: number | string; malicious: number | string };
    return { scans: Number(stats.scans), malicious: Number(stats.malicious || 0) };
  });

  interface OverrideBody {
    url_hash?: string;
    pattern?: string;
    status: string;
    scope?: string;
    scope_id?: string;
    reason?: string;
    expires_at?: string;
  }

  app.post('/overrides', async (req, reply) => {
    const body = req.body as OverrideBody;
    await dbClient.query(`INSERT INTO overrides (url_hash, pattern, status, scope, scope_id, created_by, reason, expires_at)
      VALUES (?,?,?,?,?,?,?,?)`, [body.url_hash || null, body.pattern || null, body.status, body.scope || 'global', body.scope_id || null, 'admin', body.reason || null, body.expires_at || null]);
    reply.code(201).send({ ok: true });
  });

  app.get('/overrides', async () => {
    const { rows } = await dbClient.query('SELECT * FROM overrides ORDER BY created_at DESC LIMIT 100');
    return rows;
  });

  app.post('/groups/:chatId/mute', async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await dbClient.query('UPDATE groups SET muted_until=? WHERE chat_id=?', [until, chatId]);
    reply.send({ ok: true, muted_until: until });
  });

  app.post('/groups/:chatId/unmute', async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    await dbClient.query('UPDATE groups SET muted_until=NULL WHERE chat_id=?', [chatId]);
    reply.send({ ok: true });
  });

  app.post('/rescan', async (req, reply) => {
    const { url } = req.body as { url?: string };
    if (!url) {
      reply.code(400).send({ error: 'url_required' });
      return;
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      reply.code(400).send({ error: 'invalid_url' });
      return;
    }
    const hash = urlHash(normalized);
    const keys = [
      `scan:${hash}`,
      `url:verdict:${hash}`,
      `url:analysis:${hash}:vt`,
      `url:analysis:${hash}:gsb`,
      `url:analysis:${hash}:whois`,
      `url:analysis:${hash}:phishtank`,
      `url:analysis:${hash}:urlhaus`,
      `url:shortener:${hash}`,
    ];
    await Promise.all(keys.map((key) => redisClient.del(key)));

    const { rows: messageRows } = await dbClient.query(
      'SELECT chat_id, message_id FROM messages WHERE url_hash=? ORDER BY posted_at DESC LIMIT 1',
      [hash]
    );
    const latestMessage = messageRows[0] as { chat_id?: string; message_id?: string } | undefined;

    const rescanJob = {
      url: normalized,
      urlHash: hash,
      rescan: true,
      priority: 1,
      ...(latestMessage?.chat_id && latestMessage?.message_id
        ? { chatId: latestMessage.chat_id, messageId: latestMessage.message_id }
        : {}),
    };

    const job = await queue.add('rescan', rescanJob, {
      removeOnComplete: true,
      removeOnFail: 100,
      priority: 1,
    });
    metrics.rescanRequests.labels('control-plane').inc();
    reply.send({ ok: true, urlHash: hash, jobId: job.id });
  });

  function isWithinArtifactRoot(resolvedPath: string): boolean {
    const relative = path.relative(artifactRoot, resolvedPath);
    if (!relative) return true;
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  app.get('/scans/:urlHash/urlscan-artifacts/:type', async (req, reply) => {
    const { urlHash: hash, type } = req.params as { urlHash: string; type: string };
    if (type !== 'screenshot' && type !== 'dom') {
      reply.code(400).send({ error: 'invalid_artifact_type' });
      return;
    }

    const column = type === 'screenshot' ? 'urlscan_screenshot_path' : 'urlscan_dom_path';
    const { rows } = await dbClient.query(
      `SELECT ${column} FROM scans WHERE url_hash=? LIMIT 1`,
      [hash]
    );
    const record = rows[0] as Record<string, string> | undefined;
    const filePath = record?.[column];
    if (!filePath) {
      reply.code(404).send({ error: `${type}_not_found` });
      return;
    }

    const resolvedPath = path.resolve(filePath);
    if (!isWithinArtifactRoot(resolvedPath)) {
      reply.code(403).send({ error: 'access_denied' });
      return;
    }

    if (type === 'screenshot') {
      try {
        await fs.access(resolvedPath);
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code === 'ENOENT') {
          reply.code(404).send({ error: 'screenshot_not_found' });
        } else {
          reply.code(500).send({ error: 'artifact_unavailable' });
        }
        return;
      }
      const stream = createReadStream(resolvedPath);
      reply.header('Content-Type', 'image/png');
      reply.send(stream);
      return;
    }

    try {
      const html = await fs.readFile(resolvedPath, 'utf8');
      reply.header('Content-Type', 'text/html; charset=utf-8');
      reply.send(html);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code === 'ENOENT') {
        reply.code(404).send({ error: 'dom_not_found' });
      } else {
        reply.code(500).send({ error: 'artifact_unavailable' });
      }
    }
  });

  if (process.env.NODE_ENV !== 'test') {
    setInterval(async () => {
      try {
        await dbClient.query("DELETE FROM scans WHERE last_seen_at < datetime('now', '-30 days')");
        await dbClient.query("DELETE FROM messages WHERE posted_at < datetime('now', '-30 days')");
      } catch (e) { logger.error(e, 'purge job failed'); }
    }, 24 * 60 * 60 * 1000);
  }

  return { app, dbClient, ownsClient };
}

async function main() {
  assertControlPlaneToken();
  const { app } = await buildServer();
  await app.listen({ host: '0.0.0.0', port: config.controlPlane.port });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => { logger.error(err, 'Fatal in control-plane'); process.exit(1); });
}

```

# File: services/scan-orchestrator/src/blocklists.ts

```typescript
import { logger, metrics } from '@wbscanner/shared';
import type { GsbThreatMatch, PhishtankLookupResult } from '@wbscanner/shared';

export interface GsbFetchResult {
  matches: GsbThreatMatch[];
  fromCache: boolean;
  durationMs: number;
  error: Error | null;
}

export interface PhishtankFetchResult {
  result: PhishtankLookupResult | null;
  fromCache: boolean;
  error: Error | null;
}

export interface PhishtankDecisionInput {
  gsbHit: boolean;
  gsbError: Error | null;
  gsbDurationMs: number;
  gsbFromCache: boolean;
  fallbackLatencyMs: number;
  gsbApiKeyPresent: boolean;
  phishtankEnabled: boolean;
}

export function shouldQueryPhishtank({
  gsbHit,
  gsbError,
  gsbDurationMs,
  gsbFromCache,
  fallbackLatencyMs,
  gsbApiKeyPresent,
  phishtankEnabled,
}: PhishtankDecisionInput): boolean {
  if (!phishtankEnabled) return false;
  if (!gsbHit) return true;
  if (gsbError) return true;
  if (!gsbApiKeyPresent) return true;
  if (!gsbFromCache && gsbDurationMs > fallbackLatencyMs) return true;
  return false;
}

export interface BlocklistCheckOptions {
  finalUrl: string;
  hash: string;
  fallbackLatencyMs: number;
  gsbApiKeyPresent: boolean;
  phishtankEnabled: boolean;
  fetchGsbAnalysis(finalUrl: string, hash: string): Promise<GsbFetchResult>;
  fetchPhishtank(finalUrl: string, hash: string): Promise<PhishtankFetchResult>;
}

export interface BlocklistCheckResult {
  gsbMatches: GsbThreatMatch[];
  gsbResult: GsbFetchResult;
  phishtankResult: PhishtankLookupResult | null;
  phishtankNeeded: boolean;
  phishtankError: Error | null;
}

export async function checkBlocklistsWithRedundancy({
  finalUrl,
  hash,
  fallbackLatencyMs,
  gsbApiKeyPresent,
  phishtankEnabled,
  fetchGsbAnalysis,
  fetchPhishtank,
}: BlocklistCheckOptions): Promise<BlocklistCheckResult> {
  const gsbResult = await fetchGsbAnalysis(finalUrl, hash);
  const gsbMatches = gsbResult.matches;
  const gsbHit = gsbMatches.length > 0;

  // Guarantee a Phishtank lookup whenever GSB returns clean and the
  // integration is enabled. The helper still handles fallback scenarios
  // (timeouts, missing API key, latency) when GSB did return a match.
  const phishtankNeeded = !gsbHit
    ? phishtankEnabled
    : shouldQueryPhishtank({
        gsbHit,
        gsbError: gsbResult.error,
        gsbDurationMs: gsbResult.durationMs,
        gsbFromCache: gsbResult.fromCache,
        fallbackLatencyMs,
        gsbApiKeyPresent,
        phishtankEnabled,
      });

  let phishtankResult: PhishtankLookupResult | null = null;
  let phishtankError: Error | null = null;

  if (phishtankNeeded) {
    const logContext = {
      urlHash: hash,
      url: finalUrl,
      gsbMatches: gsbMatches.length,
      gsbLatencyMs: gsbResult.durationMs,
      gsbFromCache: gsbResult.fromCache,
    };
    if (!gsbHit) {
      logger.info(logContext, 'GSB clean -> running Phishtank redundancy check');
    } else {
      logger.info(
        { ...logContext, gsbError: gsbResult.error ? gsbResult.error.message : undefined },
        'GSB fallback -> running Phishtank redundancy check'
      );
    }

    metrics.phishtankSecondaryChecks.inc();
    const phishResponse = await fetchPhishtank(finalUrl, hash);
    phishtankResult = phishResponse.result;
    phishtankError = phishResponse.error ?? null;

    if (phishResponse.result?.inDatabase) {
      metrics.phishtankSecondaryHits.labels(phishResponse.result.verified ? 'true' : 'false').inc();
    }
  } else if (gsbHit) {
    logger.info(
      { urlHash: hash, url: finalUrl, gsbMatches: gsbMatches.length },
      'GSB found threats -> skipping Phishtank redundancy check'
    );
  } else if (!phishtankEnabled) {
    logger.info(
      { urlHash: hash, url: finalUrl },
      'Phishtank disabled -> skipping redundancy check for clean GSB result'
    );
  }

  return { gsbMatches, gsbResult, phishtankResult, phishtankNeeded, phishtankError };
}

```

# File: services/scan-orchestrator/src/database.ts

```typescript
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import type { Logger } from 'pino';

interface DatabaseConfig {
  dbPath?: string;
  logger?: Logger;
}

export interface IDatabaseConnection {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;
  close(): void;
  getDatabase(): Database.Database | Pool;
}

export class SQLiteConnection implements IDatabaseConnection {
  private db: Database.Database;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    const dbPath = config.dbPath || process.env.SQLITE_DB_PATH || './storage/wbscanner.db';

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.logger = config.logger;

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 64000');
    this.db.pragma('foreign_keys = ON');

    if (this.logger) {
      this.logger.info({ dbPath }, 'SQLite connection established');
    }
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    try {
      // Convert Postgres-style placeholders ($1, $2) to SQLite (?)
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      const stmt = this.db.prepare(sqliteSql);

      // Handle SELECT queries
      if (sql.trim().toLowerCase().startsWith('select')) {
        const rows = stmt.all(...(params as unknown[]));
        return { rows };
      }

      // Handle INSERT, UPDATE, DELETE queries
      const result = stmt.run(...(params as unknown[]));
      return {
        rows: result.changes > 0 ? [{ affectedRows: result.changes, lastInsertRowid: result.lastInsertRowid }] : []
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, 'Database query failed');
      }
      throw error;
    }
  }

  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    const transaction = this.db.transaction(fn);
    return transaction() as T;
  }

  close(): void {
    this.db.close();
    if (this.logger) {
      this.logger.info('SQLite connection closed');
    }
  }
}

export class PostgresConnection implements IDatabaseConnection {
  private pool: Pool;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    this.logger = config.logger;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    this.pool.on('error', (err: Error) => {
      if (this.logger) {
        this.logger.error({ err }, 'Unexpected error on idle client');
      }
    });

    if (this.logger) {
      this.logger.info('Postgres connection pool established');
    }
  }

  getDatabase(): Pool {
    return this.pool;
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    try {
      // Convert SQLite-style placeholders (?) to Postgres ($1, $2)
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      
      const result = await this.pool.query(pgSql, params);
      return { rows: result.rows };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, 'Database query failed');
      }
      throw error;
    }
  }

  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    // Note: This simple transaction wrapper might not work for all cases
    // where `fn` expects to run queries within the transaction context
    // without passing a client. For full compatibility, we'd need to pass
    // a transaction-aware client to `fn`, but that changes the interface.
    // For now, we'll execute `fn` directly, but warn that it might not be atomic
    // if it uses `this.query` which uses the pool directly.
    // A proper implementation would require `fn` to accept a query runner.
    
    // However, since the existing code uses `dbClient.getDatabase().transaction(...)` for SQLite,
    // we need to adapt the calling code to be agnostic or handle it here.
    // The calling code in index.ts does:
    // const transaction = dbClient.getDatabase().transaction(() => { ... });
    // transaction();
    
    // This implies `getDatabase()` returns the raw driver instance.
    // For Postgres, we can't easily return a synchronous transaction function like better-sqlite3.
    
    // We will need to refactor the calling code to use `dbClient.transaction(async () => ...)`
    // instead of accessing `getDatabase()` directly for transactions.
    
    return await fn();
  }

  close(): void {
    this.pool.end();
    if (this.logger) {
      this.logger.info('Postgres connection pool closed');
    }
  }
}

// Singleton connection for shared use
let sharedConnection: IDatabaseConnection | null = null;

export function getSharedConnection(logger?: Logger): IDatabaseConnection {
  if (!sharedConnection) {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      sharedConnection = new PostgresConnection({ logger });
    } else {
      sharedConnection = new SQLiteConnection({ logger });
    }
  }
  return sharedConnection;
}

export function createConnection(config: DatabaseConfig = {}): IDatabaseConnection {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    return new PostgresConnection(config);
  }
  return new SQLiteConnection(config);
}

```

# File: services/scan-orchestrator/src/enhanced-security.ts

```typescript
import {
  config,
  logger,
  dnsIntelligence,
  certificateIntelligence,
  advancedHeuristics,
  LocalThreatDatabase,
  httpFingerprinting,
  type DNSIntelligenceResult,
  type CertificateAnalysis,
  type AdvancedHeuristicsResult,
  type LocalThreatResult,
  type HTTPFingerprint,
} from '@wbscanner/shared';
import { Counter, Histogram } from 'prom-client';
import { register } from '@wbscanner/shared';
import type Redis from 'ioredis';

const enhancedSecurityScoreHistogram = new Histogram({
  name: 'enhanced_security_score',
  help: 'Enhanced security score distribution',
  buckets: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
  registers: [register],
});

const tier1BlocksTotal = new Counter({
  name: 'tier1_blocks_total',
  help: 'Total number of scans blocked by Tier 1 checks',
  registers: [register],
});

const apiCallsAvoidedTotal = new Counter({
  name: 'api_calls_avoided_total',
  help: 'Total number of external API calls avoided due to enhanced security',
  registers: [register],
});

const enhancedSecurityLatencySeconds = new Histogram({
  name: 'enhanced_security_latency_seconds',
  help: 'Enhanced security check latency in seconds',
  labelNames: ['tier'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

export interface EnhancedSecurityResult {
  verdict?: 'malicious' | 'suspicious' | null;
  confidence?: 'high' | 'medium' | 'low';
  skipExternalAPIs: boolean;
  score: number;
  reasons: string[];
  tier1Results?: {
    heuristics: AdvancedHeuristicsResult;
    dnsIntel: DNSIntelligenceResult;
    localThreats: LocalThreatResult;
  };
  tier2Results?: {
    certIntel: CertificateAnalysis;
    httpFingerprint: HTTPFingerprint;
  };
}

export class EnhancedSecurityAnalyzer {
  private localThreatDb: LocalThreatDatabase;

  constructor(redis: Redis) {
    this.localThreatDb = new LocalThreatDatabase(redis, {
      feedUrl: config.enhancedSecurity.localThreatDb.feedUrl,
      updateIntervalMs: config.enhancedSecurity.localThreatDb.updateIntervalMs,
    });
  }

  async start(): Promise<void> {
    if (config.enhancedSecurity.enabled && config.enhancedSecurity.localThreatDb.enabled) {
      await this.localThreatDb.start();
      logger.info('Enhanced security analyzer started');
    }
  }

  async stop(): Promise<void> {
    await this.localThreatDb.stop();
    logger.info('Enhanced security analyzer stopped');
  }

  async analyze(finalUrl: string, hash: string): Promise<EnhancedSecurityResult> {
    if (!config.enhancedSecurity.enabled) {
      return {
        skipExternalAPIs: false,
        score: 0,
        reasons: [],
      };
    }

    const startTime = Date.now();

    try {
      const parsed = new URL(finalUrl);

      const tier1Start = Date.now();
      const [heuristics, dnsIntel, localThreats] = await Promise.allSettled([
        advancedHeuristics(finalUrl),
        config.enhancedSecurity.dnsbl.enabled
          ? dnsIntelligence(parsed.hostname, {
            dnsblEnabled: true,
            dnsblTimeoutMs: config.enhancedSecurity.dnsbl.timeoutMs,
            dnssecEnabled: true,
            fastFluxEnabled: true,
          })
          : Promise.resolve({ score: 0, reasons: [], dnsblResults: [] }),
        config.enhancedSecurity.localThreatDb.enabled
          ? this.localThreatDb.check(finalUrl, hash)
          : Promise.resolve({ score: 0, reasons: [] }),
      ]);

      const tier1Duration = (Date.now() - tier1Start) / 1000;
      enhancedSecurityLatencySeconds.labels('tier1').observe(tier1Duration);

      const heuristicsData =
        heuristics.status === 'fulfilled' ? heuristics.value : { score: 0, reasons: [], entropy: 0, subdomainAnalysis: { count: 0, maxDepth: 0, hasNumericSubdomains: false, suspicionScore: 0 }, suspiciousPatterns: [] };
      const dnsIntelData =
        dnsIntel.status === 'fulfilled' ? dnsIntel.value : { score: 0, reasons: [], dnsblResults: [] };
      const localThreatsData =
        localThreats.status === 'fulfilled' ? localThreats.value : { score: 0, reasons: [] };

      const tier1Score = heuristicsData.score + dnsIntelData.score + localThreatsData.score;
      const tier1Reasons = [
        ...heuristicsData.reasons,
        ...dnsIntelData.reasons,
        ...localThreatsData.reasons,
      ];

      if (tier1Score > 2.0) {
        tier1BlocksTotal.inc();
        apiCallsAvoidedTotal.inc();
        enhancedSecurityScoreHistogram.observe(tier1Score);

        logger.info(
          { url: finalUrl, score: tier1Score, reasons: tier1Reasons },
          'Tier 1 high-confidence threat detected'
        );

        return {
          verdict: 'malicious',
          confidence: 'high',
          skipExternalAPIs: true,
          score: tier1Score,
          reasons: tier1Reasons,
          tier1Results: {
            heuristics: heuristicsData,
            dnsIntel: dnsIntelData,
            localThreats: localThreatsData,
          },
        };
      }

      const tier2Start = Date.now();
      const [certIntel, httpFingerprint] = await Promise.allSettled([
        config.enhancedSecurity.certIntel.enabled && parsed.protocol === 'https:'
          ? certificateIntelligence(parsed.hostname, {
            timeoutMs: config.enhancedSecurity.certIntel.timeoutMs,
            ctCheckEnabled: config.enhancedSecurity.certIntel.ctCheckEnabled,
          })
          : Promise.resolve({
            isValid: true,
            isSelfSigned: false,
            issuer: 'unknown',
            age: 0,
            expiryDays: 0,
            sanCount: 0,
            chainValid: true,
            ctLogPresent: true,
            suspicionScore: 0,
            reasons: [],
          }),
        config.enhancedSecurity.httpFingerprint.enabled
          ? httpFingerprinting(finalUrl, {
            timeoutMs: config.enhancedSecurity.httpFingerprint.timeoutMs,
            enableSSRFGuard: true,
          })
          : Promise.resolve({
            statusCode: 0,
            securityHeaders: {
              hsts: false,
              csp: false,
              xFrameOptions: false,
              xContentTypeOptions: false,
            },
            suspiciousRedirects: false,
            suspicionScore: 0,
            reasons: [],
          }),
      ]);

      const tier2Duration = (Date.now() - tier2Start) / 1000;
      enhancedSecurityLatencySeconds.labels('tier2').observe(tier2Duration);

      const certIntelData =
        certIntel.status === 'fulfilled' ? certIntel.value : {
          isValid: true,
          isSelfSigned: false,
          issuer: 'unknown',
          age: 0,
          expiryDays: 0,
          sanCount: 0,
          chainValid: true,
          ctLogPresent: true,
          suspicionScore: 0,
          reasons: [],
        };
      const httpFingerprintData =
        httpFingerprint.status === 'fulfilled' ? httpFingerprint.value : {
          statusCode: 0,
          securityHeaders: {
            hsts: false,
            csp: false,
            xFrameOptions: false,
            xContentTypeOptions: false,
          },
          suspiciousRedirects: false,
          suspicionScore: 0,
          reasons: [],
        };

      const tier2Score = tier1Score + certIntelData.suspicionScore + httpFingerprintData.suspicionScore;
      const tier2Reasons = [
        ...tier1Reasons,
        ...certIntelData.reasons,
        ...httpFingerprintData.reasons,
      ];

      enhancedSecurityScoreHistogram.observe(tier2Score);

      if (tier2Score > 1.5) {
        logger.info(
          { url: finalUrl, score: tier2Score, reasons: tier2Reasons },
          'Tier 2 suspicious indicators detected'
        );

        return {
          verdict: 'suspicious',
          confidence: 'medium',
          skipExternalAPIs: false,
          score: tier2Score,
          reasons: tier2Reasons,
          tier1Results: {
            heuristics: heuristicsData,
            dnsIntel: dnsIntelData,
            localThreats: localThreatsData,
          },
          tier2Results: {
            certIntel: certIntelData,
            httpFingerprint: httpFingerprintData,
          },
        };
      }

      const totalDuration = (Date.now() - startTime) / 1000;
      logger.debug(
        { url: finalUrl, score: tier2Score, tier1Duration, tier2Duration, totalDuration },
        'Enhanced security analysis completed'
      );

      return {
        skipExternalAPIs: false,
        score: tier2Score,
        reasons: tier2Reasons,
        tier1Results: {
          heuristics: heuristicsData,
          dnsIntel: dnsIntelData,
          localThreats: localThreatsData,
        },
        tier2Results: {
          certIntel: certIntelData,
          httpFingerprint: httpFingerprintData,
        },
      };
    } catch (err: unknown) {
      const error = err as Error;
      logger.error({ error: error.message, url: finalUrl }, 'Enhanced security analysis failed');

      return {
        skipExternalAPIs: false,
        score: 0,
        reasons: [],
      };
    }
  }

  async recordVerdict(
    url: string,
    verdict: 'benign' | 'suspicious' | 'malicious',
    confidence: number
  ): Promise<void> {
    if (config.enhancedSecurity.enabled && config.enhancedSecurity.localThreatDb.enabled) {
      await this.localThreatDb.recordVerdict(url, verdict, confidence);
    }
  }

  async getStats(): Promise<{
    openphishCount: number;
    collaborativeCount: number;
  }> {
    if (config.enhancedSecurity.enabled && config.enhancedSecurity.localThreatDb.enabled) {
      return await this.localThreatDb.getStats();
    }
    return { openphishCount: 0, collaborativeCount: 0 };
  }

  async updateFeeds(): Promise<void> {
    if (config.enhancedSecurity.enabled && config.enhancedSecurity.localThreatDb.enabled) {
      await this.localThreatDb.updateOpenPhishFeed();
      logger.info('Threat feeds updated manually');
    }
  }
}

```

# File: services/scan-orchestrator/src/urlscan-artifacts.ts

```typescript
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fetch, Response } from 'undici';
import { config, logger, metrics } from '@wbscanner/shared';

export interface ArtifactPaths {
  screenshotPath: string | null;
  domPath: string | null;
}

type ArtifactType = 'screenshot' | 'dom';

const ARTIFACT_DIR = process.env.URLSCAN_ARTIFACT_DIR || path.resolve('storage/urlscan-artifacts');

async function ensureDirectory(): Promise<void> {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
}

function recordDownloadFailure(artifactType: ArtifactType, reason: string): void {
  metrics.artifactDownloadFailures.labels(artifactType, reason).inc();
}

async function downloadToFile(artifactType: ArtifactType, url: string, targetPath: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response | null = null;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response?.ok || !response.body) {
      recordDownloadFailure(artifactType, `http:${response?.status ?? 'unknown'}`);
      return false;
    }
    await ensureDirectory();
    await pipeline(response.body, createWriteStream(targetPath));
    return true;
  } catch (error) {
    recordDownloadFailure(artifactType, `network:${error instanceof Error ? error.name : 'unknown'}`);
    logger.warn({ url, error, artifactType }, 'Failed to download urlscan artifact');
    return false;
  }
}

export async function downloadUrlscanArtifacts(scanId: string, urlHash: string): Promise<ArtifactPaths> {
  const screenshotPath = path.join(ARTIFACT_DIR, `${urlHash}_${scanId}.png`);
  const domPath = path.join(ARTIFACT_DIR, `${urlHash}_${scanId}.html`);
  const baseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
  const screenshotUrl = `${baseUrl}/screenshots/${scanId}.png`;
  const domUrl = `${baseUrl}/dom/${scanId}/`;

  const screenshotSaved = await downloadToFile('screenshot', screenshotUrl, screenshotPath);
  if (!screenshotSaved) {
    logger.warn({ scanId, urlHash }, 'Screenshot download failed');
  }

  let domSaved = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response | null = null;
    try {
      response = await fetch(domUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (response?.ok) {
      const html = await response.text();
      await ensureDirectory();
      await fs.writeFile(domPath, html, 'utf8');
      domSaved = true;
    } else {
      recordDownloadFailure('dom', `http:${response?.status ?? 'unknown'}`);
      logger.warn({ scanId, urlHash, status: response?.status }, 'DOM download failed');
    }
  } catch (error) {
    recordDownloadFailure('dom', `network:${error instanceof Error ? error.name : 'unknown'}`);
    logger.warn({ scanId, urlHash, error }, 'Failed to download urlscan DOM');
  }

  return {
    screenshotPath: screenshotSaved ? screenshotPath : null,
    domPath: domSaved ? domPath : null,
  };
}

```

# File: services/scan-orchestrator/src/index-original.ts

```typescript
import Fastify from 'fastify';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import {
  config,
  logger,
  register,
  metrics,
  externalLatency,
  externalErrors,
  circuitStates,
  circuitBreakerTransitionCounter,
  circuitBreakerRejections,
  circuitBreakerOpenDuration,
  queueDepthGauge,
  cacheHitRatioGauge,
  normalizeUrl,
  expandUrl,
  urlHash,
  gsbLookup,
  vtAnalyzeUrl,
  vtVerdictStats,
  domainAgeDaysFromRdap,
  extraHeuristics,
  scoreFromSignals,
  urlhausLookup,
  phishtankLookup,
  submitUrlscan,
  resolveShortener,
  whoisXmlLookup,
  disableWhoisXmlForMonth,
  whoDatLookup,
  CircuitBreaker,
  CircuitState,
  withRetry,
  QuotaExceededError,
  detectHomoglyphs,
  assertEssentialConfig,
} from '@wbscanner/shared';
import { EnhancedSecurityAnalyzer } from './enhanced-security';
import {
  checkBlocklistsWithRedundancy,
  shouldQueryPhishtank,
  type GsbFetchResult,
  type PhishtankFetchResult,
} from './blocklists';
import type { GsbThreatMatch, UrlhausLookupResult, PhishtankLookupResult, VirusTotalAnalysis, UrlscanSubmissionResponse } from '@wbscanner/shared';
import { downloadUrlscanArtifacts } from './urlscan-artifacts';
import { getSharedConnection } from './database.js';

const TEST_REDIS_KEY = '__WBSCANNER_TEST_REDIS__';
const TEST_QUEUE_FACTORY_KEY = '__WBSCANNER_TEST_QUEUE_FACTORY__';

class InMemoryRedis {
  private store = new Map<string, string>();
  private ttlStore = new Map<string, number>();
  private setStore = new Map<string, Set<string>>();
  private hashStore = new Map<string, Map<string, string>>();
  private listStore = new Map<string, string[]>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, mode?: string, ttlArg?: number, nxArg?: string): Promise<'OK' | null> {
    if (mode === 'EX') {
      const ttlSeconds = typeof ttlArg === 'number' ? ttlArg : 0;
      if (nxArg === 'NX' && this.store.has(key)) {
        return null;
      }
      this.store.set(key, value);
      if (ttlSeconds > 0) {
        this.ttlStore.set(key, ttlSeconds);
      } else {
        this.ttlStore.delete(key);
      }
      return 'OK';
    }
    this.store.set(key, value);
    this.ttlStore.delete(key);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    this.ttlStore.delete(key);
    this.setStore.delete(key);
    this.hashStore.delete(key);
    this.listStore.delete(key);
    return existed ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    return this.ttlStore.get(key) ?? -1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (seconds > 0) {
      this.ttlStore.set(key, seconds);
      return 1;
    }
    this.ttlStore.delete(key);
    return 0;
  }

  async sadd(key: string, member: string): Promise<number> {
    const set = this.setStore.get(key) ?? new Set<string>();
    set.add(member);
    this.setStore.set(key, set);
    return set.size;
  }

  async srem(key: string, member: string): Promise<number> {
    const set = this.setStore.get(key);
    if (!set) return 0;
    const existed = set.delete(member);
    if (set.size === 0) this.setStore.delete(key);
    return existed ? 1 : 0;
  }

  async scard(key: string): Promise<number> {
    return this.setStore.get(key)?.size ?? 0;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    const hash = this.hashStore.get(key) ?? new Map<string, string>();
    const existed = hash.has(field) ? 0 : 1;
    hash.set(field, value);
    this.hashStore.set(key, hash);
    return existed;
  }

  async hdel(key: string, field: string): Promise<number> {
    const hash = this.hashStore.get(key);
    if (!hash) return 0;
    const removed = hash.delete(field) ? 1 : 0;
    if (hash.size === 0) this.hashStore.delete(key);
    return removed;
  }

  async hkeys(key: string): Promise<string[]> {
    return Array.from(this.hashStore.get(key)?.keys() ?? []);
  }

  async lpush(key: string, value: string): Promise<number> {
    const list = this.listStore.get(key) ?? [];
    list.unshift(value);
    this.listStore.set(key, list);
    return list.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.listStore.get(key);
    if (!list) return;
    const normalizedStop = stop < 0 ? list.length + stop : stop;
    const trimmed = list.slice(start, normalizedStop + 1);
    this.listStore.set(key, trimmed);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.listStore.get(key) ?? [];
    const normalizedStop = stop < 0 ? list.length + stop : stop;
    return list.slice(start, normalizedStop + 1);
  }

  on(): void {
    // no-op for tests
  }

  quit(): Promise<void> {
    return Promise.resolve();
  }
}

class InMemoryQueue {
  constructor(private readonly name: string) { }
  async add(jobName: string, data: unknown) {
    return { id: `${this.name}:${jobName}:${Date.now()}`, data };
  }
  async getJobCounts() {
    return { waiting: 0, active: 0, delayed: 0, failed: 0 };
  }
  async getWaitingCount() {
    return 0;
  }
  on(): void { }
  async close(): Promise<void> {
    return Promise.resolve();
  }
}

function createRedisConnection(): Redis {
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as Record<string, unknown>)[TEST_REDIS_KEY]) {
    return (globalThis as unknown as Record<string, unknown>)[TEST_REDIS_KEY] as Redis;
  }
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryRedis() as unknown as Redis;
  }
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

const redis = createRedisConnection();
const scanRequestQueue = createQueue(config.queues.scanRequest, { connection: redis });
const scanVerdictQueue = createQueue(config.queues.scanVerdict, { connection: redis });
const urlscanQueue = createQueue(config.queues.urlscan, { connection: redis });

function createQueue(name: string, options: { connection: Redis }): Queue {
  if (typeof globalThis !== 'undefined') {
    const factory = (globalThis as unknown as Record<string, unknown>)[TEST_QUEUE_FACTORY_KEY];
    if (typeof factory === 'function') {
      return factory(name, options) as Queue;
    }
  }
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryQueue(name) as unknown as Queue;
  }
  return new Queue(name, options);
}

const queueMetricsInterval = setInterval(() => {
  refreshQueueMetrics(scanRequestQueue, config.queues.scanRequest).catch(() => undefined);
  refreshQueueMetrics(scanVerdictQueue, config.queues.scanVerdict).catch(() => undefined);
  refreshQueueMetrics(urlscanQueue, config.queues.urlscan).catch(() => undefined);
}, 10_000);
queueMetricsInterval.unref();

const ANALYSIS_TTLS = {
  gsb: 60 * 60,
  phishtank: 60 * 60,
  vt: 60 * 60,
  urlhaus: 60 * 60,
  urlscan: 60 * 60,
  whois: 7 * 24 * 60 * 60,
};

const URLSCAN_UUID_PREFIX = 'urlscan:uuid:';
const URLSCAN_QUEUED_PREFIX = 'urlscan:queued:';
const URLSCAN_SUBMITTED_PREFIX = 'urlscan:submitted:';
const URLSCAN_RESULT_PREFIX = 'urlscan:result:';
const SHORTENER_CACHE_PREFIX = 'url:shortener:';

const CACHE_LABELS = {
  gsb: 'gsb_analysis',
  phishtank: 'phishtank_analysis',
  vt: 'virustotal_analysis',
  urlhaus: 'urlhaus_analysis',
  shortener: 'shortener_resolution',
  whois: 'whois_analysis',
  verdict: 'scan_result',
} as const;

const CIRCUIT_DEFAULTS = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 30_000,
  windowMs: 60_000,
} as const;

const CIRCUIT_LABELS = {
  gsb: 'google_safe_browsing',
  phishtank: 'phishtank',
  urlhaus: 'urlhaus',
  vt: 'virustotal',
  urlscan: 'urlscan',
  whoisxml: 'whoisxml',
  whodat: 'whodat',
} as const;

const cacheRatios = new Map<string, { hits: number; misses: number }>();
const circuitOpenSince = new Map<string, number>();

const VERDICT_REASON_OTHER_LABEL = 'other';

function normalizeVerdictReason(reason: string): string {
  if (reason === 'Manually allowed') {
    return 'manual_allow';
  }
  if (reason === 'Manually blocked') {
    return 'manual_deny';
  }
  if (reason.startsWith('Google Safe Browsing')) {
    if (reason.includes('MALWARE')) {
      return 'gsb_malware';
    }
    if (reason.includes('SOCIAL_ENGINEERING')) {
      return 'gsb_social_engineering';
    }
    return 'gsb_threat';
  }
  if (reason === 'Verified phishing (Phishtank)') {
    return 'phishtank_verified';
  }
  if (reason === 'Known malware distribution (URLhaus)') {
    return 'urlhaus_listed';
  }
  if (reason.includes('VT engine')) {
    return 'vt_malicious';
  }
  if (reason.startsWith('Domain registered')) {
    if (reason.includes('<7')) {
      return 'domain_age_lt7';
    }
    if (reason.includes('<14')) {
      return 'domain_age_lt14';
    }
    if (reason.includes('<30')) {
      return 'domain_age_lt30';
    }
    return 'domain_age';
  }
  if (reason.startsWith('High-risk homoglyph attack detected')) {
    return 'homoglyph_high';
  }
  if (
    reason.startsWith('Suspicious characters detected') ||
    reason === 'Suspicious homoglyph characters detected'
  ) {
    return 'homoglyph_medium';
  }
  if (reason === 'Punycode/IDN domain detected') {
    return 'homoglyph_low';
  }
  if (reason === 'URL uses IP address') {
    return 'ip_literal';
  }
  if (reason === 'Suspicious TLD') {
    return 'suspicious_tld';
  }
  if (reason.startsWith('Multiple redirects')) {
    return 'multiple_redirects';
  }
  if (reason === 'Uncommon port') {
    return 'uncommon_port';
  }
  if (reason.startsWith('Long URL')) {
    return 'long_url';
  }
  if (reason === 'Executable file extension') {
    return 'executable_extension';
  }
  if (reason === 'Shortened URL expanded') {
    return 'shortener_expanded';
  }
  if (reason === 'Redirect leads to mismatched domain/brand') {
    return 'redirect_mismatch';
  }
  return VERDICT_REASON_OTHER_LABEL;
}

function recordCacheOutcome(cacheType: string, outcome: 'hit' | 'miss'): void {
  const state = cacheRatios.get(cacheType) ?? { hits: 0, misses: 0 };
  if (outcome === 'hit') {
    state.hits += 1;
  } else {
    state.misses += 1;
  }
  cacheRatios.set(cacheType, state);
  const total = state.hits + state.misses;
  if (total > 0) {
    cacheHitRatioGauge.labels(cacheType).set(state.hits / total);
  }
}

async function refreshQueueMetrics(queue: Queue, name: string): Promise<void> {
  const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
  queueDepthGauge.labels(name).set(counts.waiting ?? 0);
  metrics.queueActive.labels(name).set(counts.active ?? 0);
  metrics.queueDelayed.labels(name).set(counts.delayed ?? 0);
  metrics.queueFailedGauge.labels(name).set(counts.failed ?? 0);
}

function makeCircuit(name: string) {
  const breaker = new CircuitBreaker({
    ...CIRCUIT_DEFAULTS,
    name,
    onStateChange: (state, from) => {
      circuitStates.labels(name).set(state);
      circuitBreakerTransitionCounter.labels(name, String(from ?? ''), String(state)).inc();
      const now = Date.now();
      if (state === CircuitState.OPEN) {
        circuitOpenSince.set(name, now);
      } else if (from === CircuitState.OPEN) {
        const openedAt = circuitOpenSince.get(name);
        if (openedAt) {
          circuitBreakerOpenDuration.labels(name).observe((now - openedAt) / 1000);
          circuitOpenSince.delete(name);
        }
      }
      logger.debug({ name, from, to: state }, 'Circuit state change');
    }
  });
  circuitStates.labels(name).set(CircuitState.CLOSED);
  return breaker;
}

const gsbCircuit = makeCircuit(CIRCUIT_LABELS.gsb);
const phishtankCircuit = makeCircuit(CIRCUIT_LABELS.phishtank);
const urlhausCircuit = makeCircuit(CIRCUIT_LABELS.urlhaus);
const vtCircuit = makeCircuit(CIRCUIT_LABELS.vt);
const urlscanCircuit = makeCircuit(CIRCUIT_LABELS.urlscan);
const whoisCircuit = makeCircuit(CIRCUIT_LABELS.whoisxml);
const whodatCircuit = makeCircuit(CIRCUIT_LABELS.whodat);

function recordLatency(service: string, ms?: number) {
  if (typeof ms === 'number' && ms >= 0) {
    externalLatency.labels(service).observe(ms / 1000);
  }
}

function classifyError(err: unknown): string {
  const rawCode = (err as { code?: string | number; statusCode?: string | number })?.code ?? (err as { statusCode?: string | number })?.statusCode;
  if (rawCode === 'UND_ERR_HEADERS_TIMEOUT' || rawCode === 'UND_ERR_CONNECT_TIMEOUT') return 'timeout';
  const codeNum = typeof rawCode === 'string' ? Number(rawCode) : rawCode;
  if (codeNum === 429) return 'rate_limited';
  if (codeNum === 408) return 'timeout';
  if (typeof codeNum === 'number' && codeNum >= 500) return 'server_error';
  if (typeof codeNum === 'number' && codeNum >= 400) return 'client_error';
  const message = (err as Error)?.message || '';
  if (message.includes('Circuit') && message.includes('open')) return 'circuit_open';
  return 'unknown';
}

function recordError(service: string, err: unknown) {
  const reason = classifyError(err);
  if (reason === 'circuit_open') {
    circuitBreakerRejections.labels(service).inc();
  }
  externalErrors.labels(service, reason).inc();
}

function shouldRetry(err: unknown): boolean {
  const rawCode = (err as { code?: string | number; statusCode?: string | number })?.code ?? (err as { statusCode?: string | number })?.statusCode;
  if (rawCode === 'UND_ERR_HEADERS_TIMEOUT' || rawCode === 'UND_ERR_CONNECT_TIMEOUT') return true;
  const codeNum = typeof rawCode === 'string' ? Number(rawCode) : rawCode;
  if (codeNum === 429) return false;
  if (codeNum === 408) return true;
  if (typeof codeNum === 'number' && codeNum >= 500) return true;
  return !codeNum;
}

async function getJsonCache<T>(cacheType: string, key: string, ttlSeconds: number): Promise<T | null> {
  const stop = metrics.cacheLookupDuration.labels(cacheType).startTimer();
  const raw = await redis.get(key);
  stop();
  if (!raw) {
    recordCacheOutcome(cacheType, 'miss');
    metrics.cacheEntryTtl.labels(cacheType).set(0);
    return null;
  }
  recordCacheOutcome(cacheType, 'hit');
  metrics.cacheEntryBytes.labels(cacheType).set(Buffer.byteLength(raw));
  const ttlRemaining = await redis.ttl(key);
  if (ttlRemaining >= 0) {
    metrics.cacheEntryTtl.labels(cacheType).set(ttlRemaining);
    if (ttlSeconds > 0 && ttlRemaining < Math.max(1, Math.floor(ttlSeconds * 0.2))) {
      metrics.cacheStaleTotal.labels(cacheType).inc();
    }
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    metrics.cacheStaleTotal.labels(cacheType).inc();
    return null;
  }
}

async function setJsonCache(cacheType: string, key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const payload = JSON.stringify(value);
  const stop = metrics.cacheWriteDuration.labels(cacheType).startTimer();
  await redis.set(key, payload, 'EX', ttlSeconds);
  stop();
  metrics.cacheRefreshTotal.labels(cacheType).inc();
  metrics.cacheEntryBytes.labels(cacheType).set(Buffer.byteLength(payload));
  metrics.cacheEntryTtl.labels(cacheType).set(ttlSeconds);
}

type GsbMatch = GsbThreatMatch;
type VtStats = ReturnType<typeof vtVerdictStats>;
type UrlhausResult = UrlhausLookupResult;
type PhishtankResult = PhishtankLookupResult;

type ArtifactCandidate = {
  type: 'screenshot' | 'dom';
  url: string;
};

function normalizeUrlscanArtifactCandidate(candidate: unknown, baseUrl: string): { url?: string; invalid: boolean } {
  if (typeof candidate !== 'string') return { invalid: false };
  const trimmed = candidate.trim();
  if (!trimmed) return { invalid: false };

  const sanitizedBase = baseUrl.replace(/\/+$/, '');
  let trustedHostname: string;
  try {
    trustedHostname = new URL(sanitizedBase).hostname.toLowerCase();
  } catch {
    return { invalid: true };
  }

  const rawUrl = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${sanitizedBase}/${trimmed.replace(/^\/+/, '')}`;

  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return { invalid: true };
  }

  const parsed = new URL(normalized);
  const candidateHostname = parsed.hostname.toLowerCase();
  const hostAllowed =
    candidateHostname === trustedHostname || candidateHostname.endsWith(`.${trustedHostname}`);

  if (!hostAllowed) {
    return { invalid: true };
  }

  return { url: parsed.toString(), invalid: false };
}

function normaliseArtifactUrl(candidate: unknown, baseUrl: string): string | undefined {
  const result = normalizeUrlscanArtifactCandidate(candidate, baseUrl);
  return result.url;
}

function extractUrlscanArtifactCandidates(uuid: string, payload: unknown): ArtifactCandidate[] {
  const baseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
  const candidates: ArtifactCandidate[] = [];
  const seen = new Set<string>();

  const p = payload as {
    screenshotURL?: string;
    domURL?: string;
    task?: { screenshotURL?: string; domURL?: string };
    visual?: { data?: { screenshotURL?: string } };
  };

  const screenshotSources = [
    p?.screenshotURL,
    p?.task?.screenshotURL,
    p?.visual?.data?.screenshotURL,
    `${baseUrl}/screenshots/${uuid}.png`,
  ];

  for (const source of screenshotSources) {
    const resolved = normaliseArtifactUrl(source, baseUrl);
    if (resolved && !seen.has(`screenshot:${resolved}`)) {
      seen.add(`screenshot:${resolved}`);
      candidates.push({ type: 'screenshot', url: resolved });
    }
  }

  const domSources = [
    p?.domURL,
    p?.task?.domURL,
    `${baseUrl}/dom/${uuid}.json`,
  ];

  for (const source of domSources) {
    const resolved = normaliseArtifactUrl(source, baseUrl);
    if (resolved && !seen.has(`dom:${resolved}`)) {
      seen.add(`dom:${resolved}`);
      candidates.push({ type: 'dom', url: resolved });
    }
  }

  return candidates;
}

async function fetchGsbAnalysis(finalUrl: string, hash: string): Promise<GsbFetchResult> {
  if (!config.gsb.enabled) {
    logger.warn({ url: finalUrl }, 'Google Safe Browsing disabled by config');
    return { matches: [], fromCache: true, durationMs: 0, error: null };
  }
  const cacheKey = `url:analysis:${hash}:gsb`;
  const cached = await getJsonCache<GsbMatch[]>(CACHE_LABELS.gsb, cacheKey, ANALYSIS_TTLS.gsb);
  if (cached) {
    return { matches: cached, fromCache: true, durationMs: 0, error: null };
  }
  try {
    const result = await gsbCircuit.execute(() =>
      withRetry(() => gsbLookup([finalUrl]), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.gsb, result.latencyMs);
    await setJsonCache(CACHE_LABELS.gsb, cacheKey, result.matches, ANALYSIS_TTLS.gsb);
    return {
      matches: result.matches,
      fromCache: false,
      durationMs: result.latencyMs ?? 0,
      error: null,
    };
  } catch (err) {
    recordError(CIRCUIT_LABELS.gsb, err);
    logger.warn({ err, url: finalUrl }, 'Google Safe Browsing lookup failed');
    return { matches: [], fromCache: false, durationMs: 0, error: err as Error };
  }
}

async function fetchPhishtank(finalUrl: string, hash: string): Promise<PhishtankFetchResult> {
  if (!config.phishtank.enabled) {
    return { result: null, fromCache: true, error: null };
  }
  const cacheKey = `url:analysis:${hash}:phishtank`;
  const cached = await getJsonCache<PhishtankResult>(CACHE_LABELS.phishtank, cacheKey, ANALYSIS_TTLS.phishtank);
  if (cached) {
    return { result: cached, fromCache: true, error: null };
  }
  try {
    const result = await phishtankCircuit.execute(() =>
      withRetry(() => phishtankLookup(finalUrl), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.phishtank, result.latencyMs);
    await setJsonCache(CACHE_LABELS.phishtank, cacheKey, result, ANALYSIS_TTLS.phishtank);
    return { result, fromCache: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.phishtank, err);
    logger.warn({ err, url: finalUrl }, 'Phishtank lookup failed');
    return { result: null, fromCache: false, error: err as Error };
  }
}

interface VirusTotalFetchResult {
  stats?: VtStats;
  fromCache: boolean;
  quotaExceeded: boolean;
  error: Error | null;
}

async function fetchVirusTotal(finalUrl: string, hash: string): Promise<VirusTotalFetchResult> {
  if (!config.vt.enabled || !config.vt.apiKey) {
    if (!config.vt.enabled) logger.warn({ url: finalUrl }, 'VirusTotal disabled by config');
    return { stats: undefined, fromCache: true, quotaExceeded: false, error: null };
  }
  const cacheKey = `url:analysis:${hash}:vt`;
  const cached = await getJsonCache<VtStats>(CACHE_LABELS.vt, cacheKey, ANALYSIS_TTLS.vt);
  if (cached) {
    return { stats: cached, fromCache: true, quotaExceeded: false, error: null };
  }
  try {
    const analysis = await vtCircuit.execute(() =>
      withRetry(() => vtAnalyzeUrl(finalUrl), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.vt, analysis.latencyMs);
    const stats = vtVerdictStats(analysis as VirusTotalAnalysis);
    if (stats) {
      await setJsonCache(CACHE_LABELS.vt, cacheKey, stats, ANALYSIS_TTLS.vt);
    }
    return { stats, fromCache: false, quotaExceeded: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.vt, err);
    const quotaExceeded = err instanceof QuotaExceededError || ((err as { code?: string | number; statusCode?: string | number })?.code ?? (err as { statusCode?: string | number })?.statusCode) === 429;
    if (!quotaExceeded) {
      logger.warn({ err, url: finalUrl }, 'VirusTotal lookup failed');
    }
    return { stats: undefined, fromCache: false, quotaExceeded, error: err as Error };
  }
}

interface UrlhausFetchResult {
  result: UrlhausResult | null;
  fromCache: boolean;
  error: Error | null;
}

async function fetchUrlhaus(finalUrl: string, hash: string): Promise<UrlhausFetchResult> {
  if (!config.urlhaus.enabled) {
    return { result: null, fromCache: true, error: null };
  }
  const cacheKey = `url:analysis:${hash}:urlhaus`;
  const cached = await getJsonCache<UrlhausResult>(CACHE_LABELS.urlhaus, cacheKey, ANALYSIS_TTLS.urlhaus);
  if (cached) {
    return { result: cached, fromCache: true, error: null };
  }
  try {
    const result = await urlhausCircuit.execute(() =>
      withRetry(() => urlhausLookup(finalUrl), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.urlhaus, result.latencyMs);
    await setJsonCache(CACHE_LABELS.urlhaus, cacheKey, result, ANALYSIS_TTLS.urlhaus);
    return { result, fromCache: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.urlhaus, err);
    logger.warn({ err, url: finalUrl }, 'URLhaus lookup failed');
    return { result: null, fromCache: false, error: err as Error };
  }
}

interface ShortenerCacheEntry {
  finalUrl: string;
  provider: string;
  chain: string[];
  wasShortened: boolean;
}

async function resolveShortenerWithCache(url: string, hash: string): Promise<ShortenerCacheEntry | null> {
  const cacheKey = `${SHORTENER_CACHE_PREFIX}${hash}`;
  const cached = await getJsonCache<ShortenerCacheEntry>(CACHE_LABELS.shortener, cacheKey, config.shortener.cacheTtlSeconds);
  if (cached) return cached;
  try {
    const start = Date.now();
    const resolved = await resolveShortener(url);
    recordLatency('shortener', Date.now() - start);
    if (resolved.wasShortened) {
      const payload: ShortenerCacheEntry = {
        finalUrl: resolved.finalUrl,
        provider: resolved.provider,
        chain: resolved.chain,
        wasShortened: true,
      };
      await setJsonCache(CACHE_LABELS.shortener, cacheKey, payload, config.shortener.cacheTtlSeconds);
      return payload;
    }
    return null;
  } catch (err) {
    recordError('shortener', err);
    logger.warn({ err, url }, 'Shortener resolution failed');
    return null;
  }
}

interface DomainIntelResult {
  ageDays?: number;
  source: 'rdap' | 'whoisxml' | 'whodat' | 'none';
  registrar?: string;
}

async function fetchDomainIntel(hostname: string, hash: string): Promise<DomainIntelResult> {
  if (config.rdap.enabled) {
    const rdapAge = await domainAgeDaysFromRdap(hostname, config.rdap.timeoutMs).catch(() => undefined);
    if (rdapAge !== undefined) {
      return { ageDays: rdapAge, source: 'rdap' };
    }
  } else {
    logger.warn({ hostname }, 'RDAP disabled by config');
  }

  // Try who-dat first if enabled (self-hosted, no quota limits)
  if (config.whodat?.enabled) {
    const cacheKey = `url:analysis:${hash}:whodat`;
    const cached = await getJsonCache<{ ageDays?: number; registrar?: string }>(
      CACHE_LABELS.whois,
      cacheKey,
      ANALYSIS_TTLS.whois
    );
    if (cached) {
      return { ageDays: cached.ageDays, registrar: cached.registrar, source: 'whodat' };
    }
    try {
      const start = Date.now();
      const response = await whodatCircuit.execute(() =>
        withRetry(() => whoDatLookup(hostname), {
          retries: 2,
          baseDelayMs: 1000,
          factor: 2,
          retryable: shouldRetry,
        })
      );
      recordLatency(CIRCUIT_LABELS.whodat, Date.now() - start);
      const record = (response as { record?: { estimatedDomainAgeDays?: number; registrarName?: string } })?.record;
      const ageDays = record?.estimatedDomainAgeDays;
      const registrar = record?.registrarName;
      await setJsonCache(CACHE_LABELS.whois, cacheKey, { ageDays, registrar }, ANALYSIS_TTLS.whois);
      return { ageDays, registrar, source: 'whodat' };
    } catch (err) {
      recordError(CIRCUIT_LABELS.whodat, err);
      logger.warn({ err, hostname }, 'Who-dat lookup failed, falling back to WhoisXML if available');
    }
  }

  // Fallback to WhoisXML if who-dat failed or is disabled
  if (!config.whoisxml?.enabled || !config.whoisxml.apiKey) {
    return { ageDays: undefined, source: 'none' };
  }
  const cacheKey = `url:analysis:${hash}:whois`;
  const cached = await getJsonCache<{ ageDays?: number; registrar?: string }>(
    CACHE_LABELS.whois,
    cacheKey,
    ANALYSIS_TTLS.whois
  );
  if (cached) {
    return { ageDays: cached.ageDays, registrar: cached.registrar, source: 'whoisxml' };
  }
  try {
    const start = Date.now();
    const response = await whoisCircuit.execute(() =>
      withRetry(() => whoisXmlLookup(hostname), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.whoisxml, Date.now() - start);
    const record = (response as { record?: { estimatedDomainAgeDays?: number; registrarName?: string } })?.record;
    const ageDays = record?.estimatedDomainAgeDays;
    const registrar = record?.registrarName;
    await setJsonCache(CACHE_LABELS.whois, cacheKey, { ageDays, registrar }, ANALYSIS_TTLS.whois);
    return { ageDays, registrar, source: 'whoisxml' };
  } catch (err) {
    recordError(CIRCUIT_LABELS.whoisxml, err);
    if (err instanceof QuotaExceededError) {
      logger.warn({ hostname }, 'WhoisXML quota exhausted, disabling for remainder of month');
      disableWhoisXmlForMonth();
    } else {
      logger.warn({ err, hostname }, 'WhoisXML lookup failed');
    }
    return { ageDays: undefined, source: 'none' };
  }
}

async function loadManualOverride(dbClient: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, urlHash: string, hostname: string): Promise<'allow' | 'deny' | null> {
  try {
    const { rows } = await dbClient.query(
      `SELECT status FROM overrides
         WHERE (url_hash = ? OR pattern = ?)
           AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY created_at DESC
         LIMIT 1`,
      [urlHash, hostname]
    );
    const record = rows[0] as { status?: string } | undefined;
    const status = record?.status;
    return status === 'allow' || status === 'deny' ? status : null;
  } catch (err) {
    logger.warn({ err, urlHash, hostname }, 'Failed to load manual override');
    return null;
  }
}

interface UrlscanCallbackBody {
  uuid?: string;
  task?: { uuid?: string; url?: string; screenshotURL?: string; domURL?: string };
  visual?: { data?: { screenshotURL?: string } };
  screenshotURL?: string;
  domURL?: string;
  [key: string]: unknown;
}

async function main() {
  assertEssentialConfig('scan-orchestrator');

  // Validate Redis connectivity before starting
  try {
    await redis.ping();
    logger.info('Redis connectivity validated');
  } catch (err) {
    logger.error({ err }, 'Redis connectivity check failed during startup');
    // Don't throw, let healthcheck handle it so container doesn't crash loop immediately
    // throw new Error('Redis is required but unreachable');
  }

  const dbClient = getSharedConnection();

  const enhancedSecurity = new EnhancedSecurityAnalyzer(redis);
  await enhancedSecurity.start();

  const app = Fastify();
  app.get('/healthz', async (_req, reply) => {
    try {
      // Check Redis connectivity
      await redis.ping();
      return { ok: true, redis: 'connected' };
    } catch (err) {
      logger.warn({ err }, 'Health check failed - Redis connectivity issue');
      reply.code(503);
      return { ok: false, redis: 'disconnected', error: 'Redis unreachable' };
    }
  });
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  app.post('/urlscan/callback', async (req, reply) => {
    if (!config.urlscan.enabled) {
      reply.code(503).send({ ok: false, error: 'urlscan disabled' });
      return;
    }
    const secret = config.urlscan.callbackSecret;
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const rawHeaderToken = headers['x-urlscan-secret'] ?? headers['x-urlscan-token'];
    const headerToken = Array.isArray(rawHeaderToken) ? rawHeaderToken[0] : rawHeaderToken;
    const queryTokenRaw = (req.query as Record<string, string | string[] | undefined> | undefined)?.token;
    const queryToken = Array.isArray(queryTokenRaw) ? queryTokenRaw[0] : queryTokenRaw;

    if (!secret || (headerToken !== secret && queryToken !== secret)) {
      reply.code(401).send({ ok: false, error: 'unauthorized' });
      return;
    }
    const body = req.body as UrlscanCallbackBody;
    const uuid = body?.uuid || body?.task?.uuid;
    if (!uuid) {
      reply.code(400).send({ ok: false, error: 'missing uuid' });
      return;
    }
    const urlscanBaseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
    const artifactSources = [
      body?.screenshotURL,
      body?.task?.screenshotURL,
      body?.visual?.data?.screenshotURL,
      body?.domURL,
      body?.task?.domURL,
    ];

    for (const source of artifactSources) {
      const validation = normalizeUrlscanArtifactCandidate(source, urlscanBaseUrl);
      if (validation.invalid) {
        logger.warn({ uuid, source }, 'urlscan callback rejected due to artifact host validation');
        reply.code(400).send({ ok: false, error: 'invalid artifact url' });
        return;
      }
    }
    let urlHashValue = await redis.get(`${URLSCAN_UUID_PREFIX}${uuid}`);
    if (!urlHashValue) {
      const taskUrl: string | undefined = body?.task?.url;
      if (taskUrl) {
        const normalized = normalizeUrl(taskUrl);
        if (normalized) {
          urlHashValue = urlHash(normalized);
        }
      }
    }
    if (!urlHashValue) {
      logger.warn({ uuid }, 'urlscan callback without known url hash');
      reply.code(202).send({ ok: true });
      return;
    }

    await redis.set(
      `${URLSCAN_RESULT_PREFIX}${urlHashValue}`,
      JSON.stringify(body),
      'EX',
      config.urlscan.resultTtlSeconds
    );

    let artifacts: { screenshotPath: string | null; domPath: string | null } | null = null;
    try {
      artifacts = await downloadUrlscanArtifacts(uuid, urlHashValue);
    } catch (err) {
      logger.warn({ err, uuid }, 'failed to download urlscan artifacts');
    }

    await dbClient.query(
      `UPDATE scans
         SET urlscan_status=?,
             urlscan_completed_at=datetime('now'),
             urlscan_result=?,
             urlscan_screenshot_path=COALESCE(?, urlscan_screenshot_path),
             urlscan_dom_path=COALESCE(?, urlscan_dom_path),
             urlscan_artifact_stored_at=CASE
               WHEN ? IS NOT NULL OR ? IS NOT NULL THEN datetime('now')
               ELSE urlscan_artifact_stored_at
             END
       WHERE url_hash=?`,
      ['completed', JSON.stringify(body), artifacts?.screenshotPath ?? null, artifacts?.domPath ?? null, artifacts?.screenshotPath ?? null, artifacts?.domPath ?? null, urlHashValue]
    ).catch((err: Error) => {
      logger.error({ err }, 'failed to persist urlscan callback');
    });

    reply.send({ ok: true });
  });

  new Worker(config.queues.scanRequest, async (job) => {
    const queueName = config.queues.scanRequest;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const { chatId, messageId, url, timestamp, rescan } = job.data as {
      chatId?: string;
      messageId?: string;
      url: string;
      timestamp?: number;
      rescan?: boolean;
    };
    const ingestionTimestamp = typeof timestamp === 'number' ? timestamp : job.timestamp ?? started;
    const hasChatContext = typeof chatId === 'string' && typeof messageId === 'string';
    try {
      const norm = normalizeUrl(url);
      if (!norm) {
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }
        return;
      }
      const h = urlHash(norm);
      const cacheKey = `scan:${h}`;

      interface CachedVerdict {
        verdict: string;
        score: number;
        reasons: string[];
        cacheTtl?: number;
        decidedAt?: number;
        [key: string]: unknown;
      }

      let cachedVerdict: CachedVerdict | null = null;
      let cachedTtl = -1;
      const cacheStop = metrics.cacheLookupDuration.labels(CACHE_LABELS.verdict).startTimer();
      const cachedRaw = await redis.get(cacheKey);
      cacheStop();
      if (cachedRaw) {
        recordCacheOutcome(CACHE_LABELS.verdict, 'hit');
        metrics.cacheHit.inc();
        metrics.cacheEntryBytes.labels(CACHE_LABELS.verdict).set(Buffer.byteLength(cachedRaw));
        cachedTtl = await redis.ttl(cacheKey);
        if (cachedTtl >= 0) {
          metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(cachedTtl);
        }
        try {
          cachedVerdict = JSON.parse(cachedRaw) as CachedVerdict;
        } catch {
          metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
        }
        if (
          cachedVerdict &&
          typeof cachedVerdict.cacheTtl === 'number' &&
          cachedTtl >= 0 &&
          cachedTtl < Math.max(1, Math.floor(cachedVerdict.cacheTtl * 0.2))
        ) {
          metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
        }
      } else {
        recordCacheOutcome(CACHE_LABELS.verdict, 'miss');
        metrics.cacheMiss.inc();
        metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(0);
      }

      if (cachedVerdict) {
        const verdictLatencySeconds = Math.max(0, (Date.now() - ingestionTimestamp) / 1000);
        metrics.verdictLatency.observe(verdictLatencySeconds);
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }

        if (hasChatContext) {
          const resolvedMessageId = messageId ?? '';
          await scanVerdictQueue.add(
            'verdict',
            {
              chatId,
              messageId: resolvedMessageId,
              ...cachedVerdict,
              decidedAt: cachedVerdict.decidedAt ?? Date.now(),
            },
            { removeOnComplete: true }
          );
        } else {
          logger.info({ url: norm, jobId: job.id, rescan: Boolean(rescan) }, 'Skipping verdict dispatch without chat context');
        }
        return;
      }

      const shortenerInfo = await resolveShortenerWithCache(norm, h);
      const preExpansionUrl = shortenerInfo?.finalUrl ?? norm;
      const exp = await expandUrl(preExpansionUrl, config.orchestrator.expansion);
      const finalUrl = exp.finalUrl;
      const finalUrlObj = new URL(finalUrl);
      const redirectChain = [...(shortenerInfo?.chain ?? []), ...exp.chain.filter((item: string) => !(shortenerInfo?.chain ?? []).includes(item))];
      const heurSignals = extraHeuristics(finalUrlObj);
      const wasShortened = Boolean(shortenerInfo?.wasShortened);
      const finalUrlMismatch = wasShortened && new URL(norm).hostname !== finalUrlObj.hostname;

      const homoglyphResult = detectHomoglyphs(finalUrlObj.hostname);
      if (homoglyphResult.detected) {
        metrics.homoglyphDetections.labels(homoglyphResult.riskLevel).inc();
        logger.info({ hostname: finalUrlObj.hostname, risk: homoglyphResult.riskLevel, confusables: homoglyphResult.confusableChars }, 'Homoglyph detection');
      }

      const enhancedSecurityResult = await enhancedSecurity.analyze(finalUrl, h);

      if (enhancedSecurityResult.verdict === 'malicious' && enhancedSecurityResult.confidence === 'high' && enhancedSecurityResult.skipExternalAPIs) {
        logger.info({ url: finalUrl, score: enhancedSecurityResult.score, reasons: enhancedSecurityResult.reasons }, 'Tier 1 high-confidence threat detected, skipping external APIs');

        const signals = {
          gsbThreatTypes: [],
          phishtankVerified: false,
          urlhausListed: false,
          vtMalicious: undefined,
          vtSuspicious: undefined,
          vtHarmless: undefined,
          domainAgeDays: undefined,
          redirectCount: redirectChain.length,
          wasShortened,
          finalUrlMismatch,
          manualOverride: null,
          homoglyph: homoglyphResult,
          ...heurSignals,
          enhancedSecurityScore: enhancedSecurityResult.score,
          enhancedSecurityReasons: enhancedSecurityResult.reasons,
        };

        const verdictResult = scoreFromSignals(signals);
        const verdict = 'malicious';
        const { score, reasons } = verdictResult;
        const enhancedReasons = [...reasons, ...enhancedSecurityResult.reasons];

        const cacheTtl = config.orchestrator.cacheTtl.malicious;
        const verdictPayload = {
          url: norm,
          finalUrl,
          verdict,
          score,
          reasons: enhancedReasons,
          cacheTtl,
          redirectChain,
          wasShortened,
          finalUrlMismatch,
          homoglyph: homoglyphResult,
          enhancedSecurity: {
            tier1Score: enhancedSecurityResult.score,
            confidence: enhancedSecurityResult.confidence,
          },
          decidedAt: Date.now(),
        };

        await setJsonCache(CACHE_LABELS.verdict, cacheKey, verdictPayload, cacheTtl);

        try {
          await dbClient.transaction(async () => {
            // Insert or update scan record
            // Note: Using INSERT OR REPLACE is SQLite specific. For Postgres compatibility we should use ON CONFLICT or separate logic.
            // However, since we are abstracting, we'll stick to standard SQL or handle it in the query method if needed.
            // But here we are using raw SQL.
            // For now, let's assume the query method handles parameter conversion.
            // Using CURRENT_TIMESTAMP for SQL standard compatibility (SQLite and Postgres)
            // Original approach used datetime('now') which is SQLite-specific
            // CURRENT_TIMESTAMP works for both SQLite and Postgres

            const standardSql = `
              INSERT INTO scans (url_hash, url, final_url, verdict, score, reasons, cache_ttl, redirect_chain, was_shortened, final_url_mismatch, homoglyph_detected, homoglyph_risk_level, first_seen_at, last_seen_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT(url_hash) DO UPDATE SET
                url=excluded.url,
                final_url=excluded.final_url,
                verdict=excluded.verdict,
                score=excluded.score,
                reasons=excluded.reasons,
                cache_ttl=excluded.cache_ttl,
                redirect_chain=excluded.redirect_chain,
                was_shortened=excluded.was_shortened,
                final_url_mismatch=excluded.final_url_mismatch,
                homoglyph_detected=excluded.homoglyph_detected,
                homoglyph_risk_level=excluded.homoglyph_risk_level,
                last_seen_at=CURRENT_TIMESTAMP
            `;

            await dbClient.query(standardSql, [
              h, norm, finalUrl, verdict, score, JSON.stringify(enhancedReasons), cacheTtl, JSON.stringify(redirectChain), wasShortened, finalUrlMismatch, homoglyphResult.detected, homoglyphResult.riskLevel
            ]);
          });
        } catch (err) {
          logger.error({ err, url: norm }, 'failed to persist enhanced security verdict');
        }

        metrics.verdictScore.observe(score);
        for (const reason of enhancedReasons) {
          metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
        }

        const verdictLatencySeconds = Math.max(0, (Date.now() - ingestionTimestamp) / 1000);
        metrics.verdictLatency.observe(verdictLatencySeconds);
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();

        if (hasChatContext) {
          await scanVerdictQueue.add('verdict', {
            chatId,
            messageId,
            ...verdictPayload,
          }, { removeOnComplete: true });
        }

        await enhancedSecurity.recordVerdict(finalUrl, 'malicious', enhancedSecurityResult.score / 3.0);
        return;
      }

      const [blocklistResult, domainIntel, manualOverride] = await Promise.all([
        checkBlocklistsWithRedundancy({
          finalUrl,
          hash: h,
          fallbackLatencyMs: config.gsb.fallbackLatencyMs,
          gsbApiKeyPresent: Boolean(config.gsb.apiKey),
          phishtankEnabled: config.phishtank.enabled,
          fetchGsbAnalysis,
          fetchPhishtank,
        }),
        fetchDomainIntel(finalUrlObj.hostname, h),
        loadManualOverride(dbClient, h, finalUrlObj.hostname),
      ]);

      if (manualOverride) {
        metrics.manualOverrideApplied.labels(manualOverride).inc();
      }

      const domainAgeDays = domainIntel.ageDays;
      const gsbMatches = blocklistResult.gsbMatches;
      const gsbHit = gsbMatches.length > 0;
      if (gsbHit) metrics.gsbHits.inc();

      const phishtankResult = blocklistResult.phishtankResult;
      const phishtankHit = Boolean(phishtankResult?.verified);

      let vtStats: VtStats | undefined;
      let vtQuotaExceeded = false;
      let vtError: Error | null = null;
      if (!gsbHit && !phishtankHit) {
        const vtResponse = await fetchVirusTotal(finalUrl, h);
        vtStats = vtResponse.stats;
        vtQuotaExceeded = vtResponse.quotaExceeded;
        vtError = vtResponse.error;
        if (!vtResponse.fromCache && !vtResponse.error) {
          metrics.vtSubmissions.inc();
        }
      }

      let urlhausResult: UrlhausResult | null = null;
      let urlhausError: Error | null = null;
      let urlhausConsulted = false;
      const shouldQueryUrlhaus =
        !gsbHit && (
          !config.vt.apiKey ||
          vtQuotaExceeded ||
          vtError !== null ||
          !vtStats
        );
      if (shouldQueryUrlhaus) {
        urlhausConsulted = true;
        const urlhausResponse = await fetchUrlhaus(finalUrl, h);
        urlhausResult = urlhausResponse.result;
        urlhausError = urlhausResponse.error;
      }

      const summarizeReason = (input?: string | null) => {
        if (!input) return 'unavailable';
        const trimmed = input.trim();
        if (trimmed.length === 0) return 'unavailable';
        return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
      };

      type ProviderState = {
        key: string;
        name: string;
        consulted: boolean;
        available: boolean;
        reason?: string;
      };

      const providerStates: ProviderState[] = [
        {
          key: 'gsb',
          name: 'Google Safe Browsing',
          consulted: true,
          available: !blocklistResult.gsbResult.error,
          reason: blocklistResult.gsbResult.error ? summarizeReason(blocklistResult.gsbResult.error.message) : undefined,
        },
      ];

      if (blocklistResult.phishtankNeeded) {
        providerStates.push({
          key: 'phishtank',
          name: 'Phishtank',
          consulted: true,
          available: !blocklistResult.phishtankError,
          reason: blocklistResult.phishtankError ? summarizeReason(blocklistResult.phishtankError.message) : undefined,
        });
      }

      const vtConsulted = !gsbHit && !phishtankHit && Boolean(config.vt.apiKey);
      if (vtConsulted) {
        let vtReason: string | undefined;
        if (!vtStats) {
          vtReason = vtQuotaExceeded ? 'quota_exhausted' : summarizeReason(vtError?.message ?? null);
        }
        providerStates.push({
          key: 'virustotal',
          name: 'VirusTotal',
          consulted: true,
          available: Boolean(vtStats) || (!vtError && !vtQuotaExceeded),
          reason: vtStats ? undefined : vtReason,
        });
      }

      if (urlhausConsulted) {
        providerStates.push({
          key: 'urlhaus',
          name: 'URLhaus',
          consulted: true,
          available: !urlhausError,
          reason: urlhausError ? summarizeReason(urlhausError.message) : undefined,
        });
      }

      const consultedProviders = providerStates.filter((state) => state.consulted);
      const availableProviders = consultedProviders.filter((state) => state.available);
      const degradedProviders = consultedProviders.filter((state) => !state.available);
      const degradedMode = consultedProviders.length > 0 && availableProviders.length === 0
        ? {
          providers: degradedProviders.map((state) => ({
            name: state.name,
            reason: state.reason ?? 'unavailable',
          })),
        }
        : undefined;

      if (degradedMode) {
        metrics.degradedModeEvents.inc();
        metrics.externalScannersDegraded.set(1);
        logger.warn({ url: finalUrl, urlHash: h, providers: degradedMode.providers }, 'Operating in degraded mode with no external providers available');
      } else {
        metrics.externalScannersDegraded.set(0);
      }

      const heuristicsOnly = degradedMode !== undefined;
      const signals = {
        gsbThreatTypes: gsbMatches.map((m: GsbThreatMatch) => m.threatType),
        phishtankVerified: Boolean(phishtankResult?.verified),
        urlhausListed: Boolean(urlhausResult?.listed),
        vtMalicious: vtStats?.malicious,
        vtSuspicious: vtStats?.suspicious,
        vtHarmless: vtStats?.harmless,
        domainAgeDays,
        redirectCount: redirectChain.length,
        wasShortened,
        finalUrlMismatch,
        manualOverride,
        homoglyph: homoglyphResult,
        ...heurSignals,
        enhancedSecurityScore: enhancedSecurityResult.score,
        enhancedSecurityReasons: enhancedSecurityResult.reasons,
        heuristicsOnly,
      };
      const verdictResult = scoreFromSignals(signals);
      const verdict = verdictResult.level;
      let { score, reasons } = verdictResult;

      if (enhancedSecurityResult.reasons.length > 0) {
        reasons = [...reasons, ...enhancedSecurityResult.reasons];
      }
      const baselineVerdict = scoreFromSignals({ ...signals, manualOverride: null }).level;

      metrics.verdictScore.observe(score);
      for (const reason of reasons) {
        metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
      }
      if (baselineVerdict !== verdict) {
        metrics.verdictEscalations.labels(baselineVerdict, verdict).inc();
      }
      if (gsbMatches.length > 0) {
        metrics.verdictSignals.labels('gsb_match').inc(gsbMatches.length);
      }
      if (phishtankHit) {
        metrics.verdictSignals.labels('phishtank_verified').inc();
      }
      if (urlhausResult?.listed) {
        metrics.verdictSignals.labels('urlhaus_listed').inc();
      }
      if ((vtStats?.malicious ?? 0) > 0) {
        metrics.verdictSignals.labels('vt_malicious').inc(vtStats?.malicious ?? 0);
      }
      if ((vtStats?.suspicious ?? 0) > 0) {
        metrics.verdictSignals.labels('vt_suspicious').inc(vtStats?.suspicious ?? 0);
      }
      if (wasShortened) {
        metrics.verdictSignals.labels('shortener').inc();
      }
      if (finalUrlMismatch) {
        metrics.verdictSignals.labels('redirect_mismatch').inc();
      }
      if (redirectChain.length > 0) {
        metrics.verdictSignals.labels('redirect_chain').inc(redirectChain.length);
      }
      if (homoglyphResult.detected) {
        metrics.verdictSignals.labels(`homoglyph_${homoglyphResult.riskLevel}`).inc();
      }
      if (typeof domainAgeDays === 'number') {
        metrics.verdictSignals.labels('domain_age').inc();
      }
      if (signals.manualOverride) {
        metrics.verdictSignals.labels(`override_${signals.manualOverride}`).inc();
      }

      const blocklistHit = gsbHit || phishtankHit || Boolean(urlhausResult?.listed);

      let enqueuedUrlscan = false;
      if (config.urlscan.enabled && config.urlscan.apiKey && verdict === 'suspicious') {
        const queued = await redis.set(
          `${URLSCAN_QUEUED_PREFIX}${h}`,
          '1',
          'EX',
          config.urlscan.uuidTtlSeconds,
          'NX'
        );
        if (queued) {
          enqueuedUrlscan = true;
          await urlscanQueue.add(
            'submit',
            {
              url: finalUrl,
              urlHash: h,
            },
            {
              removeOnComplete: true,
              removeOnFail: 500,
              attempts: 1,
            }
          );
        }
      }

      const ttlByLevel = config.orchestrator.cacheTtl as Record<string, number>;
      const ttl = ttlByLevel[verdict] ?? verdictResult.cacheTtl ?? 3600;

      metrics.verdictCacheTtl.observe(ttl);

      const decidedAt = Date.now();
      const res = {
        messageId,
        chatId,
        url: finalUrl,
        normalizedUrl: finalUrl,
        urlHash: h,
        verdict,
        score,
        reasons,
        gsb: { matches: gsbMatches },
        phishtank: phishtankResult,
        urlhaus: urlhausResult,
        vt: vtStats,
        urlscan: enqueuedUrlscan ? { status: 'queued' } : undefined,
        whois: domainIntel,
        domainAgeDays,
        redirectChain,
        ttlLevel: verdict,
        cacheTtl: ttl,
        shortener: shortenerInfo ? { provider: shortenerInfo.provider, chain: shortenerInfo.chain } : undefined,
        finalUrlMismatch,
        decidedAt,
        degradedMode,
      };
      await setJsonCache(CACHE_LABELS.verdict, cacheKey, res, ttl);

      try {
        await dbClient.transaction(async () => {
          // Insert or update scan record
          const scanSql = `
            INSERT INTO scans (
              url_hash, normalized_url, verdict, score, reasons, vt_stats,
              gsafebrowsing_hit, domain_age_days, redirect_chain_summary, cache_ttl,
              source_kind, urlscan_status, whois_source, whois_registrar, shortener_provider,
              first_seen_at, last_seen_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(url_hash) DO UPDATE SET
              normalized_url=excluded.normalized_url,
              verdict=excluded.verdict,
              score=excluded.score,
              reasons=excluded.reasons,
              vt_stats=excluded.vt_stats,
              gsafebrowsing_hit=excluded.gsafebrowsing_hit,
              domain_age_days=excluded.domain_age_days,
              redirect_chain_summary=excluded.redirect_chain_summary,
              cache_ttl=excluded.cache_ttl,
              source_kind=excluded.source_kind,
              urlscan_status=excluded.urlscan_status,
              whois_source=excluded.whois_source,
              whois_registrar=excluded.whois_registrar,
              shortener_provider=excluded.shortener_provider,
              last_seen_at=CURRENT_TIMESTAMP
          `;

          await dbClient.query(scanSql, [
            h, finalUrl, verdict, score, JSON.stringify(reasons), JSON.stringify(vtStats || {}),
            blocklistHit, domainAgeDays ?? null, JSON.stringify(redirectChain), ttl,
            'wa', enqueuedUrlscan ? 'queued' : null,
            domainIntel.source === 'none' ? null : domainIntel.source,
            domainIntel.registrar ?? null, shortenerInfo?.provider ?? null
          ]);

          if (enqueuedUrlscan) {
            await dbClient.query('UPDATE scans SET urlscan_status=? WHERE url_hash=?', ['queued', h]);
          }

          if (chatId && messageId) {
            const messageSql = `
              INSERT INTO messages (chat_id, message_id, url_hash, verdict, posted_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(chat_id, message_id) DO NOTHING
            `;
            await dbClient.query(messageSql, [chatId, messageId, h, verdict]);
          }
        });
      } catch (err) {
        logger.warn({ err, chatId, messageId }, 'failed to persist message metadata for scan');
      }

      if (chatId && messageId) {
        await scanVerdictQueue.add('verdict', { ...res, chatId, messageId }, { removeOnComplete: true });
      } else {
        logger.info({ url: finalUrl, jobId: job.id, rescan: Boolean(rescan) }, 'Completed scan without chat context; skipping messaging flow');
      }

      await enhancedSecurity.recordVerdict(
        finalUrl,
        verdict === 'malicious' ? 'malicious' : verdict === 'suspicious' ? 'suspicious' : 'benign',
        score / 15.0
      ).catch((err) => {
        logger.warn({ err, url: finalUrl }, 'failed to record verdict for collaborative learning');
      });

      metrics.verdictCounter.labels(verdict).inc();
      const totalProcessingSeconds = (Date.now() - started) / 1000;
      metrics.verdictLatency.observe(Math.max(0, (Date.now() - ingestionTimestamp) / 1000));
      metrics.scanLatency.observe(totalProcessingSeconds);
      metrics.queueProcessingDuration.labels(queueName).observe(totalProcessingSeconds);
      metrics.queueCompleted.labels(queueName).inc();
      if (job.attemptsMade > 0) {
        metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
      }
    } catch (e) {
      metrics.queueFailures.labels(queueName).inc();
      metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
      logger.error(e, 'scan worker error');
    } finally {
      await refreshQueueMetrics(scanRequestQueue, queueName).catch(() => undefined);
    }
  }, { connection: redis, concurrency: config.orchestrator.concurrency });

  if (config.urlscan.enabled && config.urlscan.apiKey) {
    new Worker(config.queues.urlscan, async (job) => {
      const queueName = config.queues.urlscan;
      const started = Date.now();
      const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
      metrics.queueJobWait.labels(queueName).observe(waitSeconds);
      const { url, urlHash: urlHashValue } = job.data as { url: string; urlHash: string };
      try {
        const submission: UrlscanSubmissionResponse = await urlscanCircuit.execute(() =>
          withRetry(
            () =>
              submitUrlscan(url, {
                callbackUrl: config.urlscan.callbackUrl || undefined,
                visibility: config.urlscan.visibility,
                tags: config.urlscan.tags,
              }),
            {
              retries: 2,
              baseDelayMs: 1000,
              factor: 2,
              retryable: shouldRetry,
            }
          )
        );
        recordLatency(CIRCUIT_LABELS.urlscan, submission.latencyMs);
        if (submission.uuid) {
          await redis.set(
            `${URLSCAN_UUID_PREFIX}${submission.uuid}`,
            urlHashValue,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await redis.set(
            `${URLSCAN_SUBMITTED_PREFIX}${urlHashValue}`,
            submission.uuid,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await dbClient.query(
            `UPDATE scans SET urlscan_uuid=?, urlscan_status=?, urlscan_submitted_at=datetime('now'), urlscan_result_url=? WHERE url_hash=?`,
            [submission.uuid, 'submitted', submission.result ?? null, urlHashValue]
          );
        }
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }
      } catch (err) {
        recordError(CIRCUIT_LABELS.urlscan, err);
        logger.error({ err, url }, 'urlscan submission failed');
        await dbClient.query(
          `UPDATE scans SET urlscan_status=?, urlscan_completed_at=datetime('now') WHERE url_hash=?`,
          ['failed', urlHashValue]
        ).catch(() => undefined);
        metrics.queueFailures.labels(queueName).inc();
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        throw err;
      } finally {
        await refreshQueueMetrics(urlscanQueue, queueName).catch(() => undefined);
      }
    }, { connection: redis, concurrency: config.urlscan.concurrency });
  }

  await app.listen({ host: '0.0.0.0', port: 3001 });

  const shutdown = async () => {
    logger.info('Shutting down scan orchestrator...');
    await enhancedSecurity.stop();
    await app.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => { logger.error(err, 'Fatal in orchestrator'); process.exit(1); });
}

export const __testables = {
  fetchGsbAnalysis,
  fetchPhishtank,
  fetchVirusTotal,
  fetchUrlhaus,
  shouldRetry,
  classifyError,
  checkBlocklistsWithRedundancy,
  shouldQueryPhishtank,
  extractUrlscanArtifactCandidates,
  normalizeUrlscanArtifactCandidate,
};

```

# File: services/scan-orchestrator/src/index.ts

```typescript
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import {
  config,
  logger,
  register,
  metrics,
  externalLatency,
  externalErrors,
  circuitStates,
  circuitBreakerTransitionCounter,
  circuitBreakerRejections,
  circuitBreakerOpenDuration,
  queueDepthGauge,
  cacheHitRatioGauge,
  normalizeUrl,
  expandUrl,
  urlHash,
  gsbLookup,
  vtAnalyzeUrl,
  vtVerdictStats,
  domainAgeDaysFromRdap,
  extraHeuristics,
  scoreFromSignals,
  urlhausLookup,
  phishtankLookup,
  submitUrlscan,
  resolveShortener,
  whoisXmlLookup,
  disableWhoisXmlForMonth,
  whoDatLookup,
  CircuitBreaker,
  CircuitState,
  withRetry,
  QuotaExceededError,
  detectHomoglyphs,
  assertEssentialConfig,
} from '@wbscanner/shared';
import { EnhancedSecurityAnalyzer } from './enhanced-security';
import {
  checkBlocklistsWithRedundancy,
  shouldQueryPhishtank,
  type GsbFetchResult,
  type PhishtankFetchResult,
} from './blocklists';
import type { GsbThreatMatch, UrlhausLookupResult, PhishtankLookupResult, VirusTotalAnalysis, UrlscanSubmissionResponse, HomoglyphResult } from '@wbscanner/shared';
import { downloadUrlscanArtifacts } from './urlscan-artifacts';
import { getSharedConnection, type IDatabaseConnection } from './database';

const TEST_REDIS_KEY = '__WBSCANNER_TEST_REDIS__';
const TEST_QUEUE_FACTORY_KEY = '__WBSCANNER_TEST_QUEUE_FACTORY__';

class InMemoryRedis {
  private store = new Map<string, string>();
  private ttlStore = new Map<string, number>();
  private setStore = new Map<string, Set<string>>();
  private hashStore = new Map<string, Map<string, string>>();
  private listStore = new Map<string, string[]>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, mode?: string, ttlArg?: number, nxArg?: string): Promise<'OK' | null> {
    if (mode === 'EX') {
      const ttlSeconds = typeof ttlArg === 'number' ? ttlArg : 0;
      if (nxArg === 'NX' && this.store.has(key)) {
        return null;
      }
      this.store.set(key, value);
      if (ttlSeconds > 0) {
        this.ttlStore.set(key, ttlSeconds);
      } else {
        this.ttlStore.delete(key);
      }
      return 'OK';
    }
    this.store.set(key, value);
    this.ttlStore.delete(key);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    this.ttlStore.delete(key);
    this.setStore.delete(key);
    this.hashStore.delete(key);
    this.listStore.delete(key);
    return existed ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    return this.ttlStore.get(key) ?? -1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (seconds > 0) {
      this.ttlStore.set(key, seconds);
      return 1;
    }
    this.ttlStore.delete(key);
    return 0;
  }

  async sadd(key: string, member: string): Promise<number> {
    const set = this.setStore.get(key) ?? new Set<string>();
    set.add(member);
    this.setStore.set(key, set);
    return set.size;
  }

  async srem(key: string, member: string): Promise<number> {
    const set = this.setStore.get(key);
    if (!set) return 0;
    const existed = set.delete(member);
    if (set.size === 0) this.setStore.delete(key);
    return existed ? 1 : 0;
  }

  async scard(key: string): Promise<number> {
    return this.setStore.get(key)?.size ?? 0;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    const hash = this.hashStore.get(key) ?? new Map<string, string>();
    const existed = hash.has(field) ? 0 : 1;
    hash.set(field, value);
    this.hashStore.set(key, hash);
    return existed;
  }

  async hdel(key: string, field: string): Promise<number> {
    const hash = this.hashStore.get(key);
    if (!hash) return 0;
    const removed = hash.delete(field) ? 1 : 0;
    if (hash.size === 0) this.hashStore.delete(key);
    return removed;
  }

  async hkeys(key: string): Promise<string[]> {
    return Array.from(this.hashStore.get(key)?.keys() ?? []);
  }

  async lpush(key: string, value: string): Promise<number> {
    const list = this.listStore.get(key) ?? [];
    list.unshift(value);
    this.listStore.set(key, list);
    return list.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.listStore.get(key);
    if (!list) return;
    const normalizedStop = stop < 0 ? list.length + stop : stop;
    const trimmed = list.slice(start, normalizedStop + 1);
    this.listStore.set(key, trimmed);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.listStore.get(key) ?? [];
    const normalizedStop = stop < 0 ? list.length + stop : stop;
    return list.slice(start, normalizedStop + 1);
  }

  on(): void {
    // no-op for tests
  }

  quit(): Promise<void> {
    return Promise.resolve();
  }
}

class InMemoryQueue {
  constructor(private readonly name: string) { }
  async add(jobName: string, data: unknown) {
    return { id: `${this.name}:${jobName}:${Date.now()}`, data };
  }
  async getJobCounts() {
    return { waiting: 0, active: 0, delayed: 0, failed: 0 };
  }
  async getWaitingCount() {
    return 0;
  }
  on(): void {
    // intentionally no-op: event hooks are not required for in-memory queue used in tests
    // NOSONAR
  }
  async close(): Promise<void> {
    return Promise.resolve();
  }
}

function createRedisConnection(): Redis {
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as Record<string, unknown>)[TEST_REDIS_KEY]) {
    return (globalThis as unknown as Record<string, unknown>)[TEST_REDIS_KEY] as Redis;
  }
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryRedis() as unknown as Redis;
  }
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

const redis = createRedisConnection();
const scanRequestQueue = createQueue(config.queues.scanRequest, { connection: redis });
const scanVerdictQueue = createQueue(config.queues.scanVerdict, { connection: redis });
const urlscanQueue = createQueue(config.queues.urlscan, { connection: redis });

function createQueue(name: string, options: { connection: Redis }): Queue {
  if (typeof globalThis !== 'undefined') {
    const factory = (globalThis as unknown as Record<string, unknown>)[TEST_QUEUE_FACTORY_KEY];
    if (typeof factory === 'function') {
      return factory(name, options) as Queue;
    }
  }
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryQueue(name) as unknown as Queue;
  }
  return new Queue(name, options);
}

const queueMetricsInterval = setInterval(() => {
  refreshQueueMetrics(scanRequestQueue, config.queues.scanRequest).catch(() => undefined);
  refreshQueueMetrics(scanVerdictQueue, config.queues.scanVerdict).catch(() => undefined);
  refreshQueueMetrics(urlscanQueue, config.queues.urlscan).catch(() => undefined);
}, 10_000);
queueMetricsInterval.unref();

const ANALYSIS_TTLS = {
  gsb: 60 * 60,
  phishtank: 60 * 60,
  vt: 60 * 60,
  urlhaus: 60 * 60,
  urlscan: 60 * 60,
  whois: 7 * 24 * 60 * 60,
};

const URLSCAN_UUID_PREFIX = 'urlscan:uuid:';
const URLSCAN_QUEUED_PREFIX = 'urlscan:queued:';
const URLSCAN_SUBMITTED_PREFIX = 'urlscan:submitted:';
const URLSCAN_RESULT_PREFIX = 'urlscan:result:';
const SHORTENER_CACHE_PREFIX = 'url:shortener:';

const CACHE_LABELS = {
  gsb: 'gsb_analysis',
  phishtank: 'phishtank_analysis',
  vt: 'virustotal_analysis',
  urlhaus: 'urlhaus_analysis',
  shortener: 'shortener_resolution',
  whois: 'whois_analysis',
  verdict: 'scan_result',
} as const;

const CIRCUIT_DEFAULTS = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 30_000,
  windowMs: 60_000,
} as const;

const CIRCUIT_LABELS = {
  gsb: 'google_safe_browsing',
  phishtank: 'phishtank',
  urlhaus: 'urlhaus',
  vt: 'virustotal',
  urlscan: 'urlscan',
  whoisxml: 'whoisxml',
  whodat: 'whodat',
} as const;

const cacheRatios = new Map<string, { hits: number; misses: number }>();
const circuitOpenSince = new Map<string, number>();

const VERDICT_REASON_OTHER_LABEL = 'other';

// Refactored normalizeVerdictReason function (complexity 28 -> 15)
function normalizeVerdictReason(reason: string): string {
  // Manual overrides
  if (reason === 'Manually allowed') return 'manual_allow';
  if (reason === 'Manually blocked') return 'manual_deny';

  // Google Safe Browsing threats
  if (reason.startsWith('Google Safe Browsing')) {
    if (reason.includes('MALWARE')) return 'gsb_malware';
    if (reason.includes('SOCIAL_ENGINEERING')) return 'gsb_social_engineering';
    return 'gsb_threat';
  }

  // Blocklist threats
  if (reason === 'Verified phishing (Phishtank)') return 'phishtank_verified';
  if (reason === 'Known malware distribution (URLhaus)') return 'urlhaus_listed';

  // VirusTotal threats
  if (reason.includes('VT engine')) return 'vt_malicious';

  // Domain age threats
  if (reason.startsWith('Domain registered')) {
    if (reason.includes('<7')) return 'domain_age_lt7';
    if (reason.includes('<14')) return 'domain_age_lt14';
    if (reason.includes('<30')) return 'domain_age_lt30';
    return 'domain_age';
  }

  // Homoglyph threats
  if (reason.startsWith('High-risk homoglyph attack detected')) return 'homoglyph_high';
  if (reason.startsWith('Suspicious characters detected') ||
    reason === 'Suspicious homoglyph characters detected') return 'homoglyph_medium';
  if (reason === 'Punycode/IDN domain detected') return 'homoglyph_low';

  // URL structure threats
  if (reason === 'URL uses IP address') return 'ip_literal';
  if (reason === 'Suspicious TLD') return 'suspicious_tld';
  if (reason.startsWith('Multiple redirects')) return 'multiple_redirects';
  if (reason === 'Uncommon port') return 'uncommon_port';
  if (reason.startsWith('Long URL')) return 'long_url';
  if (reason === 'Executable file extension') return 'executable_extension';
  if (reason === 'Shortened URL expanded') return 'shortener_expanded';
  if (reason === 'Redirect leads to mismatched domain/brand') return 'redirect_mismatch';

  return VERDICT_REASON_OTHER_LABEL;
}

function recordCacheOutcome(cacheType: string, outcome: 'hit' | 'miss'): void {
  const state = cacheRatios.get(cacheType) ?? { hits: 0, misses: 0 };
  if (outcome === 'hit') {
    state.hits += 1;
  } else {
    state.misses += 1;
  }
  cacheRatios.set(cacheType, state);
  const total = state.hits + state.misses;
  if (total > 0) {
    cacheHitRatioGauge.labels(cacheType).set(state.hits / total);
  }
}

async function refreshQueueMetrics(queue: Queue, name: string): Promise<void> {
  const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
  queueDepthGauge.labels(name).set(counts.waiting ?? 0);
  metrics.queueActive.labels(name).set(counts.active ?? 0);
  metrics.queueDelayed.labels(name).set(counts.delayed ?? 0);
  metrics.queueFailedGauge.labels(name).set(counts.failed ?? 0);
}

function makeCircuit(name: string) {
  const breaker = new CircuitBreaker({
    ...CIRCUIT_DEFAULTS,
    name,
    onStateChange: (state, from) => {
      circuitStates.labels(name).set(state);
      circuitBreakerTransitionCounter.labels(name, String(from ?? ''), String(state)).inc();
      const now = Date.now();
      if (state === CircuitState.OPEN) {
        circuitOpenSince.set(name, now);
      } else if (from === CircuitState.OPEN) {
        const openedAt = circuitOpenSince.get(name);
        if (openedAt) {
          circuitBreakerOpenDuration.labels(name).observe((now - openedAt) / 1000);
          circuitOpenSince.delete(name);
        }
      }
      logger.debug({ name, from, to: state }, 'Circuit state change');
    }
  });
  circuitStates.labels(name).set(CircuitState.CLOSED);
  return breaker;
}

const gsbCircuit = makeCircuit(CIRCUIT_LABELS.gsb);
const phishtankCircuit = makeCircuit(CIRCUIT_LABELS.phishtank);
const urlhausCircuit = makeCircuit(CIRCUIT_LABELS.urlhaus);
const vtCircuit = makeCircuit(CIRCUIT_LABELS.vt);
const urlscanCircuit = makeCircuit(CIRCUIT_LABELS.urlscan);
const whoisCircuit = makeCircuit(CIRCUIT_LABELS.whoisxml);
const whodatCircuit = makeCircuit(CIRCUIT_LABELS.whodat);

function recordLatency(service: string, ms?: number) {
  if (typeof ms === 'number' && ms >= 0) {
    externalLatency.labels(service).observe(ms / 1000);
  }
}

function classifyError(err: unknown): string {
  const rawCode = (err as { code?: string | number; statusCode?: string | number })?.code ?? (err as { statusCode?: string | number })?.statusCode;
  if (rawCode === 'UND_ERR_HEADERS_TIMEOUT' || rawCode === 'UND_ERR_CONNECT_TIMEOUT') return 'timeout';
  const codeNum = typeof rawCode === 'string' ? Number(rawCode) : rawCode;
  if (codeNum === 429) return 'rate_limited';
  if (codeNum === 408) return 'timeout';
  if (typeof codeNum === 'number' && codeNum >= 500) return 'server_error';
  if (typeof codeNum === 'number' && codeNum >= 400) return 'client_error';
  const message = (err as Error)?.message || '';
  if (message.includes('Circuit') && message.includes('open')) return 'circuit_open';
  return 'unknown';
}

function recordError(service: string, err: unknown) {
  const reason = classifyError(err);
  if (reason === 'circuit_open') {
    circuitBreakerRejections.labels(service).inc();
  }
  externalErrors.labels(service, reason).inc();
}

function shouldRetry(err: unknown): boolean {
  const rawCode = (err as { code?: string | number; statusCode?: string | number })?.code ?? (err as { statusCode?: string | number })?.statusCode;
  if (rawCode === 'UND_ERR_HEADERS_TIMEOUT' || rawCode === 'UND_ERR_CONNECT_TIMEOUT') return true;
  const codeNum = typeof rawCode === 'string' ? Number(rawCode) : rawCode;
  if (codeNum === 429) return false;
  if (codeNum === 408) return true;
  if (typeof codeNum === 'number' && codeNum >= 500) return true;
  return !codeNum;
}

async function getJsonCache<T>(cacheType: string, key: string, ttlSeconds: number): Promise<T | null> {
  const stop = metrics.cacheLookupDuration.labels(cacheType).startTimer();
  const raw = await redis.get(key);
  stop();
  if (!raw) {
    recordCacheOutcome(cacheType, 'miss');
    metrics.cacheEntryTtl.labels(cacheType).set(0);
    return null;
  }
  recordCacheOutcome(cacheType, 'hit');
  metrics.cacheEntryBytes.labels(cacheType).set(Buffer.byteLength(raw));
  const ttlRemaining = await redis.ttl(key);
  if (ttlRemaining >= 0) {
    metrics.cacheEntryTtl.labels(cacheType).set(ttlRemaining);
    if (ttlSeconds > 0 && ttlRemaining < Math.max(1, Math.floor(ttlSeconds * 0.2))) {
      metrics.cacheStaleTotal.labels(cacheType).inc();
    }
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    metrics.cacheStaleTotal.labels(cacheType).inc();
    return null;
  }
}

async function setJsonCache(cacheType: string, key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const payload = JSON.stringify(value);
  const stop = metrics.cacheWriteDuration.labels(cacheType).startTimer();
  await redis.set(key, payload, 'EX', ttlSeconds);
  stop();
  metrics.cacheRefreshTotal.labels(cacheType).inc();
  metrics.cacheEntryBytes.labels(cacheType).set(Buffer.byteLength(payload));
  metrics.cacheEntryTtl.labels(cacheType).set(ttlSeconds);
}

type GsbMatch = GsbThreatMatch;
type VtStats = ReturnType<typeof vtVerdictStats>;
type UrlhausResult = UrlhausLookupResult;
type PhishtankResult = PhishtankLookupResult;

type ArtifactCandidate = {
  type: 'screenshot' | 'dom';
  url: string;
};

function normalizeUrlscanArtifactCandidate(candidate: unknown, baseUrl: string): { url?: string; invalid: boolean } {
  if (typeof candidate !== 'string') return { invalid: false };
  const trimmed = candidate.trim();
  if (!trimmed) return { invalid: false };

  const sanitizedBase = baseUrl.replace(/\/+$/, '');
  let trustedHostname: string;
  try {
    trustedHostname = new URL(sanitizedBase).hostname.toLowerCase();
  } catch {
    return { invalid: true };
  }

  const rawUrl = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${sanitizedBase}/${trimmed.replace(/^\/+/, '')}`;

  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return { invalid: true };
  }

  const parsed = new URL(normalized);
  const candidateHostname = parsed.hostname.toLowerCase();
  const hostAllowed =
    candidateHostname === trustedHostname || candidateHostname.endsWith(`.${trustedHostname}`);

  if (!hostAllowed) {
    return { invalid: true };
  }

  return { url: parsed.toString(), invalid: false };
}

function normaliseArtifactUrl(candidate: unknown, baseUrl: string): string | undefined {
  const result = normalizeUrlscanArtifactCandidate(candidate, baseUrl);
  return result.url;
}

function extractUrlscanArtifactCandidates(uuid: string, payload: unknown): ArtifactCandidate[] {
  const baseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
  const candidates: ArtifactCandidate[] = [];
  const seen = new Set<string>();

  const p = payload as {
    screenshotURL?: string;
    domURL?: string;
    task?: { screenshotURL?: string; domURL?: string };
    visual?: { data?: { screenshotURL?: string } };
  };

  const screenshotSources = [
    p?.screenshotURL,
    p?.task?.screenshotURL,
    p?.visual?.data?.screenshotURL,
    `${baseUrl}/screenshots/${uuid}.png`,
  ];

  for (const source of screenshotSources) {
    const resolved = normaliseArtifactUrl(source, baseUrl);
    if (resolved && !seen.has(`screenshot:${resolved}`)) {
      seen.add(`screenshot:${resolved}`);
      candidates.push({ type: 'screenshot', url: resolved });
    }
  }

  const domSources = [
    p?.domURL,
    p?.task?.domURL,
    `${baseUrl}/dom/${uuid}.json`,
  ];

  for (const source of domSources) {
    const resolved = normaliseArtifactUrl(source, baseUrl);
    if (resolved && !seen.has(`dom:${resolved}`)) {
      seen.add(`dom:${resolved}`);
      candidates.push({ type: 'dom', url: resolved });
    }
  }

  return candidates;
}

async function fetchGsbAnalysis(finalUrl: string, hash: string): Promise<GsbFetchResult> {
  if (!config.gsb.enabled) {
    logger.warn({ url: finalUrl }, 'Google Safe Browsing disabled by config');
    return { matches: [], fromCache: true, durationMs: 0, error: null };
  }
  const cacheKey = `url:analysis:${hash}:gsb`;
  const cached = await getJsonCache<GsbMatch[]>(CACHE_LABELS.gsb, cacheKey, ANALYSIS_TTLS.gsb);
  if (cached) {
    return { matches: cached, fromCache: true, durationMs: 0, error: null };
  }
  try {
    const result = await gsbCircuit.execute(() =>
      withRetry(() => gsbLookup([finalUrl]), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.gsb, result.latencyMs);
    await setJsonCache(CACHE_LABELS.gsb, cacheKey, result.matches, ANALYSIS_TTLS.gsb);
    return {
      matches: result.matches,
      fromCache: false,
      durationMs: result.latencyMs ?? 0,
      error: null,
    };
  } catch (err) {
    recordError(CIRCUIT_LABELS.gsb, err);
    logger.warn({ err, url: finalUrl }, 'Google Safe Browsing lookup failed');
    return { matches: [], fromCache: false, durationMs: 0, error: err as Error };
  }
}

async function fetchPhishtank(finalUrl: string, hash: string): Promise<PhishtankFetchResult> {
  if (!config.phishtank.enabled) {
    return { result: null, fromCache: true, error: null };
  }
  const cacheKey = `url:analysis:${hash}:phishtank`;
  const cached = await getJsonCache<PhishtankResult>(CACHE_LABELS.phishtank, cacheKey, ANALYSIS_TTLS.phishtank);
  if (cached) {
    return { result: cached, fromCache: true, error: null };
  }
  try {
    const result = await phishtankCircuit.execute(() =>
      withRetry(() => phishtankLookup(finalUrl), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.phishtank, result.latencyMs);
    await setJsonCache(CACHE_LABELS.phishtank, cacheKey, result, ANALYSIS_TTLS.phishtank);
    return { result, fromCache: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.phishtank, err);
    logger.warn({ err, url: finalUrl }, 'Phishtank lookup failed');
    return { result: null, fromCache: false, error: err as Error };
  }
}

interface VirusTotalFetchResult {
  stats?: VtStats;
  fromCache: boolean;
  quotaExceeded: boolean;
  error: Error | null;
}

async function fetchVirusTotal(finalUrl: string, hash: string): Promise<VirusTotalFetchResult> {
  if (!config.vt.enabled || !config.vt.apiKey) {
    if (!config.vt.enabled) logger.warn({ url: finalUrl }, 'VirusTotal disabled by config');
    return { stats: undefined, fromCache: true, quotaExceeded: false, error: null };
  }
  const cacheKey = `url:analysis:${hash}:vt`;
  const cached = await getJsonCache<VtStats>(CACHE_LABELS.vt, cacheKey, ANALYSIS_TTLS.vt);
  if (cached) {
    return { stats: cached, fromCache: true, quotaExceeded: false, error: null };
  }
  try {
    const analysis = await vtCircuit.execute(() =>
      withRetry(() => vtAnalyzeUrl(finalUrl), {
        retries: 3,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.vt, analysis.latencyMs);
    const stats = vtVerdictStats(analysis as VirusTotalAnalysis);
    if (stats) {
      await setJsonCache(CACHE_LABELS.vt, cacheKey, stats, ANALYSIS_TTLS.vt);
    }
    return { stats, fromCache: false, quotaExceeded: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.vt, err);
    const quotaExceeded = err instanceof QuotaExceededError || ((err as { code?: string | number; statusCode?: string | number })?.code ?? (err as { statusCode?: string | number })?.statusCode) === 429;
    if (!quotaExceeded) {
      logger.warn({ err, url: finalUrl }, 'VirusTotal lookup failed');
    }
    return { stats: undefined, fromCache: false, quotaExceeded, error: err as Error };
  }
}

interface UrlhausFetchResult {
  result: UrlhausResult | null;
  fromCache: boolean;
  error: Error | null;
}

async function fetchUrlhaus(finalUrl: string, hash: string): Promise<UrlhausFetchResult> {
  if (!config.urlhaus.enabled) {
    return { result: null, fromCache: true, error: null };
  }
  const cacheKey = `url:analysis:${hash}:urlhaus`;
  const cached = await getJsonCache<UrlhausResult>(CACHE_LABELS.urlhaus, cacheKey, ANALYSIS_TTLS.urlhaus);
  if (cached) {
    return { result: cached, fromCache: true, error: null };
  }
  try {
    const result = await urlhausCircuit.execute(() =>
      withRetry(() => urlhausLookup(finalUrl), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.urlhaus, result.latencyMs);
    await setJsonCache(CACHE_LABELS.urlhaus, cacheKey, result, ANALYSIS_TTLS.urlhaus);
    return { result, fromCache: false, error: null };
  } catch (err) {
    recordError(CIRCUIT_LABELS.urlhaus, err);
    logger.warn({ err, url: finalUrl }, 'URLhaus lookup failed');
    return { result: null, fromCache: false, error: err as Error };
  }
}

interface ShortenerCacheEntry {
  finalUrl: string;
  provider: string;
  chain: string[];
  wasShortened: boolean;
}

async function resolveShortenerWithCache(url: string, hash: string): Promise<ShortenerCacheEntry | null> {
  const cacheKey = `${SHORTENER_CACHE_PREFIX}${hash}`;
  const cached = await getJsonCache<ShortenerCacheEntry>(CACHE_LABELS.shortener, cacheKey, config.shortener.cacheTtlSeconds);
  if (cached) return cached;
  try {
    const start = Date.now();
    const resolved = await resolveShortener(url);
    recordLatency('shortener', Date.now() - start);
    if (resolved.wasShortened) {
      const payload: ShortenerCacheEntry = {
        finalUrl: resolved.finalUrl,
        provider: resolved.provider,
        chain: resolved.chain,
        wasShortened: true,
      };
      await setJsonCache(CACHE_LABELS.shortener, cacheKey, payload, config.shortener.cacheTtlSeconds);
      return payload;
    }
    return null;
  } catch (err) {
    recordError('shortener', err);
    logger.warn({ err, url }, 'Shortener resolution failed');
    return null;
  }
}

interface DomainIntelResult {
  ageDays?: number;
  source: 'rdap' | 'whoisxml' | 'whodat' | 'none';
  registrar?: string;
}

async function fetchDomainIntel(hostname: string, hash: string): Promise<DomainIntelResult> {
  if (config.rdap.enabled) {
    const rdapAge = await domainAgeDaysFromRdap(hostname, config.rdap.timeoutMs).catch(() => undefined);
    if (rdapAge !== undefined) {
      return { ageDays: rdapAge, source: 'rdap' };
    }
  } else {
    logger.warn({ hostname }, 'RDAP disabled by config');
  }

  // Try who-dat first if enabled (self-hosted, no quota limits)
  if (config.whodat?.enabled) {
    const cacheKey = `url:analysis:${hash}:whodat`;
    const cached = await getJsonCache<{ ageDays?: number; registrar?: string }>(
      CACHE_LABELS.whois,
      cacheKey,
      ANALYSIS_TTLS.whois
    );
    if (cached) {
      return { ageDays: cached.ageDays, registrar: cached.registrar, source: 'whodat' };
    }
    try {
      const start = Date.now();
      const response = await whodatCircuit.execute(() =>
        withRetry(() => whoDatLookup(hostname), {
          retries: 2,
          baseDelayMs: 1000,
          factor: 2,
          retryable: shouldRetry,
        })
      );
      recordLatency(CIRCUIT_LABELS.whodat, Date.now() - start);
      const record = (response as { record?: { estimatedDomainAgeDays?: number; registrarName?: string } })?.record;
      const ageDays = record?.estimatedDomainAgeDays;
      const registrar = record?.registrarName;
      await setJsonCache(CACHE_LABELS.whois, cacheKey, { ageDays, registrar }, ANALYSIS_TTLS.whois);
      return { ageDays, registrar, source: 'whodat' };
    } catch (err) {
      recordError(CIRCUIT_LABELS.whodat, err);
      logger.warn({ err, hostname }, 'Who-dat lookup failed, falling back to WhoisXML if available');
    }
  }

  // Fallback to WhoisXML if who-dat failed or is disabled
  if (!config.whoisxml?.enabled || !config.whoisxml.apiKey) {
    return { ageDays: undefined, source: 'none' };
  }
  const cacheKey = `url:analysis:${hash}:whois`;
  const cached = await getJsonCache<{ ageDays?: number; registrar?: string }>(
    CACHE_LABELS.whois,
    cacheKey,
    ANALYSIS_TTLS.whois
  );
  if (cached) {
    return { ageDays: cached.ageDays, registrar: cached.registrar, source: 'whoisxml' };
  }
  try {
    const start = Date.now();
    const response = await whoisCircuit.execute(() =>
      withRetry(() => whoisXmlLookup(hostname), {
        retries: 2,
        baseDelayMs: 1000,
        factor: 2,
        retryable: shouldRetry,
      })
    );
    recordLatency(CIRCUIT_LABELS.whoisxml, Date.now() - start);
    const record = (response as { record?: { estimatedDomainAgeDays?: number; registrarName?: string } })?.record;
    const ageDays = record?.estimatedDomainAgeDays;
    const registrar = record?.registrarName;
    await setJsonCache(CACHE_LABELS.whois, cacheKey, { ageDays, registrar }, ANALYSIS_TTLS.whois);
    return { ageDays, registrar, source: 'whoisxml' };
  } catch (err) {
    recordError(CIRCUIT_LABELS.whoisxml, err);
    if (err instanceof QuotaExceededError) {
      logger.warn({ hostname }, 'WhoisXML quota exhausted, disabling for remainder of month');
      disableWhoisXmlForMonth();
    } else {
      logger.warn({ err, hostname }, 'WhoisXML lookup failed');
    }
    return { ageDays: undefined, source: 'none' };
  }
}

async function loadManualOverride(dbClient: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, urlHash: string, hostname: string): Promise<'allow' | 'deny' | null> {
  try {
    const { rows } = await dbClient.query(
      `SELECT status FROM overrides
         WHERE (url_hash = ? OR pattern = ?)
           AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY created_at DESC
         LIMIT 1`,
      [urlHash, hostname]
    );
    const record = rows[0] as { status?: string } | undefined;
    const status = record?.status;
    return status === 'allow' || status === 'deny' ? status : null;
  } catch (err) {
    logger.warn({ err, urlHash, hostname }, 'Failed to load manual override');
    return null;
  }
}

// Helper functions to reduce cognitive complexity

interface CachedVerdict {
  verdict: string;
  score: number;
  reasons: string[];
  cacheTtl?: number;
  decidedAt?: number;
  [key: string]: unknown;
}

async function getCachedVerdict(cacheKey: string): Promise<CachedVerdict | null> {
  let cachedVerdict: CachedVerdict | null = null;
  let cachedTtl = -1;
  const cacheStop = metrics.cacheLookupDuration.labels(CACHE_LABELS.verdict).startTimer();
  const cachedRaw = await redis.get(cacheKey);
  cacheStop();

  if (cachedRaw) {
    recordCacheOutcome(CACHE_LABELS.verdict, 'hit');
    metrics.cacheHit.inc();
    metrics.cacheEntryBytes.labels(CACHE_LABELS.verdict).set(Buffer.byteLength(cachedRaw));
    cachedTtl = await redis.ttl(cacheKey);
    if (cachedTtl >= 0) {
      metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(cachedTtl);
    }
    try {
      cachedVerdict = JSON.parse(cachedRaw) as CachedVerdict;
    } catch {
      metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
    }
    if (
      cachedVerdict &&
      typeof cachedVerdict.cacheTtl === 'number' &&
      cachedTtl >= 0 &&
      cachedTtl < Math.max(1, Math.floor(cachedVerdict.cacheTtl * 0.2))
    ) {
      metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
    }
  } else {
    recordCacheOutcome(CACHE_LABELS.verdict, 'miss');
    metrics.cacheMiss.inc();
    metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(0);
  }

  return cachedVerdict;
}

async function handleCachedVerdict(
  cachedVerdict: CachedVerdict,
  chatId: string | undefined,
  messageId: string | undefined,
  hasChatContext: boolean,
  ingestionTimestamp: number,
  queueName: string,
  started: number,
  attemptsMade: number,
  url: string,
  rescan: boolean | undefined,
  jobId: string | undefined
): Promise<void> {
  const verdictLatencySeconds = Math.max(0, (Date.now() - ingestionTimestamp) / 1000);
  metrics.verdictLatency.observe(verdictLatencySeconds);
  recordQueueMetrics(queueName, started, attemptsMade);

  if (hasChatContext) {
    const resolvedMessageId = messageId ?? '';
    await scanVerdictQueue.add(
      'verdict',
      {
        chatId,
        messageId: resolvedMessageId,
        ...cachedVerdict,
        decidedAt: cachedVerdict.decidedAt ?? Date.now(),
      },
      { removeOnComplete: true }
    );
  } else {
    logger.info({ url, jobId, rescan: Boolean(rescan) }, 'Skipping verdict dispatch without chat context');
  }
}

function recordQueueMetrics(queueName: string, started: number, attemptsMade: number): void {
  metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
  metrics.queueCompleted.labels(queueName).inc();
  if (attemptsMade > 0) {
    metrics.queueRetries.labels(queueName).inc(attemptsMade);
  }
}

interface UrlAnalysisResult {
  finalUrl: string;
  finalUrlObj: URL;
  redirectChain: string[];
  heurSignals: Record<string, unknown>;
  wasShortened: boolean;
  finalUrlMismatch: boolean;
  shortenerInfo: { finalUrl: string; provider: string; chain: string[]; wasShortened: boolean } | null;
}

async function analyzeUrl(norm: string, h: string): Promise<UrlAnalysisResult> {
  const shortenerInfo = await resolveShortenerWithCache(norm, h);
  const preExpansionUrl = shortenerInfo?.finalUrl ?? norm;
  const exp = await expandUrl(preExpansionUrl, config.orchestrator.expansion);
  const finalUrl = exp.finalUrl;
  const finalUrlObj = new URL(finalUrl);
  const redirectChain = [...(shortenerInfo?.chain ?? []), ...exp.chain.filter((item: string) => !(shortenerInfo?.chain ?? []).includes(item))];
  const heurSignals = extraHeuristics(finalUrlObj);
  const wasShortened = Boolean(shortenerInfo?.wasShortened);
  const finalUrlMismatch = wasShortened && new URL(norm).hostname !== finalUrlObj.hostname;

  return {
    finalUrl,
    finalUrlObj,
    redirectChain,
    heurSignals,
    wasShortened,
    finalUrlMismatch,
    shortenerInfo
  };
}

async function handleHighConfidenceThreat(
  norm: string,
  finalUrl: string,
  h: string,
  redirectChain: string[],
  wasShortened: boolean,
  finalUrlMismatch: boolean,
  homoglyphResult: HomoglyphResult,
  heurSignals: Record<string, unknown>,
  enhancedSecurityResult: { verdict: string; confidence: string; score: number; reasons: string[]; skipExternalAPIs: boolean },
  cacheKey: string,
  chatId: string | undefined,
  messageId: string | undefined,
  hasChatContext: boolean,
  queueName: string,
  started: number,
  attemptsMade: number,
  ingestionTimestamp: number,
  dbClient: IDatabaseConnection,
  enhancedSecurity: EnhancedSecurityAnalyzer
): Promise<void> {
  logger.info({ url: finalUrl, score: enhancedSecurityResult.score, reasons: enhancedSecurityResult.reasons }, 'Tier 1 high-confidence threat detected, skipping external APIs');

  // Create a proper HomoglyphResult object with all required properties
  const fullHomoglyphResult: HomoglyphResult = {
    detected: homoglyphResult.detected,
    riskLevel: homoglyphResult.riskLevel,
    confusableChars: homoglyphResult.confusableChars,
    isPunycode: false, // Default values
    mixedScript: false,
    unicodeHostname: finalUrl,
    normalizedDomain: finalUrl,
    riskReasons: []
  };

  const signals = {
    gsbThreatTypes: [],
    phishtankVerified: false,
    urlhausListed: false,
    vtMalicious: undefined,
    vtSuspicious: undefined,
    vtHarmless: undefined,
    domainAgeDays: undefined,
    redirectCount: redirectChain.length,
    wasShortened,
    finalUrlMismatch,
    manualOverride: null,
    homoglyph: fullHomoglyphResult,
    ...heurSignals,
    enhancedSecurityScore: enhancedSecurityResult.score,
    enhancedSecurityReasons: enhancedSecurityResult.reasons,
  };

  const verdictResult = scoreFromSignals(signals);
  const verdict = 'malicious';
  const { score, reasons } = verdictResult;
  const enhancedReasons = [...reasons, ...enhancedSecurityResult.reasons];

  const cacheTtl = config.orchestrator.cacheTtl.malicious;
  const verdictPayload = {
    url: norm,
    finalUrl,
    verdict,
    score,
    reasons: enhancedReasons,
    cacheTtl,
    redirectChain,
    wasShortened,
    finalUrlMismatch,
    homoglyph: fullHomoglyphResult,
    enhancedSecurity: {
      tier1Score: enhancedSecurityResult.score,
      confidence: enhancedSecurityResult.confidence,
    },
    decidedAt: Date.now(),
  };

  await setJsonCache(CACHE_LABELS.verdict, cacheKey, verdictPayload, cacheTtl);

  try {
    await dbClient.transaction(async () => {
      const standardSql = `
        INSERT INTO scans (url_hash, url, final_url, verdict, score, reasons, cache_ttl, redirect_chain, was_shortened, final_url_mismatch, homoglyph_detected, homoglyph_risk_level, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(url_hash) DO UPDATE SET
          url=excluded.url,
          final_url=excluded.final_url,
          verdict=excluded.verdict,
          score=excluded.score,
          reasons=excluded.reasons,
          cache_ttl=excluded.cache_ttl,
          redirect_chain=excluded.redirect_chain,
          was_shortened=excluded.was_shortened,
          final_url_mismatch=excluded.final_url_mismatch,
          homoglyph_detected=excluded.homoglyph_detected,
          homoglyph_risk_level=excluded.homoglyph_risk_level,
          last_seen_at=CURRENT_TIMESTAMP
      `;

      await dbClient.query(standardSql, [
        h, norm, finalUrl, verdict, score, JSON.stringify(enhancedReasons), cacheTtl, JSON.stringify(redirectChain), wasShortened, finalUrlMismatch, homoglyphResult.detected, homoglyphResult.riskLevel
      ]);
    });
  } catch (err) {
    logger.error({ err, url: norm }, 'failed to persist enhanced security verdict');
  }

  metrics.verdictScore.observe(score);
  for (const reason of enhancedReasons) {
    metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
  }

  const verdictLatencySeconds = Math.max(0, (Date.now() - ingestionTimestamp) / 1000);
  metrics.verdictLatency.observe(verdictLatencySeconds);
  recordQueueMetrics(queueName, started, attemptsMade);

  if (hasChatContext) {
    await scanVerdictQueue.add('verdict', {
      chatId,
      messageId,
      ...verdictPayload,
    }, { removeOnComplete: true });
  }

  await enhancedSecurity.recordVerdict(finalUrl, 'malicious', enhancedSecurityResult.score / 3.0);
}

interface ExternalCheckResults {
  blocklistResult: {
    gsbMatches: GsbThreatMatch[];
    gsbResult: { error: Error | null };
    phishtankResult: PhishtankLookupResult | null;
    phishtankNeeded: boolean;
    phishtankError: Error | null;
  };
  domainIntel: {
    ageDays?: number;
    source: 'rdap' | 'whoisxml' | 'whodat' | 'none';
    registrar?: string;
  };
  manualOverride: 'allow' | 'deny' | null;
  vtStats?: VtStats;
  vtQuotaExceeded: boolean;
  vtError: Error | null;
  urlhausResult: UrlhausResult | null;
  urlhausError: Error | null;
  urlhausConsulted: boolean;
}

async function performExternalChecks(finalUrl: string, finalUrlObj: URL, h: string, dbClient: IDatabaseConnection): Promise<ExternalCheckResults> {
  const [blocklistResult, domainIntel, manualOverride] = await Promise.all([
    checkBlocklistsWithRedundancy({
      finalUrl,
      hash: h,
      fallbackLatencyMs: config.gsb.fallbackLatencyMs,
      gsbApiKeyPresent: Boolean(config.gsb.apiKey),
      phishtankEnabled: config.phishtank.enabled,
      fetchGsbAnalysis,
      fetchPhishtank,
    }),
    fetchDomainIntel(finalUrlObj.hostname, h),
    loadManualOverride(dbClient, h, finalUrlObj.hostname),
  ]);

  if (manualOverride) {
    metrics.manualOverrideApplied.labels(manualOverride).inc();
  }

  const gsbMatches = blocklistResult.gsbMatches;
  const gsbHit = gsbMatches.length > 0;
  if (gsbHit) metrics.gsbHits.inc();

  const phishtankResult = blocklistResult.phishtankResult;
  const phishtankHit = Boolean(phishtankResult?.verified);

  let vtStats: VtStats | undefined;
  let vtQuotaExceeded = false;
  let vtError: Error | null = null;
  if (!gsbHit && !phishtankHit) {
    const vtResponse = await fetchVirusTotal(finalUrl, h);
    vtStats = vtResponse.stats;
    vtQuotaExceeded = vtResponse.quotaExceeded;
    vtError = vtResponse.error;
    if (!vtResponse.fromCache && !vtResponse.error) {
      metrics.vtSubmissions.inc();
    }
  }

  let urlhausResult: UrlhausResult | null = null;
  let urlhausError: Error | null = null;
  let urlhausConsulted = false;
  const shouldQueryUrlhaus =
    !gsbHit && (
      !config.vt.apiKey ||
      vtQuotaExceeded ||
      vtError !== null ||
      !vtStats
    );
  if (shouldQueryUrlhaus) {
    urlhausConsulted = true;
    const urlhausResponse = await fetchUrlhaus(finalUrl, h);
    urlhausResult = urlhausResponse.result;
    urlhausError = urlhausResponse.error;
  }

  return {
    blocklistResult,
    domainIntel,
    manualOverride,
    vtStats,
    vtQuotaExceeded,
    vtError,
    urlhausResult,
    urlhausError,
    urlhausConsulted
  };
}

interface VerdictResult {
  level: string;
  score: number;
  reasons: string[];
  cacheTtl?: number;
  verdict: string;
  ttl: number;
  enqueuedUrlscan: boolean;
  degradedMode?: {
    providers: Array<{ name: string; reason: string }>;
  };
}

type ProviderState = {
  key: string;
  name: string;
  consulted: boolean;
  available: boolean;
  reason?: string;
};

function buildProviderStates(
  blocklistResult: ExternalCheckResults['blocklistResult'],
  vtStats: VtStats | undefined,
  vtQuotaExceeded: boolean,
  vtError: Error | null,
  urlhausResult: UrlhausResult | null,
  urlhausError: Error | null,
  urlhausConsulted: boolean
): ProviderState[] {
  const summarizeReason = (input?: string | null) => {
    if (!input) return 'unavailable';
    const trimmed = input.trim();
    if (trimmed.length === 0) return 'unavailable';
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
  };

  const providerStates: ProviderState[] = [
    {
      key: 'gsb',
      name: 'Google Safe Browsing',
      consulted: true,
      available: !blocklistResult.gsbResult.error,
      reason: blocklistResult.gsbResult.error ? summarizeReason(blocklistResult.gsbResult.error.message) : undefined,
    },
  ];

  if (blocklistResult.phishtankNeeded) {
    providerStates.push({
      key: 'phishtank',
      name: 'Phishtank',
      consulted: true,
      available: !blocklistResult.phishtankError,
      reason: blocklistResult.phishtankError ? summarizeReason(blocklistResult.phishtankError.message) : undefined,
    });
  }

  const gsbHit = blocklistResult.gsbMatches.length > 0;
  const phishtankHit = Boolean(blocklistResult.phishtankResult?.verified);
  const vtConsulted = !gsbHit && !phishtankHit && Boolean(config.vt.apiKey);

  if (vtConsulted) {
    let vtReason: string | undefined;
    if (!vtStats) {
      vtReason = vtQuotaExceeded ? 'quota_exhausted' : summarizeReason(vtError?.message ?? null);
    }
    providerStates.push({
      key: 'virustotal',
      name: 'VirusTotal',
      consulted: true,
      available: Boolean(vtStats) || (!vtError && !vtQuotaExceeded),
      reason: vtStats ? undefined : vtReason,
    });
  }

  if (urlhausConsulted) {
    providerStates.push({
      key: 'urlhaus',
      name: 'URLhaus',
      consulted: true,
      available: !urlhausError,
      reason: urlhausError ? summarizeReason(urlhausError.message) : undefined,
    });
  }

  return providerStates;
}

function recordVerdictMetrics(
  score: number,
  reasons: string[],
  baselineVerdict: string,
  verdict: string,
  gsbMatches: GsbThreatMatch[],
  phishtankHit: boolean,
  urlhausResult: UrlhausResult | null,
  vtStats: VtStats | undefined,
  wasShortened: boolean,
  finalUrlMismatch: boolean,
  redirectChain: string[],
  homoglyphResult: HomoglyphResult,
  domainAgeDays: number | undefined,
  manualOverride: string | null
): void {
  metrics.verdictScore.observe(score);
  for (const reason of reasons) {
    metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
  }
  if (baselineVerdict !== verdict) {
    metrics.verdictEscalations.labels(baselineVerdict, verdict).inc();
  }
  if (gsbMatches.length > 0) {
    metrics.verdictSignals.labels('gsb_match').inc(gsbMatches.length);
  }
  if (phishtankHit) {
    metrics.verdictSignals.labels('phishtank_verified').inc();
  }
  if (urlhausResult?.listed) {
    metrics.verdictSignals.labels('urlhaus_listed').inc();
  }
  if ((vtStats?.malicious ?? 0) > 0) {
    metrics.verdictSignals.labels('vt_malicious').inc(vtStats?.malicious ?? 0);
  }
  if ((vtStats?.suspicious ?? 0) > 0) {
    metrics.verdictSignals.labels('vt_suspicious').inc(vtStats?.suspicious ?? 0);
  }
  if (wasShortened) {
    metrics.verdictSignals.labels('shortener').inc();
  }
  if (finalUrlMismatch) {
    metrics.verdictSignals.labels('redirect_mismatch').inc();
  }
  if (redirectChain.length > 0) {
    metrics.verdictSignals.labels('redirect_chain').inc(redirectChain.length);
  }
  if (homoglyphResult.detected) {
    metrics.verdictSignals.labels(`homoglyph_${homoglyphResult.riskLevel}`).inc();
  }
  if (typeof domainAgeDays === 'number') {
    metrics.verdictSignals.labels('domain_age').inc();
  }
  if (manualOverride) {
    metrics.verdictSignals.labels(`override_${manualOverride}`).inc();
  }
}

async function generateVerdict(
  externalResults: ExternalCheckResults,
  finalUrl: string,
  h: string,
  redirectChain: string[],
  wasShortened: boolean,
  finalUrlMismatch: boolean,
  homoglyphResult: HomoglyphResult,
  heurSignals: Record<string, unknown>,
  enhancedSecurityResult: { verdict: string; confidence: string; score: number; reasons: string[]; skipExternalAPIs: boolean },
  shortenerInfo: { finalUrl: string; provider: string; chain: string[]; wasShortened: boolean } | null
): Promise<VerdictResult> {
  const { blocklistResult, domainIntel, manualOverride, vtStats, vtQuotaExceeded, vtError, urlhausResult, urlhausError, urlhausConsulted } = externalResults;

  const domainAgeDays = domainIntel.ageDays;
  const gsbMatches = blocklistResult.gsbMatches;
  const phishtankResult = blocklistResult.phishtankResult;
  const phishtankHit = Boolean(phishtankResult?.verified);

  const providerStates = buildProviderStates(
    blocklistResult,
    vtStats,
    vtQuotaExceeded,
    vtError,
    urlhausResult,
    urlhausError,
    urlhausConsulted
  );

  const consultedProviders = providerStates.filter((state) => state.consulted);
  const availableProviders = consultedProviders.filter((state) => state.available);
  const degradedProviders = consultedProviders.filter((state) => !state.available);
  const degradedMode = consultedProviders.length > 0 && availableProviders.length === 0
    ? {
      providers: degradedProviders.map((state) => ({
        name: state.name,
        reason: state.reason ?? 'unavailable',
      })),
    }
    : undefined;

  if (degradedMode) {
    metrics.degradedModeEvents.inc();
    metrics.externalScannersDegraded.set(1);
    logger.warn({ url: finalUrl, urlHash: h, providers: degradedMode.providers }, 'Operating in degraded mode with no external providers available');
  } else {
    metrics.externalScannersDegraded.set(0);
  }

  const heuristicsOnly = degradedMode !== undefined;
  const signals = {
    gsbThreatTypes: gsbMatches.map((m: GsbThreatMatch) => m.threatType),
    phishtankVerified: Boolean(phishtankResult?.verified),
    urlhausListed: Boolean(urlhausResult?.listed),
    vtMalicious: vtStats?.malicious,
    vtSuspicious: vtStats?.suspicious,
    vtHarmless: vtStats?.harmless,
    domainAgeDays,
    redirectCount: redirectChain.length,
    wasShortened,
    finalUrlMismatch,
    manualOverride,
    homoglyph: homoglyphResult,
    ...heurSignals,
    enhancedSecurityScore: enhancedSecurityResult.score,
    enhancedSecurityReasons: enhancedSecurityResult.reasons,
    heuristicsOnly,
  };
  const verdictResult = scoreFromSignals(signals);
  const verdict = verdictResult.level;
  let { score, reasons } = verdictResult;

  if (enhancedSecurityResult.reasons.length > 0) {
    reasons = [...reasons, ...enhancedSecurityResult.reasons];
  }
  const baselineVerdict = scoreFromSignals({ ...signals, manualOverride: null }).level;

  recordVerdictMetrics(
    score,
    reasons,
    baselineVerdict,
    verdict,
    gsbMatches,
    phishtankHit,
    urlhausResult,
    vtStats,
    wasShortened,
    finalUrlMismatch,
    redirectChain,
    homoglyphResult,
    domainAgeDays,
    manualOverride
  );

  const blocklistHit = gsbMatches.length > 0 || phishtankHit || Boolean(urlhausResult?.listed);

  let enqueuedUrlscan = false;
  if (config.urlscan.enabled && config.urlscan.apiKey && verdict === 'suspicious') {
    const queued = await redis.set(
      `${URLSCAN_QUEUED_PREFIX}${h}`,
      '1',
      'EX',
      config.urlscan.uuidTtlSeconds,
      'NX'
    );
    if (queued) {
      enqueuedUrlscan = true;
      await urlscanQueue.add(
        'submit',
        {
          url: finalUrl,
          urlHash: h,
          rescan: true,
        },
        {
          removeOnComplete: true,
          removeOnFail: 500,
          attempts: 1,
        }
      );
    }
  }

  const ttlByLevel = config.orchestrator.cacheTtl as Record<string, number>;
  const ttl = ttlByLevel[verdict] ?? verdictResult.cacheTtl ?? 3600;

  metrics.verdictCacheTtl.observe(ttl);

  return {
    level: verdict,
    score,
    reasons,
    cacheTtl: verdictResult.cacheTtl,
    verdict,
    ttl,
    enqueuedUrlscan,
    degradedMode
  };
}

async function storeAndDispatchResults(
  verdictResult: VerdictResult,
  chatId: string | undefined,
  messageId: string | undefined,
  hasChatContext: boolean,
  queueName: string,
  started: number,
  attemptsMade: number,
  ingestionTimestamp: number,
  finalUrl: string,
  enhancedSecurityResult: { verdict: string; confidence: string; score: number; reasons: string[]; skipExternalAPIs: boolean },
  dbClient: IDatabaseConnection,
  enhancedSecurity: EnhancedSecurityAnalyzer
): Promise<void> {
  const { verdict, score, reasons, ttl, enqueuedUrlscan, degradedMode } = verdictResult;
  const h = urlHash(finalUrl);
  const cacheKey = `scan:${h}`;

  const res = {
    messageId,
    chatId,
    url: finalUrl,
    normalizedUrl: finalUrl,
    urlHash: h,
    verdict,
    score,
    reasons,
    gsb: { matches: [] }, // Will be filled in by the caller
    phishtank: null, // Will be filled in by the caller
    urlhaus: null, // Will be filled in by the caller
    vt: undefined, // Will be filled in by the caller
    urlscan: enqueuedUrlscan ? { status: 'queued' } : undefined,
    whois: { source: 'none' }, // Will be filled in by the caller
    domainAgeDays: undefined, // Will be filled in by the caller
    redirectChain: [], // Will be filled in by the caller
    ttlLevel: verdict,
    cacheTtl: ttl,
    shortener: undefined, // Will be filled in by the caller
    finalUrlMismatch: false, // Will be filled in by the caller
    decidedAt: Date.now(),
    degradedMode,
  };

  await setJsonCache(CACHE_LABELS.verdict, cacheKey, res, ttl);

  try {
    await dbClient.transaction(async () => {
      const scanSql = `
        INSERT INTO scans (
          url_hash, normalized_url, verdict, score, reasons, vt_stats,
          gsafebrowsing_hit, domain_age_days, redirect_chain_summary, cache_ttl,
          source_kind, urlscan_status, whois_source, whois_registrar, shortener_provider,
          first_seen_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(url_hash) DO UPDATE SET
          normalized_url=excluded.normalized_url,
          verdict=excluded.verdict,
          score=excluded.score,
          reasons=excluded.reasons,
          vt_stats=excluded.vt_stats,
          gsafebrowsing_hit=excluded.gsafebrowsing_hit,
          domain_age_days=excluded.domain_age_days,
          redirect_chain_summary=excluded.redirect_chain_summary,
          cache_ttl=excluded.cache_ttl,
          source_kind=excluded.source_kind,
          urlscan_status=excluded.urlscan_status,
          whois_source=excluded.whois_source,
          whois_registrar=excluded.whois_registrar,
          shortener_provider=excluded.shortener_provider,
          last_seen_at=CURRENT_TIMESTAMP
      `;

      await dbClient.query(scanSql, [
        h, finalUrl, verdict, score, JSON.stringify(reasons), JSON.stringify({}),
        false, null, JSON.stringify([]), ttl,
        'wa', enqueuedUrlscan ? 'queued' : null,
        null, null, null
      ]);

      if (enqueuedUrlscan) {
        await dbClient.query('UPDATE scans SET urlscan_status=? WHERE url_hash=?', ['queued', h]);
      }

      if (chatId && messageId) {
        const messageSql = `
          INSERT INTO messages (chat_id, message_id, url_hash, verdict, posted_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(chat_id, message_id) DO NOTHING
        `;
        await dbClient.query(messageSql, [chatId, messageId, h, verdict]);
      }
    });
  } catch (err) {
    logger.warn({ err, chatId, messageId }, 'failed to persist message metadata for scan');
  }

  if (chatId && messageId) {
    await scanVerdictQueue.add('verdict', { ...res, chatId, messageId }, { removeOnComplete: true });
  } else {
    logger.info({ url: finalUrl }, 'Completed scan without chat context; skipping messaging flow');
  }

  await enhancedSecurity.recordVerdict(
    finalUrl,
    verdict === 'malicious' ? 'malicious' : verdict === 'suspicious' ? 'suspicious' : 'benign',
    score / 15.0
  ).catch((err: Error) => {
    logger.warn({ err, url: finalUrl }, 'failed to record verdict for collaborative learning');
  });

  metrics.verdictCounter.labels(verdict).inc();
  const totalProcessingSeconds = (Date.now() - started) / 1000;
  metrics.verdictLatency.observe(Math.max(0, (Date.now() - ingestionTimestamp) / 1000));
  metrics.scanLatency.observe(totalProcessingSeconds);
  recordQueueMetrics(queueName, started, attemptsMade);
}

interface UrlscanCallbackBody {
  uuid?: string;
  task?: { uuid?: string; url?: string; screenshotURL?: string; domURL?: string };
  visual?: { data?: { screenshotURL?: string } };
  screenshotURL?: string;
  domURL?: string;
  [key: string]: unknown;
}

// Refactored urlscan callback handler (complexity 17 -> 15)
async function handleUrlscanCallback(req: FastifyRequest, reply: FastifyReply, dbClient: IDatabaseConnection): Promise<void> {
  if (!config.urlscan.enabled) {
    reply.code(503).send({ ok: false, error: 'urlscan disabled' });
    return;
  }

  const secret = config.urlscan.callbackSecret;
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const rawHeaderToken = headers['x-urlscan-secret'] ?? headers['x-urlscan-token'];
  const headerToken = Array.isArray(rawHeaderToken) ? rawHeaderToken[0] : rawHeaderToken;
  const queryTokenRaw = (req.query as Record<string, string | string[] | undefined> | undefined)?.token;
  const queryToken = Array.isArray(queryTokenRaw) ? queryTokenRaw[0] : queryTokenRaw;

  if (!secret || (headerToken !== secret && queryToken !== secret)) {
    reply.code(401).send({ ok: false, error: 'unauthorized' });
    return;
  }

  const body = req.body as UrlscanCallbackBody;
  const uuid = body?.uuid || body?.task?.uuid;
  if (!uuid) {
    reply.code(400).send({ ok: false, error: 'missing uuid' });
    return;
  }

  const urlscanBaseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
  const artifactSources = [
    body?.screenshotURL,
    body?.task?.screenshotURL,
    body?.visual?.data?.screenshotURL,
    body?.domURL,
    body?.task?.domURL,
  ];

  for (const source of artifactSources) {
    const validation = normalizeUrlscanArtifactCandidate(source, urlscanBaseUrl);
    if (validation.invalid) {
      logger.warn({ uuid, source }, 'urlscan callback rejected due to artifact host validation');
      reply.code(400).send({ ok: false, error: 'invalid artifact url' });
      return;
    }
  }

  let urlHashValue = await redis.get(`${URLSCAN_UUID_PREFIX}${uuid}`);
  if (!urlHashValue) {
    const taskUrl: string | undefined = body?.task?.url;
    if (taskUrl) {
      const normalized = normalizeUrl(taskUrl);
      if (normalized) {
        urlHashValue = urlHash(normalized);
      }
    }
  }
  if (!urlHashValue) {
    logger.warn({ uuid }, 'urlscan callback without known url hash');
    reply.code(202).send({ ok: true });
    return;
  }

  await redis.set(
    `${URLSCAN_RESULT_PREFIX}${urlHashValue}`,
    JSON.stringify(body),
    'EX',
    config.urlscan.resultTtlSeconds
  );

  let artifacts: { screenshotPath: string | null; domPath: string | null } | null = null;
  try {
    artifacts = await downloadUrlscanArtifacts(uuid, urlHashValue);
  } catch (err) {
    logger.warn({ err, uuid }, 'failed to download urlscan artifacts');
  }

  await dbClient.query(
    `UPDATE scans
       SET urlscan_status=?,
           urlscan_completed_at=datetime('now'),
           urlscan_result=?,
           urlscan_screenshot_path=COALESCE(?, urlscan_screenshot_path),
           urlscan_dom_path=COALESCE(?, urlscan_dom_path),
           urlscan_artifact_stored_at=CASE
             WHEN ? IS NOT NULL OR ? IS NOT NULL THEN datetime('now')
             ELSE urlscan_artifact_stored_at
           END
     WHERE url_hash=?`,
    ['completed', JSON.stringify(body), artifacts?.screenshotPath ?? null, artifacts?.domPath ?? null, artifacts?.screenshotPath ?? null, artifacts?.domPath ?? null, urlHashValue]
  ).catch((err: Error) => {
    logger.error({ err }, 'failed to persist urlscan callback');
  });

  reply.send({ ok: true });
}

async function main() {
  assertEssentialConfig('scan-orchestrator');

  // Validate Redis connectivity before starting
  try {
    await redis.ping();
    logger.info('Redis connectivity validated');
  } catch (err) {
    logger.error({ err }, 'Redis connectivity check failed during startup');
    // Don't throw, let healthcheck handle it so container doesn't crash loop immediately
    // throw new Error('Redis is required but unreachable');
  }

  const dbClient = getSharedConnection();

  const enhancedSecurity = new EnhancedSecurityAnalyzer(redis);
  await enhancedSecurity.start();

  const app = Fastify();
  app.get('/healthz', async (_req, reply) => {
    try {
      // Check Redis connectivity
      await redis.ping();
      return { ok: true, redis: 'connected' };
    } catch (err) {
      logger.warn({ err }, 'Health check failed - Redis connectivity issue');
      reply.code(503);
      return { ok: false, redis: 'disconnected', error: 'Redis unreachable' };
    }
  });
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  app.post('/urlscan/callback', (req, reply) => handleUrlscanCallback(req, reply, dbClient));

  // Refactored scan request worker (complexity 89 -> 15)
  new Worker(config.queues.scanRequest, async (job) => {
    const queueName = config.queues.scanRequest;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const { chatId, messageId, url, timestamp, rescan } = job.data as {
      chatId?: string;
      messageId?: string;
      url: string;
      timestamp?: number;
      rescan?: boolean;
    };
    const ingestionTimestamp = typeof timestamp === 'number' ? timestamp : job.timestamp ?? started;
    const hasChatContext = typeof chatId === 'string' && typeof messageId === 'string';

    try {
      const norm = normalizeUrl(url);
      if (!norm) {
        recordQueueMetrics(queueName, started, job.attemptsMade);
        return;
      }

      const h = urlHash(norm);
      const cacheKey = `scan:${h}`;

      // Check for cached verdict
      const cachedVerdict = await getCachedVerdict(cacheKey);
      if (cachedVerdict) {
        await handleCachedVerdict(cachedVerdict, chatId, messageId, hasChatContext, ingestionTimestamp, queueName, started, job.attemptsMade, norm, rescan, job.id);
        return;
      }

      // Process URL and gather signals
      const urlAnalysis = await analyzeUrl(norm, h);
      const { finalUrl, finalUrlObj, redirectChain, heurSignals, wasShortened, finalUrlMismatch, shortenerInfo } = urlAnalysis;

      // Detect homoglyphs
      const homoglyphResult = detectHomoglyphs(finalUrlObj.hostname);
      if (homoglyphResult.detected) {
        metrics.homoglyphDetections.labels(homoglyphResult.riskLevel).inc();
        logger.info({ hostname: finalUrlObj.hostname, risk: homoglyphResult.riskLevel, confusables: homoglyphResult.confusableChars }, 'Homoglyph detection');
      }

      // Enhanced security analysis
      const enhancedSecurityResult = await enhancedSecurity.analyze(finalUrl, h);

      // Handle high-confidence malicious URLs
      if (enhancedSecurityResult.verdict === 'malicious' && enhancedSecurityResult.confidence === 'high' && enhancedSecurityResult.skipExternalAPIs) {
        await handleHighConfidenceThreat(
          norm, finalUrl, h, redirectChain, wasShortened, finalUrlMismatch,
          homoglyphResult, heurSignals, { verdict: enhancedSecurityResult.verdict || "unknown", confidence: enhancedSecurityResult.confidence || "unknown", score: enhancedSecurityResult.score, reasons: enhancedSecurityResult.reasons, skipExternalAPIs: enhancedSecurityResult.skipExternalAPIs }, cacheKey,
          chatId, messageId, hasChatContext, queueName, started, job.attemptsMade, ingestionTimestamp, dbClient, enhancedSecurity
        );
        return;
      }

      // External API checks
      const externalResults = await performExternalChecks(finalUrl, finalUrlObj, h, dbClient);

      // Generate verdict
      const verdictResult = await generateVerdict(
        externalResults, finalUrl, h, redirectChain, wasShortened, finalUrlMismatch,
        homoglyphResult, heurSignals, { verdict: enhancedSecurityResult.verdict || "unknown", confidence: enhancedSecurityResult.confidence || "unknown", score: enhancedSecurityResult.score, reasons: enhancedSecurityResult.reasons, skipExternalAPIs: enhancedSecurityResult.skipExternalAPIs }, shortenerInfo
      );

      // Store results and dispatch
      await storeAndDispatchResults(
        verdictResult, chatId, messageId, hasChatContext, queueName, started,
        job.attemptsMade, ingestionTimestamp, finalUrl, { verdict: enhancedSecurityResult.verdict || "unknown", confidence: enhancedSecurityResult.confidence || "unknown", score: enhancedSecurityResult.score, reasons: enhancedSecurityResult.reasons, skipExternalAPIs: enhancedSecurityResult.skipExternalAPIs }, dbClient, enhancedSecurity
      );

    } catch (e) {
      metrics.queueFailures.labels(queueName).inc();
      metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
      logger.error(e, 'scan worker error');
    } finally {
      await refreshQueueMetrics(scanRequestQueue, queueName).catch(() => undefined);
    }
  }, { connection: redis, concurrency: config.orchestrator.concurrency });

  if (config.urlscan.enabled && config.urlscan.apiKey) {
    new Worker(config.queues.urlscan, async (job) => {
      const queueName = config.queues.urlscan;
      const started = Date.now();
      const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
      metrics.queueJobWait.labels(queueName).observe(waitSeconds);
      const { url, urlHash: urlHashValue } = job.data as { url: string; urlHash: string };
      try {
        const submission: UrlscanSubmissionResponse = await urlscanCircuit.execute(() =>
          withRetry(
            () =>
              submitUrlscan(url, {
                callbackUrl: config.urlscan.callbackUrl || undefined,
                visibility: config.urlscan.visibility,
                tags: config.urlscan.tags,
              }),
            {
              retries: 2,
              baseDelayMs: 1000,
              factor: 2,
              retryable: shouldRetry,
            }
          )
        );
        recordLatency(CIRCUIT_LABELS.urlscan, submission.latencyMs);
        if (submission.uuid) {
          await redis.set(
            `${URLSCAN_UUID_PREFIX}${submission.uuid}`,
            urlHashValue,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await redis.set(
            `${URLSCAN_SUBMITTED_PREFIX}${urlHashValue}`,
            submission.uuid,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await dbClient.query(
            `UPDATE scans SET urlscan_uuid=?, urlscan_status=?, urlscan_submitted_at=datetime('now'), urlscan_result_url=? WHERE url_hash=?`,
            [submission.uuid, 'submitted', submission.result ?? null, urlHashValue]
          );
        }
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }
      } catch (err) {
        recordError(CIRCUIT_LABELS.urlscan, err);
        logger.error({ err, url }, 'urlscan submission failed');
        await dbClient.query(
          `UPDATE scans SET urlscan_status=?, urlscan_completed_at=datetime('now') WHERE url_hash=?`,
          ['failed', urlHashValue]
        ).catch(() => undefined);
        metrics.queueFailures.labels(queueName).inc();
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        throw err;
      } finally {
        await refreshQueueMetrics(urlscanQueue, queueName).catch(() => undefined);
      }
    }, { connection: redis, concurrency: config.urlscan.concurrency });
  }

  await app.listen({ host: '0.0.0.0', port: 3001 });

  const shutdown = async () => {
    logger.info('Shutting down scan orchestrator...');
    await enhancedSecurity.stop();
    await app.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => { logger.error(err, 'Fatal in orchestrator'); process.exit(1); });
}

export const __testables = {
  fetchGsbAnalysis,
  fetchPhishtank,
  fetchVirusTotal,
  fetchUrlhaus,
  shouldRetry,
  classifyError,
  checkBlocklistsWithRedundancy,
  shouldQueryPhishtank,
  extractUrlscanArtifactCandidates,
  normalizeUrlscanArtifactCandidate,
};
```

# File: services/wa-client/src/alerts.ts

```typescript
import type { Logger } from 'pino';

interface AuthFailureAlert {
  clientId: string;
  count: number;
  lastMessage?: string;
}

export async function sendAuthFailureAlert(logger: Logger, payload: AuthFailureAlert): Promise<void> {
  const webhook = process.env.WA_ALERT_WEBHOOK_URL;
  const text = `wa-client auth failures for ${payload.clientId}: ${payload.count} consecutive errors. Last message: ${payload.lastMessage ?? 'n/a'}`;
  if (!webhook) {
    logger.warn({ payload }, 'WA_ALERT_WEBHOOK_URL not configured; skipping external auth-failure alert');
    return;
  }
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body }, 'Failed to send auth failure alert');
    }
  } catch (err) {
    logger.error({ err }, 'Error sending auth failure alert');
  }
}

```

# File: services/wa-client/src/groupGovernance.ts

```typescript
import type Redis from 'ioredis';

export type GroupConsentState = 'pending' | 'granted' | 'denied';

const CONSENT_KEY = (chatId: string) => `wa:group:${chatId}:consent`;
const AUTO_APPROVE_KEY = (chatId: string) => `wa:group:${chatId}:auto_approve`;
const GOVERNANCE_COUNT_KEY = (chatId: string) => `wa:group:${chatId}:gov_actions`;
const GOVERNANCE_AUDIT_KEY = (chatId: string) => `wa:group:${chatId}:gov_audit`;
const INVITE_ROTATED_AT_KEY = (chatId: string) => `wa:group:${chatId}:invite_rotated_at`;

const GOVERNANCE_AUDIT_TTL_SECONDS = 60 * 60 * 24 * 7;
const INVITE_ROTATION_TTL_SECONDS = 60 * 60 * 24;

export async function getGroupConsent(redis: Redis, chatId: string): Promise<GroupConsentState | null> {
  const value = await redis.get(CONSENT_KEY(chatId));
  if (!value) return null;
  if (value === 'granted' || value === 'denied' || value === 'pending') return value;
  return null;
}

export async function setGroupConsent(redis: Redis, chatId: string, state: GroupConsentState): Promise<void> {
  await redis.set(CONSENT_KEY(chatId), state);
}

export async function getAutoApprove(redis: Redis, chatId: string, fallback: boolean): Promise<boolean> {
  const value = await redis.get(AUTO_APPROVE_KEY(chatId));
  if (value === null) return fallback;
  return value === 'true';
}

export async function setAutoApprove(redis: Redis, chatId: string, enabled: boolean): Promise<void> {
  await redis.set(AUTO_APPROVE_KEY(chatId), enabled ? 'true' : 'false');
}

export async function recordGovernanceAction(redis: Redis, chatId: string, ttlSeconds: number): Promise<number> {
  const key = GOVERNANCE_COUNT_KEY(chatId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

export async function getGovernanceActionCount(redis: Redis, chatId: string): Promise<number> {
  const raw = await redis.get(GOVERNANCE_COUNT_KEY(chatId));
  return raw ? Number(raw) : 0;
}

export async function appendGovernanceLog(redis: Redis, chatId: string, entry: { action: string; actor?: string | null; targets?: string[]; detail?: string; reason?: string }): Promise<void> {
  const payload = JSON.stringify({
    ...entry,
    action: entry.action,
    actor: entry.actor ?? null,
    targets: entry.targets ?? [],
    detail: entry.detail ?? null,
    reason: entry.reason ?? null,
    at: Date.now(),
  });
  await redis
    .multi()
    .lpush(GOVERNANCE_AUDIT_KEY(chatId), payload)
    .ltrim(GOVERNANCE_AUDIT_KEY(chatId), 0, 49)
    .expire(GOVERNANCE_AUDIT_KEY(chatId), GOVERNANCE_AUDIT_TTL_SECONDS)
    .exec();
}

export async function recordInviteRotation(redis: Redis, chatId: string): Promise<void> {
  await redis.set(INVITE_ROTATED_AT_KEY(chatId), Date.now().toString(), 'EX', INVITE_ROTATION_TTL_SECONDS);
}

export async function getLastInviteRotation(redis: Redis, chatId: string): Promise<number | null> {
  const raw = await redis.get(INVITE_ROTATED_AT_KEY(chatId));
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

```

# File: services/wa-client/src/media.ts

```typescript
import { existsSync } from 'node:fs';
import path from 'node:path';
import { MessageMedia } from 'whatsapp-web.js';
import type { Logger } from 'pino';

interface VerdictJobData {
  urlHash: string;
  urlscan?: { screenshotPath?: string | null; artifactPath?: string | null };
  artifacts?: { screenshotPath?: string | null; badgePath?: string | null };
}

function resolveCandidatePaths(job: VerdictJobData): string[] {
  const candidates = new Set<string>();
  const collect = (value?: string | null) => {
    if (value) candidates.add(path.resolve(value));
  };
  collect(job.urlscan?.screenshotPath ?? undefined);
  collect(job.artifacts?.screenshotPath ?? undefined);
  collect(job.artifacts?.badgePath ?? undefined);
  const mediaDir = process.env.WA_VERDICT_MEDIA_DIR;
  if (mediaDir) {
    const pngPath = path.join(mediaDir, `${job.urlHash}.png`);
    const jpgPath = path.join(mediaDir, `${job.urlHash}.jpg`);
    const webpPath = path.join(mediaDir, `${job.urlHash}.webp`);
    [pngPath, jpgPath, webpPath].forEach(p => candidates.add(p));
  }
  return Array.from(candidates);
}

async function loadVerdictMedia(file: string): Promise<MessageMedia> {
  // Ensure we always work with a Promise-returning API, even if the library
  // typings for MessageMedia.fromFilePath do not declare a Promise type.
  return Promise.resolve(
    MessageMedia.fromFilePath(file) as unknown as MessageMedia,
  );
}

export async function buildVerdictMedia(job: VerdictJobData, logger: Logger): Promise<{ media: MessageMedia; caption?: string } | null> {
  const files = resolveCandidatePaths(job);
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const media = await loadVerdictMedia(file);
      return { media };
    } catch (err) {
      logger.warn({ err, file }, 'Failed to load verdict attachment');
    }
  }
  return null;
}

```

# File: services/wa-client/src/remoteAuthStore.ts

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { EncryptionMaterials } from './crypto/dataKeyProvider';
import { encryptPayload, decryptPayload, type EncryptedPayload } from './crypto/secureEnvelope';

interface StoreOptions {
  redis: Redis;
  logger: Logger;
  prefix: string;
  materials: EncryptionMaterials;
  clientId: string;
}

interface StorePayload {
  payload: EncryptedPayload;
  updatedAt: number;
  clientId: string;
  version: number;
}

export class RedisRemoteAuthStore {
  private readonly redis: Redis;
  private readonly logger: Logger;
  private readonly prefix: string;
  private readonly materials: EncryptionMaterials;
  private readonly clientId: string;

  constructor(options: StoreOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.prefix = options.prefix.replace(/:+$/, '');
    this.materials = options.materials;
    this.clientId = options.clientId;
  }

  public key(session: string): string {
    return `${this.prefix}:${session}`;
  }

  async sessionExists({ session }: { session: string }): Promise<boolean> {
    const exists = await this.redis.exists(this.key(session));
    return exists === 1;
  }

  async delete({ session }: { session: string }): Promise<void> {
    await this.redis.del(this.key(session));
    this.logger.info({ session, clientId: this.clientId }, 'Deleted RemoteAuth session from Redis');
  }

  async save({ session }: { session: string }): Promise<void> {
    const zipPath = path.resolve(`${session}.zip`);
    const contents = await fs.readFile(zipPath);
    const payload = encryptPayload(contents, this.materials);
    const record: StorePayload = {
      payload,
      updatedAt: Date.now(),
      clientId: this.clientId,
      version: payload.version,
    };
    await this.redis.set(this.key(session), JSON.stringify(record));
    this.logger.info({ session, clientId: this.clientId }, 'Persisted RemoteAuth session snapshot to Redis');
  }

  async extract({ session, path: zipPath }: { session: string; path: string }): Promise<void> {
    const raw = await this.redis.get(this.key(session));
    if (!raw) {
      throw new Error(`RemoteAuth session ${session} not found in Redis`);
    }
    let record: StorePayload;
    try {
      record = JSON.parse(raw) as StorePayload;
    } catch (err) {
      throw new Error(`Stored RemoteAuth payload is invalid JSON: ${(err as Error).message}`);
    }
    const buffer = decryptPayload(record.payload, this.materials);
    await fs.writeFile(path.resolve(zipPath), buffer);
    this.logger.info({ session, clientId: this.clientId }, 'Extracted RemoteAuth session snapshot from Redis');
  }
}

export function createRemoteAuthStore(options: StoreOptions): RedisRemoteAuthStore {
  return new RedisRemoteAuthStore(options);
}

```

# File: services/wa-client/src/waHealth.ts

```typescript
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { metrics } from '@wbscanner/shared';

export interface WaHealthEvent {
  event: string;
  state?: string;
  reason?: string;
  details?: Record<string, unknown>;
  version?: string;
}

export interface WaHealthContext {
  queue: Queue;
  redis: Redis;
  clientId: string;
  logger: Logger;
  alertThreshold: number;
  alertCooldownSeconds: number;
  failureWindowSeconds: number;
}

const AUTH_FAILURE_KEY = (clientId: string) => `wa:authfail:${clientId}`;
const AUTH_ALERT_KEY = (clientId: string) => `wa:authfail:alerted:${clientId}`;

export async function publishWaHealth(ctx: WaHealthContext, payload: WaHealthEvent): Promise<void> {
  const now = Date.now();
  const stateLabel = payload.state ?? 'unknown';
  metrics.waStateChanges.labels(payload.event, stateLabel).inc();
  await ctx.queue.add(
    'state-change',
    {
      ...payload,
      clientId: ctx.clientId,
      timestamp: now,
    },
    { removeOnComplete: true, removeOnFail: 50 }
  ).catch((err) => {
    ctx.logger.warn({ err, payload }, 'Failed to enqueue wa health event');
  });
  ctx.logger.info({ payload }, 'Published WhatsApp health event');
}

export async function incrementAuthFailure(ctx: WaHealthContext): Promise<{ count: number; alert: boolean }> {
  const key = AUTH_FAILURE_KEY(ctx.clientId);
  const count = await ctx.redis.incr(key);
  await ctx.redis.expire(key, ctx.failureWindowSeconds);
  metrics.waConsecutiveAuthFailures.labels(ctx.clientId).set(count);
  if (count >= ctx.alertThreshold) {
    const alertKey = AUTH_ALERT_KEY(ctx.clientId);
    const alreadyAlerted = await ctx.redis.exists(alertKey);
    if (!alreadyAlerted) {
      await ctx.redis.set(alertKey, '1', 'EX', ctx.alertCooldownSeconds);
      return { count, alert: true };
    }
  }
  return { count, alert: false };
}

export async function resetAuthFailures(ctx: WaHealthContext): Promise<void> {
  const key = AUTH_FAILURE_KEY(ctx.clientId);
  await ctx.redis.del(key);
  metrics.waConsecutiveAuthFailures.labels(ctx.clientId).set(0);
}

```

# File: services/wa-client/src/group-store.ts

```typescript
import Redis from 'ioredis';

export interface GroupGovernanceEvent {
  chatId: string;
  type: string;
  timestamp: number;
  actorId?: string | null;
  recipients?: string[];
  details?: string;
  metadata?: Record<string, unknown>;
}

export class GroupStore {
  private readonly maxEvents: number;

  constructor(private readonly redis: Redis, private readonly ttlSeconds: number, options?: { maxEvents?: number }) {
    this.maxEvents = options?.maxEvents && options.maxEvents > 0 ? options.maxEvents : 50;
  }

  private key(chatId: string): string {
    return `wa:group:audit:${chatId}`;
  }

  async recordEvent(event: GroupGovernanceEvent): Promise<void> {
    const payload: GroupGovernanceEvent = {
      ...event,
      recipients: event.recipients ?? [],
      metadata: event.metadata ?? {},
    };
    const serialized = JSON.stringify(payload);
    const key = this.key(event.chatId);
    await this.redis.lpush(key, serialized);
    await this.redis.ltrim(key, 0, this.maxEvents - 1);
    await this.redis.expire(key, this.ttlSeconds);
  }

  async listRecentEvents(chatId: string, limit = 10): Promise<GroupGovernanceEvent[]> {
    if (limit <= 0) {
      return [];
    }
    const entries = await this.redis.lrange(this.key(chatId), 0, limit - 1);
    const events: GroupGovernanceEvent[] = [];
    for (const entry of entries) {
      try {
        const parsed = JSON.parse(entry) as GroupGovernanceEvent;
        events.push(parsed);
      } catch {
        // ignore malformed entries
      }
    }
    return events;
  }

  async clearEvents(chatId: string): Promise<void> {
    await this.redis.del(this.key(chatId));
  }
}

```

# File: services/wa-client/src/message-store.ts

```typescript
import Redis from 'ioredis';

export type VerdictStatus = 'pending' | 'sent' | 'retrying' | 'failed' | 'retracted';

export interface VerdictAttemptPayload {
  chatId: string;
  messageId: string;
  url: string;
  urlHash: string;
  verdict: string;
  reasons: string[];
  decidedAt?: number;
  verdictMessageId?: string;
  ack?: number | null;
  attachments?: { screenshot?: boolean; ioc?: boolean };
  redirectChain?: string[];
  shortener?: { provider: string; chain: string[] } | null;
  degradedProviders?: Array<{ name: string; reason: string }> | null;
}

export interface VerdictRecord {
  url: string;
  urlHash: string;
  verdict: string;
  reasons: string[];
  decidedAt?: number;
  status: VerdictStatus;
  attemptCount: number;
  lastAttemptAt?: number;
  verdictMessageId?: string;
  ack?: number | null;
  lastAckAt?: number;
  ackHistory: Array<{ ack: number | null; at: number }>;
  attachments?: { screenshot?: boolean; ioc?: boolean };
  redirectChain?: string[];
  shortener?: { provider: string; chain: string[] } | null;
  degradedProviders?: Array<{ name: string; reason: string }> | null;
}

export interface MessageEditRecord {
  body: string;
  normalizedUrls: string[];
  urlHashes: string[];
  timestamp: number;
}

export interface MessageReactionRecord {
  reaction: string;
  senderId: string;
  timestamp: number;
}

export interface MessageRevocationRecord {
  scope: 'everyone' | 'me';
  timestamp: number;
}

export interface MessageRecord {
  chatId: string;
  messageId: string;
  senderId?: string | null;
  senderIdHash?: string | null;
  timestamp?: number;
  body?: string;
  normalizedUrls: string[];
  urlHashes: string[];
  createdAt: number;
  edits: MessageEditRecord[];
  reactions: MessageReactionRecord[];
  revocations: MessageRevocationRecord[];
  verdicts: Record<string, VerdictRecord>;
}

export interface VerdictContext {
  chatId: string;
  messageId: string;
  urlHash: string;
}

const MESSAGE_KEY_PREFIX = 'wa:message:';
const VERDICT_MAP_PREFIX = 'wa:verdict:message:';
const PENDING_ACK_SET_KEY = 'wa:verdict:pending_ack';

export class MessageStore {
  constructor(private readonly redis: Redis, private readonly ttlSeconds: number) {}

  private messageKey(chatId: string, messageId: string): string {
    return `${MESSAGE_KEY_PREFIX}${chatId}:${messageId}`;
  }

  private verdictMappingKey(verdictMessageId: string): string {
    return `${VERDICT_MAP_PREFIX}${verdictMessageId}`;
  }

  private serializeContext(context: VerdictContext): string {
    return JSON.stringify({ chatId: context.chatId, messageId: context.messageId, urlHash: context.urlHash });
  }

  private async loadRecord(key: string): Promise<MessageRecord | null> {
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as MessageRecord;
      parsed.edits ??= [];
      parsed.reactions ??= [];
      parsed.revocations ??= [];
      parsed.verdicts ??= {};
      return parsed;
    } catch {
      return null;
    }
  }

  private async saveRecord(key: string, record: MessageRecord): Promise<void> {
    await this.redis.set(key, JSON.stringify(record), 'EX', this.ttlSeconds);
  }

  async getRecord(chatId: string, messageId: string): Promise<MessageRecord | null> {
    return this.loadRecord(this.messageKey(chatId, messageId));
  }

  async setRecord(record: MessageRecord): Promise<void> {
    const key = this.messageKey(record.chatId, record.messageId);
    await this.saveRecord(key, record);
  }

  async ensureRecord(details: {
    chatId: string;
    messageId: string;
    senderId?: string | null;
    senderIdHash?: string | null;
    timestamp?: number;
    body?: string;
    normalizedUrls?: string[];
    urlHashes?: string[];
  }): Promise<MessageRecord> {
    const key = this.messageKey(details.chatId, details.messageId);
    const existing = await this.loadRecord(key);
    if (existing) {
      return existing;
    }
    const normalizedUrls = details.normalizedUrls ?? [];
    const urlHashes = details.urlHashes ?? [];
    const record: MessageRecord = {
      chatId: details.chatId,
      messageId: details.messageId,
      senderId: details.senderId ?? null,
      senderIdHash: details.senderIdHash ?? null,
      timestamp: details.timestamp,
      body: details.body,
      normalizedUrls,
      urlHashes,
      createdAt: Date.now(),
      edits: [],
      reactions: [],
      revocations: [],
      verdicts: {},
    };
    await this.saveRecord(key, record);
    return record;
  }

  async recordMessageCreate(details: {
    chatId: string;
    messageId: string;
    senderId?: string | null;
    senderIdHash?: string | null;
    timestamp?: number;
    body?: string;
    normalizedUrls: string[];
    urlHashes: string[];
  }): Promise<MessageRecord> {
    const key = this.messageKey(details.chatId, details.messageId);
    const record = await this.ensureRecord({
      chatId: details.chatId,
      messageId: details.messageId,
      senderId: details.senderId,
      senderIdHash: details.senderIdHash,
      timestamp: details.timestamp,
    });
    record.body = details.body;
    record.normalizedUrls = details.normalizedUrls;
    record.urlHashes = details.urlHashes;
    record.timestamp = details.timestamp ?? record.timestamp;
    record.senderId = details.senderId ?? record.senderId;
    record.senderIdHash = details.senderIdHash ?? record.senderIdHash;
    await this.saveRecord(key, record);
    return record;
  }

  async appendEdit(chatId: string, messageId: string, edit: MessageEditRecord): Promise<MessageRecord | null> {
    const key = this.messageKey(chatId, messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    record.body = edit.body;
    record.normalizedUrls = edit.normalizedUrls;
    record.urlHashes = edit.urlHashes;
    record.edits.push(edit);
    if (record.edits.length > 20) {
      record.edits = record.edits.slice(record.edits.length - 20);
    }
    await this.saveRecord(key, record);
    return record;
  }

  async recordRevocation(chatId: string, messageId: string, scope: 'everyone' | 'me', timestamp: number): Promise<MessageRecord | null> {
    const key = this.messageKey(chatId, messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    record.revocations.push({ scope, timestamp });
    if (record.revocations.length > 10) {
      record.revocations = record.revocations.slice(record.revocations.length - 10);
    }
    await this.saveRecord(key, record);
    return record;
  }

  async recordReaction(chatId: string, messageId: string, reaction: MessageReactionRecord): Promise<MessageRecord | null> {
    const key = this.messageKey(chatId, messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    record.reactions.push(reaction);
    if (record.reactions.length > 25) {
      record.reactions = record.reactions.slice(record.reactions.length - 25);
    }
    await this.saveRecord(key, record);
    return record;
  }

  async registerVerdictAttempt(payload: VerdictAttemptPayload): Promise<VerdictRecord | null> {
    const key = this.messageKey(payload.chatId, payload.messageId);
    const record = await this.ensureRecord({
      chatId: payload.chatId,
      messageId: payload.messageId,
    });
    record.verdicts ??= {};
    const existing = record.verdicts[payload.urlHash];
    const now = Date.now();
    const nextAttemptCount = (existing?.attemptCount ?? 0) + 1;
    const verdictRecord: VerdictRecord = {
      url: payload.url,
      urlHash: payload.urlHash,
      verdict: payload.verdict,
      reasons: payload.reasons,
      decidedAt: payload.decidedAt,
      status: 'sent',
      attemptCount: nextAttemptCount,
      lastAttemptAt: now,
      verdictMessageId: payload.verdictMessageId ?? existing?.verdictMessageId,
      ack: payload.ack ?? existing?.ack ?? null,
      lastAckAt: payload.ack != null ? now : existing?.lastAckAt,
      ackHistory: existing?.ackHistory ? [...existing.ackHistory] : [],
      attachments: payload.attachments ?? existing?.attachments,
      redirectChain: payload.redirectChain ?? existing?.redirectChain,
      shortener: payload.shortener ?? existing?.shortener ?? null,
      degradedProviders: payload.degradedProviders ?? existing?.degradedProviders ?? null,
    };
    if (payload.ack !== undefined) {
      verdictRecord.ackHistory.push({ ack: payload.ack ?? null, at: now });
    } else if (existing?.ackHistory) {
      verdictRecord.ackHistory = existing.ackHistory.slice();
    }
    record.verdicts[payload.urlHash] = verdictRecord;
    await this.saveRecord(key, record);
    if (payload.verdictMessageId) {
      await this.setVerdictMapping(payload.verdictMessageId, {
        chatId: payload.chatId,
        messageId: payload.messageId,
        urlHash: payload.urlHash,
      });
    }
    return verdictRecord;
  }

  async addPendingAckContext(context: VerdictContext): Promise<void> {
    const serialized = this.serializeContext(context);
    await this.redis.zadd(PENDING_ACK_SET_KEY, Date.now(), serialized);
    await this.redis.expire(PENDING_ACK_SET_KEY, this.ttlSeconds);
  }

  async removePendingAckContext(context: VerdictContext): Promise<void> {
    const serialized = this.serializeContext(context);
    await this.redis.zrem(PENDING_ACK_SET_KEY, serialized);
  }

  async listPendingAckContexts(limit = 50): Promise<VerdictContext[]> {
    if (limit <= 0) {
      return [];
    }
    const entries = await this.redis.zrange(PENDING_ACK_SET_KEY, 0, limit - 1);
    const contexts: VerdictContext[] = [];
    for (const entry of entries) {
      try {
        const parsed = JSON.parse(entry) as VerdictContext;
        if (parsed.chatId && parsed.messageId && parsed.urlHash) {
          contexts.push(parsed);
        }
      } catch {
        await this.redis.zrem(PENDING_ACK_SET_KEY, entry).catch(() => undefined);
      }
    }
    return contexts;
  }

  async updateVerdictAck(
    context: VerdictContext,
    ack: number | null,
    timestamp: number
  ): Promise<{ verdict: VerdictRecord; previousAck: number | null } | null> {
    const key = this.messageKey(context.chatId, context.messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    const verdict = record.verdicts[context.urlHash];
    if (!verdict) {
      return null;
    }
    const prevAck = verdict.ack ?? null;
    verdict.ack = ack;
    verdict.lastAckAt = timestamp;
    if (!Array.isArray(verdict.ackHistory)) {
      verdict.ackHistory = [];
    }
    verdict.ackHistory.push({ ack, at: timestamp });
    if (verdict.ackHistory.length > 20) {
      verdict.ackHistory = verdict.ackHistory.slice(verdict.ackHistory.length - 20);
    }
    record.verdicts[context.urlHash] = verdict;
    await this.saveRecord(key, record);
    return { verdict, previousAck: prevAck };
  }

  async markVerdictStatus(context: VerdictContext, status: VerdictStatus): Promise<VerdictRecord | null> {
    const key = this.messageKey(context.chatId, context.messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    const verdict = record.verdicts[context.urlHash];
    if (!verdict) {
      return null;
    }
    verdict.status = status;
    if (status === 'failed') {
      verdict.lastAttemptAt = Date.now();
    }
    record.verdicts[context.urlHash] = verdict;
    await this.saveRecord(key, record);
    return verdict;
  }

  async getVerdictRecord(context: VerdictContext): Promise<VerdictRecord | null> {
    const key = this.messageKey(context.chatId, context.messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    return record.verdicts[context.urlHash] ?? null;
  }

  async setVerdictMessageId(context: VerdictContext, verdictMessageId: string): Promise<VerdictRecord | null> {
    const key = this.messageKey(context.chatId, context.messageId);
    const record = await this.loadRecord(key);
    if (!record) {
      return null;
    }
    const verdict = record.verdicts[context.urlHash];
    if (!verdict) {
      return null;
    }
    verdict.verdictMessageId = verdictMessageId;
    record.verdicts[context.urlHash] = verdict;
    await this.saveRecord(key, record);
    await this.setVerdictMapping(verdictMessageId, context);
    return verdict;
  }

  async setVerdictMapping(verdictMessageId: string, context: VerdictContext): Promise<void> {
    await this.redis.set(this.verdictMappingKey(verdictMessageId), JSON.stringify(context), 'EX', this.ttlSeconds);
  }

  async getVerdictMapping(verdictMessageId: string): Promise<VerdictContext | null> {
    const raw = await this.redis.get(this.verdictMappingKey(verdictMessageId));
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as VerdictContext;
      return parsed;
    } catch {
      return null;
    }
  }
}

```

# File: services/wa-client/src/pairingOrchestrator.ts

```typescript
type TimeoutHandle = NodeJS.Timeout;

export interface PairingErrorInfo {
  type: 'rate_limit' | 'network' | 'other';
  retryAfter: number;
  message: string;
  rawError: unknown;
}

export interface PairingStatus {
  canRequest: boolean;
  rateLimited: boolean;
  nextAttemptIn: number;
  lastAttemptAt: number | null;
  consecutiveRateLimits: number;
}

export interface PairingOrchestratorOptions {
  enabled: boolean;
  forcePhonePairing: boolean;
  maxAttempts: number;
  baseRetryDelayMs: number;
  rateLimitDelayMs: number;
  maxRateLimitDelayMs?: number;
  manualOnly?: boolean;
  requestCode: () => Promise<string>;
  onSuccess?: (code: string, attempt: number) => void;
  onError?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean; holdUntil?: number }, errorInfo?: PairingErrorInfo) => void;
  onFallback?: (err: unknown, attempt: number) => void;
  onForcedRetry?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean; holdUntil?: number }, errorInfo?: PairingErrorInfo) => void;
  scheduler?: (fn: () => void, delay: number) => TimeoutHandle;
  clearer?: (handle: TimeoutHandle) => void;
  storage?: {
    get: () => Promise<string | null>;
    set: (val: string) => Promise<void>;
  };
}

export class PairingOrchestrator {
  private readonly forcePhonePairing: boolean;
  private readonly maxAttempts: number;
  private readonly baseRetryDelayMs: number;
  private readonly rateLimitDelayMs: number;
  private readonly maxRateLimitDelayMs: number;
  private readonly manualOnly: boolean;
  private readonly requestCode: () => Promise<string>;
  private readonly onSuccess?: (code: string, attempt: number) => void;
  private readonly onError?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean; holdUntil?: number }, errorInfo?: PairingErrorInfo) => void;
  private readonly onFallback?: (err: unknown, attempt: number) => void;
  private readonly onForcedRetry?: (err: unknown, attempt: number, nextDelayMs: number, meta: { rateLimited: boolean; holdUntil?: number }, errorInfo?: PairingErrorInfo) => void;
  private readonly scheduler: (fn: () => void, delay: number) => TimeoutHandle;
  private readonly clearer: (handle: TimeoutHandle) => void;
  private readonly storage?: {
    get: () => Promise<string | null>;
    set: (val: string) => Promise<void>;
  };

  private enabled: boolean;
  private sessionActive = false;
  private codeDelivered = false;
  private attempts = 0;
  private timer: TimeoutHandle | null = null;
  private consecutiveRateLimit = 0;
  private lastAttemptAt: number | null = null;
  private nextAllowedAttemptAt: number | null = null;

  constructor(options: PairingOrchestratorOptions) {
    this.enabled = options.enabled;
    this.forcePhonePairing = options.forcePhonePairing;
    this.maxAttempts = options.maxAttempts;
    this.baseRetryDelayMs = options.baseRetryDelayMs;
    this.rateLimitDelayMs = options.rateLimitDelayMs;
    const configuredMaxRateDelay = options.maxRateLimitDelayMs ?? Math.max(options.rateLimitDelayMs * 10, 15 * 60 * 1000);
    this.maxRateLimitDelayMs = Math.max(options.rateLimitDelayMs, configuredMaxRateDelay);
    this.manualOnly = options.manualOnly ?? false;
    this.requestCode = options.requestCode;
    this.onSuccess = options.onSuccess;
    this.onError = options.onError;
    this.onFallback = options.onFallback;
    this.onForcedRetry = options.onForcedRetry;
    this.scheduler = options.scheduler ?? ((fn, delay) => setTimeout(fn, delay));
    this.clearer = options.clearer ?? ((handle) => clearTimeout(handle));
    this.storage = options.storage;
  }

  async init(): Promise<void> {
    if (this.storage) {
      await this.loadState();
    }
  }

  private async loadState(): Promise<void> {
    if (!this.storage) return;
    try {
      const raw = await this.storage.get();
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > Date.now()) {
          this.nextAllowedAttemptAt = parsed;
          // If we have a future timestamp, we are effectively rate limited or in backoff
          // We can't know the exact consecutive count, but we should respect the wait
          this.consecutiveRateLimit = 1;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  private async saveState(): Promise<void> {
    if (!this.storage) return;
    try {
      if (this.nextAllowedAttemptAt) {
        await this.storage.set(String(this.nextAllowedAttemptAt));
      } else {
        // If no restriction, we could clear it, but the interface is simple set/get
        // Maybe set to 0 or past
        await this.storage.set('0');
      }
    } catch {
      // ignore storage errors
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  setSessionActive(active: boolean): void {
    this.sessionActive = active;
    if (active) {
      this.cancel();
    }
  }

  setCodeDelivered(delivered: boolean): void {
    this.codeDelivered = delivered;
    if (delivered) {
      this.cancel();
    }
  }

  canSchedule(): boolean {
    if (this.manualOnly) {
      return false; // Manual mode: prevent automatic scheduling
    }
    return this.enabled && !this.sessionActive && !this.codeDelivered;
  }

  /**
   * Get time remaining until next allowed pairing attempt (in milliseconds).
   * Returns 0 if an attempt can be made immediately.
   */
  getRemainingCooldown(): number {
    if (!this.nextAllowedAttemptAt) {
      return 0;
    }
    const remaining = this.nextAllowedAttemptAt - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Get current pairing status for display/decision-making.
   */
  getStatus(): PairingStatus {
    const cooldown = this.getRemainingCooldown();
    const canRequest = this.enabled && !this.sessionActive && !this.codeDelivered && cooldown === 0;

    return {
      canRequest,
      rateLimited: this.consecutiveRateLimit > 0,
      nextAttemptIn: cooldown,
      lastAttemptAt: this.lastAttemptAt,
      consecutiveRateLimits: this.consecutiveRateLimit,
    };
  }

  /**
   * Manually trigger a pairing code request (for manual-only mode).
   * Returns true if request was scheduled, false if blocked by cooldown/state.
   */
  requestManually(): boolean {
    if (!this.enabled || this.sessionActive || this.codeDelivered) {
      return false;
    }

    const cooldown = this.getRemainingCooldown();
    if (cooldown > 0) {
      return false; // Still in cooldown
    }

    this.schedule(0);
    return true;
  }

  schedule(delayMs = 0): void {
    if (!this.manualOnly && !this.canSchedule()) {
      return;
    }
    // In manual mode, allow scheduling even when canSchedule returns false
    // (as long as session isn't active and code not delivered)
    if (this.manualOnly && (this.sessionActive || this.codeDelivered)) {
      return;
    }

    if (this.timer) {
      this.clearer(this.timer);
      this.timer = null;
    }
    const run = async () => {
      this.timer = null;
      if (!this.manualOnly && !this.canSchedule()) {
        this.attempts = 0;
        return;
      }
      if (this.manualOnly && (this.sessionActive || this.codeDelivered)) {
        this.attempts = 0;
        return;
      }

      this.attempts += 1;
      this.lastAttemptAt = Date.now();
      try {
        const code = await this.requestCode();
        this.nextAllowedAttemptAt = null;
        this.onSuccess?.(code, this.attempts);
        this.attempts = 0;
        this.consecutiveRateLimit = 0;
      } catch (err) {
        const attempt = this.attempts;
        const { rateLimited, delay } = this.classifyError(err, attempt);
        if (rateLimited) {
          this.consecutiveRateLimit += 1;
          this.nextAllowedAttemptAt = Date.now() + delay;
        } else {
          this.consecutiveRateLimit = 0;
          this.nextAllowedAttemptAt = null;
        }
        void this.saveState(); // Persist the new backoff state

        const holdUntil = rateLimited ? Date.now() + delay : undefined;
        const errorInfo = this.createErrorInfo(err, rateLimited, delay);
        this.onError?.(err, attempt, delay, { rateLimited, holdUntil }, errorInfo);
        if (this.forcePhonePairing && attempt >= this.maxAttempts) {
          this.onForcedRetry?.(err, attempt, delay, { rateLimited, holdUntil }, errorInfo);
          this.attempts = 0;
          if (!this.manualOnly && this.canSchedule()) {
            this.schedule(delay);
          }
          return;
        }
        if (!this.forcePhonePairing && attempt >= this.maxAttempts) {
          this.cancel();
          this.onFallback?.(err, attempt);
          return;
        }
        if (!this.manualOnly && this.canSchedule()) {
          this.schedule(delay);
        }
        return;
      }
    };

    this.timer = this.scheduler(() => {
      void run();
    }, Math.max(0, delayMs));
  }

  cancel(): void {
    if (this.timer) {
      this.clearer(this.timer);
      this.timer = null;
    }
    this.attempts = 0;
    this.consecutiveRateLimit = 0;
    this.nextAllowedAttemptAt = null;
    void this.saveState();
  }

  private classifyError(err: unknown, attempt: number): { rateLimited: boolean; delay: number } {
    const message = this.extractMessage(err);
    const rateLimited = message.includes('rate-overlimit') || message.includes('"code":429') || message.includes('429');
    if (rateLimited) {
      const exponent = Math.min(Math.max(0, attempt - 1), 5);
      const multiplier = Math.pow(2, exponent);
      const delay = Math.min(this.rateLimitDelayMs * multiplier, this.maxRateLimitDelayMs);
      return { rateLimited, delay };
    }
    const backoffExponent = Math.min(Math.max(0, attempt - 1), 3);
    const delay = Math.min(this.baseRetryDelayMs * Math.max(1, Math.pow(2, backoffExponent)), this.rateLimitDelayMs);
    return { rateLimited, delay };
  }

  private extractMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message ?? '';
    }
    if (typeof err === 'string') {
      return err;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return '';
    }
  }

  private createErrorInfo(err: unknown, rateLimited: boolean, retryAfter: number): PairingErrorInfo {
    const message = this.extractMessage(err);
    let type: 'rate_limit' | 'network' | 'other' = 'other';

    if (rateLimited) {
      type = 'rate_limit';
    } else if (message.includes('network') || message.includes('timeout') || message.includes('ECONNREFUSED')) {
      type = 'network';
    }

    return {
      type,
      retryAfter,
      message,
      rawError: err,
    };
  }
}

```

# File: services/wa-client/src/limiters.ts

```typescript
import type Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';

export const GLOBAL_TOKEN_BUCKET_ID = 'wa-global-rate';

export function createGlobalTokenBucket(
  redis: Redis,
  tokensPerHour: number,
  keyPrefix = 'wa_global_rate'
) {
  const points = Math.max(1, tokensPerHour);

  if (process.env.NODE_ENV === 'test') {
    return new InMemoryRateLimiter(points, 3600, keyPrefix);
  }

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: 3600,
  });
}

class InMemoryRateLimiter {
  private readonly buckets = new Map<string, { remaining: number; resetAt: number }>();

  constructor(
    private readonly points: number,
    private readonly durationSeconds: number,
    private readonly keyPrefix: string,
  ) { }

  async consume(key: string) {
    const bucketKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    let bucket = this.buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { remaining: this.points, resetAt: now + this.durationSeconds * 1000 };
      this.buckets.set(bucketKey, bucket);
    }

    if (bucket.remaining <= 0) {
      const err = new Error('Rate limit exceeded') as Error & { remainingPoints?: number; msBeforeNext?: number };
      err.remainingPoints = bucket.remaining;
      err.msBeforeNext = Math.max(0, bucket.resetAt - now);
      throw err;
    }

    bucket.remaining -= 1;
    return {
      remainingPoints: bucket.remaining,
      msBeforeNext: Math.max(0, bucket.resetAt - now),
    };
  }
}

```

# File: services/wa-client/src/verdictTracker.ts

```typescript
import type Redis from 'ioredis';
import type { Message } from 'whatsapp-web.js';
import type { Logger } from 'pino';
import { config, metrics } from '@wbscanner/shared';

export interface PendingVerdictRecord {
  verdictMessageId: string;
  originalMessageId: string;
  chatId: string;
  verdictText: string;
  urlHash: string;
  sentAt: number;
  retries: number;
  level: string;
  payload: Record<string, unknown>;
}

const pendingTimers = new Map<string, NodeJS.Timeout>();

function pendingKey(verdictMessageId: string): string {
  return `wa:verdict:pending:${verdictMessageId}`;
}

function resolveTimeoutMs(): number {
  return config.wa.verdictAckTimeoutSeconds * 1000;
}

export async function storePendingVerdict(redis: Redis, record: PendingVerdictRecord, resendFn: (record: PendingVerdictRecord) => Promise<PendingVerdictRecord | null>, logger: Logger): Promise<void> {
  await redis.set(pendingKey(record.verdictMessageId), JSON.stringify(record), 'EX', Math.ceil(resolveTimeoutMs() / 1000) * 5);
  scheduleTimeout(redis, record.verdictMessageId, resendFn, logger);
}

function stopTimer(verdictMessageId: string) {
  const timer = pendingTimers.get(verdictMessageId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(verdictMessageId);
  }
}

async function discardPendingVerdict(redis: Redis, verdictMessageId: string): Promise<void> {
  await redis.del(pendingKey(verdictMessageId));
  stopTimer(verdictMessageId);
}

export async function clearPendingVerdict(redis: Redis, verdictMessageId: string, outcome: 'success' | 'failed'): Promise<void> {
  await discardPendingVerdict(redis, verdictMessageId);
  metrics.waVerdictDelivery.labels(outcome).inc();
}

export async function loadPendingVerdict(redis: Redis, verdictMessageId: string): Promise<PendingVerdictRecord | null> {
  const raw = await redis.get(pendingKey(verdictMessageId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingVerdictRecord;
  } catch {
    return null;
  }
}

function scheduleTimeout(redis: Redis, verdictMessageId: string, resendFn: (record: PendingVerdictRecord) => Promise<PendingVerdictRecord | null>, logger: Logger) {
  if (pendingTimers.has(verdictMessageId)) {
    clearTimeout(pendingTimers.get(verdictMessageId)!);
  }
  const timeout = setTimeout(async () => {
    pendingTimers.delete(verdictMessageId);
    const record = await loadPendingVerdict(redis, verdictMessageId);
    if (!record) return;
    if (record.retries >= config.wa.verdictAckMaxRetries) {
      await clearPendingVerdict(redis, verdictMessageId, 'failed');
      logger.warn({ verdictMessageId, chatId: record.chatId, retries: record.retries }, 'Verdict delivery failed after max retries');
      return;
    }
    metrics.waVerdictDeliveryRetries.labels('timeout').inc();
    logger.warn({ verdictMessageId, chatId: record.chatId, retries: record.retries }, 'Verdict ack timeout, retrying delivery');
    const updated = await resendFn({ ...record, retries: record.retries + 1 });
    if (updated) {
      await discardPendingVerdict(redis, verdictMessageId);
      await redis.set(pendingKey(updated.verdictMessageId), JSON.stringify(updated), 'EX', Math.ceil(resolveTimeoutMs() / 1000) * 5);
      scheduleTimeout(redis, updated.verdictMessageId, resendFn, logger);
    } else {
      await clearPendingVerdict(redis, verdictMessageId, 'failed');
    }
  }, resolveTimeoutMs());
  pendingTimers.set(verdictMessageId, timeout);
}

export async function restorePendingVerdicts(redis: Redis, resendFn: (record: PendingVerdictRecord) => Promise<PendingVerdictRecord | null>, logger: Logger): Promise<void> {
  let cursor = '0';
  do {

    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'wa:verdict:pending:*', 'COUNT', 25) as unknown as [string, string[]];
    cursor = nextCursor;
    for (const key of keys) {
      const verdictId = key.split(':').pop();
      if (!verdictId) continue;
      scheduleTimeout(redis, verdictId, resendFn, logger);
    }
  } while (cursor !== '0');
}

export async function deletePendingForMessage(redis: Redis, message: Message): Promise<void> {
  await clearPendingVerdict(redis, message.id._serialized, 'failed');
}

export async function triggerVerdictRetry(redis: Redis, verdictMessageId: string, resendFn: (record: PendingVerdictRecord) => Promise<PendingVerdictRecord | null>, logger: Logger): Promise<void> {
  const record = await loadPendingVerdict(redis, verdictMessageId);
  if (!record) return;
  if (record.retries >= config.wa.verdictAckMaxRetries) {
    await clearPendingVerdict(redis, verdictMessageId, 'failed');
    logger.warn({ verdictMessageId, chatId: record.chatId }, 'Skipped verdict retry due to max retries');
    return;
  }
  const next = await resendFn({ ...record, retries: record.retries + 1 });
  if (next) {
    stopTimer(verdictMessageId);
    await redis.del(pendingKey(verdictMessageId));
    await storePendingVerdict(redis, next, resendFn, logger);
  } else {
    await clearPendingVerdict(redis, verdictMessageId, 'failed');
  }
}

```

# File: services/wa-client/src/index.ts

```typescript
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import { Client, LocalAuth, RemoteAuth, Message, GroupChat, GroupNotification, MessageMedia, Reaction, MessageAck, Call, Contact, GroupParticipant } from 'whatsapp-web.js';
import type { ClientOptions } from 'whatsapp-web.js';
import QRCode from 'qrcode-terminal';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import {
  config,
  logger,
  extractUrls,
  normalizeUrl,
  urlHash,
  metrics,
  register,
  assertControlPlaneToken,
  assertEssentialConfig,
  waSessionStatusGauge,
  isPrivateHostname,
} from '@wbscanner/shared';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createGlobalTokenBucket, GLOBAL_TOKEN_BUCKET_ID } from './limiters';
import { MessageStore, VerdictContext } from './message-store';
import { GroupStore } from './group-store';
import { loadEncryptionMaterials } from './crypto/dataKeyProvider';
import { createRemoteAuthStore } from './remoteAuthStore';
import type { RedisRemoteAuthStore } from './remoteAuthStore';
import { resetRemoteSessionArtifacts, ensureRemoteSessionDirectories } from './session/cleanup';
import { describeSession, isSessionReady, type SessionSnapshot } from './session/guards';
import { enrichEvaluationError } from './session/errors';
import { safeGetGroupChatById } from './utils/chatLookup';
import { handleSelfMessageRevoke } from './handlers/selfRevoke';
import { PairingOrchestrator } from './pairingOrchestrator';
import { SessionManager } from './session/sessionManager';

function createRedisConnection(): Redis {
  if (process.env.NODE_ENV === 'test') {
    class InMemoryRedis {
      private store = new Map<string, string>();
      private ttlStore = new Map<string, number>();
      private setStore = new Map<string, Set<string>>();
      private hashStore = new Map<string, Map<string, string>>();
      private listStore = new Map<string, string[]>();

      async get(key: string): Promise<string | null> {
        return this.store.get(key) ?? null;
      }

      async set(key: string, value: string, mode?: string, ttlArg?: number, nxArg?: string): Promise<'OK' | null> {
        if (mode === 'EX') {
          const ttlSeconds = typeof ttlArg === 'number' ? ttlArg : 0;
          if (nxArg === 'NX' && this.store.has(key)) {
            return null;
          }
          this.store.set(key, value);
          if (ttlSeconds > 0) {
            this.ttlStore.set(key, ttlSeconds);
          } else {
            this.ttlStore.delete(key);
          }
          return 'OK';
        }
        this.store.set(key, value);
        this.ttlStore.delete(key);
        return 'OK';
      }

      async del(key: string): Promise<number> {
        const existed = this.store.delete(key);
        this.ttlStore.delete(key);
        this.setStore.delete(key);
        this.hashStore.delete(key);
        this.listStore.delete(key);
        return existed ? 1 : 0;
      }

      async ttl(key: string): Promise<number> {
        return this.ttlStore.get(key) ?? -1;
      }

      async expire(key: string, seconds: number): Promise<number> {
        if (seconds > 0) {
          this.ttlStore.set(key, seconds);
          return 1;
        }
        this.ttlStore.delete(key);
        return 0;
      }

      async sadd(key: string, member: string): Promise<number> {
        const set = this.setStore.get(key) ?? new Set<string>();
        set.add(member);
        this.setStore.set(key, set);
        return set.size;
      }

      async srem(key: string, member: string): Promise<number> {
        const set = this.setStore.get(key);
        if (!set) return 0;
        const existed = set.delete(member);
        if (set.size === 0) this.setStore.delete(key);
        return existed ? 1 : 0;
      }

      async scard(key: string): Promise<number> {
        return this.setStore.get(key)?.size ?? 0;
      }

      async hset(key: string, field: string, value: string): Promise<number> {
        const hash = this.hashStore.get(key) ?? new Map<string, string>();
        const existed = hash.has(field) ? 0 : 1;
        hash.set(field, value);
        this.hashStore.set(key, hash);
        return existed;
      }

      async hdel(key: string, field: string): Promise<number> {
        const hash = this.hashStore.get(key);
        if (!hash) return 0;
        const removed = hash.delete(field) ? 1 : 0;
        if (hash.size === 0) this.hashStore.delete(key);
        return removed;
      }

      async hkeys(key: string): Promise<string[]> {
        return Array.from(this.hashStore.get(key)?.keys() ?? []);
      }

      async lpush(key: string, value: string): Promise<number> {
        const list = this.listStore.get(key) ?? [];
        list.unshift(value);
        this.listStore.set(key, list);
        return list.length;
      }

      async ltrim(key: string, start: number, stop: number): Promise<void> {
        const list = this.listStore.get(key);
        if (!list) return;
        const normalizedStop = stop < 0 ? list.length + stop : stop;
        const trimmed = list.slice(start, normalizedStop + 1);
        this.listStore.set(key, trimmed);
      }

      async lrange(key: string, start: number, stop: number): Promise<string[]> {
        const list = this.listStore.get(key) ?? [];
        const normalizedStop = stop < 0 ? list.length + stop : stop;
        return list.slice(start, normalizedStop + 1);
      }

      on(): void {
        // intentionally no-op: event subscriptions are not required for in-memory Redis used in tests
      }

      quit(): Promise<void> {
        return Promise.resolve();
      }
    }

    return new InMemoryRedis() as unknown as Redis;
  }
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

const redis = createRedisConnection();
const scanRequestQueue = new Queue(config.queues.scanRequest, { connection: redis });
const sessionManager = new SessionManager(redis, logger);

const pairingCodeCacheKey = (phone: string) => `wa:pairing:code:${phone}`;
const pairingAttemptKey = (phone: string) => `wa:pairing:last_attempt:${phone}`;

async function cachePairingCode(phone: string, code: string): Promise<void> {
  try {
    const payload = JSON.stringify({ code, storedAt: Date.now() });
    const ttlSeconds = Math.max(1, Math.ceil(PHONE_PAIRING_CODE_TTL_MS / 1000));
    await redis.set(pairingCodeCacheKey(phone), payload, 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to cache pairing code.');
  }
}

async function getCachedPairingCode(phone: string): Promise<{ code: string; storedAt: number } | null> {
  try {
    const raw = await redis.get(pairingCodeCacheKey(phone));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; storedAt?: unknown };
    if (typeof parsed.code === 'string' && typeof parsed.storedAt === 'number') {
      return { code: parsed.code, storedAt: parsed.storedAt };
    }
    return null;
  } catch (err) {
    logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to read cached pairing code.');
    return null;
  }
}

async function recordPairingAttempt(phone: string, timestamp: number): Promise<void> {
  try {
    const ttlSeconds = 600;
    await redis.set(pairingAttemptKey(phone), String(timestamp), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to record pairing attempt.');
  }
}

async function getLastPairingAttempt(phone: string): Promise<number | null> {
  try {
    const raw = await redis.get(pairingAttemptKey(phone));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (err) {
    logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to read last pairing attempt.');
    return null;
  }
}

const globalLimiter = createGlobalTokenBucket(redis, config.wa.globalRatePerHour, config.wa.globalTokenBucketKey);
const groupLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_cooldown',
  points: 1,
  duration: config.wa.perGroupCooldownSeconds
});
const groupHourlyLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_hour',
  points: config.wa.perGroupHourlyLimit,
  duration: 3600,
});
const governanceLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_governance',
  points: Math.max(1, config.wa.governanceInterventionsPerHour),
  duration: 3600,
});
const membershipGroupLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'group_membership_auto',
  points: Math.max(1, config.wa.membershipAutoApprovePerHour),
  duration: 3600,
});

interface RemoteAuthContext {
  store: RedisRemoteAuthStore;
  sessionName: string;
  sessionExists: boolean;
}

interface AuthResolution {
  strategy: LocalAuth | RemoteAuth;
  remote?: RemoteAuthContext;
}

async function resolveAuthStrategy(redisInstance: Redis): Promise<AuthResolution> {
  if (config.wa.authStrategy === 'remote') {
    if (config.wa.remoteAuth.store !== 'redis') {
      throw new Error(`Unsupported RemoteAuth store "${config.wa.remoteAuth.store}". Only Redis is supported.`);
    }
    const materials = await loadEncryptionMaterials(config.wa.remoteAuth, logger);
    const store = createRemoteAuthStore({
      redis: redisInstance,
      logger,
      prefix: `remoteauth:v1:${config.wa.remoteAuth.clientId}`,
      materials,
      clientId: config.wa.remoteAuth.clientId,
    });
    const sessionName = config.wa.remoteAuth.clientId ? `RemoteAuth-${config.wa.remoteAuth.clientId}` : 'RemoteAuth';
    let sessionExists = await store.sessionExists({ session: sessionName });
    if (sessionExists && config.wa.remoteAuth.forceNewSession) {
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'Force-new-session enabled; backing up and removing stored RemoteAuth session');

      // Soft delete: Rename the key instead of deleting it
      const backupKey = `${store.key(sessionName)}:backup:${Date.now()}`;
      try {
        await redisInstance.rename(store.key(sessionName), backupKey);
        logger.info({ backupKey }, 'Previous session backed up.');
      } catch (err) {
        logger.warn({ err }, 'Failed to backup session during force-new-session reset; proceeding with deletion.');
        await resetRemoteSessionArtifacts({
          store,
          sessionName,
          dataPath: config.wa.remoteAuth.dataPath || './data/remote-session',
          logger,
        });
      }

      sessionExists = false;
      process.env.WA_REMOTE_AUTH_FORCE_NEW_SESSION = 'false';
      config.wa.remoteAuth.forceNewSession = false;
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'Force-new-session flag cleared after cleanup.');
    }
    await ensureRemoteSessionDirectories(config.wa.remoteAuth.dataPath || './data/remote-session', logger);
    logger.info({ clientId: config.wa.remoteAuth.clientId, sessionExists }, 'Initialising RemoteAuth strategy');
    const strategy = new RemoteAuth({
      clientId: config.wa.remoteAuth.clientId,
      dataPath: config.wa.remoteAuth.dataPath,
      store,
      backupSyncIntervalMs: config.wa.remoteAuth.backupIntervalMs,
    });
    return {
      strategy,
      remote: {
        store,
        sessionName,
        sessionExists,
      },
    };
  }
  logger.info('Initialising LocalAuth strategy');
  return { strategy: new LocalAuth({ dataPath: './data/session' }) };
}
const membershipGlobalLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'membership_global',
  points: Math.max(1, config.wa.membershipGlobalHourlyLimit),
  duration: 3600,
});
const messageStore = new MessageStore(redis, config.wa.messageLineageTtlSeconds);
const groupStore = new GroupStore(redis, config.wa.messageLineageTtlSeconds);

const processedKey = (chatId: string, messageId: string, urlH: string) => `processed:${chatId}:${messageId}:${urlH}`;

const consentStatusKey = (chatId: string) => `wa:consent:status:${chatId}`;
const consentPendingSetKey = 'wa:consent:pending';
const membershipPendingKey = (chatId: string) => `wa:membership:pending:${chatId}`;
const VERDICT_ACK_TARGET = 2;
const maskPhone = (phone?: string): string => {
  if (!phone) return '';
  if (phone.length <= 4) return phone;
  return `****${phone.slice(-4)}`;
};
const DEFAULT_PAIRING_CODE_TIMEOUT_MS = 120000;
const FORCE_PHONE_PAIRING = config.wa.remoteAuth.disableQrFallback || config.wa.remoteAuth.autoPair;
const CONFIGURED_MAX_PAIRING_RETRIES = Math.max(1, config.wa.remoteAuth.maxPairingRetries ?? 5);
const MAX_PAIRING_CODE_RETRIES = FORCE_PHONE_PAIRING ? Number.MAX_SAFE_INTEGER : CONFIGURED_MAX_PAIRING_RETRIES;
const PAIRING_RETRY_DELAY_MS = Math.max(1000, config.wa.remoteAuth.pairingRetryDelayMs ?? 15000);
const PHONE_PAIRING_CODE_TTL_MS = 160000;

interface PairingCodeWindow {
  AuthStore?: {
    PairingCodeLinkUtils?: unknown;
    AppState?: { state?: string };
  };
  codeInterval?: ReturnType<typeof setInterval> | number;
  onCodeReceivedEvent?: (codeValue: string) => void;
}

interface PairingCodeUtils {
  setPairingType?: (mode: string) => void;
  initializeAltDeviceLinking?: () => Promise<void>;
  startAltLinkingFlow?: (phoneNumber: string, showNotification: boolean) => Promise<string>;
}

type PageHandle = {
  evaluate: (
    pageFn: (phoneNumber: string, showNotification: boolean, intervalMs: number) => Promise<unknown>,
    phoneNumber: string | undefined,
    showNotification: boolean,
    intervalMs: number
  ) => Promise<unknown>;
};

const ackWatchers = new Map<string, NodeJS.Timeout>();
let currentWaState: string | null = null;
let botWid: string | null = null;
let pairingOrchestrator: import('./pairingOrchestrator').PairingOrchestrator | null = null;
let remotePhone: string | undefined = undefined;

function snapshotSession(): SessionSnapshot {
  return { state: currentWaState, wid: botWid };
}

function hydrateParticipantList(chat: GroupChat): Promise<GroupParticipant[]> {
  const maybeParticipants = (chat as unknown as { participants?: GroupParticipant[] }).participants;
  if (maybeParticipants && maybeParticipants.length > 0) {
    return Promise.resolve(maybeParticipants);
  }
  const fetchParticipants = (chat as unknown as { fetchParticipants?: () => Promise<GroupParticipant[]> }).fetchParticipants;
  if (typeof fetchParticipants === 'function') {
    return fetchParticipants().catch(() => maybeParticipants ?? []);
  }
  return Promise.resolve(maybeParticipants ?? []);
}

function expandWidVariants(id: string | undefined): string[] {
  if (!id) return [];
  if (!id.includes('@')) return [id];
  const [user, domain] = id.split('@');
  if (domain === 'c.us') {
    return [id, `${user}@lid`];
  }
  if (domain === 'lid') {
    return [id, `${user}@c.us`];
  }
  return [id];
}

function contextKey(context: VerdictContext): string {
  return `${context.chatId}:${context.messageId}:${context.urlHash}`;
}

function loadConsentTemplate(): string {
  const candidates = [
    path.resolve(process.cwd(), 'docs/CONSENT.md'),
    path.resolve(__dirname, '../../docs/CONSENT.md'),
    path.resolve(__dirname, '../../../docs/CONSENT.md'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, 'utf8');
      if (raw.trim().length > 0) {
        return raw.trim();
      }
    } catch {
      // ignore missing file candidates
    }
  }
  return [
    'Hello! This group uses automated link scanning for safety.',
    'Links shared here are checked against security sources and verdicts are posted in reply.',
    'We store only normalized links, chat ID, message ID, and a hashed sender identifier for 30 days.',
    'Admins can opt out at any time with !scanner mute.',
    'By continuing to use this group you consent to automated link scanning. Thank you!'
  ].join('\n');
}

const consentTemplate = loadConsentTemplate();

async function refreshConsentGauge(): Promise<void> {
  try {
    const pending = await redis.scard(consentPendingSetKey);
    metrics.waConsentGauge.set(pending);
  } catch (err) {
    logger.warn({ err }, 'Failed to refresh consent gauge');
  }
}

async function markConsentPending(chatId: string): Promise<void> {
  await redis.set(consentStatusKey(chatId), 'pending', 'EX', config.wa.messageLineageTtlSeconds);
  await redis.sadd(consentPendingSetKey, chatId);
  metrics.waGovernanceActions.labels('consent_pending').inc();
  await refreshConsentGauge();
}

async function markConsentGranted(chatId: string): Promise<void> {
  await redis.set(consentStatusKey(chatId), 'granted', 'EX', config.wa.messageLineageTtlSeconds);
  await redis.srem(consentPendingSetKey, chatId);
  metrics.waGovernanceActions.labels('consent_granted').inc();
  await refreshConsentGauge();
}

async function clearConsentState(chatId: string): Promise<void> {
  await redis.del(consentStatusKey(chatId));
  await redis.srem(consentPendingSetKey, chatId);
  await refreshConsentGauge();
}

async function getConsentStatus(chatId: string): Promise<'pending' | 'granted' | null> {
  const status = await redis.get(consentStatusKey(chatId));
  if (status === 'pending' || status === 'granted') {
    return status;
  }
  return null;
}

async function addPendingMembership(chatId: string, requesterId: string, timestamp: number): Promise<void> {
  await redis.hset(membershipPendingKey(chatId), requesterId, String(timestamp));
}

async function removePendingMembership(chatId: string, requesterId: string): Promise<void> {
  await redis.hdel(membershipPendingKey(chatId), requesterId);
}

async function listPendingMemberships(chatId: string): Promise<string[]> {
  const entries = await redis.hkeys(membershipPendingKey(chatId));
  return entries;
}

interface VerdictJobData {
  chatId: string;
  messageId: string;
  verdict: string;
  reasons: string[];
  url: string;
  urlHash: string;
  decidedAt?: number;
  redirectChain?: string[];
  shortener?: { provider: string; chain: string[] } | null;
  degradedMode?: { providers: Array<{ name: string; reason: string }> } | null;
}

async function collectVerdictMedia(job: VerdictJobData): Promise<Array<{ media: MessageMedia; type: 'screenshot' | 'ioc' }>> {
  if (!config.features.attachMediaToVerdicts) {
    return [];
  }

  const attachments: Array<{ media: MessageMedia; type: 'screenshot' | 'ioc' }> = [];

  // Collect screenshot attachment
  const screenshotAttachment = await collectScreenshotAttachment(job);
  if (screenshotAttachment) {
    attachments.push(screenshotAttachment);
  }

  // Collect IOC (Indicators of Compromise) attachment
  const iocAttachment = createIocAttachment(job);
  if (iocAttachment) {
    attachments.push(iocAttachment);
  }

  return attachments;
}

async function collectScreenshotAttachment(job: VerdictJobData): Promise<{ media: MessageMedia; type: 'screenshot' } | null> {
  const base = resolveControlPlaneBase();
  const token = assertControlPlaneToken();

  try {
    const resp = await fetch(`${base}/scans/${job.urlHash}/urlscan-artifacts/screenshot`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (buffer.length > 0) {
        const media = new MessageMedia('image/png', buffer.toString('base64'), `screenshot-${job.urlHash.slice(0, 8)}.png`);
        return { media, type: 'screenshot' };
      }
    }
  } catch (err) {
    logger.warn({ err, urlHash: job.urlHash }, 'Failed to fetch screenshot attachment');
  }

  return null;
}

function createIocAttachment(job: VerdictJobData): { media: MessageMedia; type: 'ioc' } | null {
  const lines = buildIocTextLines(job);
  const textPayload = lines.join('\n');

  if (textPayload.trim().length === 0) {
    return null;
  }

  const data = Buffer.from(textPayload, 'utf8').toString('base64');
  const media = new MessageMedia('text/plain', data, `scan-${job.urlHash.slice(0, 8)}.txt`);
  return { media, type: 'ioc' };
}

function buildIocTextLines(job: VerdictJobData): string[] {
  const lines: string[] = [];
  lines.push(`URL: ${job.url}`);
  lines.push(`Verdict: ${job.verdict}`);

  if (job.reasons.length > 0) {
    lines.push('Reasons:');
    for (const reason of job.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  if (job.redirectChain && job.redirectChain.length > 0) {
    lines.push('Redirect chain:');
    for (const hop of job.redirectChain) {
      lines.push(`- ${hop}`);
    }
  }

  if (job.shortener?.chain && job.shortener.chain.length > 0) {
    lines.push(`Shortener expansion (${job.shortener.provider ?? 'unknown'}):`);
    for (const hop of job.shortener.chain) {
      lines.push(`- ${hop}`);
    }
  }

  return lines;
}

async function deliverVerdictMessage(
  client: Client,
  job: VerdictJobData,
  context: VerdictContext,
  isRetry = false
): Promise<boolean> {
  let targetMessage: Message | null = null;
  try {
    targetMessage = await client.getMessageById(job.messageId);
  } catch (err) {
    logger.warn({ err, messageId: job.messageId }, 'Failed to hydrate original message by id');
  }

  const snapshot = snapshotSession();
  if (!isSessionReady(snapshot)) {
    logger.debug({ job, session: describeSession(snapshot) }, 'Skipping verdict delivery because session is not ready');
    return false;
  }

  let chat: GroupChat | null = null;
  try {
    if (targetMessage) {
      chat = await targetMessage.getChat().catch((err) => {
        throw enrichEvaluationError(err, {
          operation: 'deliverVerdictMessage:getChat',
          chatId: (targetMessage.id as unknown as { remote?: string })?.remote ?? job.chatId,
          messageId: targetMessage.id?._serialized,
          snapshot,
        });
      }) as GroupChat;
    } else {
      chat = await safeGetGroupChatById({
        client,
        chatId: job.chatId,
        snapshot,
        logger,
      });
    }
  } catch (err) {
    logger.warn({ err, chatId: job.chatId }, 'Unable to load chat for verdict delivery');
    return false;
  }

  if (!chat) {
    return false;
  }

  if (!isRetry && job.degradedMode?.providers?.length) {
    const lines = [
      '⚠️ Scanner degraded: external intelligence providers are unavailable.',
      ...job.degradedMode.providers.map((provider) => `- ${provider.name}: ${provider.reason}`),
      'Verdicts rely on cached data and heuristics until providers recover.',
    ];
    const message = lines.join('\n');
    try {
      await chat.sendMessage(message);
      metrics.waGroupEvents.labels('scanner_degraded').inc();
    } catch (err) {
      logger.warn({ err, chatId: job.chatId }, 'Failed to send degraded mode notification');
    }
    await groupStore.recordEvent({
      chatId: job.chatId,
      type: 'scanner_degraded',
      timestamp: Date.now(),
      details: JSON.stringify(job.degradedMode.providers),
    }).catch((err) => {
      logger.warn({ err, chatId: job.chatId }, 'Failed to record degraded mode event');
    });
  }

  const verdictText = formatGroupVerdict(job.verdict, job.reasons, job.url);
  let reply: Message | null = null;
  try {
    if (targetMessage) {
      reply = await targetMessage.reply(verdictText);
    } else {
      try {
        reply = await chat.sendMessage(verdictText, { quotedMessageId: job.messageId });
      } catch (err) {
        logger.warn({ err, chatId: job.chatId, messageId: job.messageId }, 'Failed to quote verdict message, retrying without quote');
        reply = await chat.sendMessage(verdictText);
      }
    }
  } catch (err) {
    metrics.waVerdictFailures.inc();
    logger.warn({ err, chatId: job.chatId, messageId: job.messageId }, 'Failed to send verdict message');
    await messageStore.markVerdictStatus(context, 'failed');
    return false;
  }

  const ack = typeof reply?.ack === 'number' ? reply?.ack : null;
  const attachments = await collectVerdictMedia(job);
  const attachmentMeta = attachments.length > 0 ? {
    screenshot: attachments.some((item) => item.type === 'screenshot'),
    ioc: attachments.some((item) => item.type === 'ioc'),
  } : undefined;

  await messageStore.registerVerdictAttempt({
    chatId: job.chatId,
    messageId: job.messageId,
    url: job.url,
    urlHash: job.urlHash,
    verdict: job.verdict,
    reasons: job.reasons,
    decidedAt: job.decidedAt,
    verdictMessageId: reply?.id?._serialized || reply?.id?.id,
    ack,
    attachments: attachmentMeta,
    redirectChain: job.redirectChain,
    shortener: job.shortener ?? null,
    degradedProviders: job.degradedMode?.providers ?? null,
  });

  if (job.verdict === 'malicious' && targetMessage) {
    targetMessage.react('⚠️').catch((err) => {
      logger.warn({ err }, 'Failed to add reaction to malicious message');
    });
  }

  for (const attachment of attachments) {
    try {
      if (targetMessage) {
        await targetMessage.reply(attachment.media, undefined, {
          sendMediaAsDocument: attachment.type === 'ioc',
        });
      } else {
        await chat.sendMessage(attachment.media, {
          sendMediaAsDocument: attachment.type === 'ioc',
        });
      }
      metrics.waVerdictAttachmentsSent.labels(attachment.type).inc();
    } catch (err) {
      logger.warn({ err, type: attachment.type }, 'Failed to send verdict attachment');
    }
  }

  metrics.waVerdictsSent.inc();

  if (reply?.id?._serialized) {
    const retryFn = async () => { await deliverVerdictMessage(client, job, context, true); };
    await scheduleAckWatch(context, retryFn);
  }

  if (isRetry) {
    logger.info({ job, verdictMessageId: reply?.id?._serialized }, 'Retried verdict delivery');
  }
  return true;
}

async function clearAckWatchForContext(context: VerdictContext): Promise<void> {
  const key = contextKey(context);
  const existing = ackWatchers.get(key);
  if (existing) {
    clearTimeout(existing);
    ackWatchers.delete(key);
  }
  try {
    await messageStore.removePendingAckContext(context);
  } catch (err) {
    logger.warn({ err, context }, 'Failed to clear ack context from store');
  }
}

async function scheduleAckWatch(context: VerdictContext, retry: () => Promise<void>): Promise<void> {
  const key = contextKey(context);
  const timeoutSeconds = Math.max(5, config.wa.verdictAckTimeoutSeconds);
  await clearAckWatchForContext(context);
  const handle = setTimeout(async () => {
    ackWatchers.delete(key);
    try {
      const verdict = await messageStore.getVerdictRecord(context);
      if (!verdict) {
        await messageStore.removePendingAckContext(context).catch(() => undefined);
        return;
      }
      const currentAck = verdict.ack ?? 0;
      if (currentAck >= VERDICT_ACK_TARGET) {
        await messageStore.removePendingAckContext(context).catch(() => undefined);
        return;
      }
      metrics.waVerdictAckTimeouts.labels('timeout').inc();
      if (verdict.attemptCount >= config.wa.verdictMaxRetries) {
        await messageStore.markVerdictStatus(context, 'failed');
        metrics.waVerdictRetryAttempts.labels('failed').inc();
        logger.warn({ context }, 'Max verdict retry attempts reached');
        await messageStore.removePendingAckContext(context).catch(() => undefined);
        return;
      }
      await messageStore.markVerdictStatus(context, 'retrying');
      metrics.waVerdictRetryAttempts.labels('retry').inc();
      await retry();
    } catch (err) {
      logger.error({ err, context }, 'Ack timeout handler failed');
    }
  }, timeoutSeconds * 1000);
  ackWatchers.set(key, handle);
  try {
    await messageStore.addPendingAckContext(context);
  } catch (err) {
    logger.warn({ err, context }, 'Failed to persist pending ack context');
  }
}

async function rehydrateAckWatchers(client: Client): Promise<void> {
  try {
    const contexts = await messageStore.listPendingAckContexts(100);
    for (const context of contexts) {
      try {
        const record = await messageStore.getRecord(context.chatId, context.messageId);
        if (!record) {
          await messageStore.removePendingAckContext(context);
          continue;
        }
        const verdict = record.verdicts?.[context.urlHash];
        if (!verdict) {
          await messageStore.removePendingAckContext(context);
          continue;
        }
        const ackValue = verdict.ack ?? 0;
        if (ackValue >= VERDICT_ACK_TARGET || verdict.status === 'retracted' || verdict.status === 'failed') {
          await messageStore.removePendingAckContext(context);
          continue;
        }
        const job: VerdictJobData = {
          chatId: context.chatId,
          messageId: context.messageId,
          verdict: verdict.verdict,
          reasons: verdict.reasons,
          url: verdict.url,
          urlHash: verdict.urlHash,
          decidedAt: verdict.decidedAt,
          redirectChain: verdict.redirectChain,
          shortener: verdict.shortener ?? null,
        };
        await scheduleAckWatch(context, async () => {
          await deliverVerdictMessage(client, job, context, true);
        });
      } catch (err) {
        logger.warn({ err, context }, 'Failed to rehydrate ack watcher for context');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to list pending ack contexts for rehydration');
  }
}

const SAFE_CONTROL_PLANE_DEFAULT = 'http://control-plane:8080';

function sanitizeLogValue(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 256);
}

function updateSessionStateGauge(state: string): void {
  if (currentWaState) {
    metrics.waSessionState.labels(currentWaState).set(0);
  }
  currentWaState = state;
  metrics.waSessionState.labels(state).set(1);
}

function resolveControlPlaneBase(): string {
  const candidate = (process.env.CONTROL_PLANE_BASE || SAFE_CONTROL_PLANE_DEFAULT).trim();

  try {
    const parsed = new URL(candidate);
    validateUrlProtocol(parsed);
    return normalizeUrlString(parsed);
  } catch {
    return SAFE_CONTROL_PLANE_DEFAULT;
  }
}

function validateUrlProtocol(parsed: URL): void {
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('invalid protocol');
  }
}

function normalizeUrlString(parsed: URL): string {
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

async function isUrlAllowedForScanning(normalized: string): Promise<boolean> {
  try {
    const parsed = new URL(normalized);
    if (await isPrivateHostname(parsed.hostname)) {
      return false;
    }
    if (parsed.port) {
      const port = Number.parseInt(parsed.port, 10);
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
async function initializeWhatsAppWithRetry(client: Client, maxAttempts = 5): Promise<void> {
  let attempt = 0;
  const baseDelay = 2000; // 2 seconds
  const maxDelay = 30000; // 30 seconds

  while (attempt < maxAttempts) {
    attempt++;
    try {
      logger.info({ attempt, maxAttempts }, 'Initializing WhatsApp client...');
      await client.initialize();
      logger.info({ attempt }, 'WhatsApp client initialized successfully');
      return;
    } catch (err) {
      const isRetryable = err instanceof Error && (
        err.message.includes('timeout') ||
        err.message.includes('connection') ||
        err.message.includes('network') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('EAI_AGAIN')
      );

      if (!isRetryable) {
        logger.error({ err, attempt }, 'Non-retryable error during WhatsApp initialization');
        throw err;
      }

      if (attempt >= maxAttempts) {
        logger.error({ err, attempt }, 'Max retry attempts reached for WhatsApp initialization');
        throw err;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.random() * 1000; // Add up to 1 second jitter
      const totalDelay = delay + jitter;

      logger.warn({
        err,
        attempt,
        maxAttempts,
        nextRetryIn: Math.round(totalDelay / 1000),
        retryReason: 'network_or_timeout'
      }, 'WhatsApp initialization failed, retrying with exponential backoff');

      metrics.waSessionReconnects.labels('init_retry').inc();

      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
}

async function main() {
  assertEssentialConfig('wa-client');
  assertControlPlaneToken();

  // Validate Redis connectivity before starting
  try {
    await redis.ping();
    logger.info('Redis connectivity validated');
  } catch (err) {
    logger.error({ err }, 'Redis connectivity check failed during startup');
    // Don't throw, let healthcheck handle it so container doesn't crash loop immediately
    // throw new Error('Redis is required but unreachable');
  }

  const app = Fastify();
  app.get('/healthz', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check Redis connectivity
      await redis.ping();
      return { ok: true, redis: 'connected' };
    } catch (err) {
      logger.warn({ err }, 'Health check failed - Redis connectivity issue');
      reply.code(503);
      return { ok: false, redis: 'disconnected', error: 'Redis unreachable' };
    }
  });
  app.get('/metrics', async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  app.post('/pair', async (_req: FastifyRequest, reply: FastifyReply) => {
    const numbers = remotePhoneNumbers;
    if (numbers.length === 0) {
      return reply.code(400).send({ error: 'No phone numbers configured' });
    }

    // Check rate limiting via orchestrator if available
    if (pairingOrchestrator) {
      const status = pairingOrchestrator.getStatus();
      if (status.rateLimited && status.nextAttemptIn > 0) {
        return reply.code(429).send({ error: 'Rate limited', nextAttemptIn: status.nextAttemptIn });
      }

      // Reset auto-refresh counter so loop can resume if needed
      consecutiveAutoRefreshes = 0;
    }

    try {
      const result = await performParallelPairingCodeRequest(numbers);
      if (result) {
        return { ok: true, code: result.code, phone: maskPhone(result.phone), message: 'Pairing code generated' };
      }
      return reply.code(500).send({ error: 'Failed to get pairing code from any configured number' });
    } catch (err) {
      logger.error({ err, count: numbers.length }, 'Parallel pairing request failed');
      return reply.code(500).send({ error: 'Pairing code request failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  await refreshConsentGauge();

  const authResolution = await resolveAuthStrategy(redis);
  const clientOptions: ClientOptions = {
    puppeteer: {
      headless: config.wa.headless,
      args: config.wa.puppeteerArgs,
      // Additional launch options for resource optimization
      handleSIGINT: false,          // Let Node.js handle signals
      handleSIGTERM: false,
      handleSIGHUP: false,
      ignoreHTTPSErrors: true,      // Reduce SSL validation overhead
      defaultViewport: {            // Set minimal viewport to reduce memory
        width: 1280,
        height: 720,
      },
      // Pipe instead of websocket for faster IPC (if available)
      pipe: process.platform !== 'win32',
    },
    authStrategy: authResolution.strategy,
  };

  // Initialize phone numbers for Remote Auth
  const remotePhoneNumbers = config.wa.remoteAuth.phoneNumbers.length > 0
    ? config.wa.remoteAuth.phoneNumbers
    : (config.wa.remoteAuth.phoneNumber ? [config.wa.remoteAuth.phoneNumber] : []);

  remotePhone = remotePhoneNumbers[0]; // Keep backwards compatibility for single phone variable

  if (remotePhoneNumbers.length > 0) {
    logger.info(
      {
        count: remotePhoneNumbers.length,
        numbers: remotePhoneNumbers.map(maskPhone),
        pollingEnabled: config.wa.remoteAuth.pollingEnabled
      },
      'Remote Auth phone numbers configured'
    );
  }

  if (!config.wa.remoteAuth.autoPair) {
    logger.info('RemoteAuth auto pairing disabled; a QR code will be displayed for first-time linking.');
  }
  let remoteSessionActive = authResolution.remote?.sessionExists ?? false;
  const shouldRequestPhonePairing = Boolean(
    authResolution.remote &&
    remotePhoneNumbers.length > 0 &&
    !remoteSessionActive &&
    config.wa.remoteAuth.autoPair
  );
  if (shouldRequestPhonePairing && remotePhoneNumbers.length > 0) {
    logger.info({ phoneNumbers: remotePhoneNumbers.map(maskPhone) }, 'Auto pairing enabled; open WhatsApp > Linked Devices on the target device before continuing.');
  }

  const client = new Client(clientOptions);
  const pairingTimeoutMs = config.wa.remoteAuth.pairingDelayMs > 0
    ? config.wa.remoteAuth.pairingDelayMs
    : DEFAULT_PAIRING_CODE_TIMEOUT_MS;
  let allowQrOutput = !shouldRequestPhonePairing;
  let qrSuppressedLogged = false;
  let cachedQr: string | null = null;
  let pairingCodeDelivered = false;
  let pairingCodeExpiryTimer: NodeJS.Timeout | null = null;
  let pairingFallbackTimer: NodeJS.Timeout | null = null;
  let lastPairingAttemptMs = 0;
  let consecutiveAutoRefreshes = 0;
  const MAX_CONSECUTIVE_AUTO_REFRESHES = 3;

  // Track the currently active phone number
  const getActivePairingPhone = async (): Promise<string | null> => {
    try {
      return await redis.get('wa:pairing:active_phone');
    } catch (err) {
      logger.warn({ err }, 'Failed to get active pairing phone');
      return null;
    }
  };

  const setActivePairingPhone = async (phone: string): Promise<void> => {
    try {
      const ttlSeconds = Math.max(1, Math.ceil(PHONE_PAIRING_CODE_TTL_MS / 1000));
      await redis.set('wa:pairing:active_phone', phone, 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err, phone: maskPhone(phone) }, 'Failed to set active pairing phone');
    }
  };

  // Perform parallel pairing code requests across multiple phone numbers
  // Returns the first successful code or null
  const performParallelPairingCodeRequest = async (
    phoneNumbers: string[]
  ): Promise<{ code: string; phone: string } | null> => {
    if (phoneNumbers.length === 0) {
      logger.warn('No phone numbers provided for parallel pairing request');
      return null;
    }

    if (phoneNumbers.length === 1) {
      // Optimize for single number case
      const code = await performPairingCodeRequestForPhone(phoneNumbers[0]);
      return code ? { code, phone: phoneNumbers[0] } : null;
    }

    logger.info(
      { count: phoneNumbers.length, numbers: phoneNumbers.map(maskPhone) },
      'Attempting parallel pairing code requests'
    );

    // Create promises for each phone number
    const promises = phoneNumbers.map(async (phone) => {
      try {
        const code = await performPairingCodeRequestForPhone(phone);
        if (code) {
          logger.info({ phone: maskPhone(phone) }, 'Got pairing code from phone number');
          return { code, phone };
        }
        return null;
      } catch (err) {
        logger.warn({ err, phone: maskPhone(phone) }, 'Failed to request code for phone');
        return null;
      }
    });

    // Race all requests with timeout, return first successful one
    const racePromise = Promise.race([
      ...promises,
      new Promise<null>((resolve) =>
        setTimeout(() => {
          logger.warn({ timeout: config.wa.remoteAuth.parallelCheckTimeoutMs }, 'Parallel pairing request timed out');
          resolve(null);
        }, config.wa.remoteAuth.parallelCheckTimeoutMs)
      ),
    ]);

    const result = await racePromise;

    if (result) {
      // Track which phone number produced the code
      await setActivePairingPhone(result.phone);
      await cachePairingCode(result.phone, result.code);
      logger.info(
        { phone: maskPhone(result.phone), count: phoneNumbers.length },
        'Parallel pairing request succeeded'
      );
    } else {
      logger.warn(
        { count: phoneNumbers.length },
        'All parallel pairing requests failed or timed out'
      );
    }

    return result;
  };

  // Perform pairing code request for a specific phone number
  const performPairingCodeRequestForPhone = async (phone: string): Promise<string | null> => {
    const pageHandle = getPageHandle(client);
    if (!pageHandle) {
      throw new Error('Puppeteer page handle unavailable for pairing');
    }

    // Record attempt for this specific phone
    try {
      lastPairingAttemptMs = Date.now();
      await recordPairingAttempt(phone, lastPairingAttemptMs);
    } catch (err) {
      logger.warn({ err, phoneNumber: maskPhone(phone) }, 'Failed to record pairing attempt');
    }

    await addHumanBehaviorJitter();

    const interval = Math.max(60000, config.wa.remoteAuth.pairingDelayMs ?? 0);
    const outcome = await executePairingCodeRequestForPhone(pageHandle, phone, interval);

    return processPairingOutcome(outcome);
  };

  const performPairingCodeRequest = async (): Promise<string | null> => {
    const pageHandle = getPageHandle(client);
    if (!pageHandle) {
      throw new Error('Puppeteer page handle unavailable for pairing');
    }

    recordPairingAttemptIfNeeded();
    await addHumanBehaviorJitter();

    const interval = Math.max(60000, config.wa.remoteAuth.pairingDelayMs ?? 0);
    const outcome = await executePairingCodeRequest(pageHandle, interval);

    return processPairingOutcome(outcome);
  };

  function getPageHandle(client: Client): PageHandle | null {
    const page = (client as unknown as { pupPage?: { evaluate?: (...args: unknown[]) => Promise<unknown> } }).pupPage;
    if (!page || typeof page.evaluate !== 'function') {
      return null;
    }

    const evaluateFn = page.evaluate.bind(page) as (...args: unknown[]) => Promise<unknown>;

    return {
      evaluate: (pageFn, phoneNumber, showNotification, intervalMs) =>
        evaluateFn(pageFn as (...args: unknown[]) => unknown, phoneNumber, showNotification, intervalMs),
    };
  }

  function recordPairingAttemptIfNeeded(): void {
    if (remotePhone) {
      lastPairingAttemptMs = Date.now();
      recordPairingAttempt(remotePhone, lastPairingAttemptMs).catch(err => {
        logger.warn({ err, phoneNumber: maskPhone(remotePhone!) }, 'Failed to record pairing attempt');
      });
    }
  }

  async function addHumanBehaviorJitter(): Promise<void> {
    // Add jitter to mimic human behavior (1-5 seconds)
    const jitter = Math.floor(Math.random() * 4000) + 1000;
    await new Promise(resolve => setTimeout(resolve, jitter));
  }

  async function executePairingCodeRequest(pageHandle: PageHandle, interval: number): Promise<unknown> {
    return await pageHandle.evaluate(async (phoneNumber: string, showNotification: boolean, intervalMs: number) => {
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const globalWindow = window as unknown as PairingCodeWindow;

      const utils = await waitForUtils(globalWindow, wait);
      setupEventHandlers(globalWindow, intervalMs);

      try {
        const firstCode = await requestCode(utils, phoneNumber, showNotification, wait);
        if (isValidCode(firstCode)) {
          return { ok: true, code: firstCode };
        }
        return { ok: false, reason: 'empty_code', state: globalWindow.AuthStore?.AppState?.state };
      } catch (err: unknown) {
        return formatErrorForResponse(err, globalWindow);
      }
    }, remotePhone, true, interval);
  }

  async function executePairingCodeRequestForPhone(pageHandle: PageHandle, phone: string, interval: number): Promise<unknown> {
    return await pageHandle.evaluate(async (phoneNumber: string, showNotification: boolean, intervalMs: number) => {
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const globalWindow = window as unknown as PairingCodeWindow;

      const utils = await waitForUtils(globalWindow, wait);
      setupEventHandlers(globalWindow, intervalMs);

      try {
        const firstCode = await requestCode(utils, phoneNumber, showNotification, wait);
        if (isValidCode(firstCode)) {
          return { ok: true, code: firstCode };
        }
        return { ok: false, reason: 'empty_code', state: globalWindow.AuthStore?.AppState?.state };
      } catch (err: unknown) {
        return formatErrorForResponse(err, globalWindow);
      }
    }, phone, true, interval);
  }

  async function waitForUtils(globalWindow: PairingCodeWindow, wait: (ms: number) => Promise<unknown>): Promise<PairingCodeUtils> {
    for (let i = 0; i < 20; i++) {
      if (globalWindow.AuthStore?.PairingCodeLinkUtils) {
        return globalWindow.AuthStore.PairingCodeLinkUtils as PairingCodeUtils;
      }
      await wait(500);
    }
    throw new Error('AuthStore.PairingCodeLinkUtils not found after timeout');
  }

  function setupEventHandlers(globalWindow: PairingCodeWindow, intervalMs: number): void {
    if (typeof globalWindow.onCodeReceivedEvent !== 'function') {
      globalWindow.onCodeReceivedEvent = (codeValue: string) => codeValue;
    }

    if (globalWindow.codeInterval) {
      clearInterval(globalWindow.codeInterval as number);
    }

    // Setup interval for refreshing code if needed
    globalWindow.codeInterval = setInterval(async () => {
      const state = globalWindow.AuthStore?.AppState?.state;
      if (state !== 'UNPAIRED' && state !== 'UNPAIRED_IDLE') {
        clearInterval(globalWindow.codeInterval as number);
        return;
      }
      // Only refresh if we can silently get a new code, otherwise we might trigger rate limits
      // For now, we rely on the orchestrator to manage re-requests
    }, intervalMs);
  }

  async function requestCode(utils: PairingCodeUtils, phoneNumber: string, showNotification: boolean, wait: (ms: number) => Promise<unknown>): Promise<string> {
    // Random small delay before interaction
    await wait(Math.random() * 500 + 200);

    if (typeof utils.setPairingType === 'function') {
      utils.setPairingType('ALT_DEVICE_LINKING');
    }
    if (typeof utils.initializeAltDeviceLinking === 'function') {
      await utils.initializeAltDeviceLinking();
    }

    if (typeof utils.startAltLinkingFlow !== 'function') {
      throw new Error('startAltLinkingFlow function missing on PairingCodeLinkUtils');
    }

    return utils.startAltLinkingFlow(phoneNumber, showNotification);
  }

  function isValidCode(code: unknown): code is string {
    return typeof code === 'string' && code.length > 0;
  }

  interface PairingErrorPayload {
    ok: false;
    reason: string;
    stack?: string;
    state?: string;
    hasUtils: boolean;
    isRateLimit: boolean;
    rawError: unknown;
  }

  function formatErrorForResponse(err: unknown, globalWindow: PairingCodeWindow): PairingErrorPayload {
    const typedErr = err as { message?: string; stack?: string; name?: string };
    const raw =
      typeof err === 'object' && err !== null
        ? Object.assign({}, err, { message: typedErr?.message, stack: typedErr?.stack })
        : err;

    // Detect rate limit errors from WA internal exceptions if possible
    const msg = typedErr?.message || '';
    const isRateLimit = msg.includes('429') || msg.includes('rate-overlimit');

    return {
      ok: false,
      reason: msg || String(err ?? 'unknown'),
      stack: typedErr?.stack,
      state: globalWindow.AuthStore?.AppState?.state,
      hasUtils: Boolean(globalWindow.AuthStore?.PairingCodeLinkUtils),
      isRateLimit,
      rawError: raw,
    };
  }

  function processPairingOutcome(outcome: unknown): string | null {
    if (outcome && typeof outcome === 'object' && 'ok' in outcome) {
      const payload = outcome as { ok?: unknown; code?: unknown; reason?: unknown; isRateLimit?: boolean };
      if (payload.ok === true && typeof payload.code === 'string' && payload.code.length > 0) {
        return payload.code;
      }
      // Propagate rate limit detection to the orchestrator
      if (payload.isRateLimit) {
        throw new Error(`pairing_code_request_failed:rate-overlimit:${JSON.stringify(payload)}`);
      }
      const errPayload = JSON.stringify(payload);
      throw new Error(`pairing_code_request_failed:${errPayload}`);
    }
    return typeof outcome === 'string' ? outcome : null;
  }

  function cancelPairingCodeRefresh() {
    if (pairingCodeExpiryTimer) {
      clearTimeout(pairingCodeExpiryTimer);
      pairingCodeExpiryTimer = null;
    }
  }

  function schedulePairingCodeRefresh(delayMs: number) {
    cancelPairingCodeRefresh();
    const normalized = Math.max(1000, delayMs);
    pairingCodeExpiryTimer = setTimeout(() => {
      pairingCodeExpiryTimer = null;
      if (remoteSessionActive) {
        return;
      }

      // Pause logic: Stop auto-refreshing after N attempts to avoid massive rate limits
      if (consecutiveAutoRefreshes >= MAX_CONSECUTIVE_AUTO_REFRESHES) {
        logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing paused after multiple expired codes. Run "make pair" to generate a new one.');
        if (config.wa.qrTerminal) {
          process.stdout.write('\nPairing paused. Run "make pair" to generate a new code.\n');
        }
        return;
      }

      consecutiveAutoRefreshes++;
      logger.info({ phoneNumber: maskPhone(remotePhone), attempt: consecutiveAutoRefreshes }, 'Previous pairing code expired. Requesting a new one...');
      if (config.wa.qrTerminal) {
        process.stdout.write(`\nPrevious pairing code expired. Requesting a new one (Attempt ${consecutiveAutoRefreshes}/${MAX_CONSECUTIVE_AUTO_REFRESHES})...\n`);
      }
      pairingCodeDelivered = false;
      pairingOrchestrator?.setCodeDelivered(false);
      requestPairingCodeWithRetry(0);
      startPairingFallbackTimer();
    }, normalized);
  }

  const rateLimitDelayMs = Math.max(60000, PAIRING_RETRY_DELAY_MS);
  const isFirstTimeSetup = !remoteSessionActive;

  // Hybrid approach: manual-only for re-pairing, allow automatic for first-time setup
  const useManualOnlyMode = !isFirstTimeSetup;

  if (shouldRequestPhonePairing && remotePhone) {
    const orchestrator = new PairingOrchestrator({
      enabled: true,
      forcePhonePairing: FORCE_PHONE_PAIRING,
      maxAttempts: MAX_PAIRING_CODE_RETRIES,
      baseRetryDelayMs: PAIRING_RETRY_DELAY_MS,
      rateLimitDelayMs,
      manualOnly: useManualOnlyMode,
      storage: {
        get: async () => {
          if (!remotePhone) return null;
          return redis.get(`wa:pairing:next_attempt:${remotePhone}`);
        },
        set: async (val: string) => {
          if (!remotePhone) return;
          await redis.set(`wa:pairing:next_attempt:${remotePhone}`, val);
        }
      },
      requestCode: async () => {
        const code = await performPairingCodeRequest();
        if (!code || typeof code !== 'string') {
          throw new Error('pairing_code_request_failed:empty');
        }
        return code;
      },
      onSuccess: (code, attempt) => {
        if (remotePhone) {
          cachePairingCode(remotePhone, code).catch(err => {
            logger.warn({ err, phoneNumber: maskPhone(remotePhone!) }, 'Failed to cache pairing code');
          });
          schedulePairingCodeRefresh(PHONE_PAIRING_CODE_TTL_MS);
        }
        const msg = `\n╔${'═'.repeat(50)}╗\n║  WhatsApp Pairing Code: ${code.padEnd(24)} ║\n║  Phone: ${maskPhone(remotePhone).padEnd(37)} ║\n║  Valid for: ~2:40 minutes${' '.repeat(22)} ║\n╚${'═'.repeat(50)}╝\n`;
        process.stdout.write(msg);
        logger.info({ phoneNumber: maskPhone(remotePhone), attempt, code }, 'Phone-number pairing code ready.');
      },
      onError: (err, attempt, nextDelayMs, meta, errorInfo) => {
        if (meta?.rateLimited && errorInfo) {
          const minutes = Math.ceil(nextDelayMs / 60000);
          const nextTime = meta.holdUntil ? new Date(meta.holdUntil).toLocaleTimeString() : 'unknown';
          process.stdout.write(`\n⚠️  WhatsApp rate limit detected. Next retry allowed in ${minutes} minute(s) at ${nextTime}.\n`);
        }

        // Format error for cleaner logging
        const formattedError = err instanceof Error
          ? { name: err.name, message: err.message }
          : errorInfo?.type === 'rate_limit'
            ? { type: 'rate_limit', message: 'WhatsApp API rate limit (429)' }
            : err;

        logger.warn({
          error: formattedError,
          phoneNumber: maskPhone(remotePhone),
          attempt,
          nextRetryMs: nextDelayMs,
          nextRetryAt: meta?.holdUntil ? new Date(meta.holdUntil).toISOString() : undefined,
          rateLimited: meta?.rateLimited ?? false,
          errorType: errorInfo?.type,
        }, 'Failed to request pairing code.');
      },
      onFallback: () => {
        orchestrator.setEnabled(false);
        cancelPairingCodeRefresh();
        allowQrOutput = true;
        logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing code retries exhausted; falling back to QR pairing.');
        replayCachedQr();
      },
      onForcedRetry: (err, attempt, nextDelayMs, meta, errorInfo) => {
        const minutes = Math.ceil(nextDelayMs / 60000);
        if (meta?.rateLimited) {
          process.stdout.write(`\n⚠️  Rate limit continues. Waiting ${minutes} minute(s) before retry. Use !scanner pair-status to check.\n`);
        }
        logger.warn({
          err,
          phoneNumber: maskPhone(remotePhone),
          attempt,
          nextRetryMs: nextDelayMs,
          nextRetryAt: meta?.holdUntil ? new Date(meta.holdUntil).toISOString() : undefined,
          rateLimited: meta?.rateLimited ?? false,
          errorType: errorInfo?.type,
        }, 'Pairing retries exhausted; QR fallback disabled.');
      },
    });
    await orchestrator.init();
    pairingOrchestrator = orchestrator;
  } else {
    pairingOrchestrator = null;
  }

  if (pairingOrchestrator) {
    pairingOrchestrator.setSessionActive(remoteSessionActive);
    pairingOrchestrator.setCodeDelivered(false);
    if (isFirstTimeSetup) {
      logger.info({ phoneNumber: maskPhone(remotePhone) }, 'First-time setup detected: automatic pairing enabled for initial connection.');
    } else {
      logger.info({ phoneNumber: maskPhone(remotePhone) }, 'Re-pairing mode: use !scanner pair command to request pairing codes manually.');
    }
  }

  const clearPairingRetry = () => {
    pairingOrchestrator?.cancel();
    cancelPairingCodeRefresh();
  };

  const requestPairingCodeWithRetry = (delayMs = 0) => {
    if (!remotePhone || pairingCodeDelivered || remoteSessionActive) return;
    const now = Date.now();
    let effectiveDelay = Math.max(0, delayMs);
    if (lastPairingAttemptMs > 0) {
      const sinceLast = now - lastPairingAttemptMs;
      if (sinceLast < rateLimitDelayMs) {
        effectiveDelay = Math.max(effectiveDelay, rateLimitDelayMs - sinceLast);
      }
    }
    pairingOrchestrator?.schedule(effectiveDelay);
  };

  if (remotePhone) {
    const [cachedPairingCode, recordedAttempt] = await Promise.all([
      getCachedPairingCode(remotePhone),
      getLastPairingAttempt(remotePhone),
    ]);
    if (typeof recordedAttempt === 'number') {
      lastPairingAttemptMs = recordedAttempt;
    }
    if (cachedPairingCode) {
      const ageMs = Date.now() - cachedPairingCode.storedAt;
      const remainingMs = PHONE_PAIRING_CODE_TTL_MS - ageMs;
      if (remainingMs > 1000) {
        pairingCodeDelivered = true;
        if (pairingOrchestrator) {
          pairingOrchestrator.setCodeDelivered(true);
        }
        schedulePairingCodeRefresh(remainingMs);
        logger.info({ pairingCode: cachedPairingCode.code, phoneNumber: maskPhone(remotePhone), remainingMs }, 'Reusing cached phone-number pairing code still within validity window.');
        if (config.wa.qrTerminal) {
          process.stdout.write(`\nWhatsApp pairing code for ${maskPhone(remotePhone)}: ${cachedPairingCode.code}\nOpen WhatsApp > Linked devices > Link with phone number and enter this code.\n`);
        }
      }
    }
  }
  const cancelPairingFallback = () => {
    if (pairingFallbackTimer) {
      clearTimeout(pairingFallbackTimer);
      pairingFallbackTimer = null;
    }
  };

  function startPairingFallbackTimer() {
    if (pairingFallbackTimer || !pairingOrchestrator || !remotePhone || pairingCodeDelivered || remoteSessionActive) {
      return;
    }
    pairingFallbackTimer = setTimeout(() => {
      pairingFallbackTimer = null;
      if (!pairingCodeDelivered && !remoteSessionActive) {
        metrics.waSessionReconnects.labels('pairing_code_timeout').inc();
        if (FORCE_PHONE_PAIRING) {
          logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing code not received within timeout; QR fallback disabled. Ensure WhatsApp is open to Linked Devices > Link with phone number.');
          requestPairingCodeWithRetry(Math.max(PAIRING_RETRY_DELAY_MS, 60000));
          startPairingFallbackTimer();
        } else {
          allowQrOutput = true;
          logger.warn({ phoneNumber: maskPhone(remotePhone) }, 'Pairing code not received within timeout; enabling QR fallback.');
          clearPairingRetry();
          if (!pairingOrchestrator) return;
          pairingOrchestrator.setEnabled(false);
          replayCachedQr();
        }
      }
    }, pairingTimeoutMs);
  }

  const emitQr = (qr: string, source: 'live' | 'cached') => {
    if (config.wa.qrTerminal) {
      QRCode.generate(qr, { small: false });
      process.stdout.write('\nOpen WhatsApp > Linked Devices > Link a Device and scan the QR code above.\n');
    }
    metrics.waQrCodesGenerated.inc();
    logger.info({ source }, 'WhatsApp QR code ready for scanning');
  };

  const replayCachedQr = () => {
    if (!cachedQr) {
      logger.warn('QR fallback requested but no cached QR available; restart wa-client to render a new code.');
      return;
    }
    emitQr(cachedQr, 'cached');
  };

  client.on('qr', async (qr: string) => {
    cachedQr = qr;

    // Self-healing: If we receive a QR code but we expect a RemoteAuth session to be active,
    // it means the session is invalid. We should clear it and restart.
    if (FORCE_PHONE_PAIRING && remoteSessionActive) {
      logger.warn('Received QR code while expecting active RemoteAuth session. Session is invalid/expired.');
      await sessionManager.clearSession('QR received while RemoteAuth session expected');
      logger.info('Exiting process to trigger restart and re-pairing...');
      process.exit(1);
    }

    if (!allowQrOutput) {
      if (!qrSuppressedLogged) {
        qrSuppressedLogged = true;
        logger.info({ phoneNumber: maskPhone(remotePhone) }, 'QR code generated but suppressed while requesting phone-number pairing.');
      }
      return;
    }
    emitQr(qr, 'live');
  });

  if (authResolution.remote) {
    client.on('remote_session_saved', () => {
      remoteSessionActive = true;
      consecutiveAutoRefreshes = 0;
      cancelPairingFallback();
      clearPairingRetry();
      pairingOrchestrator?.setSessionActive(true);
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'RemoteAuth session synchronized');
    });
    if (remotePhone) {
      client.on('code', code => {
        pairingCodeDelivered = true;
        cancelPairingFallback();
        clearPairingRetry();
        pairingOrchestrator?.setCodeDelivered(true);
        if (remotePhone) {
          cachePairingCode(remotePhone, code).catch(err => {
            logger.warn({ err, phoneNumber: maskPhone(remotePhone!) }, 'Failed to cache pairing code');
          });
        }
        schedulePairingCodeRefresh(PHONE_PAIRING_CODE_TTL_MS);
        logger.info({ pairingCode: code, phoneNumber: maskPhone(remotePhone) }, 'Enter this pairing code in WhatsApp > Linked devices > Link with phone number.');
        if (config.wa.qrTerminal) {
          process.stdout.write(`\nWhatsApp pairing code for ${maskPhone(remotePhone)}: ${code}\nOpen WhatsApp > Linked devices > Link with phone number and enter this code.\n`);
        }
      });
    }
    if (!remoteSessionActive) {
      if (!remotePhone) {
        allowQrOutput = true;
        logger.warn('RemoteAuth session not found and WA_REMOTE_AUTH_PHONE_NUMBER is unset; falling back to QR pairing.');
      } else {
        logger.info({ clientId: config.wa.remoteAuth.clientId, phoneNumber: maskPhone(remotePhone) }, 'RemoteAuth session not found; awaiting phone-number pairing code from WhatsApp.');
      }
    } else {
      logger.info({ clientId: config.wa.remoteAuth.clientId }, 'RemoteAuth session found; reusing existing credentials.');
    }
  }

  client.on('ready', async () => {
    logger.info('WhatsApp client ready');
    cancelPairingFallback();
    clearPairingRetry();
    waSessionStatusGauge.labels('ready').set(1);
    waSessionStatusGauge.labels('disconnected').set(0);
    metrics.waSessionReconnects.labels('ready').inc();
    updateSessionStateGauge('ready');
    botWid = client.info?.wid?._serialized || null;
    try {
      await rehydrateAckWatchers(client);
    } catch (err) {
      logger.warn({ err }, 'Failed to rehydrate ack watchers on ready');
    }
  });
  client.on('auth_failure', async (m) => {
    logger.error({ m }, 'Auth failure');
    waSessionStatusGauge.labels('ready').set(0);
    metrics.waSessionReconnects.labels('auth_failure').inc();
    botWid = null;

    // Self-healing: If auto-pair is enabled, clear the invalid session and restart
    if (config.wa.remoteAuth.autoPair) {
      logger.warn('Auth failure detected with auto-pair enabled. Clearing session and restarting...');
      await sessionManager.clearSession('Auth failure event received');
      process.exit(1);
    }
  });
  client.on('change_state', (state) => {
    const label = typeof state === 'string' ? state.toLowerCase() : 'unknown';
    metrics.waSessionReconnects.labels(`state_${label}`).inc();
    updateSessionStateGauge(String(state));
    logger.info({ state }, 'WhatsApp client state change');
    // NOTE: Automatic pairing disabled. Use !scanner pair command to request pairing codes manually.
  });
  client.on('disconnected', (r) => {
    logger.warn({ r }, 'Disconnected');
    cancelPairingFallback();
    waSessionStatusGauge.labels('ready').set(0);
    waSessionStatusGauge.labels('disconnected').set(1);
    metrics.waSessionReconnects.labels('disconnected').inc();
    updateSessionStateGauge('disconnected');
    botWid = null;
  });
  client.on('incoming_call', async (call: Call) => {
    metrics.waIncomingCalls.labels('received').inc();
    try {
      await call.reject();
      metrics.waIncomingCalls.labels('rejected').inc();
    } catch (err) {
      metrics.waIncomingCalls.labels('reject_error').inc();
      logger.warn({ err }, 'Failed to reject incoming call');
    }
    try {
      await groupStore.recordEvent({
        chatId: call.from || 'unknown',
        type: 'incoming_call',
        timestamp: Date.now(),
        actorId: call.from,
        metadata: { isGroup: call.isGroup, isVideo: call.isVideo },
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to record incoming call event');
    }
  });

  client.on('message_create', async (msg: Message) => {
    try {
      if (!msg.from) return;
      const chat = await msg.getChat();
      const chatType = (chat as GroupChat).isGroup ? 'group' : 'direct';
      metrics.waMessagesReceived.labels(chatType).inc();
      // Admin commands
      if ((msg.body || '').startsWith('!scanner')) {
        await handleAdminCommand(client, msg, chat as GroupChat, redis);
        return;
      }
      const chatId = chat.id._serialized;
      const messageId = msg.id._serialized || msg.id.id;
      const sender = msg.author || msg.from;
      const senderHash = sha256(sender);
      const timestampMs = typeof msg.timestamp === 'number' ? msg.timestamp * 1000 : Date.now();
      const body = msg.body || '';

      const baseRecord = {
        chatId,
        messageId,
        senderId: sender,
        senderIdHash: senderHash,
        timestamp: timestampMs,
        body,
      } as const;

      const urls = extractUrls(body);
      metrics.ingestionRate.inc();
      metrics.urlsPerMessage.observe(urls.length);

      if (config.wa.consentOnJoin) {
        const consentStatus = await getConsentStatus(chatId);
        if (consentStatus !== 'granted') {
          metrics.waMessagesDropped.labels('consent_pending').inc();
          await messageStore.recordMessageCreate({ ...baseRecord, normalizedUrls: [], urlHashes: [] });
          return;
        }
      }

      if (urls.length === 0) {
        metrics.waMessagesDropped.labels('no_url').inc();
        await messageStore.recordMessageCreate({ ...baseRecord, normalizedUrls: [], urlHashes: [] });
        return;
      }
      metrics.waMessagesWithUrls.labels(chatType).inc(urls.length);
      if (!chat.isGroup) {
        metrics.waMessagesDropped.labels('non_group').inc();
        await messageStore.recordMessageCreate({ ...baseRecord, normalizedUrls: [], urlHashes: [] });
        return; // Only groups per spec
      }

      const normalizedUrls: string[] = [];
      const urlHashes: string[] = [];
      for (const raw of urls) {
        const norm = normalizeUrl(raw);
        if (!norm) {
          metrics.waMessagesDropped.labels('invalid_url').inc();
          continue;
        }

        if (!(await isUrlAllowedForScanning(norm))) {
          metrics.waMessagesDropped.labels('blocked_internal_host').inc();
          logger.warn({ chatId: sanitizeLogValue(chat.id._serialized) }, 'Dropped URL due to disallowed host');
          continue;
        }

        const h = urlHash(norm);
        const idem = processedKey(chatId, messageId, h);
        const already = await redis.set(idem, '1', 'EX', 60 * 60 * 24 * 7, 'NX');
        if (already === null) {
          metrics.waMessagesDropped.labels('duplicate').inc();
          continue; // duplicate
        }

        normalizedUrls.push(norm);
        urlHashes.push(h);

        try {
          await globalLimiter.consume(GLOBAL_TOKEN_BUCKET_ID);
        } catch {
          metrics.waMessagesDropped.labels('rate_limited_global').inc();
          continue;
        }

        const jobOpts: JobsOptions = { removeOnComplete: true, removeOnFail: 1000, attempts: 2, backoff: { type: 'exponential', delay: 1000 } };
        await scanRequestQueue.add('scan', {
          chatId,
          messageId,
          senderIdHash: senderHash,
          url: norm,
          timestamp: Date.now()
        }, jobOpts);
      }
      await messageStore.recordMessageCreate({
        ...baseRecord,
        normalizedUrls,
        urlHashes,
      });
    } catch (e) {
      logger.error({ err: e, chatId: sanitizeLogValue((msg as unknown as { from?: string })?.from) }, 'Failed to process incoming WhatsApp message');
    }
  });

  client.on('message_edit', async (msg: Message) => {
    try {
      const chat = await msg.getChat();
      if (!(chat as GroupChat).isGroup) {
        return;
      }
      const chatId = chat.id._serialized;
      const messageId = msg.id._serialized || msg.id.id;
      const existing = await messageStore.getRecord(chatId, messageId);
      const previousHashes = existing?.urlHashes ?? [];
      const urls = extractUrls(msg.body || '');
      const normalizedUrls: string[] = [];
      const urlHashes: string[] = [];
      for (const raw of urls) {
        const norm = normalizeUrl(raw);
        if (!norm) {
          continue;
        }
        normalizedUrls.push(norm);
        urlHashes.push(urlHash(norm));
      }
      await messageStore.appendEdit(chatId, messageId, {
        body: msg.body || '',
        normalizedUrls,
        urlHashes,
        timestamp: Date.now(),
      });
      metrics.waMessageEdits.labels('processed').inc();

      const senderHash = sha256(msg.author || msg.from || chatId);
      const newHashes = new Set(urlHashes);
      for (let i = 0; i < normalizedUrls.length; i += 1) {
        const norm = normalizedUrls[i];
        const hash = urlHashes[i];
        if (previousHashes.includes(hash)) {
          continue;
        }
        const idem = processedKey(chatId, messageId, hash);
        const already = await redis.set(idem, '1', 'EX', 60 * 60 * 24 * 7, 'NX');
        if (already === null) {
          continue;
        }
        try {
          await globalLimiter.consume(GLOBAL_TOKEN_BUCKET_ID);
        } catch {
          metrics.waMessagesDropped.labels('rate_limited_global').inc();
          continue;
        }
        const jobOpts: JobsOptions = { removeOnComplete: true, removeOnFail: 1000, attempts: 2, backoff: { type: 'exponential', delay: 1000 } };
        await scanRequestQueue.add('scan', {
          chatId,
          messageId,
          senderIdHash: senderHash,
          url: norm,
          timestamp: Date.now(),
        }, jobOpts);
        metrics.waMessageEdits.labels('new_url').inc();
      }

      for (const removed of previousHashes.filter((hash) => !newHashes.has(hash))) {
        const context: VerdictContext = { chatId, messageId, urlHash: removed };
        const verdict = await messageStore.getVerdictRecord(context);
        if (verdict && verdict.status !== 'retracted') {
          await messageStore.markVerdictStatus(context, 'retracted');
          metrics.waMessageEdits.labels('retracted').inc();
          await clearAckWatchForContext(context);
          try {
            await msg.reply('Automated scan verdict withdrawn due to message edit.');
          } catch (err) {
            logger.warn({ err }, 'Failed to send verdict retraction after edit');
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process message edit');
    }
  });

  client.on('message_revoke_everyone', async (msg: Message, revoked?: Message) => {
    const snapshot = snapshotSession();
    if (!isSessionReady(snapshot)) {
      logger.debug({ messageId: msg.id?._serialized, session: describeSession(snapshot) }, 'Skipping group revoke handler because session is not ready');
      return;
    }
    try {
      const original = revoked ?? msg;
      const chat = await original.getChat().catch((err) => {
        const fallbackChat = (original.id as unknown as { remote?: string })?.remote ?? undefined;
        throw enrichEvaluationError(err, {
          operation: 'message_revoke_everyone:getChat',
          chatId: fallbackChat,
          messageId: original.id?._serialized,
          snapshot,
        });
      });
      if (!(chat as GroupChat).isGroup) {
        return;
      }
      const chatId = chat.id._serialized;
      const messageId = original.id._serialized || original.id.id;
      await messageStore.recordRevocation(chatId, messageId, 'everyone', Date.now());
      metrics.waMessageRevocations.labels('everyone').inc();
      const record = await messageStore.getRecord(chatId, messageId);
      if (record) {
        let retracted = false;
        for (const hash of Object.keys(record.verdicts)) {
          const context: VerdictContext = { chatId, messageId, urlHash: hash };
          const verdict = await messageStore.getVerdictRecord(context);
          if (verdict && verdict.status !== 'retracted') {
            await messageStore.markVerdictStatus(context, 'retracted');
            await clearAckWatchForContext(context);
            retracted = true;
          }
        }
        if (retracted) {
          try {
            await chat.sendMessage('Previously flagged content was removed. Automated verdict withdrawn.');
          } catch (err) {
            logger.warn({ err }, 'Failed to announce verdict retraction after revoke');
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle message revoke for everyone');
    }
  });

  client.on('message_revoke_me', async (msg: Message) => {
    const snapshot = snapshotSession();
    try {
      await handleSelfMessageRevoke(msg, {
        snapshot,
        logger,
        messageStore,
        recordMetric: () => metrics.waMessageRevocations.labels('me').inc(),
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to record self message revoke');
    }
  });

  client.on('message_reaction', async (reaction: Reaction) => {
    try {
      const messageId = (reaction.msgId as unknown as { _serialized?: string })?._serialized || reaction.msgId?.id;
      if (!messageId) return;
      const message = await client.getMessageById(messageId);
      if (!message) return;
      const chat = await message.getChat();
      if (!(chat as GroupChat).isGroup) {
        return;
      }
      const chatId = chat.id._serialized;
      await messageStore.recordReaction(chatId, messageId, {
        reaction: reaction.reaction || '',
        senderId: reaction.senderId || 'unknown',
        timestamp: (reaction.timestamp || Math.floor(Date.now() / 1000)) * 1000,
      });
      const emoji = (reaction.reaction || '').trim();
      const label = emoji && emoji.length <= 2 ? emoji : 'other';
      metrics.waMessageReactions.labels(label).inc();
    } catch (err) {
      logger.warn({ err }, 'Failed to process message reaction');
    }
  });

  client.on('message_ack', async (message: Message, ack: MessageAck) => {
    try {
      const verdictMessageId = message.id._serialized || message.id.id;
      if (!verdictMessageId) return;
      const context = await messageStore.getVerdictMapping(verdictMessageId);
      if (!context) return;
      const ackNumber = typeof ack === 'number' ? ack : Number(ack);
      const timestamp = Date.now();
      const result = await messageStore.updateVerdictAck(context, Number.isFinite(ackNumber) ? ackNumber : null, timestamp);
      if (!result) return;
      const { verdict, previousAck } = result;
      metrics.waVerdictAckTransitions.labels(String(previousAck ?? -1), String(ackNumber ?? -1)).inc();
      if (ackNumber === -1) {
        metrics.waVerdictAckTimeouts.labels('error').inc();
        await messageStore.markVerdictStatus(context, 'failed');
        await clearAckWatchForContext(context);
        return;
      }
      if ((ackNumber ?? 0) >= VERDICT_ACK_TARGET) {
        await clearAckWatchForContext(context);
        await messageStore.markVerdictStatus(context, 'sent');
      }
      logger.debug({ context, ack: ackNumber, verdictAckHistory: verdict.ackHistory }, 'Updated verdict ack state');
    } catch (err) {
      logger.warn({ err }, 'Failed to process verdict ack event');
    }
  });

  client.on('group_join', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      try {
        await governanceLimiter.consume(chatId);
      } catch {
        metrics.waGovernanceRateLimited.labels('group_join').inc();
        return;
      }
      metrics.waGroupEvents.labels('join').inc();
      metrics.waGovernanceActions.labels('group_join').inc();
      const toggled = await chat.setMessagesAdminsOnly(true).catch((err) => {
        logger.warn({ err, chatId }, 'Failed to restrict messages to admins only');
        return false;
      });
      if (config.wa.consentOnJoin) {
        await markConsentPending(chatId);
        metrics.waGroupEvents.labels('consent_pending').inc();
        await groupStore.recordEvent({
          chatId,
          type: 'consent_pending',
          timestamp: Date.now(),
          actorId: notification.author,
          recipients: notification.recipientIds,
          metadata: { reason: 'group_join' },
        });
      } else {
        await markConsentGranted(chatId);
        metrics.waGroupEvents.labels('consent_granted').inc();
        await groupStore.recordEvent({
          chatId,
          type: 'consent_granted',
          timestamp: Date.now(),
          actorId: notification.author,
          recipients: notification.recipientIds,
          metadata: { reason: 'group_join' },
        });
      }
      try {
        await chat.sendMessage(consentTemplate);
      } catch (err) {
        logger.warn({ err, chatId }, 'Failed to send consent message on join');
      }
      if (!config.wa.consentOnJoin && toggled) {
        await chat.setMessagesAdminsOnly(false).catch(() => undefined);
      }
      await groupStore.recordEvent({
        chatId,
        type: 'join',
        timestamp: Date.now(),
        actorId: notification.author,
        recipients: notification.recipientIds,
        metadata: { adminsOnly: toggled === true, consentRequired: config.wa.consentOnJoin },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to handle group join notification');
    }
  });

  client.on('group_membership_request', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      const requesterId = notification.author;
      if (!requesterId) {
        return;
      }
      metrics.waGroupEvents.labels('membership_request').inc();
      await groupStore.recordEvent({
        chatId,
        type: 'membership_request',
        timestamp: Date.now(),
        actorId: requesterId,
        recipients: notification.recipientIds,
        metadata: { requestTimestamp: notification.timestamp },
      });
      try {
        await membershipGroupLimiter.consume(chatId);
        await membershipGlobalLimiter.consume('global');
      } catch {
        metrics.waGovernanceRateLimited.labels('membership_auto').inc();
        await addPendingMembership(chatId, requesterId, Date.now());
        metrics.waMembershipApprovals.labels('rate_limited').inc();
        await groupStore.recordEvent({
          chatId,
          type: 'membership_pending',
          timestamp: Date.now(),
          actorId: requesterId,
          metadata: { reason: 'rate_limited' },
        });
        try {
          await chat.sendMessage(`Membership request from ${requesterId} queued for admin review. Use !scanner approve ${requesterId} to override.`);
        } catch (err) {
          logger.warn({ err, chatId }, 'Failed to notify group about pending membership request');
        }
        return;
      }

      try {
        await client.approveGroupMembershipRequests(chatId, { requesterIds: [requesterId], sleep: null });
        metrics.waMembershipApprovals.labels('auto').inc();
        metrics.waGovernanceActions.labels('membership_auto').inc();
        await removePendingMembership(chatId, requesterId);
        await groupStore.recordEvent({
          chatId,
          type: 'membership_auto',
          timestamp: Date.now(),
          actorId: requesterId,
        });
        try {
          await chat.sendMessage(`Automatically approved membership request from ${requesterId}.`);
        } catch (err) {
          logger.warn({ err, chatId }, 'Failed to announce auto-approved membership');
        }
      } catch (err) {
        logger.warn({ err, chatId, requesterId }, 'Auto approval failed, storing for manual review');
        metrics.waMembershipApprovals.labels('error').inc();
        await addPendingMembership(chatId, requesterId, Date.now());
        await groupStore.recordEvent({
          chatId,
          type: 'membership_error',
          timestamp: Date.now(),
          actorId: requesterId,
          metadata: { reason: 'auto_approval_failed' },
        });
        try {
          await chat.sendMessage(`Could not auto-approve ${requesterId}. An admin may run !scanner approve ${requesterId} to proceed.`);
        } catch (sendErr) {
          logger.warn({ err: sendErr, chatId }, 'Failed to notify admin about membership approval failure');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process membership request');
    }
  });

  client.on('group_leave', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      const recipients = (notification.recipientIds && notification.recipientIds.length > 0)
        ? notification.recipientIds
        : (notification.author ? [notification.author] : []);
      const normalizedType = notification.type === 'remove' ? 'leave_remove' : 'leave';
      metrics.waGroupEvents.labels(normalizedType).inc();
      for (const member of recipients) {
        await removePendingMembership(chatId, member).catch(() => undefined);
      }
      const includesBot = !!botWid && recipients.includes(botWid);
      if (includesBot) {
        await clearConsentState(chatId);
        metrics.waGroupEvents.labels('bot_removed').inc();
        await groupStore.recordEvent({
          chatId,
          type: 'bot_removed',
          timestamp: Date.now(),
          actorId: notification.author,
          recipients,
          metadata: { originalType: notification.type },
        });
      }
      await groupStore.recordEvent({
        chatId,
        type: normalizedType,
        timestamp: Date.now(),
        actorId: notification.author,
        recipients,
        metadata: { includesBot },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to process group leave notification');
    }
  });

  client.on('group_admin_changed', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      const notificationType = notification.type as unknown as string;
      const eventType = notificationType === 'promote' ? 'admin_promote' : 'admin_demote';
      metrics.waGroupEvents.labels(eventType).inc();
      const recipients = await notification.getRecipients().catch(() => [] as Contact[]);
      await groupStore.recordEvent({
        chatId,
        type: eventType,
        timestamp: Date.now(),
        actorId: notification.author,
        recipients: notification.recipientIds,
        metadata: { body: notification.body },
      });
      if (notificationType === 'promote' && recipients.length > 0) {
        try {
          await governanceLimiter.consume(chatId);
        } catch {
          metrics.waGovernanceRateLimited.labels('admin_change').inc();
          return;
        }
        const consentStatus = config.wa.consentOnJoin ? await getConsentStatus(chatId) : 'granted';
        const mentionText = recipients.map((contact) => `@${contact.id?.user || contact.id?._serialized || 'member'}`).join(' ');
        const lines = [`${mentionText} promoted to admin.`];
        if (consentStatus !== 'granted') {
          lines.push('This group is still awaiting consent. Please review and run !scanner consent when ready.');
          await chat.setMessagesAdminsOnly(true).catch(() => undefined);
        }
        await chat.sendMessage(lines.join(' '), { mentions: recipients.map(c => c.id?._serialized).filter((id): id is string => !!id) } as any);
        metrics.waGovernanceActions.labels('admin_prompt').inc();
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process admin change notification');
    }
  });

  client.on('group_update', async (notification: GroupNotification) => {
    try {
      const chat = await notification.getChat() as GroupChat;
      const chatId = chat.id._serialized;
      const subtype = notification.type || 'unknown';
      const map: Record<string, string> = {
        subject: 'update_subject',
        description: 'update_description',
        picture: 'update_picture',
        announce: 'update_announce',
        restrict: 'update_restrict',
      };
      const eventType = map[subtype] ?? `update_${subtype}`;
      metrics.waGroupEvents.labels(eventType).inc();
      await groupStore.recordEvent({
        chatId,
        type: eventType,
        timestamp: Date.now(),
        actorId: notification.author,
        recipients: notification.recipientIds,
        details: notification.body,
        metadata: { subtype },
      });
      if (subtype === 'announce' && config.wa.consentOnJoin) {
        const consentStatus = await getConsentStatus(chatId);
        if (consentStatus === 'pending') {
          await chat.setMessagesAdminsOnly(true).catch(() => undefined);
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process group update notification');
    }
  });

  // Consume verdicts
  new Worker(config.queues.scanVerdict, async (job) => {
    const queueName = config.queues.scanVerdict;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const data = job.data as VerdictJobData & { decidedAt?: number; redirectChain?: string[]; shortener?: { provider: string; chain: string[] } | null };
    const payload: VerdictJobData = {
      chatId: data.chatId,
      messageId: data.messageId,
      verdict: data.verdict,
      reasons: data.reasons,
      url: data.url,
      urlHash: data.urlHash,
      decidedAt: data.decidedAt,
      redirectChain: data.redirectChain,
      shortener: data.shortener ?? null,
    };
    try {
      const delay = Math.floor(800 + Math.random() * 1200);
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            try {
              await groupLimiter.consume(payload.chatId);
              await groupHourlyLimiter.consume(payload.chatId);
            } catch {
              metrics.waMessagesDropped.labels('verdict_rate_limited').inc();
              return;
            }
            const key = `verdict:${payload.chatId}:${payload.urlHash}`;
            const nx = await redis.set(key, '1', 'EX', 3600, 'NX');
            if (nx === null) {
              metrics.waMessagesDropped.labels('verdict_duplicate').inc();
              return;
            }
            const context: VerdictContext = {
              chatId: payload.chatId,
              messageId: payload.messageId,
              urlHash: payload.urlHash,
            };
            await deliverVerdictMessage(client, payload, context);
          } finally {
            const verdictLatencySeconds = Math.max(0, (Date.now() - (payload.decidedAt ?? started)) / 1000);
            metrics.waVerdictLatency.observe(verdictLatencySeconds);
            const processingSeconds = (Date.now() - started) / 1000;
            metrics.queueProcessingDuration.labels(queueName).observe(processingSeconds);
            metrics.queueCompleted.labels(queueName).inc();
            if (job.attemptsMade > 0) {
              metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
            }
            resolve();
          }
        }, delay);
      });
    } catch (err) {
      metrics.queueFailures.labels(queueName).inc();
      metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
      throw err;
    }
  }, { connection: redis });

  await initializeWhatsAppWithRetry(client);

  if (pairingOrchestrator && !pairingCodeDelivered) {
    const configuredDelay = config.wa.remoteAuth.pairingDelayMs && config.wa.remoteAuth.pairingDelayMs > 0
      ? config.wa.remoteAuth.pairingDelayMs
      : 5000;
    const initialDelay = Math.max(rateLimitDelayMs, configuredDelay);
    requestPairingCodeWithRetry(initialDelay);
  }
  startPairingFallbackTimer();

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ host: '0.0.0.0', port });
}

function sha256(s: string) { return createHash('sha256').update(s).digest('hex'); }

function redactDomain(u: string) {
  try { const url = new URL(u); return url.hostname.replace(/\./g, '[.]'); } catch { return u; }
}

export function formatGroupVerdict(verdict: string, reasons: string[], url: string) {
  const level = verdict.toUpperCase();
  const domain = redactDomain(url);
  let advice = 'Use caution.';
  if (verdict === 'malicious') advice = 'Do NOT open.';
  if (verdict === 'benign') advice = 'Looks okay, stay vigilant.';
  const reasonsStr = reasons.slice(0, 3).join('; ');
  return `Link scan: ${level}\nDomain: ${domain}\n${advice}${reasonsStr ? `\nWhy: ${reasonsStr}` : ''}`;
}

interface AdminCommandContext {
  client: Client;
  msg: Message;
  chat: GroupChat;
  redis: Redis;
  senderId: string | undefined;
  parts: string[];
  authHeaders: { authorization: string; 'x-csrf-token': string };
  base: string;
  pairingOrchestrator: PairingOrchestrator | null;
  remotePhone: string | undefined;
  sender: GroupParticipant | undefined;
  isSelfCommand: boolean;
}

const adminCommandHandlers: Record<string, (ctx: AdminCommandContext) => Promise<void>> = {
  mute: async ({ chat, base, authHeaders }) => {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chat.id._serialized)}/mute`, { method: 'POST', headers: authHeaders }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner muted for 60 minutes.' : 'Mute failed.');
  },
  unmute: async ({ chat, base, authHeaders }) => {
    const resp = await fetch(`${base}/groups/${encodeURIComponent(chat.id._serialized)}/unmute`, { method: 'POST', headers: authHeaders }).catch(() => null);
    await chat.sendMessage(resp && resp.ok ? 'Scanner unmuted.' : 'Unmute failed.');
  },
  status: async ({ chat, base, authHeaders }) => {
    try {
      const resp = await fetch(`${base}/status`, { headers: { authorization: authHeaders.authorization } });
      if (!resp.ok) {
        logger.warn({ status: resp.status, chatId: chat.id._serialized }, 'Status command fetch failed');
        await chat.sendMessage('Scanner status temporarily unavailable.');
        return;
      }
      const json = (await resp.json().catch(() => ({}))) as { scans?: number; malicious?: number };
      await chat.sendMessage(`Scanner status: scans=${json.scans ?? 0}, malicious=${json.malicious ?? 0}`);
    } catch (err) {
      logger.warn({ err, chatId: chat.id._serialized }, 'Failed to handle status command');
      await chat.sendMessage('Scanner status temporarily unavailable.');
    }
  },
  rescan: async ({ chat, parts, base, authHeaders }) => {
    if (!parts[2]) return;
    const rescanUrl = parts[2];
    const resp = await fetch(`${base}/rescan`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ url: rescanUrl }),
    }).catch(() => null);
    if (resp && resp.ok) {
      const data = (await resp.json().catch(() => null)) as { ok?: boolean; urlHash?: string; jobId?: string } | null;
      if (data?.ok && data.urlHash && data.jobId) {
        await chat.sendMessage(`Rescan queued. hash=${data.urlHash} job=${data.jobId}`);
      } else {
        await chat.sendMessage('Rescan queued, awaiting confirmation.');
      }
    } else {
      await chat.sendMessage('Rescan failed.');
    }
  },
  consent: async ({ chat, msg }) => {
    if (!config.wa.consentOnJoin) {
      await chat.sendMessage('Consent enforcement is currently disabled.');
      return;
    }
    await markConsentGranted(chat.id._serialized);
    await chat.setMessagesAdminsOnly(false).catch(() => undefined);
    await chat.sendMessage('Consent recorded. Automated scanning enabled for this group.');
    metrics.waGroupEvents.labels('consent_granted').inc();
    await groupStore.recordEvent({
      chatId: chat.id._serialized,
      type: 'consent_granted',
      timestamp: Date.now(),
      actorId: msg.author || msg.from,
      metadata: { source: 'command' },
    });
  },
  consentstatus: async ({ chat }) => {
    const status = await getConsentStatus(chat.id._serialized) ?? 'none';
    await chat.sendMessage(`Consent status: ${status}`);
  },
  approve: async ({ client, chat, parts, msg }) => {
    const target = parts[2];
    if (!target) {
      const pending = await listPendingMemberships(chat.id._serialized);
      if (pending.length === 0) {
        await chat.sendMessage('No pending membership requests recorded.');
      } else {
        await chat.sendMessage(`Pending membership requests: ${pending.join(', ')}`);
      }
      return;
    }
    try {
      await client.approveGroupMembershipRequests(chat.id._serialized, { requesterIds: [target], sleep: null });
      await removePendingMembership(chat.id._serialized, target);
      metrics.waMembershipApprovals.labels('override').inc();
      metrics.waGovernanceActions.labels('membership_override').inc();
      metrics.waGroupEvents.labels('membership_override').inc();
      await groupStore.recordEvent({
        chatId: chat.id._serialized,
        type: 'membership_override',
        timestamp: Date.now(),
        actorId: msg.author || msg.from,
        recipients: [target],
      });
      await chat.sendMessage(`Approved membership request for ${target}.`);
    } catch (err) {
      metrics.waMembershipApprovals.labels('error').inc();
      logger.warn({ err, target }, 'Failed to approve membership via override');
      await chat.sendMessage(`Unable to approve ${target}.`);
    }
  },
  governance: async ({ chat, parts }) => {
    const limit = Number.isFinite(Number(parts[2])) ? Math.max(1, Math.min(25, Number(parts[2]))) : 10;
    const events = await groupStore.listRecentEvents(chat.id._serialized, limit);
    if (events.length === 0) {
      await chat.sendMessage('No recent governance events recorded.');
      return;
    }
    const lines = events.map((event) => {
      const timestamp = new Date(event.timestamp).toISOString();
      const recipients = (event.recipients && event.recipients.length > 0) ? ` -> ${event.recipients.join(', ')}` : '';
      const detail = event.details ? ` :: ${event.details}` : '';
      return `- ${timestamp} [${event.type}] ${event.actorId ?? 'unknown'}${recipients}${detail}`;
    });
    await chat.sendMessage(`Recent governance events:\n${lines.join('\n')}`);
  },
  pair: async ({ chat, senderId, pairingOrchestrator }) => {
    if (!pairingOrchestrator) {
      await chat.sendMessage('Pairing orchestrator not available (phone pairing may be disabled).');
      return;
    }
    const status = pairingOrchestrator.getStatus();
    if (status.rateLimited && status.nextAttemptIn > 0) {
      const minutes = Math.ceil(status.nextAttemptIn / 60000);
      const seconds = Math.ceil((status.nextAttemptIn % 60000) / 1000);
      await chat.sendMessage(`⚠️ Rate limited. Please wait ${minutes}m ${seconds}s before requesting another code.`);
      return;
    }
    if (!status.canRequest) {
      await chat.sendMessage('Cannot request pairing code at this time (session may already be active).');
      return;
    }
    const requested = pairingOrchestrator.requestManually();
    if (requested) {
      await chat.sendMessage('Pairing code request sent. Check logs/terminal for the code.');
      logger.info({ chatId: chat.id._serialized, senderId }, 'Manual pairing code requested via admin command');
    } else {
      await chat.sendMessage('Unable to request pairing code. Check status with !scanner pair-status.');
    }
  },
  'pair-status': async ({ chat, pairingOrchestrator }) => {
    if (!pairingOrchestrator) {
      await chat.sendMessage('Pairing orchestrator not available.');
      return;
    }
    const status = pairingOrchestrator.getStatus();
    if (status.canRequest) {
      await chat.sendMessage('✅ Ready to request pairing code. Use !scanner pair');
    } else if (status.rateLimited && status.nextAttemptIn > 0) {
      const minutes = Math.ceil(status.nextAttemptIn / 60000);
      const seconds = Math.ceil((status.nextAttemptIn % 60000) / 1000);
      const lastAttempt = status.lastAttemptAt ? new Date(status.lastAttemptAt).toLocaleTimeString() : 'unknown';
      await chat.sendMessage(`⚠️ Rate limited\nLast attempt: ${lastAttempt}\nRetry in: ${minutes}m ${seconds}s\nConsecutive rate limits: ${status.consecutiveRateLimits}`);
    } else {
      await chat.sendMessage(`Status: Session may already be active or code delivered.`);
    }
  },
  'pair-reset': async ({ chat, senderId, remotePhone, redis, sender, isSelfCommand }) => {
    if (!sender?.isAdmin && !sender?.isSuperAdmin && !isSelfCommand) {
      await chat.sendMessage('Only admins can use this command.');
      return;
    }
    if (remotePhone) {
      const cacheKey = pairingCodeCacheKey(remotePhone);
      await redis.del(cacheKey);
      await chat.sendMessage('Pairing code cache cleared.');
      logger.info({ chatId: chat.id._serialized, senderId }, 'Pairing cache cleared via admin command');
    } else {
      await chat.sendMessage('No phone number configured for remote auth.');
    }
  },
};

export async function handleAdminCommand(client: Client, msg: Message, existingChat: GroupChat | undefined, redis: Redis) {
  const chat = existingChat ?? (await msg.getChat());
  if (!(chat as GroupChat).isGroup) return;
  const gc = chat as GroupChat;
  const participants = await hydrateParticipantList(gc);
  const senderId = msg.author || (msg.fromMe && botWid ? botWid : undefined);
  const senderVariants = expandWidVariants(senderId);
  const isSelfCommand = msg.fromMe || (botWid !== null && senderVariants.includes(botWid));
  const parts = (msg.body || '').trim().split(/\s+/);
  logger.info({ chatId: gc.id._serialized, senderId, senderVariants, isSelfCommand, participantCount: participants.length, command: parts[1] ?? null }, 'Received admin command');

  // Resolve contact to handle LID vs PN mismatch
  const contact = await msg.getContact();
  const contactId = contact.id._serialized;

  // Try to find sender by contact ID first, then by variants
  let sender = participants.find(p => p.id._serialized === contactId);
  if (!sender) {
    sender = participants.find(p => senderVariants.includes(p.id._serialized));
  }

  if (!isSelfCommand && !sender?.isAdmin && !sender?.isSuperAdmin) {
    logger.info({ chatId: gc.id._serialized, senderId, contactId }, 'Ignoring command from non-admin sender');
    return;
  }

  const cmd = parts[1];
  if (!cmd) return;

  const handler = adminCommandHandlers[cmd];
  if (handler) {
    const base = resolveControlPlaneBase();
    const token = assertControlPlaneToken();
    const csrfToken = config.controlPlane.csrfToken;
    const authHeaders = {
      authorization: `Bearer ${token}`,
      'x-csrf-token': csrfToken,
    };

    await handler({
      client,
      msg,
      chat: gc,
      redis,
      senderId,
      parts,
      authHeaders,
      base,
      pairingOrchestrator,
      remotePhone,
      sender,
      isSelfCommand,
    });
  } else {
    await chat.sendMessage('Commands: !scanner mute|unmute|status|rescan <url>|consent|consentstatus|approve [memberId]|governance [limit]|pair|pair-status|pair-reset');
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    logger.error({ err }, 'Fatal in wa-client');
    process.exit(1);
  });
}

```

# File: services/wa-client/src/crypto/dataKeyProvider.ts

```typescript
import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import type { config } from '@wbscanner/shared';

export interface RemoteAuthCryptoConfig {
  store: string;
  clientId: string;
  autoPair?: boolean;
  pairingDelayMs?: number;
  kmsKeyId?: string;
  encryptedDataKey?: string;
  dataKey?: string;
  vaultTransitPath?: string;
  vaultToken?: string;
  vaultAddress?: string;
  phoneNumber?: string;
}

export interface EncryptionMaterials {
  encryptionKey: Buffer;
  hmacKey: Buffer;
  keySource: string;
}

function deriveKey(base: Buffer, context: string): Buffer {
  return createHash('sha256').update(base).update(context).digest();
}

function decodeBase64(value: string, label: string): Buffer {
  try {
    return Buffer.from(value, 'base64');
  } catch (err) {
    throw new Error(`Failed to decode base64 value for ${label}: ${(err as Error).message}`);
  }
}

async function decryptWithKms(ciphertextB64: string, kmsKeyId: string, logger: Logger): Promise<Buffer> {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error('AWS_REGION (or AWS_DEFAULT_REGION) must be set when using KMS decryption for RemoteAuth.');
  }
  const { KMSClient, DecryptCommand } = await import('@aws-sdk/client-kms');
  const client = new KMSClient({ region });
  const ciphertext = decodeBase64(ciphertextB64, 'WA_REMOTE_AUTH_ENCRYPTED_DATA_KEY');
  const command = new DecryptCommand({
    CiphertextBlob: ciphertext,
    KeyId: kmsKeyId,
  });
  const response = await client.send(command);
  if (!response.Plaintext) {
    throw new Error('KMS decrypt response did not include Plaintext.');
  }
  logger.info({ kmsKeyId }, 'Decrypted RemoteAuth data key using AWS KMS');
  return Buffer.from(response.Plaintext);
}

async function decryptWithVault(options: RemoteAuthCryptoConfig, logger: Logger): Promise<Buffer> {
  const { vaultAddress, vaultTransitPath, vaultToken, encryptedDataKey } = options;
  if (!vaultAddress || !vaultTransitPath || !vaultToken || !encryptedDataKey) {
    throw new Error('Vault configuration incomplete; require address, transit path, token, and encrypted data key.');
  }
  const endpoint = `${vaultAddress.replace(/\/$/, '')}/v1/${vaultTransitPath.replace(/^\//, '')}/decrypt`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-Token': vaultToken,
    },
    body: JSON.stringify({ ciphertext: encryptedDataKey }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Vault transit decrypt failed: ${resp.status} ${resp.statusText} - ${body}`);
  }
  const json = await resp.json() as { data?: { plaintext?: string } };
  const plaintext = json?.data?.plaintext;
  if (!plaintext) {
    throw new Error('Vault transit decrypt response missing plaintext field.');
  }
  logger.info('Decrypted RemoteAuth data key using Vault transit');
  return decodeBase64(plaintext, 'vault plaintext');
}

async function resolveDataKey(options: RemoteAuthCryptoConfig, logger: Logger): Promise<{ key: Buffer; source: string }> {
  if (options.dataKey) {
    logger.info('Using raw RemoteAuth data key from WA_REMOTE_AUTH_DATA_KEY');
    return { key: decodeBase64(options.dataKey, 'WA_REMOTE_AUTH_DATA_KEY'), source: 'env' };
  }
  if (options.encryptedDataKey && options.kmsKeyId) {
    const key = await decryptWithKms(options.encryptedDataKey, options.kmsKeyId, logger);
    return { key, source: 'kms' };
  }
  if (options.vaultTransitPath && options.encryptedDataKey) {
    const key = await decryptWithVault(options, logger);
    return { key, source: 'vault' };
  }
  throw new Error('RemoteAuth encryption requires WA_REMOTE_AUTH_DATA_KEY, or KMS/Vault configuration.');
}

let cachedMaterials: EncryptionMaterials | undefined;

export async function loadEncryptionMaterials(
  options: RemoteAuthCryptoConfig,
  logger: Logger
): Promise<EncryptionMaterials> {
  if (cachedMaterials) return cachedMaterials;
  const { key, source } = await resolveDataKey(options, logger);
  const encryptionKey = deriveKey(key, 'wbscanner-wa-enc');
  const hmacKey = deriveKey(key, 'wbscanner-wa-hmac');
  cachedMaterials = {
    encryptionKey,
    hmacKey,
    keySource: source,
  };
  return cachedMaterials;
}

export type WaConfig = typeof config.wa;

```

# File: services/wa-client/src/crypto/secureEnvelope.ts

```typescript
import { randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto';
import type { EncryptionMaterials } from './dataKeyProvider';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  hmac: string;
  version: number;
}

const CIPHER_ALGO = 'aes-256-gcm';
const HMAC_ALGO = 'sha256';
const PAYLOAD_VERSION = 1;

function buildMacInput(iv: Buffer, authTag: Buffer, ciphertext: Buffer): Buffer {
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function encryptPayload(plaintext: Buffer, materials: EncryptionMaterials): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGO, materials.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = buildMacInput(iv, authTag, ciphertext);
  const mac = createHmac(HMAC_ALGO, materials.hmacKey).update(payload).digest();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    hmac: mac.toString('base64'),
    version: PAYLOAD_VERSION,
  };
}

function verifyMac(iv: Buffer, authTag: Buffer, ciphertext: Buffer, macB64: string, materials: EncryptionMaterials): void {
  const payload = buildMacInput(iv, authTag, ciphertext);
  const expected = createHmac(HMAC_ALGO, materials.hmacKey).update(payload).digest();
  const provided = Buffer.from(macB64, 'base64');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('Encrypted payload failed HMAC verification');
  }
}

export function decryptPayload(payload: EncryptedPayload, materials: EncryptionMaterials): Buffer {
  if ((payload.version ?? PAYLOAD_VERSION) !== PAYLOAD_VERSION) {
    throw new Error(`Unsupported RemoteAuth payload version: ${payload.version}`);
  }
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  verifyMac(iv, authTag, ciphertext, payload.hmac, materials);
  const decipher = createDecipheriv(CIPHER_ALGO, materials.encryptionKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

```

# File: services/wa-client/src/state/messageStore.ts

```typescript
import type Redis from 'ioredis';

export interface StoredMessageState {
  chatId: string;
  messageId: string;
  originalBody?: string;
  latestBody?: string;
  from?: string;
  timestamp?: number;
  edits?: Array<{ body: string; editedAt: number }>;
  revoked?: boolean;
  revokedAt?: number | null;
  verdictMessageId?: string;
  verdictHistory?: Array<{ messageId: string; sentAt: number; attempt?: number; status?: string }>;
  reactions?: Record<string, string>;
  mentionedIds?: string[];
  groupMentions?: string[];
  quotedMessageId?: string;
  forwardingScore?: number;
  ackHistory?: Array<{ ack: number; at: number }>;
  deliveredAt?: number | null;
  viewOnce?: boolean;
  ephemeral?: boolean;
  mediaUploadedAt?: number | null;
}

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function stateKey(chatId: string, messageId: string) {
  return `wa:msg:${chatId}:${messageId}`;
}

async function loadState(redis: Redis, chatId: string, messageId: string): Promise<StoredMessageState | null> {
  const raw = await redis.get(stateKey(chatId, messageId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredMessageState;
  } catch {
    return null;
  }
}

async function persistState(redis: Redis, state: StoredMessageState): Promise<void> {
  await redis.set(stateKey(state.chatId, state.messageId), JSON.stringify(state), 'EX', TTL_SECONDS);
}

type EnsureParams = {
  chatId: string;
  messageId: string;
  from?: string;
  body?: string;
  timestamp?: number;
  mentionedIds?: string[];
  groupMentions?: string[];
  quotedMessageId?: string;
  forwardingScore?: number;
  viewOnce?: boolean;
  ephemeral?: boolean;
};

function updateExistingStateFromEnsureParams(existing: StoredMessageState, params: EnsureParams): boolean {
  let mutated = false;

  if (params.body && !existing.originalBody) {
    existing.originalBody = params.body;
    existing.latestBody = params.body;
    mutated = true;
  }

  if (params.mentionedIds && params.mentionedIds.length > 0 && !existing.mentionedIds) {
    existing.mentionedIds = Array.from(new Set(params.mentionedIds));
    mutated = true;
  }

  if (params.groupMentions && params.groupMentions.length > 0 && !existing.groupMentions) {
    existing.groupMentions = Array.from(new Set(params.groupMentions));
    mutated = true;
  }

  if (params.quotedMessageId && !existing.quotedMessageId) {
    existing.quotedMessageId = params.quotedMessageId;
    mutated = true;
  }

  if (typeof params.forwardingScore === 'number' && existing.forwardingScore === undefined) {
    existing.forwardingScore = params.forwardingScore;
    mutated = true;
  }

  if (params.viewOnce !== undefined && existing.viewOnce === undefined) {
    existing.viewOnce = params.viewOnce;
    mutated = true;
  }

  if (params.ephemeral !== undefined && existing.ephemeral === undefined) {
    existing.ephemeral = params.ephemeral;
    mutated = true;
  }

  return mutated;
}

function createInitialState(params: EnsureParams): StoredMessageState {
  return {
    chatId: params.chatId,
    messageId: params.messageId,
    originalBody: params.body,
    latestBody: params.body,
    from: params.from,
    timestamp: params.timestamp ?? Date.now(),
    edits: [],
    revoked: false,
    verdictHistory: [],
    reactions: {},
    mentionedIds: params.mentionedIds ? Array.from(new Set(params.mentionedIds)) : undefined,
    groupMentions: params.groupMentions ? Array.from(new Set(params.groupMentions)) : undefined,
    quotedMessageId: params.quotedMessageId,
    forwardingScore: params.forwardingScore,
    ackHistory: [],
    deliveredAt: null,
    viewOnce: params.viewOnce,
    ephemeral: params.ephemeral,
    revokedAt: null,
    mediaUploadedAt: null,
  };
}

export async function ensureMessageState(redis: Redis, params: EnsureParams): Promise<StoredMessageState> {
  const existing = await loadState(redis, params.chatId, params.messageId);
  if (existing) {
    const mutated = updateExistingStateFromEnsureParams(existing, params);
    if (mutated) {
      await persistState(redis, existing);
    }
    return existing;
  }

  const initial = createInitialState(params);
  await persistState(redis, initial);
  return initial;
}

export async function updateMessageBody(redis: Redis, params: { chatId: string; messageId: string; newBody: string }): Promise<StoredMessageState | null> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  const edits = state.edits ?? [];
  edits.push({ body: params.newBody, editedAt: Date.now() });
  state.edits = edits.slice(-20);
  if (!state.originalBody) state.originalBody = params.newBody;
  state.latestBody = params.newBody;
  state.revoked = false;
  state.revokedAt = null;
  await persistState(redis, state);
  return state;
}

export async function appendMessageEdit(redis: Redis, params: { chatId: string; messageId: string; newBody: string }): Promise<StoredMessageState | null> {
  const state = await loadState(redis, params.chatId, params.messageId);
  if (!state) return null;

  const edits = state.edits ?? [];
  edits.push({ body: params.newBody, editedAt: Date.now() });
  state.edits = edits.slice(-20);
  state.latestBody = params.newBody;

  await persistState(redis, state);
  return state;
}

export async function markMessageRevoked(redis: Redis, params: { chatId: string; messageId: string }): Promise<StoredMessageState | null> {
  const state = await loadState(redis, params.chatId, params.messageId);
  if (!state) return null;
  state.revoked = true;
  state.revokedAt = Date.now();
  await persistState(redis, state);
  return state;
}

export async function recordVerdictAssociation(redis: Redis, params: { chatId: string; messageId: string; verdictMessageId: string; attempt?: number; status?: string }): Promise<void> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  state.verdictMessageId = params.verdictMessageId;
  const history = state.verdictHistory ?? [];
  history.push({ messageId: params.verdictMessageId, sentAt: Date.now(), attempt: params.attempt, status: params.status ?? 'sent' });
  state.verdictHistory = history.slice(-10);
  await persistState(redis, state);
}

export async function clearVerdictAssociation(redis: Redis, params: { chatId: string; messageId: string }): Promise<void> {
  const state = await loadState(redis, params.chatId, params.messageId);
  if (!state) return;
  state.verdictMessageId = undefined;
  await persistState(redis, state);
}

export async function recordReaction(redis: Redis, params: { chatId: string; messageId: string; senderId: string; reaction: string | null }): Promise<void> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  const reactions = state.reactions ?? {};
  if (params.reaction) {
    reactions[params.senderId] = params.reaction;
  } else {
    delete reactions[params.senderId];
  }
  state.reactions = reactions;
  await persistState(redis, state);
}

export async function getMessageState(redis: Redis, chatId: string, messageId: string): Promise<StoredMessageState | null> {
  return loadState(redis, chatId, messageId);
}

export interface MetadataUpdateParams {
  chatId: string;
  messageId: string;
  mentionedIds?: string[];
  groupMentions?: string[];
  quotedMessageId?: string;
  forwardingScore?: number;
  viewOnce?: boolean;
  ephemeral?: boolean;
}

function updateMentionCollections(state: StoredMessageState, params: MetadataUpdateParams): boolean {
  let mutated = false;

  if (params.mentionedIds && params.mentionedIds.length > 0) {
    const next = Array.from(new Set([...(state.mentionedIds ?? []), ...params.mentionedIds]));
    if ((state.mentionedIds ?? []).length !== next.length) {
      state.mentionedIds = next;
      mutated = true;
    }
  }

  if (params.groupMentions && params.groupMentions.length > 0) {
    const next = Array.from(new Set([...(state.groupMentions ?? []), ...params.groupMentions]));
    if ((state.groupMentions ?? []).length !== next.length) {
      state.groupMentions = next;
      mutated = true;
    }
  }

  return mutated;
}

function updateQuotedAndForwarding(state: StoredMessageState, params: MetadataUpdateParams): boolean {
  let mutated = false;

  if (params.quotedMessageId && !state.quotedMessageId) {
    state.quotedMessageId = params.quotedMessageId;
    mutated = true;
  }

  if (typeof params.forwardingScore === 'number' && state.forwardingScore === undefined) {
    state.forwardingScore = params.forwardingScore;
    mutated = true;
  }

  return mutated;
}

function updateVisibilityFlags(state: StoredMessageState, params: MetadataUpdateParams): boolean {
  let mutated = false;

  if (params.viewOnce !== undefined && state.viewOnce !== params.viewOnce) {
    state.viewOnce = params.viewOnce;
    mutated = true;
  }

  if (params.ephemeral !== undefined && state.ephemeral !== params.ephemeral) {
    state.ephemeral = params.ephemeral;
    mutated = true;
  }

  return mutated;
}

export async function upsertMessageMetadata(redis: Redis, params: MetadataUpdateParams): Promise<void> {
  const state = await ensureMessageState(redis, params);
  let mutated = false;

  if (updateMentionCollections(state, params)) {
    mutated = true;
  }

  if (updateQuotedAndForwarding(state, params)) {
    mutated = true;
  }

  if (updateVisibilityFlags(state, params)) {
    mutated = true;
  }

  if (mutated) {
    await persistState(redis, state);
  }
}

export async function recordMessageAck(redis: Redis, params: { chatId: string; messageId: string; ack: number }): Promise<void> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  const history = state.ackHistory ?? [];
  history.push({ ack: params.ack, at: Date.now() });
  state.ackHistory = history.slice(-20);
  if (params.ack >= 2) {
    state.deliveredAt = Date.now();
  }
  await persistState(redis, state);
}

export async function recordMediaUpload(redis: Redis, params: { chatId: string; messageId: string }): Promise<void> {
  const state = (await loadState(redis, params.chatId, params.messageId)) ?? (await ensureMessageState(redis, { chatId: params.chatId, messageId: params.messageId }));
  state.mediaUploadedAt = Date.now();
  await persistState(redis, state);
}

```

# File: services/wa-client/src/state/runtimeSession.ts

```typescript
let clientReady = false;
let currentWaState: string | null = null;
let botWid: string | null = null;

export class SessionNotReadyError extends Error {
  public readonly state: string | null;

  constructor(action: string, state: string | null) {
    super(`WhatsApp session not ready while attempting to ${action}. Current state: ${state ?? 'unknown'}.`);
    this.name = 'SessionNotReadyError';
    this.state = state;
  }
}

export function markClientReady(): void {
  clientReady = true;
}

export function markClientDisconnected(): void {
  clientReady = false;
}

export function isClientReady(): boolean {
  return clientReady;
}

export function assertSessionReady(action: string): void {
  if (!clientReady) {
    throw new SessionNotReadyError(action, currentWaState);
  }
}

export function setCurrentSessionState(state: string | null): void {
  currentWaState = state;
}

export function getCurrentSessionState(): string | null {
  return currentWaState;
}

export function setBotWid(wid: string | null): void {
  botWid = wid;
}

export function getBotWid(): string | null {
  return botWid;
}

export function resetRuntimeSessionState(): void {
  clientReady = false;
  currentWaState = null;
  botWid = null;
}

```

# File: services/wa-client/src/utils/debounce.ts

```typescript
export function createAsyncDebouncer(intervalMs: number) {
  let lastRun = 0;
  let running = false;

  return async (fn: () => Promise<void>) => {
    const now = Date.now();
    if (running) return;
    if (now - lastRun < intervalMs) return;
    running = true;
    try {
      await fn();
      lastRun = Date.now();
    } finally {
      running = false;
    }
  };
}

```

# File: services/wa-client/src/utils/chatResolver.ts

```typescript
import type { Client, GroupChat, Message } from 'whatsapp-web.js';
import type { Logger } from 'pino';
import { assertSessionReady } from '../state/runtimeSession';

export class ChatLookupError extends Error {
  public readonly chatId: string;
  public readonly causeError: unknown;

  constructor(chatId: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Unable to load chat ${chatId}: ${message}`);
    this.name = 'ChatLookupError';
    this.chatId = chatId;
    this.causeError = cause;
  }
}

export interface ChatResolutionResult {
  chat: GroupChat;
  targetMessage: Message | null;
}

export interface ChatResolutionOptions {
  client: Pick<Client, 'getMessageById' | 'getChatById'>;
  logger: Pick<Logger, 'warn'>;
  chatId: string;
  messageId: string;
}

export async function resolveChatForVerdict(options: ChatResolutionOptions): Promise<ChatResolutionResult> {
  const { client, logger, chatId, messageId } = options;
  assertSessionReady('load chat context');

  let targetMessage: Message | null = null;
  try {
    targetMessage = await client.getMessageById(messageId);
  } catch (err) {
    logger.warn({ err, messageId }, 'Failed to hydrate original message by id');
  }

  try {
    if (targetMessage) {
      const chat = await targetMessage.getChat() as GroupChat;
      return { chat, targetMessage };
    }
    const chat = await client.getChatById(chatId) as GroupChat;
    return { chat, targetMessage };
  } catch (err) {
    throw new ChatLookupError(chatId, err);
  }
}

```

# File: services/wa-client/src/utils/chatLookup.ts

```typescript
import type { Logger } from 'pino';
import type { Client, GroupChat } from 'whatsapp-web.js';
import { describeSession, isSessionReady, type SessionSnapshot } from '../session/guards';
import { enrichEvaluationError } from '../session/errors';

interface ChatLookupParams {
  client: Client;
  chatId: string;
  snapshot: SessionSnapshot;
  logger: Logger;
  suppressError?: boolean;
}

export async function safeGetGroupChatById(params: ChatLookupParams): Promise<GroupChat | null> {
  const { client, chatId, snapshot, logger, suppressError } = params;
  if (!isSessionReady(snapshot)) {
    logger.debug({ chatId, session: describeSession(snapshot) }, 'Skipping chat lookup because session is not ready');
    return null;
  }
  try {
    const chat = await client.getChatById(chatId);
    if (chat && (chat as GroupChat).isGroup) {
      return chat as GroupChat;
    }
    return null;
  } catch (err) {
    const wrapped = enrichEvaluationError(err, {
      operation: 'getChatById',
      chatId,
      snapshot,
    });
    if (suppressError) {
      logger.warn({ err: wrapped, chatId }, 'Chat lookup failed but was suppressed');
      return null;
    }
    throw wrapped;
  }
}

```

# File: services/wa-client/src/utils/historySync.ts

```typescript
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { Client, GroupChat, Message } from 'whatsapp-web.js';
import { safeGetGroupChatById } from './chatLookup';
import type { SessionSnapshot } from '../session/guards';

const CHAT_CURSOR_KEY = (chatId: string) => `wa:chat:${chatId}:cursor`;
const KNOWN_CHATS_KEY = 'wa:chats:known';
const DEFAULT_CURSOR_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function rememberChat(redis: Redis, chatId: string): Promise<void> {
  await redis.sadd(KNOWN_CHATS_KEY, chatId);
  await redis.expire(KNOWN_CHATS_KEY, DEFAULT_CURSOR_TTL_SECONDS);
}

export async function listKnownChats(redis: Redis): Promise<string[]> {
  return redis.smembers(KNOWN_CHATS_KEY);
}

export async function updateChatCursor(redis: Redis, chatId: string, timestampMs: number): Promise<void> {
  if (!Number.isFinite(timestampMs)) return;
  await redis.set(CHAT_CURSOR_KEY(chatId), Math.max(timestampMs, 0).toString(), 'EX', DEFAULT_CURSOR_TTL_SECONDS);
}

export async function getChatCursor(redis: Redis, chatId: string): Promise<number | null> {
  const raw = await redis.get(CHAT_CURSOR_KEY(chatId));
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

interface HistorySyncParams {
  client: Client;
  redis: Redis;
  logger: Logger;
  chatId: string;
  snapshot?: SessionSnapshot;
  limit?: number;
  onMessage: (msg: Message, chat: GroupChat) => Promise<void>;
}

export async function syncChatHistory(params: HistorySyncParams): Promise<number> {
  const { client, redis, logger, chatId, snapshot, limit = 200, onMessage } = params;
  const cursor = await getChatCursor(redis, chatId);
  const effectiveSnapshot: SessionSnapshot = snapshot ?? { state: 'ready', wid: 'history-sync' };
  const chat = await safeGetGroupChatById({
    client,
    chatId,
    snapshot: effectiveSnapshot,
    logger,
    suppressError: !snapshot,
  });
  if (!chat || !(chat as GroupChat).isGroup) return 0;
  const groupChat = chat as GroupChat;
  await rememberChat(redis, chatId);

  const messages = await groupChat.fetchMessages({ limit, fromMe: false }).catch((err) => {
    logger.warn({ err, chatId }, 'Failed to fetch message history for chat');
    return [] as Message[];
  });
  if (!messages || messages.length === 0) return 0;

  const baseline = cursor ?? null;
  if (baseline === null) {
    const latest = messages[messages.length - 1];
    if (latest?.timestamp) {
      await updateChatCursor(redis, chatId, latest.timestamp * 1000);
    }
    return 0;
  }

  let processed = 0;
  for (const msg of messages) {
    const tsMs = (msg.timestamp ?? 0) * 1000;
    if (!tsMs || tsMs <= baseline) continue;
    try {
      await onMessage(msg, groupChat);
      await updateChatCursor(redis, chatId, tsMs);
      processed += 1;
    } catch (err) {
      logger.error({ err, chatId, messageId: msg.id?._serialized }, 'Failed to sync historical message');
    }
  }
  return processed;
}

```

# File: services/wa-client/src/session/cleanup.ts

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import type { RedisRemoteAuthStore } from '../remoteAuthStore';

export interface RemoteSessionCleanupOptions {
  store: Pick<RedisRemoteAuthStore, 'delete'>;
  sessionName: string;
  dataPath: string;
  logger: Logger;
}

function resolveZipPath(sessionName: string): string {
  return path.resolve(`${sessionName}.zip`);
}

async function removeIfExists(targetPath: string, options?: { recursive?: boolean }): Promise<void> {
  await fs.rm(targetPath, { force: true, recursive: options?.recursive ?? false }).catch((err: unknown) => {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return;
    throw err;
  });
}

export async function resetRemoteSessionArtifacts(options: RemoteSessionCleanupOptions): Promise<void> {
  const { store, sessionName, dataPath, logger } = options;
  try {
    await store.delete({ session: sessionName });
  } catch (err) {
    logger.warn({ err, session: sessionName }, 'Failed to delete RemoteAuth session record from Redis');
  }

  const resolvedDataPath = path.resolve(dataPath || './data/remote-session');
  const zipPath = resolveZipPath(sessionName);

  await removeIfExists(zipPath).catch((err) => {
    logger.warn({ err, zipPath }, 'Failed to delete RemoteAuth snapshot archive during force reset');
  });

  await removeIfExists(resolvedDataPath, { recursive: true }).catch((err) => {
    logger.warn({ err, resolvedDataPath }, 'Failed to remove RemoteAuth data directory during force reset');
  });

  try {
    await fs.mkdir(resolvedDataPath, { recursive: true });
    const tempSessionPath = path.join(resolvedDataPath, 'wwebjs_temp_session_default', 'Default');
    await fs.mkdir(tempSessionPath, { recursive: true });
  } catch (err) {
    logger.warn({ err, resolvedDataPath }, 'Failed to recreate RemoteAuth data directories during force reset');
  }
}

export async function ensureRemoteSessionDirectories(dataPath: string, logger: Logger): Promise<void> {
  const resolvedDataPath = path.resolve(dataPath || './data/remote-session');
  const tempSessionPath = path.join(resolvedDataPath, 'wwebjs_temp_session_default', 'Default');
  try {
    await fs.mkdir(tempSessionPath, { recursive: true });
  } catch (err) {
    logger.error({ err, resolvedDataPath }, 'Unable to create RemoteAuth session directories');
    throw err;
  }
  try {
    await fs.access(tempSessionPath);
  } catch (err) {
    logger.error({ err, resolvedDataPath }, 'RemoteAuth temp session directory still missing after creation attempt');
    throw err;
  }
}

```

# File: services/wa-client/src/session/errors.ts

```typescript
import type { SessionSnapshot } from './guards';

export interface ChatLookupErrorContext {
  operation: string;
  chatId?: string;
  messageId?: string;
  snapshot: SessionSnapshot;
}

export function enrichEvaluationError(err: unknown, context: ChatLookupErrorContext): Error {
  if (err instanceof Error) {
    if (/Evaluation failed/.test(err.message)) {
      const descriptor = [
        'WhatsApp Web evaluation failed during',
        context.operation,
        context.chatId ? `for chat ${context.chatId}` : '',
        context.messageId ? `message ${context.messageId}` : '',
      ].filter(Boolean).join(' ');
      return new Error(`${descriptor.trim()} (session ${context.snapshot.state ?? 'unknown'}, wid ${context.snapshot.wid ?? 'unset'}). Original message: ${err.message}`);
    }
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return new Error(`Filesystem artifact missing during ${context.operation}: ${(err as NodeJS.ErrnoException).path ?? 'unknown path'} (session ${context.snapshot.state ?? 'unknown'}, wid ${context.snapshot.wid ?? 'unset'})`);
    }
    return err;
  }
  return new Error(`Unexpected error during ${context.operation}: ${String(err)}`);
}

```

# File: services/wa-client/src/session/guards.ts

```typescript
export interface SessionSnapshot {
  state: string | null;
  wid: string | null;
  paused?: boolean;
}

export function isSessionReady(snapshot: SessionSnapshot): boolean {
  if (snapshot.paused) return false;
  return snapshot.state === 'ready' && typeof snapshot.wid === 'string' && snapshot.wid.length > 0;
}

export function describeSession(snapshot: SessionSnapshot): string {
  const { state, wid, paused } = snapshot;
  const stateLabel = state ?? 'unknown';
  const widLabel = wid ?? 'unset';
  const pausedLabel = paused ? 'paused' : 'active';
  return `state=${stateLabel}, wid=${widLabel}, status=${pausedLabel}`;
}

```

# File: services/wa-client/src/session/sessionManager.ts

```typescript
import { Logger } from 'pino';
import Redis from 'ioredis';
import { config } from '@wbscanner/shared';
import { resetRemoteSessionArtifacts } from './cleanup';
import { createRemoteAuthStore } from '../remoteAuthStore';
import { loadEncryptionMaterials } from '../crypto/dataKeyProvider';

export class SessionManager {
    constructor(
        private redis: Redis,
        private logger: Logger
    ) { }

    async clearSession(reason: string): Promise<void> {
        if (config.wa.authStrategy !== 'remote') {
            this.logger.info('Skipping session clear (not using RemoteAuth)');
            return;
        }

        this.logger.warn({ reason }, 'Clearing invalid RemoteAuth session to trigger re-pairing');

        try {
            const materials = await loadEncryptionMaterials(config.wa.remoteAuth, this.logger);
            const store = createRemoteAuthStore({
                redis: this.redis,
                logger: this.logger,
                prefix: `remoteauth:v1:${config.wa.remoteAuth.clientId}`,
                materials,
                clientId: config.wa.remoteAuth.clientId,
            });

            const sessionName = config.wa.remoteAuth.clientId ? `RemoteAuth-${config.wa.remoteAuth.clientId}` : 'RemoteAuth';

            await resetRemoteSessionArtifacts({
                store,
                sessionName,
                dataPath: config.wa.remoteAuth.dataPath || './data/remote-session',
                logger: this.logger,
            });

            this.logger.info('Session cleared successfully');
        } catch (err) {
            this.logger.error({ err }, 'Failed to clear session');
            throw err;
        }
    }
}

```

# File: services/wa-client/src/events/messageRevoke.ts

```typescript
import type { Logger } from 'pino';
import type { Message } from 'whatsapp-web.js';
import type { MessageStore } from '../message-store';

type MetricsCounter = { inc: () => void };

type Metrics = {
  waMessageRevocations: {
    labels: (scope: 'me' | 'everyone') => MetricsCounter;
  };
};

export interface MessageRevokeDependencies {
  messageStore: Pick<MessageStore, 'recordRevocation'>;
  metrics: Metrics;
  logger: Pick<Logger, 'warn'>;
}

export async function handleSelfMessageRevoke(deps: MessageRevokeDependencies, msg: Pick<Message, 'fromMe' | 'from' | 'to' | 'id'>): Promise<void> {
  const { messageStore, metrics, logger } = deps;
  try {
    const chatId = msg.fromMe ? msg.to : msg.from;
    if (!chatId) {
      return;
    }
    const messageId = (msg.id as unknown as { _serialized?: string })?._serialized || (msg.id as unknown as { id?: string })?.id;
    if (!messageId) {
      return;
    }
    await messageStore.recordRevocation(chatId, messageId, 'me', Date.now());
    metrics.waMessageRevocations.labels('me').inc();
  } catch (err) {
    logger.warn({ err }, 'Failed to record self message revoke');
  }
}

```

# File: services/wa-client/src/handlers/selfRevoke.ts

```typescript
import type { Logger } from 'pino';
import type { Message } from 'whatsapp-web.js';
import type { MessageStore } from '../message-store';
import { describeSession, isSessionReady, type SessionSnapshot } from '../session/guards';
import { enrichEvaluationError } from '../session/errors';

export interface SelfRevokeDependencies {
  snapshot: SessionSnapshot;
  logger: Logger;
  messageStore: MessageStore;
  recordMetric: () => void;
  now?: () => number;
}

export type SelfRevokeOutcome = 'recorded' | 'skipped';

export async function handleSelfMessageRevoke(msg: Message, deps: SelfRevokeDependencies): Promise<SelfRevokeOutcome> {
  const { snapshot, logger, messageStore, recordMetric, now } = deps;
  if (!isSessionReady(snapshot)) {
    logger.debug({ messageId: msg.id?._serialized, session: describeSession(snapshot) }, 'Skipping self revoke handler because session is not ready');
    return 'skipped';
  }

  const rawChatId = (msg.id as unknown as { remote?: string })?.remote ?? msg.from ?? '';
  if (typeof rawChatId === 'string' && rawChatId.includes('status@broadcast')) {
    logger.debug({ messageId: msg.id?._serialized }, 'Skipping self revoke for status broadcast message');
    return 'skipped';
  }

  const chat = await msg.getChat().catch((err) => {
    throw enrichEvaluationError(err, {
      operation: 'message_revoke_me:getChat',
      chatId: (msg.id as unknown as { remote?: string })?.remote ?? undefined,
      messageId: msg.id?._serialized,
      snapshot,
    });
  });
  const chatId = chat.id._serialized;
  const messageId = msg.id._serialized || msg.id.id;
  await messageStore.recordRevocation(chatId, messageId, 'me', now ? now() : Date.now());
  recordMetric();
  return 'recorded';
}

```

# File: services/landing-page/index.html

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot Scanner | Getting Started</title>
    <link rel="stylesheet" href="style.css?v=2">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
</head>

<body>
    <div class="background-glow"></div>
    <div class="container">
        <header>
            <div class="logo">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor"
                    class="icon">
                    <path
                        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 7H13V13H11V7ZM11 15H13V17H11V15Z" />
                </svg>
                <h1>Bot Scanner</h1>
            </div>
            <p class="subtitle">Secure your WhatsApp groups with automated link scanning.</p>
        </header>

        <main>
            <section class="card">
                <h2>🚀 First Run Instructions</h2>
                <p>To start using the bot, you need to pair it with your WhatsApp account and add it to a group.</p>

                <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h3>Pair Device</h3>
                        <p>Check the terminal logs for the pairing code or QR code. Go to <strong>WhatsApp > Linked
                                Devices > Link a Device</strong>.</p>
                    </div>
                </div>

                <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h3>Add to Group</h3>
                        <p>Add the bot's phone number to any WhatsApp group you want to protect.</p>
                    </div>
                </div>

                <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h3>Grant Consent</h3>
                        <p>The bot will not scan messages until an admin grants consent. Run this command in the group:
                        </p>
                        <div class="code-block">
                            <code>!scanner consent</code>
                            <button class="copy-btn" onclick="copyToClipboard('!scanner consent')">Copy</button>
                        </div>
                    </div>
                </div>
            </section>

            <section class="card">
                <h2>🛠️ Admin Commands</h2>
                <div class="command-list">
                    <div class="command-item">
                        <code>!scanner status</code>
                        <span>Check system health and scan stats.</span>
                    </div>
                    <div class="command-item">
                        <code>!scanner mute</code>
                        <span>Pause scanning for 60 minutes.</span>
                    </div>
                    <div class="command-item">
                        <code>!scanner unmute</code>
                        <span>Resume scanning immediately.</span>
                    </div>
                    <div class="command-item">
                        <code>!scanner rescan &lt;url&gt;</code>
                        <span>Manually trigger a scan for a specific URL.</span>
                    </div>
                    <div class="command-item">
                        <code>!scanner pair</code>
                        <span>Request a new pairing code (if disconnected).</span>
                    </div>
                </div>
            </section>
        </main>

        <footer>
            <p>
                <a href="/dashboard" class="link">Uptime Kuma</a> •
                <a href="http://localhost:3002" class="link">Grafana</a> •
                <a href="/healthz" class="link">API Health</a>
            </p>
        </footer>
    </div>

    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text);
            const btn = document.querySelector('.copy-btn');
            const originalText = btn.innerText;
            btn.innerText = 'Copied!';
            setTimeout(() => btn.innerText = originalText, 2000);
        }
    </script>
</body>

</html>
```

# File: services/landing-page/style.css

```css
:root {
    --bg-color: #0f172a;
    --card-bg: rgba(30, 41, 59, 0.7);
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --accent: #38bdf8;
    --accent-glow: rgba(56, 189, 248, 0.3);
    --border: rgba(255, 255, 255, 0.1);
    --font-family: 'Outfit', sans-serif;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: var(--font-family);
    background-color: var(--bg-color);
    color: var(--text-primary);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow-x: hidden;
}

.background-glow {
    position: fixed;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at center, var(--accent-glow) 0%, transparent 60%);
    z-index: -1;
    pointer-events: none;
}

.container {
    width: 100%;
    max-width: 800px;
    padding: 2rem;
}

header {
    text-align: center;
    margin-bottom: 3rem;
    animation: fadeInDown 0.8s ease-out;
}

.logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.icon {
    width: 40px;
    height: 40px;
    color: var(--accent);
}

h1 {
    font-size: 2.5rem;
    font-weight: 700;
    letter-spacing: -0.05em;
    background: linear-gradient(to right, #fff, #94a3b8);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

.subtitle {
    color: var(--text-secondary);
    font-size: 1.1rem;
}

.card {
    background: var(--card-bg);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    animation: fadeInUp 0.8s ease-out;
}

h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    color: var(--accent);
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.75rem;
}

.step {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.step-number {
    background: var(--accent);
    color: var(--bg-color);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
}

.step-content h3 {
    font-size: 1.1rem;
    margin-bottom: 0.25rem;
}

.step-content p {
    color: var(--text-secondary);
    line-height: 1.5;
}

.code-block {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-top: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid var(--border);
}

code {
    font-family: 'Courier New', Courier, monospace;
    color: #e2e8f0;
}

.copy-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: var(--text-secondary);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s;
}

.copy-btn:hover {
    background: var(--accent);
    color: var(--bg-color);
}

.command-list {
    display: grid;
    gap: 1rem;
}

.command-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.command-item:last-child {
    border-bottom: none;
}

.command-item code {
    color: var(--accent);
    font-weight: 600;
}

.command-item span {
    color: var(--text-secondary);
    font-size: 0.9rem;
}

footer {
    text-align: center;
    margin-top: 2rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
}

.link {
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.2s;
}

.link:hover {
    color: var(--accent);
}

@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 600px) {
    .container {
        padding: 1rem;
    }

    h1 {
        font-size: 2rem;
    }
}
```

# File: packages/shared/src/log.ts

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.authorization', 'authorization', 'vt.apiKey', 'gsb.apiKey'],
    remove: true
  }
});


```

# File: packages/shared/src/circuit-breaker.ts

```typescript
export enum CircuitState {
  CLOSED = 0,
  OPEN = 1,
  HALF_OPEN = 2,
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  windowMs: number;
  name: string;
  onStateChange?: (state: CircuitState, from: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = [];
  private successes: number = 0;
  private lastAttempt = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState() {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    this.trimFailures(now);
    switch (this.state) {
      case CircuitState.OPEN:
        if (now - this.lastAttempt < this.options.timeoutMs) {
          throw new Error(`Circuit ${this.options.name} is open`);
        }
        this.changeState(CircuitState.HALF_OPEN);
        break;
      case CircuitState.HALF_OPEN:
        // allow single test request
        break;
      case CircuitState.CLOSED:
      default:
        break;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure(now);
      throw err;
    }
  }

  private trimFailures(now: number) {
    const threshold = now - this.options.windowMs;
    this.failures = this.failures.filter(ts => ts > threshold);
  }

  private recordFailure(now: number) {
    this.failures.push(now);
    this.lastAttempt = now;
    if (this.state === CircuitState.HALF_OPEN) {
      this.changeState(CircuitState.OPEN);
      this.successes = 0;
    } else if (this.failures.length >= this.options.failureThreshold && this.state === CircuitState.CLOSED) {
      this.changeState(CircuitState.OPEN);
    }
  }

  private recordSuccess() {
    this.successes += 1;
    if (this.state === CircuitState.HALF_OPEN && this.successes >= this.options.successThreshold) {
      this.changeState(CircuitState.CLOSED);
      this.successes = 0;
      this.failures = [];
    } else if (this.state === CircuitState.CLOSED) {
      this.failures = [];
    }
  }

  private changeState(next: CircuitState) {
    const prev = this.state;
    this.state = next;
    if (this.options.onStateChange) {
      this.options.onStateChange(next, prev);
    }
  }
}

export async function withRetry<T>(
  task: () => Promise<T>,
  options: { retries: number; baseDelayMs: number; factor?: number; retryable?: (err: unknown) => boolean } = { retries: 0, baseDelayMs: 0 }
): Promise<T> {
  const factor = options.factor ?? 2;
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (err) {
      attempt += 1;
      const shouldRetry =
        attempt <= options.retries &&
        (!options.retryable || options.retryable(err));
      if (!shouldRetry) {
        throw err;
      }
      const delay = options.baseDelayMs * Math.pow(factor, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

```

# File: packages/shared/src/errors.ts

```typescript
export class QuotaExceededError extends Error {
  public readonly service: string;

  constructor(service: string, message?: string) {
    super(message ?? `${service} quota exceeded`);
    this.name = 'QuotaExceededError';
    this.service = service;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FeatureDisabledError extends Error {
  public readonly feature: string;

  constructor(feature: string, message?: string) {
    super(message ?? `${feature} feature disabled`);
    this.name = 'FeatureDisabledError';
    this.feature = feature;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

```

# File: packages/shared/src/ssrf.ts

```typescript
import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

const privateCidrs = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10'
].map(c => ipaddr.parseCIDR(c));

export async function isPrivateHostname(hostname: string): Promise<boolean> {
  try {
    const addrs = await dns.lookup(hostname, { all: true, family: 0 });
    return addrs.some(a => isPrivateIp(a.address));
  } catch {
    return true; // fail closed
  }
}

export function isPrivateIp(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    return privateCidrs.some(([range, prefix]) => {
      if (addr.kind() !== range.kind()) return false;
      return addr.match(range, prefix);
    });
  } catch {
    return true;
  }
}


```

# File: packages/shared/src/homoglyph.ts

```typescript
import { getConfusableCharacters } from 'confusable';
import punycode from 'punycode';

export type HomoglyphRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface HomoglyphCharacter {
  original: string;
  confusedWith: string;
  position: number;
  script: string;
  alternatives: string[];
}

export interface HomoglyphResult {
  detected: boolean;
  isPunycode: boolean;
  mixedScript: boolean;
  unicodeHostname: string;
  normalizedDomain: string;
  confusableChars: HomoglyphCharacter[];
  riskLevel: HomoglyphRiskLevel;
  riskReasons: string[];
}

const ASCII_PATTERN = /^[\x00-\x7F]+$/;

const BRAND_NAMES = ['google', 'facebook', 'paypal', 'amazon', 'microsoft', 'apple', 'netflix', 'whatsapp'];

const RISK_PRIORITY: Record<HomoglyphRiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const PRIORITY_TO_LEVEL: HomoglyphRiskLevel[] = ['none', 'low', 'medium', 'high'];

interface ScriptRange {
  name: string;
  ranges: Array<[number, number]>;
}

const SCRIPT_RANGES: ScriptRange[] = [
  { name: 'Latin', ranges: [
    [0x0041, 0x024F],
    [0x1E00, 0x1EFF],
    [0x2C60, 0x2C7F],
    [0xA720, 0xA7FF],
    [0xFF21, 0xFF3A],
    [0xFF41, 0xFF5A],
  ] },
  { name: 'Greek', ranges: [[0x0370, 0x03FF], [0x1F00, 0x1FFF]] },
  { name: 'Cyrillic', ranges: [[0x0400, 0x052F], [0x2DE0, 0x2DFF], [0xA640, 0xA69F]] },
  { name: 'Armenian', ranges: [[0x0530, 0x058F]] },
  { name: 'Hebrew', ranges: [[0x0590, 0x05FF]] },
  { name: 'Arabic', ranges: [[0x0600, 0x06FF], [0x0750, 0x077F], [0x08A0, 0x08FF]] },
  { name: 'Devanagari', ranges: [[0x0900, 0x097F]] },
  { name: 'Thai', ranges: [[0x0E00, 0x0E7F]] },
  { name: 'Hangul', ranges: [[0x1100, 0x11FF], [0x3130, 0x318F], [0xAC00, 0xD7AF]] },
  { name: 'Han', ranges: [[0x3400, 0x4DBF], [0x4E00, 0x9FFF], [0xF900, 0xFAFF]] },
  { name: 'Katakana', ranges: [[0x30A0, 0x30FF], [0xFF66, 0xFF9F]] },
  { name: 'Hiragana', ranges: [[0x3040, 0x309F]] },
];

export function detectHomoglyphs(domain: string): HomoglyphResult {
  const unicodeHostname = decodeDomain(domain);
  const isPunycode = domain.split('.').some(label => label.startsWith('xn--'));

  const confusableChars: HomoglyphCharacter[] = [];
  const scripts = new Set<string>();
  const riskReasons: string[] = [];

  let asciiSkeletonBuilder = '';
  const characters = Array.from(unicodeHostname);

  characters.forEach((char, index) => {
    if (char === '.') {
      asciiSkeletonBuilder += char;
      return;
    }

    const script = detectScript(char);
    if (script !== 'Common') {
      scripts.add(script);
    }

    const codePoint = char.codePointAt(0);
    const confusableSet = codePoint !== undefined && codePoint > 0x7f
      ? sanitizeAlternatives(char, getConfusableCharacters(char))
      : [];
    const asciiAlternative = confusableSet.find(candidate => ASCII_PATTERN.test(candidate) && candidate.toLowerCase() !== char.toLowerCase());

    let replacement = char;
    if (asciiAlternative) {
      replacement = asciiAlternative;
      confusableChars.push({
        original: char,
        confusedWith: asciiAlternative,
        position: index,
        script,
        alternatives: confusableSet,
      });
    } else if (confusableSet.length > 0 && script !== 'Latin') {
      const fallback = confusableSet[0];
      replacement = fallback;
      confusableChars.push({
        original: char,
        confusedWith: fallback,
        position: index,
        script,
        alternatives: confusableSet,
      });
    }

    asciiSkeletonBuilder += replacement;
  });

  const asciiSkeleton = asciiSkeletonBuilder.toLowerCase();
  const mixedScript = scripts.size > 1;

  let riskPriority = 0;

  if (isPunycode) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.low);
    pushUnique(riskReasons, 'Hostname uses punycode/IDN encoding');
  }

  if (mixedScript) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.medium);
    pushUnique(riskReasons, `Mixed scripts detected: ${Array.from(scripts).join(', ')}`);
  }

  if (confusableChars.length > 0) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.medium);
    confusableChars.forEach(entry => {
      pushUnique(riskReasons, `Confusable character ${entry.original}→${entry.confusedWith} (${entry.script})`);
    });
  }

  if (confusableChars.length >= 2 || (confusableChars.length > 0 && mixedScript) || (isPunycode && confusableChars.length > 0)) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.high);
  }

  const brandMatch = detectBrandSpoof(unicodeHostname, asciiSkeleton);
  if (brandMatch) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.high);
    pushUnique(riskReasons, `Visually similar to brand "${brandMatch}"`);
  }

  const riskLevel = PRIORITY_TO_LEVEL[riskPriority];
  const detected = isPunycode || mixedScript || confusableChars.length > 0;

  return {
    detected,
    isPunycode,
    mixedScript,
    unicodeHostname,
    normalizedDomain: asciiSkeleton,
    confusableChars,
    riskLevel,
    riskReasons,
  };
}

function decodeDomain(domain: string): string {
  return domain
    .split('.')
    .map(label => {
      if (!label.startsWith('xn--')) {
        return label;
      }

      try {
        const decoded = punycode.toUnicode(label);
        return decoded || label;
      } catch {
        return label;
      }
    })
    .join('.');
}

function detectScript(char: string): string {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return 'Common';
  }
  if ((codePoint >= 0x0030 && codePoint <= 0x0039) || char === '-' || char === '_') {
    return 'Common';
  }
  for (const script of SCRIPT_RANGES) {
    if (script.ranges.some(([start, end]) => codePoint >= start && codePoint <= end)) {
      return script.name;
    }
  }
  return 'Common';
}

function sanitizeAlternatives(original: string, entries: string[]): string[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter(entry => entry && entry !== original);
}

function detectBrandSpoof(unicodeHostname: string, asciiSkeleton: string): string | null {
  const primaryLabel = unicodeHostname.split('.')[0]?.toLowerCase() ?? unicodeHostname.toLowerCase();
  const normalizedLabel = asciiSkeleton.split('.')[0] ?? asciiSkeleton;
  const normalizedLower = normalizedLabel.toLowerCase();

  for (const brand of BRAND_NAMES) {
    if (primaryLabel === brand) {
      continue;
    }
    const similarityOriginal = stringSimilarity(primaryLabel, brand);
    const similarityNormalized = stringSimilarity(normalizedLower, brand);
    if (Math.max(similarityOriginal, similarityNormalized) > 0.88) {
      return brand;
    }
  }
  return null;
}

function stringSimilarity(a: string, b: string): number {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 1;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function pushUnique(reasons: string[], reason: string) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

```

# File: packages/shared/src/database.ts

```typescript
import Database from 'better-sqlite3';
import type { Logger } from 'pino';
import fs from 'fs';
import path from 'path';

interface DatabaseConfig {
  dbPath?: string;
  logger?: Logger;
}

export class SQLiteConnection {
  private db: Database.Database;
  private logger: Logger | undefined;

  constructor(config: DatabaseConfig = {}) {
    const dbPath = config.dbPath || process.env.SQLITE_DB_PATH || './storage/wbscanner.db';

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.logger = config.logger;

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 64000');
    this.db.pragma('foreign_keys = ON');

    if (this.logger) {
      this.logger.info({ dbPath }, 'SQLite connection established');
    }
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  async query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    try {
      const stmt = this.db.prepare(sql);

      // Handle SELECT queries
      if (sql.trim().toLowerCase().startsWith('select')) {
        const rows = stmt.all(...params);
        return { rows };
      }

      // Handle INSERT, UPDATE, DELETE queries
      const result = stmt.run(...params);
      return {
        rows: result.changes > 0 ? [{ affectedRows: result.changes, lastInsertRowid: result.lastInsertRowid }] : []
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, sql, params }, 'Database query failed');
      }
      throw error;
    }
  }

  async transaction<T>(fn: () => T): Promise<T> {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  close(): void {
    this.db.close();
    if (this.logger) {
      this.logger.info('SQLite connection closed');
    }
  }
}

// Singleton connection for shared use
let sharedConnection: SQLiteConnection | null = null;

export function getSharedConnection(logger?: Logger): SQLiteConnection {
  if (!sharedConnection) {
    sharedConnection = new SQLiteConnection({ logger });
  }
  return sharedConnection;
}

export function createConnection(config: DatabaseConfig = {}): SQLiteConnection {
  return new SQLiteConnection(config);
}
```

# File: packages/shared/src/verdict-cache.ts

```typescript
import NodeCache from 'node-cache';
import type { Logger } from 'pino';

export interface VerdictCacheOptions {
    ttlSeconds?: number;
    maxKeys?: number;
    checkPeriodSeconds?: number;
    logger?: Logger;
}

export interface CachedVerdict {
    verdict: 'benign' | 'suspicious' | 'malicious';
    confidence: number;
    timestamp: number;
    sources?: string[];
}

/**
 * In-memory verdict cache using node-cache.
 * Reduces Redis load for frequently scanned URLs.
 * Each service instance maintains its own cache.
 */
export class VerdictCache {
    private cache: NodeCache;
    private logger?: Logger;
    private hits = 0;
    private misses = 0;

    constructor(options: VerdictCacheOptions = {}) {
        const {
            ttlSeconds = 3600,
            maxKeys = 10000,
            checkPeriodSeconds = 600,
            logger,
        } = options;

        this.logger = logger;
        this.cache = new NodeCache({
            stdTTL: ttlSeconds,
            maxKeys,
            checkperiod: checkPeriodSeconds,
            useClones: false, // Performance optimization
        });

        // Log cache statistics periodically
        if (this.logger) {
            setInterval(() => {
                const stats = this.getStats();
                this.logger?.debug(stats, 'Verdict cache statistics');
            }, 60000); // Every minute
        }
    }

    /**
     * Get a cached verdict by URL hash
     */
    get(urlHash: string): CachedVerdict | undefined {
        const value = this.cache.get<CachedVerdict>(urlHash);
        if (value) {
            this.hits++;
            this.logger?.debug({ urlHash, verdict: value.verdict }, 'Cache hit');
            return value;
        }
        this.misses++;
        this.logger?.debug({ urlHash }, 'Cache miss');
        return undefined;
    }

    /**
     * Set a verdict in the cache
     */
    set(urlHash: string, verdict: CachedVerdict, ttlSeconds?: number): boolean {
        try {
            const success = ttlSeconds !== undefined
                ? this.cache.set(urlHash, verdict, ttlSeconds)
                : this.cache.set(urlHash, verdict);
            if (success) {
                this.logger?.debug({ urlHash, verdict: verdict.verdict }, 'Cached verdict');
            }
            return success;
        } catch (err) {
            this.logger?.warn({ err, urlHash }, 'Failed to cache verdict');
            return false;
        }
    }

    /**
     * Delete a specific verdict from cache
     */
    delete(urlHash: string): number {
        return this.cache.del(urlHash);
    }

    /**
     * Clear all cached verdicts
     */
    clear(): void {
        this.cache.flushAll();
        this.hits = 0;
        this.misses = 0;
        this.logger?.info('Verdict cache cleared');
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        keys: number;
        hits: number;
        misses: number;
        hitRate: number;
        ksize: number;
        vsize: number;
    } {
        const stats = this.cache.getStats();
        const totalRequests = this.hits + this.misses;
        const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

        return {
            keys: stats.keys,
            hits: this.hits,
            misses: this.misses,
            hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
            ksize: stats.ksize,
            vsize: stats.vsize,
        };
    }

    /**
     * Check if cache has a specific key
     */
    has(urlHash: string): boolean {
        return this.cache.has(urlHash);
    }

    /**
     * Get TTL for a specific key (in seconds)
     */
    getTtl(urlHash: string): number | undefined {
        const ttl = this.cache.getTtl(urlHash);
        return ttl !== undefined ? ttl : undefined;
    }

    /**
     * Close the cache and cleanup
     */
    close(): void {
        this.cache.close();
        this.logger?.info('Verdict cache closed');
    }
}

```

# File: packages/shared/src/http-errors.ts

```typescript
// Shared error types for HTTP operations
export interface HttpError extends Error {
    statusCode?: number;
    code?: number | string;
    details?: unknown;
}

export function createHttpError(message: string, statusCode?: number): HttpError {
    const error = new Error(message) as HttpError;
    if (statusCode !== undefined) {
        error.statusCode = statusCode;
    }
    return error;
}

```

# File: packages/shared/src/config.ts

```typescript
import dotenv from 'dotenv';
import { logger } from './log';

dotenv.config();

const urlscanEnabled = (process.env.URLSCAN_ENABLED || 'true') === 'true';
const urlscanCallbackSecret = (process.env.URLSCAN_CALLBACK_SECRET || '').trim();

if (urlscanEnabled && !urlscanCallbackSecret) {
  throw new Error('URLSCAN_CALLBACK_SECRET must be provided when URLSCAN_ENABLED=true');
}

function parseStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function ensureNonEmpty(raw: string | undefined, envVar: string): string {
  const value = (raw ?? '').trim();
  if (!value) {
    throw new Error(`${envVar} must not be empty`);
  }
  return value;
}

function ensureQueueName(raw: string, envVar: string): string {
  const value = ensureNonEmpty(raw, envVar);
  if (value.includes(':')) {
    throw new Error(`${envVar} must not contain ':' characters. Use hyphen-separated names (e.g., scan-request).`);
  }
  return value;
}

let cachedControlPlaneToken: string | undefined;

function getControlPlaneToken(): string {
  if (!cachedControlPlaneToken) {
    cachedControlPlaneToken = ensureNonEmpty(process.env.CONTROL_PLANE_API_TOKEN, 'CONTROL_PLANE_API_TOKEN');
  }
  return cachedControlPlaneToken;
}

function parsePositiveInt(value: string | undefined, fallback: number, { minimum = 1 }: { minimum?: number } = {}): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isFinite(parsed) && parsed >= minimum) {
    return parsed;
  }
  return fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

const featureFlags = {
  attachMediaToVerdicts: (process.env.FEATURE_ATTACH_MEDIA_TO_VERDICTS || 'false') === 'true',
};

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379/0',
  queues: {
    scanRequest: ensureQueueName(process.env.SCAN_REQUEST_QUEUE || 'scan-request', 'SCAN_REQUEST_QUEUE'),
    scanVerdict: ensureQueueName(process.env.SCAN_VERDICT_QUEUE || 'scan-verdict', 'SCAN_VERDICT_QUEUE'),
    urlscan: ensureQueueName(process.env.SCAN_URLSCAN_QUEUE || 'scan-urlscan', 'SCAN_URLSCAN_QUEUE'),
  },
  vt: {
    enabled: (process.env.VT_ENABLED || 'true') === 'true' && !!process.env.VT_API_KEY,
    apiKey: process.env.VT_API_KEY || '',
    timeoutMs: parseInt(process.env.VT_REQUEST_TIMEOUT_MS || '8000', 10),
    requestsPerMinute: parsePositiveInt(process.env.VT_REQUESTS_PER_MINUTE, 4),
    requestJitterMs: parseNonNegativeInt(process.env.VT_REQUEST_JITTER_MS, 0),
  },
  gsb: {
    enabled: (process.env.GSB_ENABLED || 'true') === 'true' && !!process.env.GSB_API_KEY,
    apiKey: process.env.GSB_API_KEY || '',
    timeoutMs: parseInt(process.env.GSB_REQUEST_TIMEOUT_MS || '5000', 10),
    fallbackLatencyMs: parseInt(process.env.GSB_FALLBACK_LATENCY_MS || '500', 10),
  },
  urlhaus: {
    enabled: (process.env.URLHAUS_ENABLED || 'true') === 'true',
    timeoutMs: parseInt(process.env.URLHAUS_TIMEOUT_MS || '5000', 10),
  },
  phishtank: {
    enabled: (process.env.PHISHTANK_ENABLED || 'true') === 'true' && !!process.env.PHISHTANK_APP_KEY,
    appKey: process.env.PHISHTANK_APP_KEY || '',
    userAgent: process.env.PHISHTANK_USER_AGENT || 'wbscanner-bot/1.0',
    timeoutMs: parseInt(process.env.PHISHTANK_TIMEOUT_MS || '5000', 10),
  },
  rdap: {
    enabled: (process.env.RDAP_ENABLED || 'true') === 'true',
    timeoutMs: parseInt(process.env.RDAP_TIMEOUT_MS || '5000', 10),
  },
  urlscan: {
    enabled: urlscanEnabled,
    apiKey: process.env.URLSCAN_API_KEY || '',
    baseUrl: process.env.URLSCAN_BASE_URL || 'https://urlscan.io',
    visibility: process.env.URLSCAN_VISIBILITY || 'private',
    tags: (process.env.URLSCAN_TAGS || 'wbscanner').split(',').map(t => t.trim()).filter(Boolean),
    callbackUrl: process.env.URLSCAN_CALLBACK_URL || '',
    callbackSecret: urlscanCallbackSecret,
    submitTimeoutMs: parseInt(process.env.URLSCAN_SUBMIT_TIMEOUT_MS || '10000', 10),
    resultPollTimeoutMs: parseInt(process.env.URLSCAN_RESULT_TIMEOUT_MS || '30000', 10),
    uuidTtlSeconds: parseInt(process.env.URLSCAN_UUID_TTL_SECONDS || '86400', 10),
    resultTtlSeconds: parseInt(process.env.URLSCAN_RESULT_TTL_SECONDS || '86400', 10),
    concurrency: parseInt(process.env.URLSCAN_CONCURRENCY || '2', 10),
    get allowedArtifactHosts(): string[] {
      const configuredHosts = parseStringList(process.env.URLSCAN_ALLOWED_HOSTS);
      const baseHosts = [] as string[];
      try {
        const host = new URL(process.env.URLSCAN_BASE_URL || 'https://urlscan.io').hostname.toLowerCase();
        baseHosts.push(host);
      } catch {
        // ignore invalid base URL overrides; validation happens elsewhere
      }
      const combined = [...baseHosts, ...configuredHosts].map((host) => host.toLowerCase());
      return Array.from(new Set(combined.filter((host) => host.length > 0)));
    },
  },
  whoisxml: {
    enabled: ((process.env.WHOISXML_ENABLE ?? process.env.WHOISXML_ENABLED) || 'false') === 'true',
    apiKey: process.env.WHOISXML_API_KEY || '',
    timeoutMs: parseInt(process.env.WHOISXML_TIMEOUT_MS || '5000', 10),
    monthlyQuota: parsePositiveInt(process.env.WHOISXML_MONTHLY_QUOTA, 500),
    quotaAlertThreshold: parsePositiveInt(process.env.WHOISXML_QUOTA_ALERT_THRESHOLD, 100, { minimum: 1 }),
  },
  whodat: {
    enabled: (process.env.WHODAT_ENABLED || 'true') === 'true',
    baseUrl: process.env.WHODAT_BASE_URL || 'http://who-dat:8080',
    timeoutMs: parseInt(process.env.WHODAT_TIMEOUT_MS || '5000', 10),
  },
  shortener: {
    unshortenEndpoint: process.env.UNSHORTEN_ENDPOINT || 'https://unshorten.me/json/',
    unshortenRetries: parseInt(process.env.UNSHORTEN_RETRIES || '1', 10),
    cacheTtlSeconds: parseInt(process.env.SHORTENER_CACHE_TTL_SECONDS || '86400', 10),
  },
  orchestrator: {
    concurrency: parseInt(process.env.SCAN_CONCURRENCY || '10', 10),
    expansion: {
      maxRedirects: parseInt(process.env.URL_EXPANSION_MAX_REDIRECTS || '5', 10),
      timeoutMs: parseInt(process.env.URL_EXPANSION_TIMEOUT_MS || '5000', 10),
      maxContentLength: parseInt(process.env.URL_MAX_CONTENT_LENGTH || '1048576', 10),
    },
    cacheTtl: {
      benign: parseInt(process.env.CACHE_TTL_BENIGN_SECONDS || '86400', 10),
      suspicious: parseInt(process.env.CACHE_TTL_SUSPICIOUS_SECONDS || '3600', 10),
      malicious: parseInt(process.env.CACHE_TTL_MALICIOUS_SECONDS || '900', 10),
    }
  },
  cache: {
    inMemoryEnabled: (process.env.CACHE_IN_MEMORY_ENABLED || 'true') === 'true',
    inMemoryTtlSeconds: parseInt(process.env.CACHE_IN_MEMORY_TTL_SECONDS || '3600', 10),
    inMemoryMaxKeys: parseInt(process.env.CACHE_IN_MEMORY_MAX_KEYS || '10000', 10),
  },
  enhancedSecurity: {
    enabled: (process.env.ENHANCED_SECURITY_ENABLED || 'true') === 'true',
    dnsbl: {
      enabled: (process.env.DNSBL_ENABLED || 'true') === 'true',
      timeoutMs: parseInt(process.env.DNSBL_TIMEOUT_MS || '2000', 10),
    },
    certIntel: {
      enabled: (process.env.CERT_INTEL_ENABLED || 'true') === 'true',
      timeoutMs: parseInt(process.env.CERT_INTEL_TIMEOUT_MS || '3000', 10),
      ctCheckEnabled: (process.env.CERT_INTEL_CT_CHECK_ENABLED || 'true') === 'true',
    },
    localThreatDb: {
      enabled: (process.env.LOCAL_THREAT_DB_ENABLED || 'true') === 'true',
      feedUrl: process.env.OPENPHISH_FEED_URL || 'https://openphish.com/feed.txt',
      updateIntervalMs: parseInt(process.env.OPENPHISH_UPDATE_INTERVAL_MS || '7200000', 10),
    },
    httpFingerprint: {
      enabled: (process.env.HTTP_FINGERPRINT_ENABLED || 'true') === 'true',
      timeoutMs: parseInt(process.env.HTTP_FINGERPRINT_TIMEOUT_MS || '2000', 10),
    },
    heuristics: {
      entropyThreshold: parseFloat(process.env.ENHANCED_HEURISTICS_ENTROPY_THRESHOLD || '4.5'),
    },
  },
  controlPlane: {
    port: parseInt(process.env.CONTROL_PLANE_PORT || '8080', 10),
    get token(): string {
      return getControlPlaneToken();
    },
    enableUi: (process.env.CONTROL_PLANE_ENABLE_UI || 'true') === 'true',
    get csrfToken(): string {
      return (process.env.CONTROL_PLANE_CSRF_TOKEN || getControlPlaneToken()).trim();
    },
    get allowedOrigins(): string[] {
      return parseStringList(process.env.CONTROL_PLANE_ALLOWED_ORIGINS).map((origin) => origin.toLowerCase());
    },
  },
  features: featureFlags,
  wa: {
    headless: (process.env.WA_HEADLESS || 'true') === 'true',
    qrTerminal: (process.env.WA_QR_TERMINAL || 'true') === 'true',
    consentOnJoin: (process.env.WA_CONSENT_ON_JOIN || 'true') === 'true',
    quietHours: process.env.WA_QUIET_HOURS || '22-07',
    perGroupCooldownSeconds: parseInt(process.env.WA_PER_GROUP_REPLY_COOLDOWN_SECONDS || '60', 10),
    globalRatePerHour: parsePositiveInt(process.env.WA_GLOBAL_REPLY_RATE_PER_HOUR, 1000),
    globalTokenBucketKey: process.env.WA_GLOBAL_TOKEN_BUCKET_KEY || 'wa_global_token_bucket',
    perGroupHourlyLimit: parsePositiveInt(process.env.WA_PER_GROUP_HOURLY_LIMIT, 60),
    remoteAuth: {
      store: (process.env.WA_REMOTE_AUTH_STORE || 'redis').toLowerCase(),
      clientId: process.env.WA_AUTH_CLIENT_ID || 'default',
      autoPair: (process.env.WA_REMOTE_AUTH_AUTO_PAIR || 'false') === 'true',
      pairingDelayMs: parsePositiveInt(process.env.WA_REMOTE_AUTH_AUTO_PAIR_DELAY_MS, 0, { minimum: 0 }),
      pairingRetryDelayMs: parsePositiveInt(process.env.WA_REMOTE_AUTH_RETRY_DELAY_MS, 15000, { minimum: 1000 }),
      maxPairingRetries: parsePositiveInt(process.env.WA_REMOTE_AUTH_MAX_RETRIES, 5, { minimum: 1 }),
      disableQrFallback: (process.env.WA_REMOTE_AUTH_DISABLE_QR_FALLBACK || 'false') === 'true',
      kmsKeyId: (process.env.WA_REMOTE_AUTH_KMS_KEY_ID || '').trim() || undefined,
      encryptedDataKey: (process.env.WA_REMOTE_AUTH_ENCRYPTED_DATA_KEY || '').trim() || undefined,
      dataKey: (process.env.WA_REMOTE_AUTH_DATA_KEY || '').trim() || undefined,
      vaultTransitPath: (process.env.WA_REMOTE_AUTH_VAULT_PATH || '').trim() || undefined,
      vaultToken: (process.env.WA_REMOTE_AUTH_VAULT_TOKEN || '').trim() || undefined,
      vaultAddress: (process.env.WA_REMOTE_AUTH_VAULT_ADDRESS || '').trim() || undefined,
      alertThreshold: parsePositiveInt(process.env.WA_AUTH_FAILURE_ALERT_THRESHOLD, 3, { minimum: 1 }),
      alertCooldownSeconds: parsePositiveInt(process.env.WA_AUTH_FAILURE_ALERT_COOLDOWN_SECONDS, 1800, { minimum: 60 }),
      failureWindowSeconds: parsePositiveInt(process.env.WA_AUTH_FAILURE_WINDOW_SECONDS, 900, { minimum: 60 }),
      resetDebounceSeconds: parsePositiveInt(process.env.WA_RESET_DEBOUNCE_SECONDS, 60, { minimum: 15 }),
      backupIntervalMs: parsePositiveInt(process.env.WA_REMOTE_AUTH_BACKUP_INTERVAL_MS, 300000, { minimum: 60000 }),
      dataPath: process.env.WA_REMOTE_AUTH_DATA_PATH || './data/remote-session',
      forceNewSession: (process.env.WA_REMOTE_AUTH_FORCE_NEW_SESSION || 'false') === 'true',

      // Multi-number support (comma-separated list)
      phoneNumbers: (() => {
        const raw = (process.env.WA_REMOTE_AUTH_PHONE_NUMBERS || process.env.WA_REMOTE_AUTH_PHONE_NUMBER || '').trim();
        return raw.split(',')
          .map(num => num.replace(/\D/g, ''))
          .filter(num => num.length > 4);
      })(),

      // Backwards compatibility: single phoneNumber (deprecated)
      phoneNumber: (() => {
        const raw = (process.env.WA_REMOTE_AUTH_PHONE_NUMBER || '').replace(/\D/g, '');
        return raw.length > 4 ? raw : undefined;
      })(),

      // On-demand polling configuration
      pollingEnabled: (process.env.WA_REMOTE_AUTH_POLLING_ENABLED || 'false') === 'true',
      pollingIntervalMinutes: parsePositiveInt(process.env.WA_REMOTE_AUTH_POLLING_INTERVAL_MINUTES, 10, { minimum: 5 }),
      pollingDurationMinutes: parsePositiveInt(process.env.WA_REMOTE_AUTH_POLLING_DURATION_MINUTES, 60, { minimum: 10 }),
      pollingSchedule: (process.env.WA_REMOTE_AUTH_POLLING_SCHEDULE || '').trim() || undefined,

      // Parallel checking configuration
      parallelCheckTimeoutMs: parsePositiveInt(process.env.WA_REMOTE_AUTH_PARALLEL_TIMEOUT_MS, 30000, { minimum: 10000 }),
    },
    authStrategy: (() => {
      const raw = (process.env.WA_AUTH_STRATEGY || 'remote').toLowerCase();
      return raw === 'local' ? 'local' : 'remote';
    })() as 'local' | 'remote',
    puppeteerArgs: (() => {
      const raw = process.env.WA_PUPPETEER_ARGS;
      if (!raw || raw.trim() === '') {
        // Optimized args to reduce memory and CPU overhead by 40-60%
        return [
          // Security (required for Docker)
          '--no-sandbox',
          '--disable-setuid-sandbox',

          // Memory optimization
          '--disable-dev-shm-usage',        // Use /tmp instead of /dev/shm (prevents OOM)
          '--disable-gpu',                   // No GPU rendering needed
          '--disable-software-rasterizer',   // Disable software rasterizer fallback

          // CPU optimization
          '--disable-background-networking', // No background requests
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',              // Disable crash reporting
          '--disable-component-extensions-with-background-pages',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-ipc-flooding-protection', // Reduce IPC overhead
          '--disable-renderer-backgrounding', // Keep renderer active

          // Feature disabling (not needed for WhatsApp Web)
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',       // Minimal metrics
          '--mute-audio',                   // No audio needed
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-domain-reliability',
          '--disable-client-side-phishing-detection',

          // Resource preloading (reduce initial load)
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled', // Anti-detection
        ];
      }
      return raw.split(',').map((segment) => segment.trim()).filter((segment) => segment.length > 0);
    })(),
    verdictAckTimeoutSeconds: parsePositiveInt(process.env.WA_VERDICT_ACK_TIMEOUT_SECONDS, 30),
    verdictAckMaxRetries: parsePositiveInt(process.env.WA_VERDICT_ACK_MAX_RETRIES, 5),
    verdictMaxRetries: parsePositiveInt(process.env.WA_VERDICT_MAX_RETRIES, 3),
    membershipAutoApprovePerHour: parsePositiveInt(process.env.WA_MEMBERSHIP_AUTO_APPROVE_PER_HOUR, 10),
    membershipGlobalHourlyLimit: parsePositiveInt(process.env.WA_MEMBERSHIP_GLOBAL_HOURLY_LIMIT, 100),
    governanceInterventionsPerHour: parsePositiveInt(process.env.WA_GOVERNANCE_INTERVENTIONS_PER_HOUR, 12),
    messageLineageTtlSeconds: parsePositiveInt(process.env.WA_MESSAGE_LINEAGE_TTL_SECONDS, 60 * 60 * 24 * 30),
  }
};

export function assertControlPlaneToken(): string {
  return getControlPlaneToken();
}

export function assertEssentialConfig(serviceName: string): void {
  const missing: string[] = [];

  if (!config.vt.apiKey?.trim()) missing.push('VT_API_KEY');
  if (!config.redisUrl?.trim()) missing.push('REDIS_URL');

  if (missing.length > 0) {
    logger.error({ service: serviceName, missing }, 'Missing required environment variables');
    process.exit(1);
  }
}


```

# File: packages/shared/src/index.ts

```typescript
export * from './log';
export * from './metrics';
export * from './config';
export * from './url';
export * from './ssrf';
export * from './scoring';
export * from './reputation/virustotal';
export * from './reputation/gsb';
export * from './reputation/rdap';
export * from './reputation/urlhaus';
export * from './reputation/phishtank';
export * from './reputation/urlscan';
export * from './reputation/whoisxml';
export * from './reputation/whodat';
export * from './reputation/dns-intelligence';
export * from './reputation/certificate-intelligence';
export * from './reputation/advanced-heuristics';
export * from './reputation/local-threat-db';
export * from './reputation/http-fingerprint';
export * from './circuit-breaker';
export * from './url-shortener';
export * from './types';
export * from './errors';
export * from './homoglyph';
export * from './database';
export * from './verdict-cache';

```

# File: packages/shared/src/scoring.ts

```typescript
import { isSuspiciousTld } from './url';
import { detectHomoglyphs } from './homoglyph';
import type { HomoglyphResult } from './homoglyph';

export interface Signals {
  gsbThreatTypes?: string[];
  vtMalicious?: number;
  vtSuspicious?: number;
  vtHarmless?: number;
  urlhausListed?: boolean;
  phishtankVerified?: boolean;
  domainAgeDays?: number;
  isIpLiteral?: boolean;
  hasSuspiciousTld?: boolean;
  redirectCount?: number;
  hasUncommonPort?: boolean;
  urlLength?: number;
  hasExecutableExtension?: boolean;
  wasShortened?: boolean;
  manualOverride?: 'allow' | 'deny' | null;
  finalUrlMismatch?: boolean;
  homoglyph?: HomoglyphResult;
  heuristicsOnly?: boolean;
}

export interface RiskVerdict {
  score: number;
  level: 'benign' | 'suspicious' | 'malicious';
  reasons: string[];
  cacheTtl: number;
}

function pushReason(reasons: string[], reason: string) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function evaluateBlocklistSignals(signals: Signals, score: number, reasons: string[]): number {
  const threatTypes = signals.gsbThreatTypes ?? [];
  if (threatTypes.includes('MALWARE') || threatTypes.includes('SOCIAL_ENGINEERING')) {
    score += 10;
    pushReason(reasons, `Google Safe Browsing: ${threatTypes.join(', ')}`);
  }
  if (signals.phishtankVerified) {
    score += 10;
    pushReason(reasons, 'Verified phishing (Phishtank)');
  }
  if (signals.urlhausListed) {
    score += 10;
    pushReason(reasons, 'Known malware distribution (URLhaus)');
  }
  return score;
}

function evaluateVirusTotalSignals(signals: Signals, score: number, reasons: string[]): number {
  const vtMalicious = signals.vtMalicious ?? 0;
  if (vtMalicious >= 3) {
    score += 8;
    pushReason(reasons, `${vtMalicious} VT engines flagged malicious`);
  } else if (vtMalicious >= 1) {
    score += 5;
    pushReason(reasons, `${vtMalicious} VT engine flagged malicious`);
  }
  return score;
}

function evaluateDomainAge(signals: Signals, score: number, reasons: string[]): number {
  if (signals.domainAgeDays !== undefined && signals.domainAgeDays !== null) {
    if (signals.domainAgeDays < 7) {
      score += 6;
      pushReason(reasons, `Domain registered ${signals.domainAgeDays} days ago (<7)`);
    } else if (signals.domainAgeDays < 14) {
      score += 4;
      pushReason(reasons, `Domain registered ${signals.domainAgeDays} days ago (<14)`);
    } else if (signals.domainAgeDays < 30) {
      score += 2;
      pushReason(reasons, `Domain registered ${signals.domainAgeDays} days ago (<30)`);
    }
  }
  return score;
}

function evaluateHomoglyphSignals(signals: Signals, score: number, reasons: string[]): number {
  const homoglyph = signals.homoglyph;
  if (homoglyph?.detected) {
    const characterPairs = homoglyph.confusableChars.map(c => `${c.original}→${c.confusedWith}`).join(', ');
    if (homoglyph.riskLevel === 'high') {
      score += 5;
      pushReason(
        reasons,
        characterPairs
          ? `High-risk homoglyph attack detected (${characterPairs})`
          : 'High-risk homoglyph attack detected',
      );
    } else if (homoglyph.riskLevel === 'medium') {
      score += 3;
      pushReason(
        reasons,
        characterPairs
          ? `Suspicious homoglyph characters detected (${characterPairs})`
          : 'Suspicious homoglyph characters detected',
      );
    } else {
      score += 1;
      const baseReason = homoglyph.isPunycode ? 'Punycode/IDN hostname detected' : 'Internationalized hostname detected';
      pushReason(reasons, characterPairs ? `${baseReason} (${characterPairs})` : baseReason);
    }
    homoglyph.riskReasons
      .filter(reason => !reason.startsWith('Confusable character'))
      .forEach(reason => pushReason(reasons, reason));
  }
  return score;
}

function evaluateHeuristicSignals(signals: Signals, score: number, reasons: string[]): number {
  if (signals.isIpLiteral) {
    score += 3;
    pushReason(reasons, 'URL uses IP address');
  }
  if (signals.hasSuspiciousTld) {
    score += 2;
    pushReason(reasons, 'Suspicious TLD');
  }
  if ((signals.redirectCount ?? 0) >= 3) {
    score += 2;
    pushReason(reasons, `Multiple redirects (${signals.redirectCount})`);
  }
  if (signals.hasUncommonPort) {
    score += 2;
    pushReason(reasons, 'Uncommon port');
  }
  if ((signals.urlLength ?? 0) > 200) {
    score += 2;
    pushReason(reasons, `Long URL (${signals.urlLength} chars)`);
  }
  if (signals.hasExecutableExtension) {
    score += 1;
    pushReason(reasons, 'Executable file extension');
  }
  if (signals.wasShortened) {
    score += 1;
    pushReason(reasons, 'Shortened URL expanded');
  }
  if (signals.finalUrlMismatch) {
    score += 2;
    pushReason(reasons, 'Redirect leads to mismatched domain/brand');
  }
  return score;
}

function determineRiskLevel(finalScore: number): { level: RiskVerdict['level']; cacheTtl: number } {
  if (finalScore <= 3) {
    return { level: 'benign', cacheTtl: 86400 };
  } else if (finalScore <= 7) {
    return { level: 'suspicious', cacheTtl: 3600 };
  } else {
    return { level: 'malicious', cacheTtl: 900 };
  }
}

export function scoreFromSignals(signals: Signals): RiskVerdict {
  if (signals.manualOverride === 'allow') {
    return { score: 0, level: 'benign', reasons: ['Manually allowed'], cacheTtl: 86400 };
  }
  if (signals.manualOverride === 'deny') {
    return { score: 15, level: 'malicious', reasons: ['Manually blocked'], cacheTtl: 86400 };
  }

  let score = 0;
  const reasons: string[] = [];

  score = evaluateBlocklistSignals(signals, score, reasons);
  score = evaluateVirusTotalSignals(signals, score, reasons);
  score = evaluateDomainAge(signals, score, reasons);
  score = evaluateHomoglyphSignals(signals, score, reasons);
  score = evaluateHeuristicSignals(signals, score, reasons);

  if (signals.heuristicsOnly) {
    pushReason(reasons, 'Heuristics-only scan (external providers unavailable)');
  }

  const finalScore = Math.max(0, Math.min(score, 15));
  const { level, cacheTtl } = determineRiskLevel(finalScore);

  return { score: finalScore, level, reasons, cacheTtl };
}

export function extraHeuristics(u: URL): Partial<Signals> {
  const port = u.port ? parseInt(u.port, 10) : (u.protocol === 'http:' ? 80 : 443);
  const hasUncommonPort = ![80, 443, 8080, 8443].includes(port);
  const isIpLiteral = /^(\d+\.\d+\.\d+\.\d+|\[[0-9a-fA-F:]+\])$/.test(u.hostname);
  const hasExecutableExtension = /\.(exe|msi|apk|bat|cmd|ps1|scr|jar|pkg|dmg|iso)$/i.test(u.pathname);
  const hasSuspiciousTld = isSuspiciousTld(u.hostname);
  const homoglyph = detectHomoglyphs(u.hostname);
  return {
    hasUncommonPort,
    isIpLiteral,
    hasExecutableExtension,
    hasSuspiciousTld,
    urlLength: u.toString().length,
    homoglyph,
  };
}

```

# File: packages/shared/src/types.ts

```typescript
export type Verdict = 'benign' | 'suspicious' | 'malicious';

export interface ScanRequest {
  chatId: string;
  messageId: string;
  senderIdHash?: string;
  url: string;
  timestamp: number;
}

export interface ScanResult {
  chatId: string;
  messageId: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  verdict: Verdict;
  score: number;
  reasons: string[];
  override?: {
    status: 'allow' | 'deny';
    reason?: string | null;
  };
  vt?: unknown;
  gsb?: { matches: unknown[] } | boolean;
  phishtank?: unknown;
  urlhaus?: unknown;
  urlscan?: {
    status?: string;
    uuid?: string;
  };
  whois?: {
    source?: 'rdap' | 'whoisxml';
    ageDays?: number;
    registrar?: string;
  };
  domainAgeDays?: number;
  redirectChain?: string[];
  cacheTtl?: number;
  ttlLevel?: Verdict;
  shortener?: {
    provider: string;
    chain: string[];
  };
  finalUrlMismatch?: boolean;
}

export interface GroupSettings {
  notify_admins?: boolean;
  throttles?: {
    per_group_cooldown_seconds?: number;
    global_per_minute?: number;
  };
  quiet_hours?: string; // e.g., "22-07"
  language?: string; // e.g., "en"
}

```

# File: packages/shared/src/url-shortener.ts

```typescript
import { request, fetch as undiciFetch } from 'undici';
import urlExpandModuleRaw from 'url-expand';
import { promisify } from 'node:util';
import { config } from './config';
import { normalizeUrl } from './url';
import { isPrivateHostname } from './ssrf';
import { metrics } from './metrics';

const DEFAULT_SHORTENERS = [
  'bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'ow.ly', 'is.gd', 'buff.ly', 'adf.ly',
  'rebrand.ly', 'lnkd.in', 'rb.gy', 's.id', 'shorturl.at', 'short.io', 'trib.al',
  'po.st', 'bit.do', 'cutt.ly', 'mcaf.ee', 'su.pr', 'qr.ae', 'zpr.io', 'shor.by',
  'tiny.cc', 'x.co', 'lnk.to', 'amzn.to', 'fb.me', 'ift.tt', 'j.mp', 'youtu.be',
  'spr.ly', 'cli.re', 'wa.link', 'tele.cm', 'grabify.link', 'short.cm', 'v.gd',
  'kutt.it', 'snip.ly', 'ttm.sh', 'gg.gg', 'rb.gy', 'prf.hn', 'chilp.it',
  'qps.ru', 'clk.im', 'u.to', 't2m.io', 'soo.gd', 'shorte.st', 't.ly', 'smarturl.it',
  'vn.tl', 'cbsn.ws', 'cnvrt.ly', 'ibm.co', 'es.pn', 'nyti.ms', 'wapo.st',
  'apne.ws', 'reut.rs', 'trib.it', 'bloom.bg', 'for.tn', 'on.ft.com', 'on.mktw.net',
  'lat.ms', 'washpo.st', 'cnet.co', 'g.co', 'hearsay.social', 'dlvr.it', 'relia.pe',
  'go.aws', 'sforce.co', 'drd.sh', 'get.msgsndr.com', 'expi.co', 'plnk.to', 'starturl.com',
  'shortest.link', 'shorten.rest', 'w.wiki', 'hbr.org/go/', 'r.fr24.com', 'lnkd.in',
  'win.gs', 'engt.co', 'go.nasa.gov', 'go.wired.com'
].map(s => s.toLowerCase());

const SHORTENER_HOSTS = new Set(DEFAULT_SHORTENERS);

export function registerAdditionalShorteners(hosts: string[]) {
  for (const host of hosts) {
    if (host) SHORTENER_HOSTS.add(host.toLowerCase());
  }
}

export function isKnownShortener(hostname: string): boolean {
  return SHORTENER_HOSTS.has(hostname.toLowerCase());
}

export type ExpansionFailureReason =
  | 'timeout'
  | 'max-content-length'
  | 'http-error'
  | 'library-error'
  | 'ssrf-blocked'
  | 'expansion-failed';

export interface ShortenerResolution {
  finalUrl: string;
  provider: 'unshorten_me' | 'direct' | 'urlexpander' | 'original';
  chain: string[];
  wasShortened: boolean;
  expanded: boolean;
  reason?: ExpansionFailureReason;
  error?: string;
}

class DirectExpansionError extends Error {
  constructor(public reason: ExpansionFailureReason, message?: string) {
    super(message ?? reason);
    this.name = 'DirectExpansionError';
  }
}

function failureReasonFrom(
  urlExpanderError: unknown,
  directError: unknown,
): ExpansionFailureReason {
  if (urlExpanderError instanceof Error && urlExpanderError.message.includes('SSRF protection')) {
    return 'ssrf-blocked';
  }
  if (directError instanceof DirectExpansionError) {
    return directError.reason;
  }
  if (urlExpanderError) {
    return 'library-error';
  }
  return 'expansion-failed';
}

function failureMessageFrom(urlExpanderError: unknown, directError: unknown): string {
  if (urlExpanderError instanceof Error && urlExpanderError.message.includes('SSRF protection')) {
    return urlExpanderError.message;
  }
  if (directError instanceof DirectExpansionError) {
    return directError.message;
  }
  if (urlExpanderError instanceof Error) {
    return urlExpanderError.message;
  }
  if (directError instanceof Error) {
    return directError.message;
  }
  return 'Expansion failed';
}

interface UnshortenResponse {
  requested_url?: string;
  resolved_url?: string;
  success?: boolean;
  error?: string;
}

async function resolveWithUnshorten(url: string): Promise<string | null> {
  try {
    const endpoint = config.shortener.unshortenEndpoint.replace(/\/+$/, '');
    const res = await request(`${endpoint}/${encodeURIComponent(url)}`, {
      method: 'GET',
      headersTimeout: 5000,
      bodyTimeout: 5000
    });
    if (res.statusCode >= 400) return null;
    const json = await res.body.json() as UnshortenResponse;
    if (json?.resolved_url && json.success !== false) {
      const normalized = normalizeUrl(json.resolved_url);
      return normalized || json.resolved_url;
    }
    return null;
  } catch {
    return null;
  }
}

type FetchInput = Parameters<typeof undiciFetch>[0];
type SafeFetch = (input: FetchInput, init?: Parameters<typeof undiciFetch>[1]) => ReturnType<typeof undiciFetch>;

function extractTargetUrl(input: FetchInput): string {
  const rawTarget =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input && typeof input === 'object' && 'url' in input && typeof (input as { url?: unknown }).url === 'string'
          ? (input as { url: string }).url
          : undefined;

  if (!rawTarget) {
    throw new DirectExpansionError('expansion-failed', 'Expansion failed: Missing target URL');
  }

  return rawTarget;
}

async function validateAndNormalizeUrl(rawTarget: string, chain: string[]): Promise<string> {
  const normalizedTarget = normalizeUrl(rawTarget) || rawTarget;
  const parsed = new URL(normalizedTarget);

  if (await isPrivateHostname(parsed.hostname)) {
    throw new DirectExpansionError('ssrf-blocked', 'SSRF protection: Private host blocked');
  }

  if (!chain.length || chain[chain.length - 1] !== normalizedTarget) {
    chain.push(normalizedTarget);
  }

  return normalizedTarget;
}

type UndiciResponse = Awaited<ReturnType<typeof undiciFetch>>;

async function checkContentLength(response: UndiciResponse, maxContentLength: number): Promise<void> {
  const contentLengthHeader = response.headers?.get?.('content-length');
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxContentLength) {
      // @ts-ignore - body.cancel is not in the type definition but exists at runtime for undici streams
      response.body?.cancel?.();
      throw new DirectExpansionError('max-content-length', `Content too large: ${contentLength} bytes`);
    }
  }
}

function handleFetchError(error: unknown, timeoutMs: number): never {
  if (error instanceof DirectExpansionError) {
    throw error;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    throw new DirectExpansionError('timeout', `Expansion timed out after ${timeoutMs}ms`);
  }
  throw new DirectExpansionError(
    'http-error',
    error instanceof Error ? error.message : 'Expansion failed',
  );
}

function createGuardedFetch(
  chain: string[],
  maxRedirects: number,
  timeoutMs: number,
  maxContentLength: number,
): SafeFetch {
  let attempts = 0;

  return async (input, init) => {
    const rawTarget = extractTargetUrl(input);
    const normalizedTarget = await validateAndNormalizeUrl(rawTarget, chain);

    if (attempts >= maxRedirects) {
      throw new DirectExpansionError('expansion-failed', `Redirect limit exceeded (${maxRedirects})`);
    }
    attempts += 1;

    try {
      const response = await undiciFetch(normalizedTarget, {
        ...init,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });

      await checkContentLength(response, maxContentLength);
      return response;
    } catch (error) {
      handleFetchError(error, timeoutMs);
    }
  };
}

async function processRedirectResponse(response: UndiciResponse, normalized: string, chain: string[]): Promise<{ nextUrl?: string; result?: { finalUrl: string; chain: string[] } }> {
  const location = response.headers?.get?.('location');
  if (response.status >= 300 && response.status < 400) {
    if (!location) {
      // @ts-ignore
      response.body?.cancel?.();
      return { result: { finalUrl: normalized, chain } };
    }
    // @ts-ignore
    response.body?.cancel?.();
    return { nextUrl: new URL(location, normalized).toString() };
  }

  // @ts-ignore
  response.body?.cancel?.();
  return { result: { finalUrl: normalized, chain } };
}

async function fetchAndValidateUrl(normalized: string, timeoutMs: number, maxContentLength: number): Promise<UndiciResponse | null> {
  const response = await undiciFetch(normalized, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentLengthHeader = response.headers?.get?.('content-length');
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxContentLength) {
      // @ts-ignore
      response.body?.cancel?.();
      throw new DirectExpansionError('max-content-length', `Content too large: ${contentLength} bytes`);
    }
  }

  if (response.status >= 400) {
    if (response.status >= 500) {
      // @ts-ignore
      response.body?.cancel?.();
      throw new DirectExpansionError('http-error', `Expansion request failed with status ${response.status}`);
    }
    return null;
  }

  return response;
}

async function resolveDirectly(url: string): Promise<{ finalUrl: string; chain: string[] } | null> {
  const { maxRedirects, timeoutMs, maxContentLength } = config.orchestrator.expansion;
  let current = url;
  const chain: string[] = [];

  for (let i = 0; i < maxRedirects; i += 1) {
    const normalized = normalizeUrl(current) || current;
    if (!normalized) break;

    const parsed = new URL(normalized);
    if (await isPrivateHostname(parsed.hostname)) {
      throw new DirectExpansionError('ssrf-blocked', 'SSRF protection: Private host blocked');
    }

    if (!chain.length || chain[chain.length - 1] !== normalized) {
      chain.push(normalized);
    }

    try {
      const response = await fetchAndValidateUrl(normalized, timeoutMs, maxContentLength);
      if (!response) return null;

      const { nextUrl, result } = await processRedirectResponse(response, normalized, chain);
      if (result) return result;
      if (nextUrl) {
        current = nextUrl;
        continue;
      }
    } catch (error) {
      if (error instanceof DirectExpansionError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DirectExpansionError('timeout', `Expansion timed out after ${timeoutMs}ms`);
      }
      throw new DirectExpansionError(
        'http-error',
        error instanceof Error ? error.message : 'Expansion failed',
      );
    }
  }

  return chain.length ? { finalUrl: chain[chain.length - 1], chain } : null;
}

function getUrlExpandModule() {
  const moduleUnknown = urlExpandModuleRaw as unknown;
  const moduleAny = moduleUnknown as { expand?: unknown };
  const modernExpand: ((shortUrl: string, options: { fetch: SafeFetch; maxRedirects: number; timeoutMs: number }) => Promise<{ url: string; redirects?: string[] }>) | undefined =
    typeof moduleAny?.expand === 'function' ? (moduleAny.expand as typeof modernExpand) : undefined;

  const legacyExpand = typeof moduleAny === 'function'
    ? promisify(moduleAny as (shortUrl: string, callback: (error: unknown, expandedUrl?: string | null) => void) => void)
    : undefined;

  return { modernExpand, legacyExpand };
}

async function processModernExpandResult(result: { url: string; redirects?: string[] }, chain: string[]): Promise<{ finalUrl: string; chain: string[] }> {
  if (Array.isArray(result.redirects)) {
    for (const redirect of result.redirects) {
      const normalizedRedirect = normalizeUrl(redirect) || redirect;
      if (chain[chain.length - 1] !== normalizedRedirect) {
        chain.push(normalizedRedirect);
      }
    }
  }

  const finalUrl = normalizeUrl(result.url) || result.url;
  if (chain[chain.length - 1] !== finalUrl) {
    chain.push(finalUrl);
  }

  return { finalUrl, chain };
}

async function processLegacyExpandResult(expandedUrl: string, chain: string[]): Promise<{ finalUrl: string; chain: string[] }> {
  if (!expandedUrl) {
    throw new Error('url-expand returned empty response');
  }

  const normalizedFinal = normalizeUrl(expandedUrl) || expandedUrl;

  let parsedFinal: URL;
  try {
    parsedFinal = new URL(normalizedFinal);
  } catch {
    throw new Error('url-expand returned invalid URL');
  }

  if (await isPrivateHostname(parsedFinal.hostname)) {
    throw new DirectExpansionError('ssrf-blocked', 'SSRF protection: Private host blocked');
  }

  if (chain[chain.length - 1] !== normalizedFinal) {
    chain.push(normalizedFinal);
  }

  return { finalUrl: normalizedFinal, chain };
}

async function resolveWithUrlExpand(url: string): Promise<{ finalUrl: string; chain: string[] }> {
  const { maxRedirects, timeoutMs, maxContentLength } = config.orchestrator.expansion;
  const normalizedInput = normalizeUrl(url) || url;
  const chain: string[] = [normalizedInput];

  const { modernExpand, legacyExpand } = getUrlExpandModule();

  if (modernExpand) {
    const fetchWithGuards = createGuardedFetch(chain, maxRedirects, timeoutMs, maxContentLength);
    const result = await modernExpand(normalizedInput, {
      fetch: fetchWithGuards,
      maxRedirects,
      timeoutMs,
    });

    return processModernExpandResult(result, chain);
  }

  if (!legacyExpand) {
    throw new Error('url-expand module does not expose a supported interface');
  }

  const expandedUrl = await legacyExpand(normalizedInput) as string;
  return processLegacyExpandResult(expandedUrl, chain);
}

export async function resolveShortener(url: string): Promise<ShortenerResolution> {
  const normalized = normalizeUrl(url);
  const chain: string[] = [];
  if (!normalized) {
    return { finalUrl: url, provider: 'original', chain, wasShortened: false, expanded: false };
  }
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (!isKnownShortener(hostname)) {
    return { finalUrl: normalized, provider: 'original', chain, wasShortened: false, expanded: false };
  }

  const tries = Math.max(1, config.shortener.unshortenRetries);
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const resolved = await resolveWithUnshorten(normalized);
    if (resolved) {
      metrics.shortenerExpansion.labels('unshorten.me', 'success').inc();
      return {
        finalUrl: resolved,
        provider: 'unshorten_me',
        chain: [normalized, resolved],
        wasShortened: true,
        expanded: normalized !== resolved,
      };
    }
  }
  metrics.shortenerExpansion.labels('unshorten.me', 'error').inc();

  let directResult: { finalUrl: string; chain: string[] } | null = null;
  let directError: unknown;
  try {
    directResult = await resolveDirectly(normalized);
  } catch (error) {
    directError = error;
    metrics.shortenerExpansion.labels('direct', 'error').inc();
  }

  if (directResult) {
    metrics.shortenerExpansion.labels('direct', 'success').inc();
    return {
      finalUrl: directResult.finalUrl,
      provider: 'direct',
      chain: directResult.chain,
      wasShortened: true,
      expanded: directResult.chain.length > 1 || directResult.finalUrl !== normalized,
    };
  }

  try {
    const expanded = await resolveWithUrlExpand(normalized);
    metrics.shortenerExpansion.labels('urlexpander', 'success').inc();
    return {
      finalUrl: expanded.finalUrl,
      provider: 'urlexpander',
      chain: expanded.chain,
      wasShortened: true,
      expanded: expanded.chain.length > 1 || expanded.finalUrl !== normalized,
    };
  } catch (error) {
    metrics.shortenerExpansion.labels('urlexpander', 'error').inc();
    return {
      finalUrl: normalized,
      provider: 'original',
      chain: [normalized],
      wasShortened: true,
      expanded: false,
      reason: failureReasonFrom(error, directError),
      error: failureMessageFrom(error, directError),
    };
  }
}

```

# File: packages/shared/src/url.ts

```typescript
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { isPrivateHostname } from './ssrf';
import { request } from 'undici';
import { toASCII } from 'punycode/';
import { parse } from 'tldts';
import { isKnownShortener } from './url-shortener';

const TRACKING_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'vero_conv', 'vero_id']);

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /((https?:\/\/|www\.)[^\s<>()]+[^\s`!()\[\]{};:'".,<>?«»“”‘’])/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map(m => m.startsWith('http') ? m : `http://${m}`)));
}

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hostname = u.hostname.toLowerCase();
    // IDN -> ASCII
    u.hostname = toASCII(u.hostname);
    // strip default ports
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }
    // strip fragments
    u.hash = '';
    // strip tracking params
    for (const p of Array.from(u.searchParams.keys())) {
      if (TRACKING_PARAMS.has(p)) u.searchParams.delete(p);
    }
    // normalize path
    u.pathname = u.pathname.replace(/\/+/g, '/');
    return u.toString();
  } catch {
    return null;
  }
}

export function urlHash(norm: string): string {
  return createHash('sha256').update(norm).digest('hex');
}

export async function expandUrl(raw: string, opts: { maxRedirects: number; timeoutMs: number; maxContentLength: number; }): Promise<{ finalUrl: string; chain: string[]; contentType?: string; }> {
  const chain: string[] = [];
  let current = raw;
  for (let i = 0; i < opts.maxRedirects; i++) {
    const nu = normalizeUrl(current);
    if (!nu) break;
    const u = new URL(nu);
    if (await isPrivateHostname(u.hostname)) break; // SSRF block
    const { statusCode, headers } = await request(u, {
      method: 'HEAD',
      maxRedirections: 0,
      headersTimeout: opts.timeoutMs,
      bodyTimeout: opts.timeoutMs,
      headers: { 'user-agent': 'wbscanner/0.1' }
    }).catch(() => ({ statusCode: 0, headers: {} as Record<string, unknown> }));
    chain.push(nu);
    if (statusCode && statusCode >= 300 && statusCode < 400) {
      const loc = headers['location'];
      if (!loc) break;
      current = new URL(loc as string, u).toString();
      continue;
    }
    const ct = Array.isArray(headers['content-type']) ? headers['content-type'][0] : headers['content-type'];
    return { finalUrl: nu, chain, contentType: ct as string | undefined };
  }
  const nu = normalizeUrl(current) || current;
  return { finalUrl: nu, chain };
}

export function isSuspiciousTld(hostname: string): boolean {
  const t = parse(hostname);
  const bad = new Set(['zip', 'mov', 'tk', 'ml', 'cf', 'gq', 'work', 'click', 'country', 'kim', 'men', 'party', 'science', 'top', 'xyz', 'club', 'link']);
  return !!t.publicSuffix && bad.has(t.publicSuffix);
}

export function isShortener(hostname: string): boolean {
  return isKnownShortener(hostname);
}

function parseForbiddenPatterns(): string[] {
  return (process.env.WA_FORBIDDEN_HOSTNAMES || '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(entry => entry.length > 0);
}

export async function isForbiddenHostname(hostname: string): Promise<boolean> {
  const patterns = parseForbiddenPatterns();
  if (patterns.length === 0) return false;

  const lowerHost = hostname.toLowerCase();
  return patterns.some(pattern => lowerHost === pattern || lowerHost.endsWith(`.${pattern}`));
}

```

# File: packages/shared/src/metrics.ts

```typescript
import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const metrics = {
  ingestionRate: new client.Counter({
    name: 'wbscanner_messages_ingested_total',
    help: 'Total messages ingested',
    registers: [register],
  }),
  urlsPerMessage: new client.Histogram({
    name: 'wbscanner_urls_per_message',
    help: 'URLs extracted per message',
    buckets: [0, 1, 2, 3, 5, 8, 13],
    registers: [register],
  }),
  scanLatency: new client.Histogram({
    name: 'wbscanner_scan_latency_seconds',
    help: 'End-to-end scan latency',
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [register],
  }),
  cacheHit: new client.Counter({
    name: 'wbscanner_cache_hits_total',
    help: 'Cache hits',
    registers: [register],
  }),
  cacheMiss: new client.Counter({
    name: 'wbscanner_cache_misses_total',
    help: 'Cache misses',
    registers: [register],
  }),
  vtSubmissions: new client.Counter({
    name: 'wbscanner_vt_submissions_total',
    help: 'VirusTotal submissions',
    registers: [register],
  }),
  gsbHits: new client.Counter({
    name: 'wbscanner_gsb_hits_total',
    help: 'Google Safe Browsing hits',
    registers: [register],
  }),
  phishtankSecondaryChecks: new client.Counter({
    name: 'wbscanner_phishtank_secondary_checks_total',
    help: 'Phishtank secondary checks executed when GSB is inconclusive',
    registers: [register],
  }),
  phishtankSecondaryHits: new client.Counter({
    name: 'wbscanner_phishtank_secondary_hits_total',
    help: 'Phishtank hits observed during secondary checks, partitioned by verification status',
    labelNames: ['verified'],
    registers: [register],
  }),
  shortenerExpansion: new client.Counter({
    name: 'wbscanner_shortener_expansions_total',
    help: 'URL shortener expansion attempts by method and result',
    labelNames: ['method', 'result'],
    registers: [register],
  }),
  manualOverrideApplied: new client.Counter({
    name: 'wbscanner_manual_overrides_total',
    help: 'Manual overrides applied during scoring',
    labelNames: ['status'],
    registers: [register],
  }),
  rescanRequests: new client.Counter({
    name: 'wbscanner_rescan_requests_total',
    help: 'Rescan requests received by source',
    labelNames: ['source'],
    registers: [register],
  }),
  artifactDownloadFailures: new client.Counter({
    name: 'wbscanner_artifact_download_failures_total',
    help: 'Failures when downloading urlscan artifacts',
    labelNames: ['type', 'reason'],
    registers: [register],
  }),
  homoglyphDetections: new client.Counter({
    name: 'wbscanner_homoglyph_detections_total',
    help: 'Homoglyph detections by risk level',
    labelNames: ['risk_level'],
    registers: [register],
  }),
  whoisRequests: new client.Counter({
    name: 'wbscanner_whois_requests_total',
    help: 'WhoisXML lookups executed',
    registers: [register],
  }),
  whoisResults: new client.Counter({
    name: 'wbscanner_whois_results_total',
    help: 'WhoisXML lookup outcomes by result',
    labelNames: ['result'],
    registers: [register],
  }),
  whoisDisabled: new client.Counter({
    name: 'wbscanner_whois_disabled_total',
    help: 'WhoisXML disabled events by reason',
    labelNames: ['reason'],
    registers: [register],
  }),
  verdictCounter: new client.Counter({
    name: 'wbscanner_verdicts_total',
    help: 'Verdicts issued by level',
    labelNames: ['level'],
    registers: [register],
  }),
  degradedModeEvents: new client.Counter({
    name: 'wbscanner_degraded_mode_events_total',
    help: 'Scans processed while operating in degraded mode',
    registers: [register],
  }),
  externalScannersDegraded: new client.Gauge({
    name: 'wbscanner_external_scanners_degraded',
    help: 'Indicates if all external scanners are degraded (1) or operational (0)',
    registers: [register],
  }),
  cacheLookupDuration: new client.Histogram({
    name: 'wbscanner_cache_lookup_duration_seconds',
    help: 'Latency of cache lookups by cache type',
    labelNames: ['cache_type'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    registers: [register],
  }),
  cacheWriteDuration: new client.Histogram({
    name: 'wbscanner_cache_write_duration_seconds',
    help: 'Latency of cache writes by cache type',
    labelNames: ['cache_type'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    registers: [register],
  }),
  cacheEntryBytes: new client.Gauge({
    name: 'wbscanner_cache_entry_bytes',
    help: 'Serialized cache entry size by cache type',
    labelNames: ['cache_type'],
    registers: [register],
  }),
  cacheRefreshTotal: new client.Counter({
    name: 'wbscanner_cache_refresh_total',
    help: 'Cache refresh operations by cache type',
    labelNames: ['cache_type'],
    registers: [register],
  }),
  cacheStaleTotal: new client.Counter({
    name: 'wbscanner_cache_stale_total',
    help: 'Cache hits considered stale by cache type',
    labelNames: ['cache_type'],
    registers: [register],
  }),
  cacheEntryTtl: new client.Gauge({
    name: 'wbscanner_cache_entry_ttl_seconds',
    help: 'Remaining TTL for cache entries by cache type',
    labelNames: ['cache_type'],
    registers: [register],
  }),
  verdictScore: new client.Histogram({
    name: 'wbscanner_verdict_score',
    help: 'Distribution of computed risk scores',
    buckets: [0, 2, 4, 6, 8, 10, 12, 15, 20],
    registers: [register],
  }),
  verdictReasons: new client.Counter({
    name: 'wbscanner_verdict_reasons_total',
    help: 'Reasons contributing to final verdicts',
    labelNames: ['reason'],
    registers: [register],
  }),
  verdictSignals: new client.Counter({
    name: 'wbscanner_verdict_signals_total',
    help: 'Signals observed while composing verdicts',
    labelNames: ['signal'],
    registers: [register],
  }),
  verdictLatency: new client.Histogram({
    name: 'wbscanner_verdict_latency_seconds',
    help: 'Latency from ingestion to verdict emission',
    buckets: [0.5, 1, 2, 5, 10, 20, 40, 80],
    registers: [register],
  }),
  verdictCacheTtl: new client.Histogram({
    name: 'wbscanner_verdict_cache_ttl_seconds',
    help: 'Cache TTL assigned to verdict responses',
    buckets: [300, 900, 1800, 3600, 7200, 14400, 28800, 86400],
    registers: [register],
  }),
  verdictEscalations: new client.Counter({
    name: 'wbscanner_verdict_escalations_total',
    help: 'Verdict transitions compared to cached decision',
    labelNames: ['from', 'to'],
    registers: [register],
  }),
  queueJobWait: new client.Histogram({
    name: 'wbscanner_queue_job_wait_seconds',
    help: 'Time jobs spend waiting in queue before execution',
    labelNames: ['queue'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
    registers: [register],
  }),
  queueProcessingDuration: new client.Histogram({
    name: 'wbscanner_queue_processing_duration_seconds',
    help: 'Job processing duration per queue',
    labelNames: ['queue'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 40, 80],
    registers: [register],
  }),
  queueCompleted: new client.Counter({
    name: 'wbscanner_queue_completed_total',
    help: 'Jobs completed by queue',
    labelNames: ['queue'],
    registers: [register],
  }),
  queueRetries: new client.Counter({
    name: 'wbscanner_queue_retries_total',
    help: 'Retry attempts by queue',
    labelNames: ['queue'],
    registers: [register],
  }),
  queueFailures: new client.Counter({
    name: 'wbscanner_queue_failures_total',
    help: 'Failed jobs by queue',
    labelNames: ['queue'],
    registers: [register],
  }),
  queueActive: new client.Gauge({
    name: 'wbscanner_queue_active_jobs',
    help: 'Active jobs per queue',
    labelNames: ['queue'],
    registers: [register],
  }),
  queueDelayed: new client.Gauge({
    name: 'wbscanner_queue_delayed_jobs',
    help: 'Delayed jobs per queue',
    labelNames: ['queue'],
    registers: [register],
  }),
  queueFailedGauge: new client.Gauge({
    name: 'wbscanner_queue_failed_jobs',
    help: 'Failed job backlog per queue',
    labelNames: ['queue'],
    registers: [register],
  }),
  waMessagesReceived: new client.Counter({
    name: 'wbscanner_wa_messages_received_total',
    help: 'WhatsApp messages received by chat type',
    labelNames: ['chat_type'],
    registers: [register],
  }),
  waMessagesWithUrls: new client.Counter({
    name: 'wbscanner_wa_messages_with_urls_total',
    help: 'WhatsApp messages containing URLs',
    labelNames: ['chat_type'],
    registers: [register],
  }),
  waMessagesDropped: new client.Counter({
    name: 'wbscanner_wa_messages_dropped_total',
    help: 'WhatsApp messages dropped before scanning by reason',
    labelNames: ['reason'],
    registers: [register],
  }),
  waSessionReconnects: new client.Counter({
    name: 'wbscanner_wa_session_events_total',
    help: 'WhatsApp client session lifecycle events',
    labelNames: ['event'],
    registers: [register],
  }),
  waQrCodesGenerated: new client.Counter({
    name: 'wbscanner_wa_qr_generated_total',
    help: 'QR codes generated for WhatsApp reauthentication',
    registers: [register],
  }),
  waVerdictsSent: new client.Counter({
    name: 'wbscanner_wa_verdict_messages_sent_total',
    help: 'Verdict messages sent back to WhatsApp groups',
    registers: [register],
  }),
  waVerdictFailures: new client.Counter({
    name: 'wbscanner_wa_verdict_messages_failed_total',
    help: 'Failed attempts to send verdict messages',
    registers: [register],
  }),
  waVerdictLatency: new client.Histogram({
    name: 'wbscanner_wa_verdict_delivery_latency_seconds',
    help: 'Latency between verdict availability and WhatsApp delivery',
    buckets: [0.5, 1, 2, 5, 10, 20, 40],
    registers: [register],
  }),
  waMessageEdits: new client.Counter({
    name: 'wbscanner_wa_message_edits_total',
    help: 'WhatsApp message edit events handled by cause',
    labelNames: ['cause'],
    registers: [register],
  }),
  waMessageRevocations: new client.Counter({
    name: 'wbscanner_wa_message_revocations_total',
    help: 'WhatsApp message revocation events by scope',
    labelNames: ['scope'],
    registers: [register],
  }),
  waMessageReactions: new client.Counter({
    name: 'wbscanner_wa_message_reactions_total',
    help: 'WhatsApp message reaction events grouped by reaction emoji',
    labelNames: ['reaction'],
    registers: [register],
  }),
  waVerdictAckTransitions: new client.Counter({
    name: 'wbscanner_wa_verdict_ack_transitions_total',
    help: 'Ack transitions observed for verdict messages',
    labelNames: ['from', 'to'],
    registers: [register],
  }),
  waVerdictAckTimeouts: new client.Counter({
    name: 'wbscanner_wa_verdict_ack_timeouts_total',
    help: 'Verdict delivery attempts that exceeded ack thresholds',
    labelNames: ['reason'],
    registers: [register],
  }),
  waVerdictRetryAttempts: new client.Counter({
    name: 'wbscanner_wa_verdict_retries_total',
    help: 'Verdict resend attempts by outcome',
    labelNames: ['outcome'],
    registers: [register],
  }),
  waVerdictDelivery: new client.Counter({
    name: 'wbscanner_wa_verdict_delivery_total',
    help: 'Verdict delivery outcomes recorded by result',
    labelNames: ['outcome'],
    registers: [register],
  }),
  waVerdictDeliveryRetries: new client.Counter({
    name: 'wbscanner_wa_verdict_delivery_retries_total',
    help: 'Verdict resend attempts triggered by ack workflows',
    labelNames: ['reason'],
    registers: [register],
  }),
  waVerdictAttachmentsSent: new client.Counter({
    name: 'wbscanner_wa_verdict_attachments_total',
    help: 'Media attachments delivered alongside verdicts by type',
    labelNames: ['type'],
    registers: [register],
  }),
  waGroupEvents: new client.Counter({
    name: 'wbscanner_wa_group_events_total',
    help: 'Group lifecycle and governance events observed',
    labelNames: ['event'],
    registers: [register],
  }),
  waGovernanceActions: new client.Counter({
    name: 'wbscanner_wa_governance_actions_total',
    help: 'Group governance interventions executed by action',
    labelNames: ['action'],
    registers: [register],
  }),
  waGovernanceRateLimited: new client.Counter({
    name: 'wbscanner_wa_governance_rate_limited_total',
    help: 'Governance actions skipped due to rate limiting by action',
    labelNames: ['action'],
    registers: [register],
  }),
  waMembershipApprovals: new client.Counter({
    name: 'wbscanner_wa_membership_approvals_total',
    help: 'Membership approvals handled by mode',
    labelNames: ['mode'],
    registers: [register],
  }),
  waConsentGauge: new client.Gauge({
    name: 'wbscanner_wa_group_consent_pending',
    help: 'Number of WhatsApp groups awaiting consent acknowledgment',
    registers: [register],
  }),
  waSessionState: new client.Gauge({
    name: 'wbscanner_wa_session_state',
    help: 'Current WhatsApp client state indicator (1 for current state, 0 otherwise)',
    labelNames: ['state'],
    registers: [register],
  }),
  waStateChanges: new client.Counter({
    name: 'wbscanner_wa_state_changes_total',
    help: 'WhatsApp state transition events emitted by wa-client',
    labelNames: ['event', 'state'],
    registers: [register],
  }),
  waConsecutiveAuthFailures: new client.Gauge({
    name: 'wbscanner_wa_auth_consecutive_failures',
    help: 'Count of consecutive authentication failures per client instance',
    labelNames: ['client'],
    registers: [register],
  }),
  waIncomingCalls: new client.Counter({
    name: 'wbscanner_wa_incoming_calls_total',
    help: 'Incoming WhatsApp calls handled by action',
    labelNames: ['action'],
    registers: [register],
  }),
  apiQuotaConsumption: new client.Counter({
    name: 'wbscanner_api_quota_consumption_total',
    help: 'API quota tokens consumed by service',
    labelNames: ['service'],
    registers: [register],
  }),
  apiQuotaResets: new client.Counter({
    name: 'wbscanner_api_quota_resets_total',
    help: 'API quota reset events by service',
    labelNames: ['service'],
    registers: [register],
  }),
  apiQuotaProjectedDepletion: new client.Gauge({
    name: 'wbscanner_api_quota_projected_depletion_seconds',
    help: 'Projected seconds until quota depletion by service',
    labelNames: ['service'],
    registers: [register],
  }),
  apiQuotaUtilization: new client.Gauge({
    name: 'wbscanner_api_quota_utilization_ratio',
    help: 'Fraction of quota consumed by service',
    labelNames: ['service'],
    registers: [register],
  }),

};

export const externalLatency = new client.Histogram({
  name: 'wbscanner_external_api_latency_seconds',
  help: 'External API latency by service',
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  labelNames: ['service'],
  registers: [register],
});

export const externalErrors = new client.Counter({
  name: 'wbscanner_external_api_errors_total',
  help: 'External API errors by service and type',
  labelNames: ['service', 'reason'],
  registers: [register],
});

export const circuitStates = new client.Gauge({
  name: 'wbscanner_circuit_breaker_state',
  help: 'Circuit breaker state per external service (0=closed,1=open,2=half-open)',
  labelNames: ['service'],
  registers: [register],
});

export const rateLimiterDelay = new client.Histogram({
  name: 'wbscanner_rate_limiter_delay_seconds',
  help: 'Delay introduced by rate limiters before external API calls',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  labelNames: ['service'],
  registers: [register],
});

export const apiQuotaRemainingGauge = new client.Gauge({
  name: 'wbscanner_api_quota_remaining',
  help: 'Remaining API quota tokens for external services',
  labelNames: ['service'],
  registers: [register],
});

export const apiQuotaStatusGauge = new client.Gauge({
  name: 'wbscanner_api_quota_status',
  help: 'API quota status (1=available,0=exhausted)',
  labelNames: ['service'],
  registers: [register],
});

export const apiQuotaDepletedCounter = new client.Counter({
  name: 'wbscanner_api_quota_depleted_total',
  help: 'Total number of times an external service quota was depleted',
  labelNames: ['service'],
  registers: [register],
});

export const cacheHitRatioGauge = new client.Gauge({
  name: 'wbscanner_cache_hit_ratio',
  help: 'Cache hit ratio by cache type',
  labelNames: ['cache_type'],
  registers: [register],
});

export const queueDepthGauge = new client.Gauge({
  name: 'wbscanner_queue_depth',
  help: 'Queue depth for BullMQ queues',
  labelNames: ['queue'],
  registers: [register],
});

export const circuitBreakerTransitionCounter = new client.Counter({
  name: 'wbscanner_circuit_breaker_transitions_total',
  help: 'Circuit breaker state transitions by service',
  labelNames: ['service', 'from', 'to'],
  registers: [register],
});

export const waSessionStatusGauge = new client.Gauge({
  name: 'wbscanner_wa_session_status',
  help: 'WhatsApp session status (1=ready,0=disconnected)',
  labelNames: ['state'],
  registers: [register],
});

export const circuitBreakerRejections = new client.Counter({
  name: 'wbscanner_circuit_breaker_rejections_total',
  help: 'Requests rejected due to open circuit breakers by service',
  labelNames: ['service'],
  registers: [register],
});

export const circuitBreakerOpenDuration = new client.Histogram({
  name: 'wbscanner_circuit_breaker_open_duration_seconds',
  help: 'Duration circuits remain open before recovery',
  labelNames: ['service'],
  buckets: [5, 10, 30, 60, 120, 300, 600, 1200],
  registers: [register],
});

export const rateLimiterQueueDepth = new client.Gauge({
  name: 'wbscanner_rate_limiter_queue_depth',
  help: 'Jobs queued inside external API rate limiters',
  labelNames: ['service'],
  registers: [register],
});

export function metricsRoute() {
  // Using minimal types to avoid Express dependency in shared package
  return async (_req: { header?: unknown }, res: { header: (name: string, value: string) => void; send: (data: string) => void }) => {
    res.header('Content-Type', register.contentType);
    res.send(await register.metrics());
  };
}

```

# File: packages/shared/src/reputation/advanced-heuristics.ts

```typescript
import { logger } from '../log';

export interface SubdomainAnalysis {
  count: number;
  maxDepth: number;
  hasNumericSubdomains: boolean;
  suspicionScore: number;
}

export interface AdvancedHeuristicsResult {
  score: number;
  reasons: string[];
  entropy: number;
  subdomainAnalysis: SubdomainAnalysis;
  suspiciousPatterns: string[];
}

export async function advancedHeuristics(url: string): Promise<AdvancedHeuristicsResult> {
  const result: AdvancedHeuristicsResult = {
    score: 0,
    reasons: [],
    entropy: 0,
    subdomainAnalysis: {
      count: 0,
      maxDepth: 0,
      hasNumericSubdomains: false,
      suspicionScore: 0,
    },
    suspiciousPatterns: [],
  };

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const pathname = parsed.pathname;
    const fullUrl = url;

    // Shannon entropy analysis
    result.entropy = calculateShannonEntropy(hostname);
    if (result.entropy > 4.5) {
      result.score += 0.6;
      result.reasons.push('High entropy in hostname (possible DGA)');
    }

    // Subdomain analysis
    result.subdomainAnalysis = analyzeSubdomains(hostname);
    result.score += result.subdomainAnalysis.suspicionScore;
    if (result.subdomainAnalysis.suspicionScore > 0) {
      result.reasons.push('Suspicious subdomain structure');
    }

    // Keyboard walk detection
    const keyboardWalk = detectKeyboardWalk(hostname);
    if (keyboardWalk) {
      result.score += 0.4;
      result.reasons.push('Keyboard walk pattern detected');
      result.suspiciousPatterns.push('keyboard_walk');
    }

    // Suspicious character patterns
    const suspiciousChars = detectSuspiciousCharacters(fullUrl);
    if (suspiciousChars.length > 0) {
      result.score += 0.3 * suspiciousChars.length;
      result.reasons.push(`Suspicious characters: ${suspiciousChars.join(', ')}`);
      result.suspiciousPatterns.push(...suspiciousChars);
    }

    // URL length analysis
    if (fullUrl.length > 200) {
      result.score += 0.3;
      result.reasons.push('Unusually long URL');
    }

    // Path depth analysis
    const pathDepth = pathname.split('/').filter(Boolean).length;
    if (pathDepth > 8) {
      result.score += 0.2;
      result.reasons.push('Deep path structure');
    }

    // Suspicious TLD patterns
    const tld = hostname.split('.').pop()?.toLowerCase();
    const suspiciousTlds = ['tk', 'ml', 'ga', 'cf', 'click', 'download'];
    if (tld && suspiciousTlds.includes(tld)) {
      result.score += 0.4;
      result.reasons.push(`Suspicious TLD: .${tld}`);
    }

    // Homograph detection (basic)
    const homographs = detectBasicHomographs(hostname);
    if (homographs.length > 0) {
      result.score += 0.5;
      result.reasons.push('Potential homograph attack');
      result.suspiciousPatterns.push('homograph');
    }

    return result;
  } catch (err) {
    logger.warn({ url, err }, 'Advanced heuristics analysis failed');
    return result;
  }
}

function calculateShannonEntropy(str: string): number {
  const freq: { [key: string]: number } = {};
  
  // Count character frequencies
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;

  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

function analyzeSubdomains(hostname: string): SubdomainAnalysis {
  const parts = hostname.split('.');
  const subdomains = parts.slice(0, -2); // Remove domain and TLD
  
  const analysis: SubdomainAnalysis = {
    count: subdomains.length,
    maxDepth: subdomains.length,
    hasNumericSubdomains: false,
    suspicionScore: 0,
  };

  // Check for numeric subdomains
  analysis.hasNumericSubdomains = subdomains.some(sub => /^\d+$/.test(sub));
  if (analysis.hasNumericSubdomains) {
    analysis.suspicionScore += 0.3;
  }

  // Excessive subdomain depth
  if (analysis.count > 4) {
    analysis.suspicionScore += 0.4;
  }

  // Very long subdomains
  const longSubdomains = subdomains.filter(sub => sub.length > 20);
  if (longSubdomains.length > 0) {
    analysis.suspicionScore += 0.3;
  }

  return analysis;
}

function detectKeyboardWalk(str: string): boolean {
  const keyboardRows = [
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
    '1234567890',
  ];

  for (const row of keyboardRows) {
    for (let i = 0; i <= row.length - 4; i++) {
      const pattern = row.slice(i, i + 4);
      if (str.toLowerCase().includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

function detectSuspiciousCharacters(url: string): string[] {
  const suspicious: string[] = [];

  // Multiple consecutive hyphens
  if (/-{2,}/.test(url)) {
    suspicious.push('multiple_hyphens');
  }

  // Mixed scripts (basic check)
  if (/[а-я]/.test(url) && /[a-z]/.test(url)) {
    suspicious.push('mixed_scripts');
  }

  // Unusual Unicode characters
  if (/[^\x00-\x7F]/.test(url)) {
    suspicious.push('unicode_chars');
  }

  // Excessive dots
  if ((url.match(/\./g) || []).length > 8) {
    suspicious.push('excessive_dots');
  }

  return suspicious;
}

function detectBasicHomographs(hostname: string): string[] {
  const homographs: string[] = [];

  // Common homograph substitutions
  const substitutions = {
    'a': ['а', 'à', 'á', 'â', 'ã', 'ä', 'å'],
    'e': ['е', 'è', 'é', 'ê', 'ë'],
    'o': ['о', 'ò', 'ó', 'ô', 'õ', 'ö'],
    'p': ['р'],
    'c': ['с'],
    'x': ['х'],
  };

  for (const [latin, variants] of Object.entries(substitutions)) {
    for (const variant of variants) {
      if (hostname.includes(variant)) {
        homographs.push(`${latin}->${variant}`);
      }
    }
  }

  return homographs;
}
```

# File: packages/shared/src/reputation/certificate-intelligence.ts

```typescript
import { request } from 'undici';
import { logger } from '../log';
import tls from 'tls';

export interface CertificateAnalysis {
  isValid: boolean;
  isSelfSigned: boolean;
  issuer: string;
  age: number; // days since issued
  expiryDays: number; // days until expiry
  sanCount: number; // Subject Alternative Names count
  chainValid: boolean;
  ctLogPresent: boolean; // Certificate Transparency log presence
  suspicionScore: number;
  reasons: string[];
}

interface CertificateIntelligenceOptions {
  timeoutMs?: number;
  ctCheckEnabled?: boolean;
}

interface CertificateInfo {
  issuer?: { CN?: string };
  subject?: { CN?: string };
  valid_from?: string;
  valid_to?: string;
  subjectaltname?: string;
}

export async function certificateIntelligence(
  hostname: string,
  options: CertificateIntelligenceOptions = {}
): Promise<CertificateAnalysis> {
  const { timeoutMs = 3000, ctCheckEnabled = true } = options;

  const result: CertificateAnalysis = {
    isValid: true,
    isSelfSigned: false,
    issuer: 'unknown',
    age: 0,
    expiryDays: 0,
    sanCount: 0,
    chainValid: true,
    ctLogPresent: true,
    suspicionScore: 0,
    reasons: [],
  };

  try {
    const { certInfo, isValidCert } = await fetchCertificateInfo(hostname, timeoutMs);

    if (certInfo) {
      analyzeCertificateProperties(certInfo, result);
      updateValidationStatus(isValidCert, result);
      checkSuspiciousPatterns(result);

      if (ctCheckEnabled) {
        await checkCertificateTransparency(hostname, result);
      }
    }

    return result;
  } catch (err) {
    logger.warn({ hostname, err }, 'Certificate analysis failed');
    result.isValid = false;
    result.suspicionScore += 0.5;
    result.reasons.push('Certificate analysis failed');
    return result;
  }
}

async function fetchCertificateInfo(
  hostname: string,
  timeoutMs: number
): Promise<{ certInfo: unknown; isValidCert: boolean }> {
  try {
    // First attempt with certificate validation enabled for security
    const certInfo = await getCertificateWithValidation(hostname, timeoutMs);
    return { certInfo, isValidCert: true };
  } catch (validCertError) {
    // If validation fails, try again without validation to analyze the invalid cert
    logger.debug({ hostname, err: validCertError }, 'Certificate validation failed, attempting to analyze invalid certificate');
    const certInfo = await getCertificateWithoutValidation(hostname, timeoutMs);
    return { certInfo, isValidCert: false };
  }
}

async function getCertificateWithValidation(hostname: string, timeoutMs: number): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Certificate check timeout'));
    }, timeoutMs);

    const socket = tls.connect(443, hostname, {
      servername: hostname,
      rejectUnauthorized: true, // Secure by default
      checkServerIdentity: tls.checkServerIdentity, // Explicit hostname verification
    }, () => {
      clearTimeout(timeout);
      const cert = socket.getPeerCertificate(true);
      socket.destroy();
      resolve(cert);
    });

    socket.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function getCertificateWithoutValidation(hostname: string, timeoutMs: number): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Certificate check timeout'));
    }, timeoutMs);

    const socket = tls.connect(443, hostname, {
      servername: hostname,
      rejectUnauthorized: false, // skip-check: JS-S1017 // NOSONAR Only bypass validation to analyze invalid certs
      checkServerIdentity: (servername, cert) => {
        // Still perform hostname verification even when bypassing cert validation
        // This allows us to detect hostname mismatches in invalid certificates
        return tls.checkServerIdentity(servername, cert);
      },
    }, () => {
      clearTimeout(timeout);
      const cert = socket.getPeerCertificate(true);
      socket.destroy();
      resolve(cert);
    });

    socket.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function analyzeCertificateProperties(certInfo: unknown, result: CertificateAnalysis): void {
  const cert = certInfo as CertificateInfo;

  if (!cert) return;

  // Extract basic certificate information
  result.issuer = cert.issuer?.CN || 'unknown';
  result.isSelfSigned = cert.issuer?.CN === cert.subject?.CN;

  // Calculate certificate age
  if (cert.valid_from) {
    const issuedDate = new Date(cert.valid_from);
    result.age = Math.floor((Date.now() - issuedDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Calculate days until expiry
  if (cert.valid_to) {
    const expiryDate = new Date(cert.valid_to);
    result.expiryDays = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  // Count Subject Alternative Names
  if (cert.subjectaltname) {
    result.sanCount = cert.subjectaltname.split(',').length;
  }
}

function updateValidationStatus(isValidCert: boolean, result: CertificateAnalysis): void {
  result.isValid = isValidCert;
  if (!isValidCert) {
    result.suspicionScore += 0.7;
    result.reasons.push('Certificate validation failed');
  }
}

function checkSuspiciousPatterns(result: CertificateAnalysis): void {
  // Check for self-signed certificates
  if (result.isSelfSigned) {
    result.suspicionScore += 0.8;
    result.reasons.push('Self-signed certificate detected');
  }

  // Check for very new certificates
  if (result.age < 7) {
    result.suspicionScore += 0.5;
    result.reasons.push('Very new certificate (< 7 days old)');
  }

  // Check for certificates expiring soon
  if (result.expiryDays < 30) {
    result.suspicionScore += 0.3;
    result.reasons.push('Certificate expires soon');
  }

  // Check for unusually high number of SANs
  if (result.sanCount > 100) {
    result.suspicionScore += 0.4;
    result.reasons.push('Unusually high number of SANs');
  }

  // Check for suspicious issuers
  if (hasSuspiciousIssuer(result.issuer)) {
    result.suspicionScore += 0.6;
    result.reasons.push('Suspicious certificate issuer');
  }
}

function hasSuspiciousIssuer(issuer: string): boolean {
  const suspiciousIssuers = ['localhost', 'test', 'example', 'invalid'];
  return suspiciousIssuers.some(sus => issuer.toLowerCase().includes(sus));
}

async function checkCertificateTransparency(hostname: string, result: CertificateAnalysis): Promise<void> {
  try {
    // Simplified CT log check - in production you'd query actual CT logs
    // This is a placeholder that assumes most legitimate sites are in CT logs
    const response = await request(`https://crt.sh/?q=${encodeURIComponent(hostname)}&output=json`, {
      method: 'GET',
      headersTimeout: 2000,
      bodyTimeout: 2000,
    });

    if (response.statusCode === 200) {
      const data = await response.body.json();
      result.ctLogPresent = Array.isArray(data) && data.length > 0;
    } else {
      result.ctLogPresent = false;
    }

    if (!result.ctLogPresent) {
      result.suspicionScore += 0.4;
      result.reasons.push('Certificate not found in CT logs');
    }
  } catch (err) {
    logger.debug({ hostname, err }, 'CT log check failed');
  }
}
```

# File: packages/shared/src/reputation/dns-intelligence.ts

```typescript
import { logger } from '../log';
import dns from 'dns/promises';

export interface DNSBLResult {
  provider: string;
  listed: boolean;
  reason?: string;
}

export interface DNSIntelligenceResult {
  score: number;
  reasons: string[];
  dnsblResults: DNSBLResult[];
  dnssecValid?: boolean;
  fastFluxDetected?: boolean;
}

interface DNSIntelligenceOptions {
  dnsblEnabled?: boolean;
  dnsblTimeoutMs?: number;
  dnssecEnabled?: boolean;
  fastFluxEnabled?: boolean;
}

const DNSBL_PROVIDERS = [
  'zen.spamhaus.org',
  'bl.spamcop.net',
  'dnsbl.sorbs.net',
];

export async function dnsIntelligence(
  hostname: string,
  options: DNSIntelligenceOptions = {}
): Promise<DNSIntelligenceResult> {
  const {
    dnsblEnabled = true,
    dnsblTimeoutMs = 2000,
    dnssecEnabled = true,
    fastFluxEnabled = true,
  } = options;

  const result: DNSIntelligenceResult = {
    score: 0,
    reasons: [],
    dnsblResults: [],
  };

  try {
    // Perform DNSBL checks
    if (dnsblEnabled) {
      await performDNSBLChecks(hostname, dnsblTimeoutMs, result);
    }

    // Perform DNSSEC validation
    if (dnssecEnabled) {
      await performDNSSECCheck(hostname, result);
    }

    // Perform fast-flux detection
    if (fastFluxEnabled) {
      await performFastFluxDetection(hostname, result);
    }

    return result;
  } catch (err) {
    logger.warn({ hostname, err }, 'DNS intelligence check failed');
    return result;
  }
}

async function performDNSBLChecks(
  hostname: string, 
  dnsblTimeoutMs: number, 
  result: DNSIntelligenceResult
): Promise<void> {
  const dnsblResults = await Promise.allSettled(
    DNSBL_PROVIDERS.map(provider => checkDNSBL(hostname, provider, dnsblTimeoutMs))
  );

  for (const dnsblResult of dnsblResults) {
    if (dnsblResult.status === 'fulfilled' && dnsblResult.value.listed) {
      result.dnsblResults.push(dnsblResult.value);
      result.score += 1.0;
      result.reasons.push(`Domain listed in DNSBL: ${dnsblResult.value.provider}`);
    }
  }
}

async function performDNSSECCheck(hostname: string, result: DNSIntelligenceResult): Promise<void> {
  try {
    const dnssecValid = await checkDNSSEC(hostname);
    result.dnssecValid = dnssecValid;
    if (!dnssecValid) {
      result.score += 0.3;
      result.reasons.push('DNSSEC validation failed');
    }
  } catch (err) {
    logger.debug({ hostname, err }, 'DNSSEC check failed');
  }
}

async function performFastFluxDetection(hostname: string, result: DNSIntelligenceResult): Promise<void> {
  try {
    const fastFlux = await detectFastFlux(hostname);
    result.fastFluxDetected = fastFlux;
    if (fastFlux) {
      result.score += 0.8;
      result.reasons.push('Fast-flux DNS pattern detected');
    }
  } catch (err) {
    logger.debug({ hostname, err }, 'Fast-flux detection failed');
  }
}

async function checkDNSBL(hostname: string, provider: string, timeoutMs: number): Promise<DNSBLResult> {
  try {
    // This is a simplified DNSBL check - in production you'd use proper DNS queries
    const query = `${hostname}.${provider}`;

    // Use Promise.race for timeout
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('DNS timeout')), timeoutMs);
    });

    try {
      await Promise.race([dns.resolve4(query), timeoutPromise]);
      return { provider, listed: true, reason: 'Listed in DNSBL' };
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return { provider, listed: false };
      }
      if (error.message === 'DNS timeout') {
        // Treat timeout as not listed for this specific check
        return { provider, listed: false, reason: 'Timeout during DNSBL check' };
      }
      throw err;
    }
  } catch (_err) {
    return { provider, listed: false };
  }
}

async function checkDNSSEC(hostname: string): Promise<boolean> {
  try {
    // Simplified DNSSEC check - in production you'd use proper DNSSEC validation
    await dns.resolveTxt(hostname);
    // This is a placeholder - real DNSSEC validation is more complex
    return true;
  } catch (_err) {
    return false;
  }
}

async function detectFastFlux(hostname: string): Promise<boolean> {
  try {
    // Check for multiple A records with short TTL (fast-flux indicator)
    const records = await dns.resolve4(hostname, { ttl: true });

    if (Array.isArray(records) && records.length > 5) {
      // Check if TTL is suspiciously short (< 300 seconds)
      const shortTtl = records.some((record: unknown) => {
        const r = record as { ttl?: number };
        return r.ttl && r.ttl < 300;
      });
      if (shortTtl) {
        return true;
      }
    }

    return false;
  } catch (_err) {
    return false;
  }
}
```

# File: packages/shared/src/reputation/gsb.ts

```typescript
import { request } from 'undici';
import { config } from '../config';
import { HttpError } from '../http-errors';

export interface GsbThreatMatch {
  threatType: string;
  platformType: string;
  threatEntryType: string;
  threat: string;
}

export interface GsbLookupResult {
  matches: GsbThreatMatch[];
  latencyMs: number;
}

export async function gsbLookup(urls: string[], timeoutMs = config.gsb.timeoutMs): Promise<GsbLookupResult> {
  if (!config.gsb.apiKey || urls.length === 0) return { matches: [], latencyMs: 0 };
  const body = {
    client: { clientId: 'wbscanner', clientVersion: '0.1' },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'MALICIOUS_BINARY'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: urls.map(u => ({ url: u }))
    }
  };
  const start = Date.now();
  const res = await request(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${config.gsb.apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs
  });
  if (res.statusCode >= 500) {
    const err = new Error(`Google Safe Browsing error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  const json = await res.body.json() as { matches?: Array<{ threatType: string; platformType: string; threatEntryType: string; threat: { url?: string } | string }> };
  const matches: GsbThreatMatch[] = Array.isArray(json?.matches)
    ? json.matches.map((match) => ({
      threatType: match.threatType,
      platformType: match.platformType,
      threatEntryType: match.threatEntryType,
      threat: typeof match.threat === 'string' ? match.threat : (match.threat?.url ?? '')
    }))
    : [];
  return { matches, latencyMs: Date.now() - start };
}

```

# File: packages/shared/src/reputation/http-fingerprint.ts

```typescript
import { request } from 'undici';
import { logger } from '../log';

export interface SecurityHeaders {
  hsts: boolean;
  csp: boolean;
  xFrameOptions: boolean;
  xContentTypeOptions: boolean;
}

export interface HTTPFingerprint {
  statusCode: number;
  securityHeaders: SecurityHeaders;
  suspiciousRedirects: boolean;
  suspicionScore: number;
  reasons: string[];
}

interface HTTPFingerprintOptions {
  timeoutMs?: number;
  enableSSRFGuard?: boolean;
}

export async function httpFingerprinting(
  url: string,
  options: HTTPFingerprintOptions = {}
): Promise<HTTPFingerprint> {
  const { timeoutMs = 2000, enableSSRFGuard = true } = options;

  const result: HTTPFingerprint = {
    statusCode: 0,
    securityHeaders: {
      hsts: false,
      csp: false,
      xFrameOptions: false,
      xContentTypeOptions: false,
    },
    suspiciousRedirects: false,
    suspicionScore: 0,
    reasons: [],
  };

  try {
    // SSRF protection
    if (enableSSRFGuard && isPrivateIP(new URL(url).hostname)) {
      result.suspicionScore += 1.0;
      result.reasons.push('URL points to private IP address');
      return result;
    }

    const response = await request(url, {
      method: 'HEAD', // Use HEAD to minimize data transfer
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      maxRedirections: 5,
    });

    result.statusCode = response.statusCode;
    const headers = response.headers;

    // Analyze response headers
    analyzeSecurityHeaders(headers, result);
    analyzeStatusCode(result.statusCode, result);
    analyzeServerHeader(headers.server as string, result);
    analyzeRedirects(url, headers.location as string, result);
    analyzeContentType(headers['content-type'] as string, result);

    return result;
  } catch (err: unknown) {
    return handleHttpError(err as { message?: string; code?: string }, url, result);
  }
}

function analyzeSecurityHeaders(headers: Record<string, unknown>, result: HTTPFingerprint): void {
  // Check security headers
  result.securityHeaders.hsts = !!(headers['strict-transport-security']);
  result.securityHeaders.csp = !!(headers['content-security-policy']);
  result.securityHeaders.xFrameOptions = !!(headers['x-frame-options']);
  result.securityHeaders.xContentTypeOptions = !!(headers['x-content-type-options']);

  // Score based on missing security headers
  const missingHeaders = Object.values(result.securityHeaders).filter(present => !present).length;
  if (missingHeaders >= 3) {
    result.suspicionScore += 0.4;
    result.reasons.push('Multiple security headers missing');
  }
}

function analyzeStatusCode(statusCode: number, result: HTTPFingerprint): void {
  // Check for suspicious status codes
  if (statusCode >= 400 && statusCode < 500) {
    result.suspicionScore += 0.2;
    result.reasons.push(`Client error status: ${statusCode}`);
  } else if (statusCode >= 500) {
    result.suspicionScore += 0.3;
    result.reasons.push(`Server error status: ${statusCode}`);
  }
}

function analyzeServerHeader(server: string, result: HTTPFingerprint): void {
  if (!server) return;
  
  const suspiciousServers = ['apache/1.', 'nginx/0.', 'test', 'localhost'];
  if (suspiciousServers.some(sus => server.toLowerCase().includes(sus))) {
    result.suspicionScore += 0.3;
    result.reasons.push('Suspicious server header');
  }
}

function analyzeRedirects(originalUrl: string, location: string, result: HTTPFingerprint): void {
  if (!location) return;
  
  try {
    const originalHost = new URL(originalUrl).hostname;
    const redirectHost = new URL(location).hostname;

    if (originalHost !== redirectHost) {
      // Cross-domain redirect - check if suspicious
      if (isPrivateIP(redirectHost) || redirectHost.includes('localhost')) {
        result.suspiciousRedirects = true;
        result.suspicionScore += 0.6;
        result.reasons.push('Suspicious redirect to private/local address');
      }
    }
  } catch (_err) {
    // Invalid redirect URL
    result.suspiciousRedirects = true;
    result.suspicionScore += 0.4;
    result.reasons.push('Invalid redirect URL');
  }
}

function analyzeContentType(contentType: string, result: HTTPFingerprint): void {
  if (contentType && contentType.includes('application/octet-stream')) {
    result.suspicionScore += 0.3;
    result.reasons.push('Binary content type detected');
  }
}

function handleHttpError(
  error: { message?: string; code?: string }, 
  url: string, 
  result: HTTPFingerprint
): HTTPFingerprint {
  logger.warn({ url, err: error.message }, 'HTTP fingerprinting failed');

  // Analyze the error for additional insights
  if (error.code === 'ENOTFOUND') {
    result.suspicionScore += 0.5;
    result.reasons.push('Domain not found');
  } else if (error.code === 'ECONNREFUSED') {
    result.suspicionScore += 0.4;
    result.reasons.push('Connection refused');
  } else if (error.code === 'CERT_AUTHORITY_INVALID') {
    result.suspicionScore += 0.6;
    result.reasons.push('Invalid certificate authority');
  }

  return result;
}

function isPrivateIP(hostname: string): boolean {
  // Check for private IP ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./, // Link-local
    /^::1$/, // IPv6 localhost
    /^fc00:/, // IPv6 private
    /^fe80:/, // IPv6 link-local
  ];

  // Check for localhost variations
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    return true;
  }

  return privateRanges.some(range => range.test(hostname));
}
```

# File: packages/shared/src/reputation/local-threat-db.ts

```typescript
import { request } from 'undici';
import { logger } from '../log';
import type Redis from 'ioredis';

export interface LocalThreatResult {
  score: number;
  reasons: string[];
  openphishMatch?: boolean;
  collaborativeMatch?: boolean;
}

interface LocalThreatDatabaseOptions {
  feedUrl: string;
  updateIntervalMs: number;
}

export class LocalThreatDatabase {
  private redis: Redis;
  private options: LocalThreatDatabaseOptions;
  private updateTimer?: NodeJS.Timeout;
  private readonly OPENPHISH_KEY = 'threat_db:openphish';
  private readonly COLLABORATIVE_KEY = 'threat_db:collaborative';
  private readonly LAST_UPDATE_KEY = 'threat_db:last_update';

  constructor(redis: Redis, options: LocalThreatDatabaseOptions) {
    this.redis = redis;
    this.options = options;
  }

  async start(): Promise<void> {
    // Initial feed update - non-fatal if it fails
    try {
      await this.updateOpenPhishFeed();
    } catch (err) {
      logger.warn({ err }, 'Initial OpenPh feed update failed; will retry on next interval');
    }

    // Schedule periodic updates
    this.updateTimer = setInterval(() => {
      this.updateOpenPhishFeed().catch(err => {
        logger.error({ err }, 'Failed to update OpenPhish feed');
      });
    }, this.options.updateIntervalMs);

    logger.info('Local threat database started');
  }

  async stop(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    logger.info('Local threat database stopped');
  }

  async check(url: string, _hash: string): Promise<LocalThreatResult> {
    const result: LocalThreatResult = {
      score: 0,
      reasons: [],
    };

    try {
      const normalizedUrl = this.normalizeUrl(url);

      // Check OpenPhish feed
      const openphishMatch = await this.redis.sismember(this.OPENPHISH_KEY, normalizedUrl);
      if (openphishMatch) {
        result.openphishMatch = true;
        result.score += 2.0;
        result.reasons.push('URL found in OpenPhish feed');
      }

      // Check collaborative learning database
      const collaborativeScore = await this.redis.zscore(this.COLLABORATIVE_KEY, normalizedUrl);
      if (collaborativeScore !== null && Number(collaborativeScore) > 0.7) {
        result.collaborativeMatch = true;
        result.score += Math.min(1.5, Number(collaborativeScore));
        result.reasons.push('URL flagged by collaborative learning');
      }

      return result;
    } catch (_err) {
      logger.warn({ url, err: _err }, 'Local threat database check failed');
      return result;
    }
  }

  async updateOpenPhishFeed(): Promise<void> {
    try {
      logger.info('Updating OpenPhish feed...');

      const response = await request(this.options.feedUrl, {
        method: 'GET',
        headersTimeout: 10000,
        bodyTimeout: 30000,
        maxRedirections: 5, // Follow redirects
      });

      if (response.statusCode !== 200) {
        throw new Error(`OpenPhish feed returned ${response.statusCode}`);
      }

      const feedData = await response.body.text();
      const urls = feedData
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.startsWith('http'))
        .map(url => this.normalizeUrl(url));

      if (urls.length === 0) {
        throw new Error('No URLs found in OpenPhish feed');
      }

      // Update Redis with new feed data
      const pipeline = this.redis.pipeline();
      pipeline.del(this.OPENPHISH_KEY);

      // Add URLs in batches to avoid memory issues
      const batchSize = 1000;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        pipeline.sadd(this.OPENPHISH_KEY, ...batch);
      }

      pipeline.set(this.LAST_UPDATE_KEY, Date.now());
      pipeline.expire(this.OPENPHISH_KEY, 24 * 60 * 60); // 24 hours TTL

      await pipeline.exec();

      logger.info({ count: urls.length }, 'OpenPhish feed updated successfully');
    } catch (err) {
      logger.error({ err }, 'Failed to update OpenPhish feed');
      // Don't throw - make this non-fatal to allow service to continue running
    }
  }

  async recordVerdict(
    url: string,
    verdict: 'benign' | 'suspicious' | 'malicious',
    confidence: number
  ): Promise<void> {
    try {
      const normalizedUrl = this.normalizeUrl(url);

      let score = 0;
      if (verdict === 'malicious') {
        score = confidence;
      } else if (verdict === 'suspicious') {
        score = confidence * 0.5;
      }

      if (score > 0) {
        await this.redis.zadd(this.COLLABORATIVE_KEY, score, normalizedUrl);
        // Set TTL for collaborative entries (30 days)
        await this.redis.expire(this.COLLABORATIVE_KEY, 30 * 24 * 60 * 60);
      }
    } catch (err) {
      logger.warn({ url, verdict, err }, 'Failed to record verdict in collaborative database');
    }
  }

  async getStats(): Promise<{ openphishCount: number; collaborativeCount: number }> {
    try {
      const [openphishCount, collaborativeCount] = await Promise.all([
        this.redis.scard(this.OPENPHISH_KEY),
        this.redis.zcard(this.COLLABORATIVE_KEY),
      ]);

      return {
        openphishCount: openphishCount || 0,
        collaborativeCount: collaborativeCount || 0,
      };
    } catch (err) {
      logger.warn({ err }, 'Failed to get threat database stats');
      return { openphishCount: 0, collaborativeCount: 0 };
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove common tracking parameters and fragments
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().toLowerCase();
    } catch (_err) {
      return url.toLowerCase();
    }
  }
}
```

# File: packages/shared/src/reputation/phishtank.ts

```typescript
import { request } from 'undici';
import { config } from '../config';
import { HttpError } from '../http-errors';

export interface PhishtankLookupResult {
  inDatabase: boolean;
  verified: boolean;
  verifiedAt?: string;
  url?: string;
  phishId?: number;
  submissionTime?: string;
  detailsUrl?: string;
  latencyMs?: number;
}

export async function phishtankLookup(url: string, timeoutMs = config.phishtank.timeoutMs): Promise<PhishtankLookupResult> {
  if (!config.phishtank.enabled) {
    return { inDatabase: false, verified: false, latencyMs: 0 };
  }
  const params = new URLSearchParams({
    url,
    format: 'json',
    app_key: config.phishtank.appKey || '',
    response: 'json'
  });

  const start = Date.now();
  const res = await request('https://checkurl.phishtank.com/checkurl/', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': config.phishtank.userAgent
    },
    body: params.toString(),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs
  });

  if (res.statusCode === 429) {
    const err = new Error('Phishtank rate limited') as HttpError;
    err.code = 429;
    throw err;
  }
  if (res.statusCode >= 500) {
    const err = new Error(`Phishtank error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }

  const json = await res.body.json() as {
    results?: {
      in_database?: boolean;
      verified?: boolean;
      verified_at?: string;
      url?: string;
      phish_id?: number;
      submission_time?: string;
      phishtank_url?: string;
    };
  };
  const results = json?.results;
  if (!results) {
    return { inDatabase: false, verified: false, latencyMs: Date.now() - start };
  }
  const inDatabase = Boolean(results.in_database);
  const verified = inDatabase && Boolean(results.verified);
  return {
    inDatabase,
    verified,
    verifiedAt: results.verified_at ?? undefined,
    url: results.url ?? undefined,
    phishId: results.phish_id ?? undefined,
    submissionTime: results.submission_time ?? undefined,
    detailsUrl: results.phishtank_url ?? undefined,
    latencyMs: Date.now() - start
  };
}

```

# File: packages/shared/src/reputation/rdap.ts

```typescript
import { request } from 'undici';
import { parse } from 'tldts';

export async function domainAgeDaysFromRdap(hostname: string, timeoutMs = 5000): Promise<number | undefined> {
  const { domain } = parse(hostname);
  if (!domain) return undefined;
  const url = `https://rdap.org/domain/${domain}`;
  const res = await request(url, { headersTimeout: timeoutMs, bodyTimeout: timeoutMs }).catch(() => null);
  if (!res || res.statusCode >= 400) return undefined;
  const json = await res.body.json() as {
    events?: Array<{
      eventAction?: string;
      eventDate?: string;
    }>;
  };
  const events = json?.events || [];
  const reg = events.find(e => e.eventAction === 'registration' || e.eventAction === 'registered');
  if (!reg?.eventDate) return undefined;
  const regDate = new Date(reg.eventDate);
  const now = new Date();
  return Math.floor((now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));
}


```

# File: packages/shared/src/reputation/urlhaus.ts

```typescript
import { request } from 'undici';
import { config } from '../config';
import { HttpError } from '../http-errors';

export interface UrlhausLookupResult {
  listed: boolean;
  threat?: string;
  urlId?: string;
  firstSeen?: string;
  lastSeen?: string;
  reporter?: string;
  blacklists?: string[];
  latencyMs?: number;
}

export async function urlhausLookup(url: string, timeoutMs = config.urlhaus.timeoutMs): Promise<UrlhausLookupResult> {
  if (!config.urlhaus.enabled) return { listed: false, latencyMs: 0 };
  const start = Date.now();
  const res = await request('https://urlhaus-api.abuse.ch/v1/url/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url }).toString(),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs
  });
  if (res.statusCode === 429) {
    const err = new Error('URLhaus rate limited') as HttpError;
    err.code = 429;
    throw err;
  }
  if (res.statusCode >= 500) {
    const err = new Error(`URLhaus error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  const json = await res.body.json() as {
    query_status?: string;
    threat?: string;
    threat_type?: string;
    id?: string;
    urlid?: string;
    date_added?: string;
    firstseen?: string;
    last_seen?: string;
    reporter?: string;
    blacklists?: string[];
  };
  if (json?.query_status === 'ok') {
    return {
      listed: true,
      threat: json.threat ?? json.threat_type ?? undefined,
      urlId: json.id ?? json.urlid ?? undefined,
      firstSeen: json.date_added ?? json.firstseen ?? undefined,
      lastSeen: json.last_seen ?? undefined,
      reporter: json.reporter ?? undefined,
      blacklists: Array.isArray(json.blacklists) ? json.blacklists : undefined,
      latencyMs: Date.now() - start
    };
  }
  if (json?.query_status === 'no_results') {
    return { listed: false, latencyMs: Date.now() - start };
  }
  // Unknown response – treat as error to trigger fallback handling
  const err = new Error('URLhaus unexpected response') as HttpError;
  err.details = json;
  throw err;
}

```

# File: packages/shared/src/reputation/urlscan.ts

```typescript
import { request } from 'undici';
import { config } from '../config';
import { HttpError } from '../http-errors';

export interface UrlscanSubmissionOptions {
  visibility?: string;
  tags?: string[];
  referer?: string;
  callbackUrl?: string;
  customAgent?: string;
}

export interface UrlscanSubmissionResponse {
  uuid?: string;
  result?: string;
  api?: string;
  message?: string;
  submissionUrl?: string;
  visibility?: string;
  latencyMs?: number;
}

export interface UrlscanResult {
  task?: {
    uuid?: string;
    url?: string;
    visibility?: string;
    userAgent?: string;
    time?: string;
  };
  stats?: Record<string, unknown>;
  page?: Record<string, unknown>;
  lists?: Record<string, unknown>;
  submitter?: Record<string, unknown>;
  verdicts?: Record<string, unknown>;
}

function buildHeaders() {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (config.urlscan.apiKey) {
    headers['API-Key'] = config.urlscan.apiKey;
  }
  return headers;
}

export async function submitUrlscan(
  url: string,
  options: UrlscanSubmissionOptions = {}
): Promise<UrlscanSubmissionResponse> {
  if (!config.urlscan.enabled) {
    throw new Error('urlscan integration disabled');
  }
  if (!config.urlscan.apiKey) {
    throw new Error('urlscan API key missing');
  }

  const payload = {
    url,
    visibility: options.visibility || config.urlscan.visibility || 'private',
    tags: options.tags || config.urlscan.tags || [],
    referer: options.referer,
    callbackurl: options.callbackUrl || config.urlscan.callbackUrl || undefined,
    customagent: options.customAgent || 'wbscanner/urlscan',
  };

  const start = Date.now();
  const res = await request(`${config.urlscan.baseUrl}/api/v1/scan/`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    headersTimeout: config.urlscan.submitTimeoutMs,
    bodyTimeout: config.urlscan.submitTimeoutMs,
  });

  if (res.statusCode === 429) {
    const err = new Error('urlscan quota exceeded') as HttpError;
    err.code = 429;
    throw err;
  }
  if (res.statusCode >= 500) {
    const err = new Error(`urlscan error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  if (res.statusCode >= 400) {
    const errBody = await res.body.text();
    const err = new Error(`urlscan submission failed: ${res.statusCode} - ${errBody}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }

  const json = await res.body.json() as {
    uuid?: string;
    result?: string;
    api?: string;
    message?: string;
    submissionUrl?: string;
    visibility?: string;
  };
  return {
    uuid: json?.uuid,
    result: json?.result,
    api: json?.api,
    message: json?.message,
    submissionUrl: json?.submissionUrl,
    visibility: json?.visibility,
    latencyMs: Date.now() - start,
  };
}

export async function fetchUrlscanResult(uuid: string): Promise<UrlscanResult> {
  if (!config.urlscan.enabled) {
    throw new Error('urlscan integration disabled');
  }
  const res = await request(`${config.urlscan.baseUrl}/api/v1/result/${uuid}/`, {
    method: 'GET',
    headers: buildHeaders(),
    headersTimeout: config.urlscan.resultPollTimeoutMs,
    bodyTimeout: config.urlscan.resultPollTimeoutMs,
  });
  if (res.statusCode === 404) {
    const err = new Error('urlscan result not ready') as HttpError;
    err.code = 404;
    throw err;
  }
  if (res.statusCode >= 500) {
    const err = new Error(`urlscan result error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  if (res.statusCode >= 400) {
    const err = new Error(`urlscan result failed: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  const json = await res.body.json() as UrlscanResult;
  return json;
}

```

# File: packages/shared/src/reputation/virustotal.ts

```typescript
import Bottleneck from 'bottleneck';
import { fetch } from 'undici';
import { config } from '../config';
import { logger } from '../log';
import {
  apiQuotaDepletedCounter,
  apiQuotaRemainingGauge,
  apiQuotaStatusGauge,
  metrics,
  rateLimiterDelay,
  rateLimiterQueueDepth,
} from '../metrics';
import { QuotaExceededError } from '../errors';
import { HttpError } from '../http-errors';

export interface VirusTotalAnalysis {
  data?: unknown;
  latencyMs?: number;
  disabled?: boolean;
}

const VT_LIMITER_RESERVOIR = Math.max(1, config.vt.requestsPerMinute);

const vtLimiter = new Bottleneck({
  reservoir: VT_LIMITER_RESERVOIR,
  reservoirRefreshAmount: VT_LIMITER_RESERVOIR,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1,
  minTime: 250,
});

let requestsRemaining = VT_LIMITER_RESERVOIR;
let lastReservoir = VT_LIMITER_RESERVOIR;
initializeQuotaMetrics(requestsRemaining);

vtLimiter.on('depleted', () => {
  recordReservoir(0);
});

const refreshInterval = setInterval(async () => {
  try {
    const current = await vtLimiter.currentReservoir();
    if (typeof current === 'number') {
      recordReservoir(current);
    }
    rateLimiterQueueDepth.labels('virustotal').set(getQueuedJobs());
  } catch (err) {
    logger.debug({ err }, 'Failed to poll VT limiter reservoir');
  }
}, 10_000);
refreshInterval.unref();

function getQueuedJobs(): number {
  // Bottleneck doesn't export the queued method type, so we need to access it dynamically
  const limiter = vtLimiter as unknown as { queued?: () => number };
  if (typeof limiter.queued === 'function') {
    try {
      const value = limiter.queued();
      return typeof value === 'number' ? value : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function initializeQuotaMetrics(initial: number) {
  apiQuotaRemainingGauge.labels('virustotal').set(initial);
  apiQuotaStatusGauge.labels('virustotal').set(1);
  metrics.apiQuotaUtilization.labels('virustotal').set(0);
  metrics.apiQuotaProjectedDepletion.labels('virustotal').set((initial * 60) / VT_LIMITER_RESERVOIR);
}

function recordReservoir(reservoir: number) {
  requestsRemaining = reservoir;
  apiQuotaRemainingGauge.labels('virustotal').set(Math.max(reservoir, 0));
  apiQuotaStatusGauge.labels('virustotal').set(reservoir > 0 ? 1 : 0);
  if (reservoir > lastReservoir) {
    metrics.apiQuotaResets.labels('virustotal').inc();
  }
  lastReservoir = reservoir;
  const utilization = reservoir <= 0 ? 1 : Math.min(1, Math.max(0, 1 - reservoir / VT_LIMITER_RESERVOIR));
  metrics.apiQuotaUtilization.labels('virustotal').set(utilization);
  const projection = reservoir <= 0 ? 0 : (reservoir * 60) / VT_LIMITER_RESERVOIR;
  metrics.apiQuotaProjectedDepletion.labels('virustotal').set(projection);
}

async function scheduleVtCall<T>(cb: () => Promise<T>): Promise<T> {
  const queuedAt = Date.now();
  return vtLimiter.schedule(async () => {
    const waitSeconds = (Date.now() - queuedAt) / 1000;
    if (waitSeconds > 0) {
      rateLimiterDelay.labels('virustotal').observe(waitSeconds);
    }
    metrics.apiQuotaConsumption.labels('virustotal').inc();
    rateLimiterQueueDepth.labels('virustotal').set(getQueuedJobs());

    const jitterMs = config.vt.requestJitterMs;
    if (jitterMs > 0) {
      const jitterDelay = Math.floor(Math.random() * (jitterMs + 1));
      if (jitterDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, jitterDelay));
      }
    }

    try {
      return await cb();
    } finally {
      const reservoir = await vtLimiter.currentReservoir();
      if (typeof reservoir === 'number') {
        recordReservoir(reservoir);
      }
      rateLimiterQueueDepth.labels('virustotal').set(getQueuedJobs());
    }
  });
}

function handleVirusTotalQuotaExceeded(stage: 'submission' | 'polling'): never {
  recordReservoir(0);
  apiQuotaDepletedCounter.labels('virustotal').inc();
  logger.warn({ stage }, 'VirusTotal quota exhausted');
  throw new QuotaExceededError('virustotal', 'VirusTotal quota exhausted');
}

export async function vtAnalyzeUrl(url: string): Promise<VirusTotalAnalysis> {
  if (!config.vt.apiKey) return { disabled: true };
  const submitResponse = await scheduleVtCall(() =>
    fetch('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: {
        'x-apikey': config.vt.apiKey,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ url }).toString(),
    })
  );

  if (submitResponse.status === 429) {
    handleVirusTotalQuotaExceeded('submission');
  }

  if (submitResponse.status >= 400) {
    const err = new Error(`VirusTotal submission failed: ${submitResponse.status}`) as HttpError;
    err.statusCode = submitResponse.status;
    throw err;
  }

  const body = await submitResponse.json() as { data?: { id?: string } };
  const analysisId = body.data?.id;
  const started = Date.now();
  let analysis: unknown;
  while (Date.now() - started < 50000) {
    const res = await scheduleVtCall(() =>
      fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: { 'x-apikey': config.vt.apiKey },
      })
    );

    if (res.status === 429) {
      handleVirusTotalQuotaExceeded('polling');
    }
    if (res.status >= 500) {
      const err = new Error(`VirusTotal analysis failed: ${res.status}`) as HttpError;
      err.statusCode = res.status;
      throw err;
    }
    analysis = await res.json();
    const analysisData = analysis as { data?: { attributes?: { status?: string } } };
    const status = analysisData.data?.attributes?.status;
    if (status !== 'queued') break;
    await new Promise(r => setTimeout(r, 2000));
  }
  return { data: analysis, latencyMs: Date.now() - started };
}

export function vtVerdictStats(analysis: VirusTotalAnalysis): { malicious: number; suspicious: number; harmless: number } | undefined {
  if (analysis?.disabled) return undefined;

  // Type guard for analysis data structure
  const data = analysis?.data as { data?: { attributes?: { stats?: unknown } }; attributes?: { stats?: unknown } } | undefined;
  const st = data?.data?.attributes?.stats ?? data?.attributes?.stats;

  if (!st || typeof st !== 'object') return undefined;

  const stats = st as { malicious?: number; suspicious?: number; harmless?: number };
  return {
    malicious: stats.malicious || 0,
    suspicious: stats.suspicious || 0,
    harmless: stats.harmless || 0
  };
}

```

# File: packages/shared/src/reputation/whodat.ts

```typescript
import { request } from 'undici';
import { config } from '../config';
import { metrics } from '../metrics';
import { FeatureDisabledError } from '../errors';
import { logger } from '../log';
import { HttpError } from '../http-errors';

export interface WhoDatRecord {
  domainName?: string;
  createdDate?: string;
  updatedDate?: string;
  expiresDate?: string;
  registrarName?: string;
  estimatedDomainAgeDays?: number;
  nameServers?: string[];
  status?: string[];
}

export interface WhoDatResponse {
  record?: WhoDatRecord;
}

/**
 * Query the self-hosted who-dat WHOIS service
 * @param domain - Domain name to query
 * @returns WHOIS record information
 */
export async function whoDatLookup(domain: string): Promise<WhoDatResponse> {
  if (!config.whodat.enabled) {
    throw new FeatureDisabledError('whodat', 'Who-dat WHOIS service disabled');
  }

  const url = new URL(`${config.whodat.baseUrl}/whois/${encodeURIComponent(domain)}`);

  metrics.whoisRequests.inc();
  const start = Date.now();

  try {
    const res = await request(url.toString(), {
      method: 'GET',
      headersTimeout: config.whodat.timeoutMs,
      bodyTimeout: config.whodat.timeoutMs,
    });

    const latency = Date.now() - start;

    if (res.statusCode === 404) {
      metrics.whoisResults.labels('not_found').inc();
      logger.debug({ domain }, 'Who-dat: domain not found');
      return { record: undefined };
    }

    if (res.statusCode >= 500) {
      metrics.whoisResults.labels('error').inc();
      const err = new Error(`Who-dat service error: ${res.statusCode}`) as HttpError;
      err.statusCode = res.statusCode;
      throw err;
    }

    if (res.statusCode >= 400) {
      metrics.whoisResults.labels('error').inc();
      const err = new Error(`Who-dat request failed: ${res.statusCode}`) as HttpError;
      err.statusCode = res.statusCode;
      throw err;
    }

    const json = await res.body.json() as {
      domain_name?: string;
      created_date?: string;
      creation_date?: string;
      updated_date?: string;
      expiration_date?: string;
      expires_date?: string;
      registrar?: string;
      registrar_name?: string;
      name_servers?: string[];
      nameservers?: string[];
      status?: string[];
    };
    metrics.whoisResults.labels('success').inc();

    // Parse creation date and calculate domain age
    const createdDate = json.created_date || json.creation_date;
    let ageDays: number | undefined;

    if (createdDate) {
      const created = new Date(createdDate);
      if (!Number.isNaN(created.getTime())) {
        const now = Date.now();
        ageDays = Math.floor((now - created.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    logger.debug({ domain, latency, ageDays }, 'Who-dat lookup completed');

    return {
      record: {
        domainName: json.domain_name || domain,
        createdDate: createdDate,
        updatedDate: json.updated_date,
        expiresDate: json.expiration_date || json.expires_date,
        registrarName: json.registrar || json.registrar_name,
        estimatedDomainAgeDays: ageDays,
        nameServers: json.name_servers || json.nameservers || [],
        status: json.status || [],
      },
    };
  } catch (err) {
    metrics.whoisResults.labels('error').inc();
    logger.warn({ err, domain }, 'Who-dat lookup failed');
    throw err;
  }
}
```

# File: packages/shared/src/reputation/whoisxml.ts

```typescript
import { request } from 'undici';
import { config } from '../config';
import { apiQuotaRemainingGauge, apiQuotaStatusGauge, metrics } from '../metrics';
import { QuotaExceededError, FeatureDisabledError } from '../errors';
import { logger } from '../log';
import { HttpError } from '../http-errors';

export interface WhoisXmlRecord {
  domainName?: string;
  createdDate?: string;
  updatedDate?: string;
  expiresDate?: string;
  registrarName?: string;
  estimatedDomainAgeDays?: number;
}

export interface WhoisXmlResponse {
  record?: WhoisXmlRecord;
}

const SERVICE_LABEL = 'whoisxml';

let monthlyRequestCount = 0;
let currentMonth = new Date().getMonth();
let quotaDisabled = false;

function updateQuotaMetrics(remaining: number, available: boolean): void {
  const quota = Math.max(1, config.whoisxml.monthlyQuota);
  const boundedRemaining = Math.max(0, remaining);
  apiQuotaRemainingGauge.labels(SERVICE_LABEL).set(boundedRemaining);
  apiQuotaStatusGauge.labels(SERVICE_LABEL).set(available ? 1 : 0);
  const consumed = Math.max(0, config.whoisxml.monthlyQuota - boundedRemaining);
  const utilization = available ? Math.min(1, consumed / quota) : 1;
  metrics.apiQuotaUtilization.labels(SERVICE_LABEL).set(utilization);
  const projection = available ? boundedRemaining * 3600 : 0;
  metrics.apiQuotaProjectedDepletion.labels(SERVICE_LABEL).set(projection);
}

updateQuotaMetrics(config.whoisxml.enabled ? config.whoisxml.monthlyQuota : 0, config.whoisxml.enabled);

function resetMonthlyQuotaIfNeeded(): void {
  const now = new Date();
  if (now.getMonth() !== currentMonth) {
    logger.info({ previousCount: monthlyRequestCount }, 'WhoisXML quota counter reset (new month)');
    monthlyRequestCount = 0;
    currentMonth = now.getMonth();
    quotaDisabled = false;
    updateQuotaMetrics(config.whoisxml.enabled ? config.whoisxml.monthlyQuota : 0, config.whoisxml.enabled);
    metrics.apiQuotaResets.labels(SERVICE_LABEL).inc();
  }
}

function assertQuotaAvailable(): void {
  if (!config.whoisxml.enabled) {
    updateQuotaMetrics(0, false);
    metrics.whoisResults.labels('disabled').inc();
    throw new FeatureDisabledError('whoisxml', 'WhoisXML disabled');
  }
  if (quotaDisabled) {
    updateQuotaMetrics(0, false);
    throw new QuotaExceededError('whoisxml', 'WhoisXML monthly quota exhausted');
  }
  if (monthlyRequestCount >= config.whoisxml.monthlyQuota) {
    quotaDisabled = true;
    updateQuotaMetrics(0, false);
    metrics.whoisDisabled.labels('quota').inc();
    metrics.whoisResults.labels('quota_exhausted').inc();
    throw new QuotaExceededError('whoisxml', 'WhoisXML monthly quota exhausted');
  }
}

export async function whoisXmlLookup(domain: string): Promise<WhoisXmlResponse> {
  if (!config.whoisxml.apiKey) {
    throw new FeatureDisabledError('whoisxml', 'WhoisXML missing API key');
  }

  resetMonthlyQuotaIfNeeded();
  assertQuotaAvailable();

  monthlyRequestCount += 1;
  metrics.apiQuotaConsumption.labels(SERVICE_LABEL).inc();
  const remaining = Math.max(0, config.whoisxml.monthlyQuota - monthlyRequestCount);
  updateQuotaMetrics(remaining, remaining > 0);
  metrics.whoisRequests.inc();

  if (remaining <= config.whoisxml.quotaAlertThreshold) {
    logger.warn({ remaining }, 'WhoisXML quota nearing exhaustion');
  }

  const url = new URL('https://www.whoisxmlapi.com/whoisserver/WhoisService');
  url.searchParams.set('apiKey', config.whoisxml.apiKey);
  url.searchParams.set('domainName', domain);
  url.searchParams.set('outputFormat', 'JSON');
  let res: Awaited<ReturnType<typeof request>>;
  try {
    res = await request(url.toString(), {
      method: 'GET',
      headersTimeout: config.whoisxml.timeoutMs,
      bodyTimeout: config.whoisxml.timeoutMs
    });
  } catch (err) {
    metrics.whoisResults.labels('error').inc();
    throw err;
  }
  if (res.statusCode === 401 || res.statusCode === 403) {
    metrics.whoisResults.labels('unauthorized').inc();
    const err = new Error('WhoisXML unauthorized') as HttpError;
    err.code = res.statusCode;
    throw err;
  }
  if (res.statusCode === 429) {
    quotaDisabled = true;
    updateQuotaMetrics(0, false);
    metrics.whoisDisabled.labels('rate_limited').inc();
    metrics.whoisResults.labels('rate_limited').inc();
    metrics.whoisResults.labels('quota_exhausted').inc();
    throw new QuotaExceededError('whoisxml', 'WhoisXML rate limited');
  }
  if (res.statusCode >= 400 && res.statusCode < 500) {
    metrics.whoisResults.labels('error').inc();
    const err = new Error(`WhoisXML error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  if (res.statusCode >= 500) {
    metrics.whoisResults.labels('error').inc();
    const err = new Error(`WhoisXML error: ${res.statusCode}`) as HttpError;
    err.statusCode = res.statusCode;
    throw err;
  }
  const json = await res.body.json() as {
    WhoisRecord?: {
      domainName?: string;
      createdDateNormalized?: string;
      createdDate?: string;
      updatedDateNormalized?: string;
      updatedDate?: string;
      expiresDateNormalized?: string;
      expiresDate?: string;
      registrarName?: string;
      registrarNameSponsored?: string;
      registryData?: {
        createdDateNormalized?: string;
      };
    };
  };
  const record = json?.WhoisRecord;
  metrics.whoisResults.labels('success').inc();
  if (!record) return { record: undefined };
  const created = record.createdDateNormalized || record.registryData?.createdDateNormalized || record.createdDate;
  const createdDate = created ? new Date(created) : undefined;
  let ageDays: number | undefined;
  if (createdDate && !Number.isNaN(createdDate.getTime())) {
    const now = Date.now();
    ageDays = Math.floor((now - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  return {
    record: {
      domainName: record.domainName,
      createdDate: created,
      updatedDate: record.updatedDateNormalized || record.updatedDate,
      expiresDate: record.expiresDateNormalized || record.expiresDate,
      registrarName: record.registrarName || record.registrarNameSponsored,
      estimatedDomainAgeDays: ageDays
    }
  };
}

export function disableWhoisXmlForMonth(): void {
  quotaDisabled = true;
  updateQuotaMetrics(0, false);
}

```

# File: packages/shared/src/types/url-expand.d.ts

```typescript
declare module 'url-expand' {
  type Callback = (err: unknown, expanded?: string) => void;
  export default function expandUrl(url: string, cb: Callback): void;
}

```

# File: packages/confusable/index.js

```javascript
const confusables = require('confusables.js');

function toStringValue(entry) {
  if (typeof entry === 'string') {
    return entry;
  }
  if (Array.isArray(entry)) {
    return entry.join('');
  }
  return '';
}

function getConfusableCharacters(char) {
  if (typeof char !== 'string' || char.length === 0) {
    return [];
  }
  try {
    const result = confusables.getConfusableCharacters(char[0]);
    if (!Array.isArray(result)) {
      return [];
    }
    return result.map(toStringValue).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function hasConfusable(char) {
  if (typeof char !== 'string' || char.length === 0) {
    return false;
  }
  try {
    confusables.getConfusableCharacters(char[0]);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  getConfusableCharacters,
  hasConfusable,
};

```

# File: packages/confusable/index.d.ts

```typescript
export function getConfusableCharacters(char: string): string[];
export function hasConfusable(char: string): boolean;

```

# File: scripts/pair.sh

```bash
#!/bin/bash
# Trigger a manual pairing code request
echo "Requesting new pairing code..."
curl -X POST http://127.0.0.1:3000/pair
echo ""
echo "Check 'docker compose logs wa-client' for the code."

```

# File: scripts/watch-pairing-code.js

```javascript



/**
 * Continuously watch wa-client logs and surface pairing-code events with a
 * visual + audible cue. Useful when you cannot stare at the raw docker logs.
 */

import { spawn } from 'node:child_process';
import readline from 'node:readline';

const PAIRING_CODE_TTL_MS = 160_000;
const REMINDER_INTERVAL_MS = 30_000;

let activeReminder = null;
let activeCode = null;
let expiryTimestamp = 0;

function bell(times = 1) {
  for (let i = 0; i < times; i += 1) {
    try {
      process.stdout.write('\x07');
    } catch {
      // ignore
    }
  }
}

function formatPhone(masked) {
  return masked ?? 'unknown';
}

function formatWhen(timestampIso) {
  if (!timestampIso) return 'unknown';
  const when = new Date(timestampIso);
  if (Number.isNaN(when.getTime())) return timestampIso;
  return when.toLocaleTimeString();
}

function prettyDelay(ms) {
  if (!Number.isFinite(ms)) return 'unknown';
  if (ms >= 60_000) {
    const minutes = Math.round(ms / 60_000);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const seconds = Math.round(ms / 1000);
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function sanitize(line) {
  if (typeof line !== 'string') return '';
  const pipeIndex = line.indexOf('|');
  if (pipeIndex >= 0) {
    return line.slice(pipeIndex + 1).trim();
  }
  return line.trim();
}

function speak(text) {
  const volume = process.env.WATCH_PAIRING_VOLUME ?? '0.8';
  let voiceCmd = null;
  if (process.platform === 'darwin') {
    voiceCmd = spawn('say', ['-v', 'Ava', '-r', '180', text]);
  } else {
    voiceCmd = spawn('espeak', ['-a', String(Number(volume) * 200), text]);
  }
  voiceCmd.on('error', () => {
    // ignore speech errors; bell + console output still work
  });
}

function cancelReminder() {
  if (activeReminder) {
    clearInterval(activeReminder);
    activeReminder = null;
  }
  activeCode = null;
  expiryTimestamp = 0;
}

function scheduleReminder(maskedPhone) {
  cancelReminder();
  activeReminder = setInterval(() => {
    if (!activeCode) {
      cancelReminder();
      return;
    }
    const remaining = expiryTimestamp - Date.now();
    if (remaining <= 0) {
      console.log(`[watch] Code ${activeCode} for ${maskedPhone} likely expired.`);
      cancelReminder();
      return;
    }
    bell(2);
    speak(`Reminder. Enter WhatsApp pairing code ${activeCode}. ${Math.ceil(remaining / 1000)} seconds remain.`);
  }, REMINDER_INTERVAL_MS);
}

const source = process.env.WATCH_PAIRING_SOURCE === 'stdin' ? 'stdin' : 'docker';

let docker;
let inputStream;

if (source === 'stdin') {
  inputStream = process.stdin;
  console.log('[watch] Reading pairing events from STDIN (test mode).');
} else {
  docker = spawn('docker', ['compose', 'logs', '-f', 'wa-client'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  docker.on('error', (err) => {
    console.error('[watch-pairing-code] Failed to start docker compose logs:', err.message);
    process.exitCode = 1;
  });
  inputStream = docker.stdout;
}

const rl = readline.createInterface({ input: inputStream });

function triggerPairingAlert(code, attempt, maskedPhone, expiresAt) {
  bell(3);
  speak(`WhatsApp pairing code ${code} is ready. It expires in two minutes.`);
  console.log('\n=== WhatsApp Pairing Code Available ===');
  console.log(` Code:       ${code}`);
  console.log(` Attempt:    ${attempt}`);
  console.log(` Phone:      ${maskedPhone}`);
  console.log(` Expires at: ${expiresAt.toLocaleTimeString()}`);
  console.log('======================================\n');
  activeCode = code;
  expiryTimestamp = expiresAt.getTime();
  scheduleReminder(maskedPhone);
}

function handleRateLimitEvent(parsed) {
  const maskedPhone = formatPhone(parsed?.phoneNumber);
  const nextAt = formatWhen(parsed?.nextRetryAt);
  const delay = prettyDelay(parsed?.nextRetryMs);
  console.log(`[watch] Rate limited for ${maskedPhone}. Next retry in ~${delay} (${nextAt}).`);
  cancelReminder();
}

function handlePairingLine(parsed) {
  const maskedPhone = formatPhone(parsed?.phoneNumber);
  const code = parsed?.code ?? 'UNKNOWN';
  const attempt = parsed?.attempt ?? 'n/a';
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
  triggerPairingAlert(code, attempt, maskedPhone, expiresAt);
}

if (source === 'docker') {
  console.log('[watch] Live mode. Commands: d=demo alert, q=quit\n');
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (chunk) => {
      const key = chunk.toString().trim().toLowerCase();
      if (key === 'q') {
        shutdown();
        process.exit(0);
      }
      if (key === 'd') {
        const demoCode = `DEMO${Math.random().toString(36).toUpperCase().slice(2, 6)}`;
        const masked = '****DEMO';
        const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
        console.log('[watch] Running demo alert...');
        triggerPairingAlert(demoCode, 'demo', masked, expiresAt);
      }
    });
  } else {
    console.log('[watch] (stdin not TTY; demo shortcuts disabled)');
  }
}

rl.on('line', (rawLine) => {
  const line = sanitize(rawLine);
  if (!line) return;

  let parsed;
  if (line.startsWith('{')) {
    try {
      parsed = JSON.parse(line);
    } catch {
      // plain text line, fall through
    }
  }

  const message = parsed?.msg ?? line;
  if (message.includes('Requested phone-number pairing code')) {
    handlePairingLine(parsed);
    return;
  }

  if (message.includes('Failed to request pairing code automatically') && parsed?.rateLimited) {
    handleRateLimitEvent(parsed);
    return;
  }

  if (message.includes('Pairing code not received within timeout')) {
    const maskedPhone = formatPhone(parsed?.phoneNumber);
    console.log(`[watch] No code received yet for ${maskedPhone}. Keeping QR suppressed.`);
    cancelReminder();
  }
});

const shutdown = () => {
  rl.close();
  if (docker && !docker.killed) {
    docker.kill('SIGINT');
  }
};

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

```

# File: scripts/validate-setup.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Validating setup..."

# Check for .env file
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "FAIL: .env file not found. Run ./setup.sh --hobby-mode or copy .env.example to .env"
  exit 1
fi
echo "OK: .env file found."

# Check for Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "FAIL: Docker is not installed or not in PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "FAIL: Docker daemon is not running."
  exit 1
fi
echo "OK: Docker is running."

# Check for essential env vars
if grep -q "VT_API_KEY=$" "$ROOT_DIR/.env"; then
  echo "FAIL: VT_API_KEY is empty in .env"
  exit 1
fi
echo "OK: VT_API_KEY is set."

if grep -q "REDIS_URL=$" "$ROOT_DIR/.env"; then
  echo "FAIL: REDIS_URL is empty in .env"
  exit 1
fi
echo "OK: REDIS_URL is set."

echo "Setup validation passed!"
exit 0
```

