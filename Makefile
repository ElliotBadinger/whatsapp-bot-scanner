SHELL := /bin/bash

.PHONY: build up down logs test migrate seed fmt lint

build:
	docker compose build --parallel

up:
	docker compose up -d

down:
	docker compose down -v

logs:
	docker compose logs -f --tail=200

test:
	npm test --workspaces

migrate:
	npm run migrate

seed:
	npm run seed

