# WhatsApp Bot Scanner MVP Plan

## What exists now (MVP)

- **WhatsApp ingest (`services/wa-client/`)**: receives messages, extracts URLs, runs local heuristics, posts verdicts.
- **Scanner core (`packages/scanner-core/`)**: deterministic URL extraction + scoring.
- **Shared helpers (`packages/shared/`)**: normalization, config, logging.

## Scope

- Single container, single process.
- No Redis, no queues, no control-plane.
- External enrichers off by default.

## Archived

Advanced services and infrastructure live under `archive/` and are out of scope for MVP.
