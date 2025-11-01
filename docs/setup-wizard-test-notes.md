# Setup Wizard Test Notes

## Summary
Dry-run and targeted checks confirm the Node-based wizard exercises each setup stage while remaining safe for CI and non-interactive environments.

| Date | Environment | Command | Focus | Result | Notes |
| ---- | ----------- | ------- | ----- | ------ | ----- |
| 2025-11-01 | Linux (Ubuntu, repo sandbox) | `./setup.sh --dry-run --noninteractive` | Full flow sans Docker launch | ✅ | Verifies preflight, `.env` mutations, config validation, API key checks (with graceful skips), post-run summaries. |

## Follow-up Coverage
- Docker build/start and container health checks will execute during a normal `./setup.sh` run (omitted here via `--dry-run` to avoid perturbing shared environments). Recommend running once per release candidate.
- WhatsApp pairing watcher prompt observed in manual interactive run (QA to attach audio cues verification).

## Outstanding Validation Items
- macOS terminal dry-run to confirm ANSI rendering parity.
- Full interactive “happy path” run captured in `docs/setup-wizard-happy-path-transcript.md`.
