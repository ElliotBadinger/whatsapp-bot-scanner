# Setup Wizard Overhaul Design

## Goals
- Provide a narrative, confidence-building setup journey for first-time operators.
- Replace linear bash prompts with a guided wizard featuring menus, inline help, and visible progress.
- Preserve non-interactive and CI compatibility by supporting `--noninteractive` and environment fallbacks.
- Keep destructive operations obvious and confirmed with a summarized plan prior to execution.
- Reduce repeated container tear-down/start cycles by orchestrating Docker work in grouped phases.

## Key Decisions
- **Runtime:** Migrate orchestration to a Node.js CLI (`scripts/setup-wizard.mjs`) that drives tasks via `execa`. Bash wrapper (`setup.sh`) remains as an entry point for portability.
- **CLI Libraries:** Adopt
  - `enquirer` for accessible prompts, checkboxes, and contextual help text.
  - `listr2` for ordered task lists with progress indicators and live status.
  - `chalk`/`log-symbols` for high-contrast messaging.
  - `ora` for spinners where long-running subtasks (e.g., Docker build) require sustained feedback.
- **Configuration Handling:** Load and persist `.env` edits through an idempotent parser/serializer (no reliance on sed/awk). Secrets generated with `crypto.randomBytes`.
- **API Key Capture:** Present grouped integrations with guidance, defaults, and “remind me later” toggles that flow into a post-run checklist.
- **WhatsApp Pairing:** Offer a side-by-side explanation of RemoteAuth auto-pair vs QR flow, capture preference, and surface next steps or optional watcher launch.
- **Testing Hooks:** Introduce a dry-run flag plus task-level unit exercises (`npm run test --workspace tests/setup-wizard` TBD) so CI can cover preflight + env mutations.

## Flow Outline
1. **Welcome & Mode Selection:** Boxed introduction, explain estimated duration, confirm readiness.
2. **Plan Builder:** Checkbox selector for pull/clean/reset + branch override; show computed summary before execution.
3. **Preflight:** Validate command prerequisites, optionally install Docker Compose plugin hints, confirm daemon availability.
4. **Repository Prep:** Optional tarball extraction, branch checkout, code/image pulls.
5. **Environment Prep:** Bootstrap `.env`, generate secrets, capture API keys (with inline docs), queue validation, port check advisories.
6. **Config Validation:** Run Node validator and present actionable error cards.
7. **Build & Launch:** Consolidated Docker build/up with streaming logs, progress ticks, and failure remediation hints.
8. **Health & Pairing:** Watch containers, perform HTTP health checks, guide pairing flow, optionally launch watcher.
9. **Postrun Dashboard:** Summaries for observability URLs, missing keys, disabled integrations, troubleshooting FAQ, and exportable transcript.

## Accessibility Considerations
- Default to high-contrast chalk palette; detect `NO_COLOR`/`--no-color`.
- Provide textual progress updates beyond spinner glyphs (percentage/step counts).
- Allow skipping sound-based cues; maintain plain-text alternatives for transcripts/non-TTYs.
- Respect `CI=true` and `SETUP_NONINTERACTIVE` to bypass interactive UI entirely.

## Open Implementation Questions
- Should we persist the execution transcript to `./logs/setup-YYYYMMDDHHMM.log` for support sharing?
- How do we expose “dry run” without altering production environment (e.g., `--dry-run` that stops after plan + preflight)?
