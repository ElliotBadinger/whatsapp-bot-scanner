# Codex ↔ Gemini Delegation Architecture

## Goals and Constraints
- Enable unattended codebase maintenance where Codex CLI coordinates tasks and Gemini CLI acts as a specialized sub-agent.
- Reuse the existing CLIs—no additional API keys, hosted services, or external model credentials.
- Keep orchestration logic auditable inside the repository with deterministic JSON interfaces so downstream tooling can trust the outputs.
- Borrow proven patterns (planner/executor/verifier loops) from the research repos under `Research/` without depending on their cloud-specific assumptions.

## Core Roles
- **Planner (Codex CLI)**  
  Issues high-level work breakdowns. Prompted to emit strict JSON describing tasks (`title`, `goal`, `context`, `artifacts`). Runs via `codex exec --json` so reasoning and status events are machine-readable.

- **Executor (Gemini CLI)**  
  Consumes a single task specification and returns either a no-op decision or one or more atomic patches. The prompt enforces a JSON envelope (`{"status": "...","patches":[...]}`) so the orchestrator can apply changes locally using `git apply`/`apply_patch`.

- **Reviewer (Codex CLI)**  
  Re-validates the workspace after executor actions. The reviewer prompt requests a concise verdict plus optional follow-up tasks. This mirrors the verifier in AgentFlow and the tracer/critic loop in Agent Lightning.

- **Orchestrator (Python runner)**  
  Drives the loop: seeds objectives, calls Planner → Executor → Reviewer, persists transcripts, and stops when tasks are approved or retries exhausted. Lives in `scripts/agent_orchestrator/`.

## Execution Flow
1. **Objective Intake** – Operator (or CI) invokes `python scripts/agent_orchestrator/main.py --objective "<goal>"`. The runner loads guardrails (repository guidelines, coding standards) and the latest git status.
2. **Planning Pass** – Planner prompt contextualizes the repo and requests ≤10 ordered tasks. Output is stored at `storage/agent_runs/<timestamp>/plan.json`.
3. **Task Dispatch** – For each pending task:
   - Executor prompt streams relevant files (via `@include` blocks) and prior plan context.
   - Gemini CLI produces structured patches; the orchestrator validates schema, writes patches to `storage/agent_runs/.../patch_N.diff`, and applies them with `git apply`.
   - Optional post-step hooks run lint/test commands configured in `agent_orchestrator/config.yaml`.
4. **Review Loop** – Reviewer receives diff summary + command outputs. If verdict `"pass"`, task is marked complete; if `"retry"`, Planner is re-invoked with reviewer feedback to re-plan the remaining scope.
5. **Completion** – The orchestrator commits changes with a conventional message (scope derived from objective) and can optionally push if `--push` is supplied.

## File & Configuration Layout
- `scripts/agent_orchestrator/main.py` – CLI entrypoint, argument parsing, run lifecycle.
- `scripts/agent_orchestrator/agents.py` – Codex/Gemini adapters (subprocess wrappers, JSON parsing, retry logic).
- `scripts/agent_orchestrator/prompts/` – Prompt templates with injectable metadata (repository guidelines, objective, task state).
- `scripts/agent_orchestrator/config.yaml` – Thresholds (max retries, reviewer enable/disable, test commands).
- `storage/agent_runs/` – Per-run artifacts (raw CLI transcripts, applied patch logs, reviewer reports) for auditing.

## Safety & Guardrails
- Deterministic JSON schemas prevent arbitrary shell execution from the sub-agent. Any malformed output is rejected and triggers a planner retry.
- Git diff summaries and dry-run (`git apply --stat --check`) precede actual patch application to catch context drift.
- Optional allowlist for commands that Codex may authorize inside its reviewer role, keeping destructive actions off limits.

## Implementation Plan
1. Scaffold orchestrator package with CLI entrypoint, config loader, and storage helpers.
2. Implement Codex planner/reviewer adapter with JSON parsing and retry/backoff.
3. Implement Gemini executor adapter with patch schema validation and diff application.
4. Wire execution loop, add smoke-test objective (`--demo`) that exercises end-to-end flow without mutating tracked files.
5. Document usage in `docs/automation/README.md` (future) and register Makefile target for CI automation.


## MCP Server Package
- Installable Python package lives under `scripts/agent_orchestrator/` with entry point `wbscanner-mcp`.
- `scripts/agent_orchestrator/mcp_server.py` exposes a FastMCP server that composes AutoGen chat agents (`CodexPlannerChatAgent`, `GeminiExecutorChatAgent`) with the existing `AgentOrchestrator`.
- Logging flows through `agentlightning.logging.configure_logger`, mirroring Agent Lightning samples; FastMCP usage follows the repo's RAG tooling patterns.

### Installation
```bash
cd scripts/agent_orchestrator
python -m pip install -e .
# (optional) install research dependencies for richer tracing/features
python -m pip install -e ../../Research/agent-lightning
python -m pip install -e ../../Research/autogen/python/packages/autogen-agentchat
python -m pip install -e ../../Research/autogen/python/packages/autogen-core
```

### Running the MCP server
```bash
wbscanner-mcp  # starts FastMCP with repo defaults
```

- Codex CLI: `codex mcp --server stdio --command wbscanner-mcp`
- Gemini CLI: `gemini mcp run --command wbscanner-mcp`
- MCP tool signature: `delegate_objective(objective, dry_run=True, plan_only=False, config_path=None)`

### Configuration
- Defaults live in `scripts/agent_orchestrator/config.yaml` (planner timeout 240 s, executor timeout 420 s, reviews enabled, empty `test_commands`).
- Override by editing the file or supplying `config_path` via the MCP call.

### Research Repo Leverage
- **Agent Lightning** – logging/bootstrap helpers and FastMCP workflow patterns.
- **AutoGen** – `BaseChatAgent` wrappers that translate between CLI wrappers and AutoGen task runners.
- **AgentFlow** – orchestration mirrors the planner → executor → reviewer loop enabling future Flow-GRPO integration.

## Future Enhancements
- Incorporate AgentFlow-style memory to let the planner reference previous runs.
- Swap in Agent Lightning training loops if we later host custom models.
- Extend to additional sub-agents (e.g., test-data synthesizer) by adding more CLI adapters under `agents.py`.
