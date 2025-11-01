# Autogen + AgentFlow Integration Blueprint

## Purpose
- Replace the current Codex/Gemini CLI wrappers with a native Autogen-based orchestration layer that can spawn specialist sub-agents, facilitate critique loops, and negotiate consensus before emitting patches.
- Incorporate AgentFlow-style memory, policy, and telemetry features—including Flow-GRPO training hooks—while preserving existing MCP interfaces, storage layout, and safety guardrails.
- Provide a migration plan that ensures the Codex CLI stack remains a viable fallback and that dry-run/test protections stay enabled by default.

## Current State Snapshot
- **MCP Surface**: `scripts/agent_orchestrator/mcp_server.py` exposes a single `delegate_objective` tool that forwards work to `AgentOrchestrator`.
- **Execution Loop**: `AgentOrchestrator` (planner/executor/reviewer) shells out to Codex & Gemini CLIs. Artifacts are persisted under `storage/agent_runs/<timestamp>/`.
- **Prompts & Policies**: Prompt templates live in `scripts/agent_orchestrator/prompts/`; guardrails and repository norms are loaded from `AGENTS.md`.
- **Safety Rails**: `git apply --check`, dry-run mode, and configurable test commands enforce change validation. Auto-commit/push remain opt-in.
- **Observability**: JSONL transcripts and per-task artifacts exist, but there is no aggregated telemetry or long-term memory across runs.

## Target Capabilities
- **Autogen Multi-Agent Fabric**
  - Lift planner/executor/reviewer roles into Autogen `ConversableAgent` instances.
  - Allow dynamic specialist spawning (e.g., `RefactorAgent`, `TestAuthorAgent`) using Autogen’s hierarchical agent orchestration.
  - Support structured debates with temperature-controlled critique loops prior to patch emission.
- **AgentFlow Memory & Policy Enhancements**
  - Integrate persistent run memory (per objective and cross-run) stored alongside `storage/agent_runs/` metadata.
  - Add policy hooks for Flow-GRPO tuning, enabling reward feedback from reviewers/tests.
  - Surface retry strategies (plan/execution/review) via AgentFlow policy modules instead of hard-coded retry counts.
- **Telemetry & UX**
  - Emit structured MCP responses with debate summaries, confidence scores, and policy decisions.
  - Expose toggles for enabling/disabling Autogen, memory, and experimentation modes.
  - Maintain existing output schema so downstream tools can ignore new fields when disabled.

## High-Level Architecture
```
┌───────────────────────────────┐     ┌───────────────────────────────┐
│ FastMCP Server (delegate_…)   │────▶│ Autogen Orchestrator Manager  │
└───────────────────────────────┘     └───────────────────────────────┘
                                            │
                                            │ registers planners/reviewers/executors
                                            ▼
      ┌──────────────────┬───────────────────────┬─────────────────────┐
      │ Planner Guild    │ Critic Guild          │ Executor Guild      │
      │ (Codex fallback) │ (AgentFlow critics)   │ (Patch writers)     │
      └──────────────────┴───────────────────────┴─────────────────────┘
                │                   │                     │
                ▼                   ▼                     ▼
        Memory/Policy Layer ◀───────┼───────────▶ Telemetry Sink
                │                                     │
                ▼                                     ▼
      `storage/agent_runs/<ts>/`          MCP response + log streaming
```

- **Autogen Orchestrator Manager**: New Python module coordinating agent registration, debate loops, and fallbacks. Wraps existing `AgentOrchestrator` for legacy mode.
- **Planner Guild**: Primary planner plus optional specialists (e.g., risk analyst). When Autogen is disabled, a shim invokes the existing Codex CLI.
- **Critic Guild**: Implements AgentFlow-style critiques with Flow-GRPO signals. Critics annotate patches before application; consensus logic can veto unsafe changes.
- **Executor Guild**: Coordinates patch authors (Gemini or other models) and test agents. Produces diffs that still pass through the existing `git apply` / dry-run validation.
- **Memory/Policy Layer**: Stores episodic memory, objective summaries, retry outcomes, and reward signals. Built atop AgentFlow abstractions with persistence in `storage/agent_runs/<ts>/memory.json` plus a lightweight SQLite/JSON index for cross-run recall.
- **Telemetry Sink**: Aggregates debate transcripts, policy decisions, retry counts, and emits condensed data back through MCP responses and optional OpenTelemetry exporters.

## Key Components & Interfaces
- `AutogenManager`: Initializes Autogen agents, configures routing policies, and proxies `delegate_objective` requests.
- `AgentFlowPolicyController`: Applies memory recall, retry decisions, and Flow-GRPO updates; integrates with the planner to adjust task decomposition.
- `MemoryStore`: File-backed store with optional pluggable adapters (SQLite, Redis). Defaults to JSON under `storage/agent_runs/`.
- `TelemetryEmitter`: Bridges AgentFlow telemetry to FastMCP responses (e.g., new `metrics` field) and optional WebSocket streams.
- **Configuration Flags** (added to `config.yaml`):
  - `autogen.enabled` (default false)
  - `autogen.allow_specialists`
  - `agentflow.memory.enabled`
  - `agentflow.policy.mode` (`"static" | "flow-grpo" | "off"`)
  - `telemetry.verbose`

## Migration Strategy Overview
1. **Scaffold Autogen Modules (Phase 0)**
   - Introduce Autogen manager and wiring with feature flag disabled.
   - Add configuration schema, telemetry placeholders, and memory storage scaffolding.
2. **Shadow Mode Execution (Phase 1)**
   - Run Autogen agents in shadow alongside CLI orchestrator; capture decisions without applying patches.
   - Validate debate loops, memory writes, and telemetry coverage.
3. **Selective Task Execution (Phase 2)**
   - Allow Autogen executor to propose patches while reviewer still uses Codex CLI. Compare outcomes.
   - Enable Flow-GRPO policy tuning using reviewer verdicts/tests as reward.
4. **Full Autogen Takeover (Phase 3)**
   - Promote Autogen planner/executor/reviewer to primary path. Fallback to CLI on failure.
   - Document toggles for manual rollback.
5. **Extended Specialists & Telemetry (Phase 4)**
   - Add optional specialists (e.g., security auditor) and expose telemetry dashboards.

## Safety & Compliance Considerations
- Preserve dry-run/test enforcement; Autogen executors must still pass through `_apply_patch`.
- Limit specialist capabilities with explicit tool/command allowlists.
- Persist debate transcripts for auditing and include reviewer veto logging.
- Ensure memory store encrypts or redacts sensitive data if objectives contain secrets.
- Maintain Codex CLI fallback path; Autogen must auto-disable when dependencies are missing.

## Open Questions
- Preferred backing store for cross-run memory (lightweight SQLite vs. JSON files)?
- How should Flow-GRPO rewards be parameterized for non-binary reviewer outcomes?
- Do we need to expose telemetry via MCP streaming or rely on storage artifacts?

## Stakeholder Engagement & Decisions
- **Audience**: automation maintainers (Codex/Gemini delegations), platform reliability, security reviewers, and observability owners.
- **Distribution Plan**: circulate this blueprint plus the roadmap via the #automation-engineering channel and the weekly platform sync on **October 30, 2025**; request async comments in the doc within 48 hours.
- **Decision Log**:
  - `2025-10-30 – Memory backing store`: solicit input from platform + data infra (owner: Priya R.). **Status**: pending.
  - `2025-10-30 – Flow-GRPO reward shape`: schedule follow-up with research leads (owner: Mateo L.). **Status**: pending.
  - `2025-10-31 – Telemetry surface`: demo telemetry emitter to observability team (owner: Riley S.). **Status**: pending.
- **Next Actions**: compile stakeholder feedback into this section; mark each decision item as `resolved` when an approach is agreed and link out to supporting notes (e.g., `storage/agent_runs/20251030/stakeholder-notes.json`).
