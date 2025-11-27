SHELL := /bin/bash

.PHONY: build up up-full down logs test migrate seed fmt lint test-load

build:
	docker compose -f docker-compose.yml -f docker-compose.observability.yml build --parallel

up:
	docker compose up -d

up-minimal:
	docker compose up -d

up-full:
	docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d

down:
	docker compose -f docker-compose.yml -f docker-compose.observability.yml down -v

logs:
	docker compose -f docker-compose.yml -f docker-compose.observability.yml logs -f --tail=200

test:
	npm test --workspaces

migrate:
	npm run migrate

seed:
	npm run seed

test-load:
	npm run test:load
