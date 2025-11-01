# Setup Wizard Test Notes

## Summary
Dry-run, automated, and fully interactive checks confirm the Node-based wizard exercises each setup stage while remaining safe for CI and non-interactive environments.

| Date | Environment | Command | Focus | Result | Notes |
| ---- | ----------- | ------- | ----- | ------ | ----- |
| 2025-11-01 | Linux (Ubuntu, repo sandbox) | `./setup.sh --dry-run --noninteractive` | Full flow sans Docker launch | ✅ | Verifies preflight, `.env` mutations, config validation, API key checks (with graceful skips), post-run summaries. |
| 2025-11-01 | GitHub Actions dry-run | `npm --workspace tests/integration run test -- setup-wizard.test.ts` | Automated smoke test | ✅ | Uses new `SETUP_ENV_PATH` and skip flags to confirm headless execution without touching real `.env`. |
| 2025-11-01 | macOS 14 (Support Ops) | `./setup.sh` | Happy-path interactive run | ✅ | Transcript captured in `docs/setup-wizard-happy-path-transcript.md`; confirmed Docker build/start, pairing watcher audio, and postrun summary. |

## Functional Checks
- **Preflight dependencies:** Verified interactively on macOS (2025-11-01) with Docker Desktop 4.35; wizard proceeded without skip flags.
- **.env creation/update:** Confirmed via automated integration test using `SETUP_ENV_PATH` to isolate artifacts.
- **RemoteAuth prompts:** Manual happy-path run captured user acceptance of auto-pair and fallback guidance.
- **Docker build/start:** Happy-path run completed full `make build` + `make up`; logs archived in product ops Confluence.
- **Pairing watcher launch:** Audio confirmation recorded during happy-path session; optional prompt behaves correctly when declined.
- **Postrun summary:** Validated in both interactive and dry-run outputs, including missing key reminders.

## Follow-up Coverage
- macOS terminal dry-run parity validated informally; Linux dry-run covered by CI. Windows PowerShell check remains on backlog.

## Outstanding Validation Items
- Evaluate transcript export to file when CI flag provided (tracked in setup wizard backlog).

## Sign-off
- 2025-11-01 — Engineering: Alex Rivera (CLI/Tooling).
- 2025-11-01 — Support Ops: Jamie Patel (Non-technical stakeholder).
