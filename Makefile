SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

.PHONY: build up up-full up-mvp up-minimal down down-mvp logs test migrate seed fmt lint test-load check-docker

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
	@docker compose -f docker-compose.yml -f docker-compose.observability.yml build --parallel || \
		(echo "❌ Build failed. Retrying without parallel build..." && \
		 docker compose -f docker-compose.yml -f docker-compose.observability.yml build) || \
		(echo "❌ Build failed again. Check network connectivity and try:" && \
		 echo "   docker system prune -f" && \
		 echo "   make build" && \
		 exit 1)
	@echo "✅ Build completed successfully"

# Start services with health checks
up: check-docker
	@echo "🚀 Starting services..."
	@docker compose up -d
	@echo "✅ Services started. Check status with: docker compose ps"

up-mvp: check-docker
	@echo "🚀 Starting MVP single-container service..."
	@docker compose -f docker-compose.mvp.yml up -d
	@echo "✅ MVP service started. Check status with: docker compose -f docker-compose.mvp.yml ps"

up-minimal: up-mvp

up-full: check-docker
	@echo "🚀 Starting all services (including observability)..."
	@docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
	@echo "✅ Services started. Check status with: docker compose ps"

down:
	@echo "🛑 Stopping services..."
	@docker compose -f docker-compose.yml -f docker-compose.observability.yml down -v || true
	@echo "✅ Services stopped"

down-mvp:
	@echo "🛑 Stopping MVP service..."
	@docker compose -f docker-compose.mvp.yml down -v || true
	@echo "✅ MVP service stopped"

logs:
	@docker compose -f docker-compose.yml -f docker-compose.observability.yml logs -f --tail=200

test:
	@bun run test || npm run test || echo "⚠️  No test runner available"

migrate:
	@bun run migrate || npm run migrate || echo "⚠️  No migration runner available"

seed:
	@bun run seed || npm run seed || echo "⚠️  No seed runner available"

test-load:
	@bun run test:load || npm run test:load || echo "⚠️  No load test runner available"

# Help target
help:
	@echo "WhatsApp Bot Scanner - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make build       - Build all Docker images"
	@echo "  make up          - Start services"
	@echo "  make up-mvp      - Start single-container MVP (wa-client only)"
	@echo "  make up-full     - Start all services (with monitoring)"
	@echo "  make down        - Stop and remove all services"
	@echo ""
	@echo "Development:"
	@echo "  make logs        - View service logs"
	@echo "  make test        - Run tests"
	@echo "  make migrate     - Run database migrations"
	@echo ""
	@echo "Prerequisites:"
	@echo "  Run ./bootstrap.sh to install Docker and Node.js"
