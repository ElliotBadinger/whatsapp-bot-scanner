# Autogen + AgentFlow Rollout Roadmap

## Guiding Principles
- Ship incremental slices that can be feature-gated or rolled back quickly.
- Keep Codex/Gemini CLI orchestration functional until Autogen proves parity.
- Validate every milestone with automated tests plus manual smoke-runs, and capture metrics needed for Flow-GRPO policy tuning.

## Milestones

### M1 — Foundation Scaffolding
- Deliverables:
  - Autogen manager module and configuration flags (`autogen.*`, `agentflow.*`, `telemetry.*`).
  - Memory store abstraction (file-backed) with no-op policy controller.
  - MCP responses extended with `engine` metadata while defaulting to CLI mode.
- Validation:
  - Unit tests for configuration parsing and feature flag branching.
  - Smoke run (`--demo`) verifying CLI path still executes.
- Backward Compatibility:
  - Flags disabled by default; Codex/Gemini path untouched.

### M2 — Shadow Autogen Runs
- Deliverables:
  - Autogen planner/executor/reviewer prototypes invoked in shadow (no patch application).
  - Debate transcripts persisted to `storage/agent_runs/<ts>/autogen/`.
  - Telemetry emitter records agent timings and decision summaries.
- Validation:
  - Compare Autogen plan/execution outputs to CLI equivalents on fixed objectives.
  - Ensure storage artifacts are created without altering workspace.
- Backward Compatibility:
  - Shadow mode toggle (`autogen.shadow_mode`) ensures Autogen can't modify files.

### M3 — Hybrid Execution
- Deliverables:
  - Autogen executor allowed to emit patches gated by reviewer consensus (Codex critic as arbiter).
  - AgentFlow memory recall informs planner prompts (e.g., include prior TODOs).
  - Flow-GRPO reward hooks capture reviewer verdict/test results.
- Validation:
  - Regression tests covering `_apply_patch` dry-run path.
  - Integration run applying a small, reversible change to confirm patch plumbing.
  - Manual audit of memory entries for correctness.
- Backward Compatibility:
  - Rollback switch flips executor back to CLI by setting `autogen.mode=legacy`.

### M4 — Full Autogen Orchestration
- Deliverables:
  - Autogen planner/reviewer become primary; Codex CLI invoked only on failure.
  - Policy controller dynamically adjusts retry limits and specialist spawns.
  - MCP responses include debate summary, critic verdicts, and Flow-GRPO reward metrics.
- Validation:
  - Extended demo covering multiple tasks with at least one forced retry.
  - Canary runs in CI w/ telemetry dashboards tracking success rate & latency.
- Backward Compatibility:
  - `autogen.enabled` flag remains the master switch; legacy CLI path well-tested.

### M5 — Specialist Expansion & Telemetry Surfacing
- Deliverables:
  - Optional specialist agents (e.g., security, docs) configurable per objective.
  - Telemetry streaming to observability stack (OpenTelemetry or logs JSON).
  - Documentation updates for runbooks and MCP clients.
- Validation:
  - Load-testing multi-agent debates to ensure resource limits hold.
  - Security review for memory persistence and telemetry payloads.
- Backward Compatibility:
  - Specialists disabled by default; telemetry streaming opt-in.

## Validation & Quality Gates
- **Automated Tests**: Extend unit/integration suites to cover config toggles, memory read/write, fallback logic, and telemetry serialization.
- **Canary Objectives**: Maintain a catalog of repeatable objectives (lint fix, doc edit, small refactor) to benchmark success rates before enabling Autogen broadly.
- **Observability**: Create Grafana panels (latency, retry count, agreement rate) fed by telemetry emitter.
- **Launch Reviews**: Gate each milestone with security/privacy review (per docs/SECURITY_PRIVACY.md) and update docs/automation runbooks.

## Release Management
- Feature flags stored in `config.yaml`; MCP can override via parameters while enforcing safe defaults.
- Document change-management steps (toggle order, rollback procedure) in docs/automation/codex-gemini-delegation.md.
- Provide migration notes in release PRs and ensure storage schema migrations include backward-compatible readers.
