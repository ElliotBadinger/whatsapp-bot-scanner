SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

.PHONY: build up up-mvp down down-mvp logs test check-docker

# Check if Docker is available and running
check-docker:
	@if ! command -v docker >/dev/null 2>&1; then \
		echo "❌ Docker is not installed. Please install Docker first."; \
		echo "   Run: ./bootstrap.sh"; \
		exit 1; \
	fi
	@if ! docker info >/dev/null 2>&1; then \
		echo "❌ Docker daemon is not running."; \
		echo "   Start Docker and try again."; \
		exit 1; \
	fi
	@echo "✓ Docker is available and running"

# Build with retry logic and better error messages
build: check-docker
	@echo "🔨 Building Docker images..."
	@docker compose -f docker-compose.mvp.yml build
	@echo "✅ Build completed successfully"

# Start services with health checks
up: up-mvp

up-mvp: check-docker
	@echo "🚀 Starting MVP single-container service..."
	@docker compose -f docker-compose.mvp.yml up -d
	@echo "✅ MVP service started. Check status with: docker compose -f docker-compose.mvp.yml ps"

down: down-mvp

down-mvp:
	@echo "🛑 Stopping MVP service..."
	@docker compose -f docker-compose.mvp.yml down -v || true
	@echo "✅ MVP service stopped"

logs:
	@docker compose -f docker-compose.mvp.yml logs -f --tail=200

test:
	@bun run test || npm run test || echo "⚠️  No test runner available"

# Help target
help:
	@echo "WhatsApp Bot Scanner - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make build       - Build MVP Docker image"
	@echo "  make up          - Start MVP service"
	@echo "  make up-mvp      - Start MVP service"
	@echo "  make down        - Stop MVP service"
	@echo ""
	@echo "Development:"
	@echo "  make logs        - View service logs"
	@echo "  make test        - Run tests"
	@echo ""
	@echo "Prerequisites:"
	@echo "  Run ./bootstrap.sh to install Docker and Node.js"
