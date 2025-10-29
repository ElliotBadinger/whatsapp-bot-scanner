from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]

# Ensure agent-lightning utilities are importable when running in-place.
AGENT_LIGHTNING_PATH = REPO_ROOT / "Research" / "agent-lightning"
if AGENT_LIGHTNING_PATH.exists() and str(AGENT_LIGHTNING_PATH) not in sys.path:
    sys.path.insert(0, str(AGENT_LIGHTNING_PATH))

try:  # pragma: no cover
    from agentlightning.logging import configure_logger
except ImportError:  # pragma: no cover - fallback logger
    def configure_logger(level: int = logging.INFO, name: str = "wbscanner.mcp") -> logging.Logger:
        logger = logging.getLogger(name)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s - %(message)s"))
        logger.handlers.clear()
        logger.addHandler(handler)
        logger.setLevel(level)
        logger.propagate = False
        return logger

try:  # pragma: no cover
    from fastmcp import FastMCP
except ImportError as error:  # pragma: no cover
    raise ImportError("fastmcp is required. Install via `pip install fastmcp`.") from error

if __package__ is None:  # pragma: no cover
    package_dir = Path(__file__).resolve().parent
    if str(package_dir) not in sys.path:
        sys.path.insert(0, str(package_dir))
    from cli_agents import CodexPlannerChatAgent, GeminiExecutorChatAgent  # type: ignore
    from config import RunnerConfig, load_config  # type: ignore
    from main import AgentOrchestrator, Task  # type: ignore
    from utils import load_guidelines, parse_json  # type: ignore
else:  # pragma: no cover
    from .cli_agents import CodexPlannerChatAgent, GeminiExecutorChatAgent
    from .config import RunnerConfig, load_config
    from .main import AgentOrchestrator, Task
    from .utils import load_guidelines, parse_json

LOGGER = configure_logger(name="wbscanner.mcp")
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"

mcp = FastMCP(name="wbscanner codex-gemini orchestrator")


async def _run_planner(
    objective: str,
    planner_agent: CodexPlannerChatAgent,
) -> Dict[str, Any]:
    """Invoke the Codex planner through AutoGen and parse the JSON response."""

    planner_result = await planner_agent.run(task=objective)
    if not planner_result.messages:
        raise ValueError("Planner produced no messages.")

    plan_text = getattr(planner_result.messages[-1], "content", "")
    if not plan_text:
        raise ValueError("Planner returned an empty response.")

    plan_data = parse_json(plan_text)
    if not isinstance(plan_data, dict):
        raise ValueError("Planner response must be a JSON object.")
    return plan_data


async def _run_executor(
    payload: Dict[str, Any],
    executor_agent: GeminiExecutorChatAgent,
) -> Dict[str, Any]:
    """Invoke the Gemini executor via AutoGen and parse its JSON response."""

    executor_result = await executor_agent.run(task=json.dumps(payload, indent=2))
    if not executor_result.messages:
        raise ValueError("Executor produced no messages.")

    executor_text = getattr(executor_result.messages[-1], "content", "")
    if not executor_text:
        raise ValueError("Executor returned an empty response.")

    execution = parse_json(executor_text)
    if not isinstance(execution, dict):
        raise ValueError("Executor response must be a JSON object.")
    return execution


def _materialize_tasks(plan_json: Dict[str, Any]) -> List[Task]:
    """Transform planner JSON into Task dataclass instances."""

    raw_tasks = plan_json.get("tasks", [])
    tasks: List[Task] = []
    for index, raw_task in enumerate(raw_tasks, start=1):
        if not isinstance(raw_task, dict):
            continue
        task = Task(
            id=str(raw_task.get("id") or f"plan-{index}"),
            title=str(raw_task.get("title") or f"Task {index}"),
            goal=str(raw_task.get("goal") or ""),
            context=str(raw_task.get("context") or ""),
            artifacts=list(raw_task.get("artifacts") or []),
        )
        tasks.append(task)
    return tasks


def _task_payload(objective: str, task: Task) -> Dict[str, Any]:
    """Construct a serialized payload for the executor."""

    return {"objective": objective, "task": task.to_dict()}


def _store_plan(
    run_dir: Path,
    objective: str,
    plan_json: Dict[str, Any],
    tasks: List[Task],
) -> None:
    """Persist plan metadata for traceability."""

    payload = {
        "objective": objective,
        "notes": plan_json.get("notes"),
        "tasks": [task.to_dict() for task in tasks],
    }
    (run_dir / "plan.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _store_task_artifacts(
    run_dir: Path,
    task: Task,
    execution: Dict[str, Any],
    review: Dict[str, Any],
    tests: List[Dict[str, Any]],
) -> None:
    """Persist per-task execution artifacts."""

    payload = {
        "task": task.to_dict(),
        "execution": execution,
        "review": review,
        "tests": tests,
    }
    path = run_dir / f"task_{task.id}.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


@mcp.tool(
    name="delegate_objective",
    description="Plan and execute repository work via Codex & Gemini CLIs.",
)
async def delegate_objective(
    objective: str,
    dry_run: bool = True,
    plan_only: bool = False,
    config_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Expose the multi-agent orchestration loop as an MCP tool."""

    LOGGER.info("Starting MCP delegation. objective=%s dry_run=%s plan_only=%s", objective, dry_run, plan_only)
    if not objective:
        raise ValueError("Objective is required.")

    config_file = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    config: RunnerConfig = load_config(config_file)

    orchestrator = AgentOrchestrator(REPO_ROOT, config, dry_run=dry_run)
    guidelines = orchestrator.guidelines or load_guidelines(REPO_ROOT)

    planner_agent = CodexPlannerChatAgent(
        codex=orchestrator.planner,
        guidelines=guidelines,
        git_status=orchestrator._git_status,
        objective_hint=objective,
        timeout_seconds=config.codex_timeout_seconds,
    )
    plan_json = await _run_planner(objective, planner_agent)
    tasks = _materialize_tasks(plan_json)
    _store_plan(orchestrator.run_dir, objective, plan_json, tasks)

    if plan_only:
        LOGGER.info("Plan-only mode enabled; returning early.")
        return {
            "objective": objective,
            "plan": plan_json,
            "tasks": [task.to_dict() for task in tasks],
            "run_dir": str(orchestrator.run_dir.relative_to(REPO_ROOT)),
        }

    executor_agent = GeminiExecutorChatAgent(
        gemini=orchestrator.executor,
        repo_root=REPO_ROOT,
        guidelines=guidelines,
        git_status=orchestrator._git_status,
        timeout_seconds=config.gemini_timeout_seconds,
    )

    results: List[Dict[str, Any]] = []
    for task in tasks:
        execution = await _run_executor(_task_payload(objective, task), executor_agent)
        execution.setdefault("returncode", None)

        patches = execution.get("patches") or []
        if execution.get("status") == "apply" and isinstance(patches, list):
            patch_results: List[Dict[str, Any]] = []
            for index, patch in enumerate(patches, start=1):
                result = orchestrator._apply_patch(task, patch, index)
                patch_results.append(result)
                if not result.get("applied", False):
                    break
            execution["patch_results"] = patch_results
        else:
            execution["status"] = execution.get("status", "skip")
            execution["patch_results"] = []

        tests: List[Dict[str, Any]] = []
        if execution.get("status") == "apply" and not orchestrator.dry_run:
            tests = orchestrator.run_tests()

        review: Dict[str, Any] = {}
        if orchestrator.config.review_enabled and execution.get("status") == "apply":
            review = orchestrator.review(task, objective, tests)

        _store_task_artifacts(orchestrator.run_dir, task, execution, review, tests)
        results.append(
            {
                "task": task.to_dict(),
                "execution": execution,
                "review": review,
                "tests": tests,
            }
        )

    LOGGER.info("Delegation completed. tasks=%d", len(results))
    return {
        "objective": objective,
        "plan": plan_json,
        "results": results,
        "run_dir": str(orchestrator.run_dir.relative_to(REPO_ROOT)),
    }


def main() -> None:
    """Launch the FastMCP server."""

    LOGGER.info("Starting wbscanner Codex↔Gemini MCP server.")
    mcp.run()


if __name__ == "__main__":
    main()

