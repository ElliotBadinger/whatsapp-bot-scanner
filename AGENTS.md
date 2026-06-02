# Repository Guidelines

## What this is

A WhatsApp link/bot scanner for **community and group admins** who self-host it.
The bot watches group messages, extracts URLs, scans them with local heuristics
plus free threat feeds, and posts a verdict back to the group. The MVP goal is a
single container an admin can run with one command — no control plane, no Redis,
no message queue, no dashboards.

## Project Structure & Module Organization

- `services/wa-client` — the bot. Connects to WhatsApp via the **Baileys** adapter
  (`src/adapters/`), handles messages (`src/handlers/message-handler.ts`), and runs
  scans through an in-process queue (`src/queues/in-process-scan-queue.ts`). The
  single entry point is `src/main.ts`.
- `services/landing-page` — the marketing/landing site.
- `packages/scanner-core` — the scanning brain (URL heuristics + feed scoring). This
  is the product's core value; keep it well-tested.
- `packages/shared` — config loaders, logging, metrics, and scan utilities imported
  via the `@wbscanner/...` alias.
- `packages/confusable` — homoglyph/confusable detection used by the scanner.
- `scripts/` — the guided setup CLI (`unified-cli.mjs`), corpus/feed tooling, and the
  offline robustness/benchmark harness.
- `docker/Dockerfile` + `docker-compose.mvp.yml` — the single-container MVP build.

The advanced multi-service stack (control plane, scan orchestrator, observability)
was retired; it lives in the `pre-mvp-archive` git tag if ever needed again.

## Build, Test, and Development Commands

- `bun install` — install workspace dependencies.
- `bun run build` / `bun run type-check` / `bun run lint` — across all workspaces;
  scope to one with `bun run --filter '@wbscanner/wa-client' <script>`.
- `bun run test` — run the Jest suites across workspaces.
- `docker compose -f docker-compose.mvp.yml up --build` — run the MVP container.
- `bun scripts/unified-cli.mjs` — guided one-command setup for self-hosters.

## Coding Style & Naming Conventions

- `.editorconfig` enforces UTF-8, LF endings, trimmed whitespace, and two-space
  indentation.
- `tsconfig.base.json` enables strict typing; prefer explicit return types on
  exported functions and keep async flows promise-based.
- Name files in kebab-case; log via the shared `logger` for consistent formatting.

## Testing Guidelines

- Jest is the test runner. Place specs in `__tests__/` or name them
  `<feature>.test.ts`.
- Write **unit/regression tests** for changed behaviour — that is the expected tier.
  Add property-based tests (fast-check) where they pull their weight, especially in
  `scanner-core`. Heavier tiers (integration/e2e/performance) are optional and only
  warranted when a change needs them; do not add ceremony the MVP doesn't need.
- Run `bun run test` before opening a PR.

## Commit & Pull Request Guidelines

- Conventional commits: `type(scope): summary`, scope mapping to a service or
  package (e.g. `feat(scanner-core): add punycode heuristic`). Keep subjects
  imperative and under 72 characters.
- Deliver changes via pull requests; do not push directly to the default branch.
- PRs should describe the behaviour change and include test evidence.
- Commit and push your branch before handing off; do not leave uncommitted edits.

## Security & Configuration Tips

- Clone `.env.mvp.example` when provisioning; never commit secrets, and rotate the
  WhatsApp session stored by `wa-client` when sharing a stack.
- The link corpus and dataset reports contain **real malicious URLs** — never open
  them in a browser; use isolated environments. See `docs/LINK_CORPUS.md`.
- Revisit `docs/SECURITY_PRIVACY.md` and `docs/THREAT_MODEL.md` when adding external
  calls or persistence.
