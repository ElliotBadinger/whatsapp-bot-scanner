# Testing & Quality Checks

The repository uses shared npm scripts so every workspace runs the same linting, type checking, and test commands.

## Monorepo commands

Run all quality gates from the repo root:

- `npm run check` &mdash; runs linting, type checking, and tests for every workspace in sequence.
- `npm run lint` &mdash; executes `eslint` in workspaces that expose a `lint` script (services and shared packages).
- `npm run typecheck` &mdash; executes `tsc --noEmit` in TypeScript workspaces that expose a `typecheck` script.
- `npm test` &mdash; runs each workspace's `test` script (Jest for services, Vitest for test suites).

These commands leverage npm workspaces, so dependencies are installed once at the root while each package owns its own scripts.

## Workspace commands

You can scope checks to an individual workspace when iterating locally:

```bash
npm run lint --workspace services/control-plane
npm run typecheck --workspace services/scan-orchestrator
npm test --workspace services/wa-client
```

The same pattern works for the shared package and test suites (for example, `npm run lint --workspace packages/shared`).

## Continuous integration

The optional GitHub Actions workflow defined in `.github/workflows/quality.yml` installs dependencies with `npm ci` and runs `npm run check`. It keeps linting, type checking, and tests in lock-step with local development.
