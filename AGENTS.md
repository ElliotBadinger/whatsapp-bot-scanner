# Repository Guidelines

## Project Structure & Module Organization

- `services/control-plane`, `services/scan-orchestrator`, and `services/wa-client` host the Fastify services; keep authored TypeScript in each `src/` directory and generated JavaScript in `dist/`.
- `packages/shared` exports queue contracts, config loaders, and logging helpers that every service imports via the `@wbscanner/...` alias.
- Support assets live in `docs/` (architecture, security, runbooks), `db/` plus `scripts/` (SQL migrations and seed runners), and `observability/`, `grafana/`, `reverse-proxy/` (monitoring and ingress).

## Build, Test, and Development Commands

- `make build`, `make up`, and `make down` orchestrate the Docker stack; pair with `make logs` to tail cross-service output while diagnosing issues.
- `npm run build` compiles all workspaces; scope to one service with `npm --workspace services/<name> run build`.
- `npm run dev` launches any workspace `dev` scripts (e.g., `ts-node src/index.ts`), so stop lingering sessions before rebuilding containers.
- Use `npm run migrate` and `npm run seed` for database workflows defined in the `scripts/` helpers.

## Coding Style & Naming Conventions

- `.editorconfig` enforces UTF-8, LF endings, trimmed whitespace, and two-space indentation—configure your editor accordingly.
- `tsconfig.base.json` enables strict typing and ES2020 targets; prefer explicit return types on exported functions and keep async flows promise-based.
- Name files and queues in kebab-case (`domain-scanner.ts`, `link-score-queue`), and log via the shared `logger` to maintain consistent formatting.

## Testing Guidelines

- Jest is configured by `packages/shared/jest.config.js`; place specs in `__tests__/` or name them `<feature>.test.ts` to match the default regex.
- Run `npm test --workspaces` before opening a PR; add workspace-specific `test` scripts when services gain coverage.
- For integration checks, bring the stack up with `make up`, hit Fastify endpoints or BullMQ queues through shared clients, and document manual steps in `docs/RUNBOOKS.md`.
- For any files created or modified, add or update applicable unit, regression, integration, performance, mutation, property-based, and end-to-end tests.

## Commit & Pull Request Guidelines

- Follow conventional commits: `type(scope): summary`, where `scope` maps to a service or package (e.g., `feat(control-plane): add mute audit log`); keep subjects imperative and under 72 characters.
- Reference migrations, dashboards, or external tickets in the body when relevant, and squash fixups before pushing.
- Pull requests should highlight behaviour changes, deployment or rollback notes, and test evidence; add screenshots or logs when altering APIs, dashboards, or alert rules.
- Commits must be opened as pull requests every time.
- After completing any code change or documentation update, agents must create a descriptive commit and push the branch before handing off work. Do not leave uncommitted edits in the workspace.

## Security & Configuration Tips

- Clone `.env.example` when provisioning environments, never commit secrets, and rotate WhatsApp sessions stored by `wa-client` when sharing stacks.
- Revisit `docs/SECURITY_PRIVACY.md` and `docs/THREAT_MODEL.md` when adding external calls or persistence, and keep the control-plane bearer token guard on new routes.
