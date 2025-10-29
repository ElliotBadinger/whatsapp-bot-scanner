from __future__ import annotations

import asyncio
import json
import logging
import sys
from concurrent.futures import Future
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]

# Ensure research logging helpers are importable when running in-place.
AGENT_LIGHTNING_PATH = REPO_ROOT / "Research" / "agent-lightning"
if AGENT_LIGHTNING_PATH.exists() and str(AGENT_LIGHTNING_PATH) not in sys.path:
    sys.path.insert(0, str(AGENT_LIGHTNING_PATH))

try:  # pragma: no cover - optional dependency
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
    import fastmcp as _fastmcp_module
    from fastmcp import FastMCP
except ImportError as error:  # pragma: no cover
    raise ImportError("fastmcp is required. Install via `pip install fastmcp`.") from error
else:
    _fastmcp_module.settings.show_cli_banner = False  # type: ignore[attr-defined]

if __package__ is None:  # pragma: no cover - script execution
    package_dir = Path(__file__).resolve().parent
    if str(package_dir) not in sys.path:
        sys.path.insert(0, str(package_dir))
    from config import RunnerConfig, load_config  # type: ignore
    from main import AgentOrchestrator  # type: ignore
else:  # pragma: no cover
    from .config import RunnerConfig, load_config
    from .main import AgentOrchestrator

LOGGER = configure_logger(name="wbscanner.mcp")
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"


@dataclass
class BackgroundRun:
    objective: str
    run_dir: Path
    future: Future
    plan_source_run: Optional[str] = None
    plan_only: bool = False
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


RUN_REGISTRY: Dict[str, BackgroundRun] = {}

mcp = FastMCP(name="wbscanner codex-gemini orchestrator")


def _resolve_run_dir(run_id: str) -> Path:
    base_dir = (REPO_ROOT / "storage" / "agent_runs").resolve()
    run_dir = (base_dir / run_id).resolve()
    run_dir.relative_to(base_dir)  # Raises ValueError if outside base dir
    return run_dir


def _load_plan(run_id: str) -> Dict[str, Any]:
    run_dir = _resolve_run_dir(run_id)
    plan_path = run_dir / "plan.json"
    if not plan_path.is_file():
        raise ValueError(f"No stored plan found for run_id '{run_id}'. Expected {plan_path}.")
    return json.loads(plan_path.read_text(encoding="utf-8"))


def _register_background_run(run_id: str, run: BackgroundRun) -> None:
    def _on_complete(future: Future) -> None:
        try:
            run.result = future.result()
        except Exception as exc:  # pragma: no cover - surfaced via get_run_status
            run.error = str(exc)
        finally:
            run.completed_at = datetime.now(timezone.utc)
            LOGGER.info("Background run %s finished (error=%s).", run_id, bool(run.error))

    run.future.add_done_callback(_on_complete)
    RUN_REGISTRY[run_id] = run


@mcp.tool(
    name="delegate_objective",
    description="Plan and execute repository work via Codex & Gemini CLIs.",
)
async def delegate_objective(
    objective: str,
    dry_run: bool = True,
    plan_only: bool = False,
    config_path: Optional[str] = None,
    resume_run_id: Optional[str] = None,
    wait_seconds: Optional[float] = 45.0,
) -> Dict[str, Any]:
    """Expose the multi-agent orchestration loop as an MCP tool."""

    if not objective:
        raise ValueError("Objective is required.")

    config_file = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    config: RunnerConfig = load_config(config_file)

    plan_payload: Optional[Dict[str, Any]] = None
    plan_source_run: Optional[str] = None
    if resume_run_id:
        plan_payload = _load_plan(resume_run_id)
        plan_source_run = resume_run_id

    orchestrator = AgentOrchestrator(REPO_ROOT, config, dry_run=dry_run)
    loop = asyncio.get_running_loop()

    LOGGER.info(
        (
            "Starting MCP delegation. objective=%s dry_run=%s plan_only=%s "
            "attempts(plan/exec)=%s/%s resume_run_id=%s"
        ),
        objective,
        dry_run,
        plan_only,
        config.max_replan_attempts,
        config.max_executor_retries,
        resume_run_id,
    )

    future = loop.run_in_executor(
        None,
        lambda: orchestrator.run_objective(
            objective,
            plan_only=plan_only,
            existing_plan=plan_payload,
            plan_source_run=plan_source_run,
        ),
    )

    wait_timeout = None
    if wait_seconds is not None:
        wait_timeout = max(0.0, float(wait_seconds))

    if wait_timeout == 0.0:
        run_id = orchestrator.run_dir.name
        _register_background_run(
            run_id,
            BackgroundRun(
                objective=objective,
                run_dir=orchestrator.run_dir,
                future=future,
                plan_source_run=plan_source_run,
                plan_only=plan_only,
            ),
        )
        return {
            "status": "in_progress",
            "objective": objective,
            "run_id": run_id,
            "run_dir": str(orchestrator.run_dir.relative_to(REPO_ROOT)),
            "plan_only": plan_only,
            "message": (
                "Planning continues asynchronously. Poll get_run_status to retrieve the plan."
                if plan_only
                else "Execution scheduled asynchronously. Poll get_run_status to monitor progress."
            ),
        }

    wrapped_future = asyncio.wrap_future(future)
    done, _ = await asyncio.wait({wrapped_future}, timeout=wait_timeout)
    if wrapped_future in done:
        result = wrapped_future.result()
        if plan_only:
            LOGGER.info(
                "Plan completed within wait window. tasks=%s",
                len(result.get("tasks", [])),
            )
        else:
            LOGGER.info(
                "Delegation completed within wait window. tasks=%s",
                len(result.get("results", result.get("tasks", []))),
            )
        return result

    run_id = orchestrator.run_dir.name
    background_run = BackgroundRun(
        objective=objective,
        run_dir=orchestrator.run_dir,
        future=future,
        plan_source_run=plan_source_run,
        plan_only=plan_only,
    )
    _register_background_run(run_id, background_run)

    LOGGER.info(
        "Delegation still running after %.1fs; returning in-progress handle run_id=%s.",
        wait_timeout,
        run_id,
    )
    return {
        "status": "in_progress",
        "objective": objective,
        "run_id": run_id,
        "run_dir": str(orchestrator.run_dir.relative_to(REPO_ROOT)),
        "plan_only": plan_only,
        "message": (
            "Planning continues asynchronously. Use get_run_status to retrieve the plan."
            if plan_only
            else "Execution continuing asynchronously. Use get_run_status to check progress."
        ),
    }

@mcp.tool(
    name="get_run_status",
    description="Retrieve the status of an in-progress or recently completed delegate_objective run.",
)
async def get_run_status(run_id: str) -> Dict[str, Any]:
    if not run_id:
        raise ValueError("run_id is required.")

    run_dir = _resolve_run_dir(run_id)
    run_entry = RUN_REGISTRY.get(run_id)
    response: Dict[str, Any] = {
        "run_id": run_id,
        "run_dir": str(run_dir.relative_to(REPO_ROOT)),
    }

    if run_entry is None:
        # We no longer track the run (process restart or old run). Provide best-effort info.
        summary_path = run_dir / "summary.json"
        if summary_path.is_file():
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            summary.setdefault("status", "completed")
            summary.setdefault("run_id", run_id)
            summary.setdefault("run_dir", str(run_dir.relative_to(REPO_ROOT)))
            return summary
        if run_dir.exists():
            response.update(
                {
                    "status": "unknown",
                    "message": "Run directory exists but no active tracker is available. Inspect artifacts manually.",
                }
            )
            return response
        raise ValueError(f"No data recorded for run_id '{run_id}'.")

    if run_entry.result is not None:
        response.update(
            {
                "status": "completed",
                "objective": run_entry.objective,
                "result": run_entry.result,
                "started_at": run_entry.started_at.isoformat(),
                "completed_at": run_entry.completed_at.isoformat() if run_entry.completed_at else None,
            }
        )
        response["plan_only"] = run_entry.plan_only
        if run_entry.plan_source_run:
            response.setdefault("metadata", {})
            response["metadata"]["plan_source_run"] = run_entry.plan_source_run
        return response

    if run_entry.error is not None:
        response.update(
            {
                "status": "failed",
                "objective": run_entry.objective,
                "error": run_entry.error,
                "started_at": run_entry.started_at.isoformat(),
                "completed_at": run_entry.completed_at.isoformat() if run_entry.completed_at else None,
            }
        )
        response["plan_only"] = run_entry.plan_only
        if run_entry.plan_source_run:
            response.setdefault("metadata", {})
            response["metadata"]["plan_source_run"] = run_entry.plan_source_run
        return response

    response.update(
        {
            "status": "running",
            "objective": run_entry.objective,
            "started_at": run_entry.started_at.isoformat(),
        }
    )
    response["plan_only"] = run_entry.plan_only
    if run_entry.plan_source_run:
        response.setdefault("metadata", {})
        response["metadata"]["plan_source_run"] = run_entry.plan_source_run
    return response


def main() -> None:
    """Launch the FastMCP server."""

    LOGGER.info("Starting wbscanner Codex↔Gemini MCP server.")
    mcp.run(show_banner=False)


if __name__ == "__main__":
    main()
