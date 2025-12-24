# WhatsApp Bot Scanner MVP Plan

## Current Components

- **WhatsApp ingest (`services/wa-client/`)**: Receives WhatsApp messages, extracts URLs, and forwards them into the scan pipeline.
- **Scan pipeline orchestrator (`services/scan-orchestrator/`)**: Coordinates URL scans, leverages shared contracts, and would normally dispatch work to queue workers.
- **Shared URL/scoring modules (`packages/shared/`)**: Provides URL parsing/normalization, scoring utilities, config loaders, and queue/type contracts used across services.
- **Existing scripts and helpers**:
  - `scripts/` utilities (e.g., migrations, setup helpers) that accompany service workflows.
  - `docker/` build scripts and `docker-compose.yml` for multi-service local runs.
  - `Makefile` targets for building and running the stack.

## MVP Scope (kept for now)

- Run path focused on WhatsApp ingest and scan orchestration without external infrastructure.
- Keep shared URL parsing/scoring helpers from `packages/shared/` to avoid duplication across services.
- Use existing local entrypoints for development:
  - `npm --workspace services/wa-client run dev` or equivalent service dev scripts.
  - `npm --workspace services/scan-orchestrator run dev` for the pipeline coordinator.
  - `make build` / `npm run build --workspaces` for optional builds if needed.

## Deferred/Post-MVP Items

- **Control-plane service** (`services/control-plane/`): Management APIs and auth flows are paused until after the MVP.
- **Reverse proxy/ingress** (`reverse-proxy/`, `docker` Nginx configs): Deployment-facing routing and TLS termination are out of scope.
- **Observability stack** (`observability/`, `grafana/`, `docker-compose.observability.yml`): Metrics, dashboards, and alerting are parked until after core functionality stabilizes.
- **Queue/broker dependency paths**: Redis/BullMQ-backed workers and Postgres migrations remain optional; avoid requiring them for the MVP run path.

## MVP Constraints Checklist

- [ ] No mandatory Redis/BullMQ/Postgres runtime requirements for the default run path.
- [ ] Single-process execution path available (e.g., run ingest + orchestrator locally without extra workers).
- [ ] External enrichers/third-party calls remain optional and **off by default**.
- [ ] Documented scripts/entrypoints map to current directories (e.g., `services/wa-client`, `services/scan-orchestrator`, `packages/shared`, `docker-compose.yml`, `Makefile`).
- [ ] Reintroduce deferred components only after the core ingest + pipeline flow is stable.
