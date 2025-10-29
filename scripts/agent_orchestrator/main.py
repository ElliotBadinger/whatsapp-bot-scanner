from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

if __package__ is None:  # pragma: no cover - support `python path/to/main.py`
    package_dir = Path(__file__).resolve().parent
    if str(package_dir) not in sys.path:
        sys.path.insert(0, str(package_dir))
    from agents import CodexAgent, GeminiAgent  # type: ignore
    from config import RunnerConfig, load_config  # type: ignore
    from utils import build_artifact_blob, load_guidelines, parse_json, render_prompt  # type: ignore
else:  # pragma: no cover
    from .agents import CodexAgent, GeminiAgent
    from .config import RunnerConfig, load_config
    from .utils import build_artifact_blob, load_guidelines, parse_json, render_prompt


@dataclass
class Task:
    id: str
    title: str
    goal: str
    context: str
    artifacts: List[str] = field(default_factory=list)
    status: str = "pending"
    attempts: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "goal": self.goal,
            "context": self.context,
            "artifacts": list(self.artifacts),
            "status": self.status,
            "attempts": self.attempts,
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automate multi-agent orchestration using Codex and Gemini CLIs.",
    )
    parser.add_argument(
        "--objective",
        type=str,
        help="Primary goal for the orchestrator to solve. Required unless --demo is set.",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("scripts/agent_orchestrator/config.yaml"),
        help="Path to runner configuration file.",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Repository root. Defaults to project root inferred from script location.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate patches but do not apply them.",
    )
    parser.add_argument(
        "--plan-only",
        action="store_true",
        help="Stop after producing the task plan.",
    )
    parser.add_argument(
        "--commit-message",
        type=str,
        default=None,
        help="Optional commit message when auto_commit is enabled in config.",
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="Push the branch after a successful run when auto_commit is enabled.",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run a demo objective that exercises the pipeline without modifying tracked files.",
    )
    return parser.parse_args()


class AgentOrchestrator:
    def __init__(
        self,
        repo_root: Path,
        config: RunnerConfig,
        dry_run: bool = False,
    ) -> None:
        self.repo_root = repo_root
        self.config = config
        self.dry_run = dry_run
        self.guidelines = load_guidelines(repo_root)
        self.run_dir = self._init_run_dir()
        self.planner = CodexAgent(repo_root, model=config.codex_model)
        self.reviewer = CodexAgent(repo_root, model=config.codex_model)
        self.executor = GeminiAgent(repo_root, model=config.gemini_model)

    def _init_run_dir(self) -> Path:
        root = self.repo_root / "storage" / "agent_runs"
        root.mkdir(parents=True, exist_ok=True)
        run_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        run_dir = root / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        return run_dir

    def plan(self, objective: str) -> List[Task]:
        prompt = render_prompt(
            "planner.txt",
            objective=objective,
            guidelines=self.guidelines,
            status=self._git_status(),
        )
        plan_run = self.planner.run(prompt, timeout=self.config.codex_timeout_seconds)
        self._write_jsonl(self.run_dir / "planner_events.jsonl", plan_run.events)

        plan_data = parse_json(plan_run.message)
        if not isinstance(plan_data, dict):
            raise ValueError("Planner response must be a JSON object.")
        tasks_data = plan_data.get("tasks", [])
        tasks: List[Task] = []
        for index, raw_task in enumerate(tasks_data, start=1):
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

        plan_payload = {
            "objective": objective,
            "notes": plan_data.get("notes"),
            "tasks": [task.to_dict() for task in tasks],
        }
        (self.run_dir / "plan.json").write_text(
            json.dumps(plan_payload, indent=2),
            encoding="utf-8",
        )
        return tasks

    def execute_task(self, task: Task, objective: str) -> Dict[str, Any]:
        task.attempts += 1
        artifacts_blob = build_artifact_blob(self.repo_root, task.artifacts)
        prompt = render_prompt(
            "executor.txt",
            objective=objective,
            task_json=json.dumps(task.to_dict(), indent=2),
            guidelines=self.guidelines,
            status=self._git_status(),
            artifacts=artifacts_blob,
        )
        raw_path = self.run_dir / f"executor_{task.id}_raw.json"
        try:
            exec_run = self.executor.run(prompt, timeout=self.config.gemini_timeout_seconds)
        except RuntimeError as error:
            raw_path.write_text(
                json.dumps(
                    {
                        "error": str(error),
                        "prompt": prompt,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            return {
                "status": "error",
                "summary": str(error),
                "patches": [],
                "follow_up": [],
                "returncode": None,
                "patch_results": [],
            }

        raw_path.write_text(
            json.dumps(
                {
                    "payload": exec_run.payload,
                    "response_text": exec_run.response_text,
                    "returncode": exec_run.returncode,
                    "stderr": exec_run.raw_stderr,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

        execution = parse_json(exec_run.response_text)
        if not isinstance(execution, dict):
            raise ValueError("Executor response must be a JSON object.")
        execution["returncode"] = exec_run.returncode

        patches = execution.get("patches") or []
        if not isinstance(patches, list):
            raise ValueError("Executor response 'patches' must be a list.")
        patch_results: List[Dict[str, Any]] = []
        status = execution.get("status")
        if status == "apply" and patches:
            for index, patch in enumerate(patches, start=1):
                patch_result = self._apply_patch(task, patch, index)
                patch_results.append(patch_result)
                if not patch_result.get("applied", False):
                    break
        else:
            execution["status"] = "skip"

        execution["patch_results"] = patch_results
        return execution

    def review(self, task: Task, objective: str, test_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        diff_summary = self._git_diff_stat()
        diff_patch = self._git_diff_patch()
        prompt = render_prompt(
            "reviewer.txt",
            objective=objective,
            task_json=json.dumps(task.to_dict(), indent=2),
            guidelines=self.guidelines,
            diff_summary=diff_summary,
            diff_patch=diff_patch,
            test_results=json.dumps(test_results, indent=2),
        )
        review_run = self.reviewer.run(prompt, timeout=self.config.codex_timeout_seconds)
        review_payload = parse_json(review_run.message)
        review_payload["returncode"] = review_run.returncode
        review_path = self.run_dir / f"review_{task.id}.json"
        review_path.write_text(
            json.dumps(review_payload, indent=2),
            encoding="utf-8",
        )
        return review_payload

    def run_tests(self) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for command in self.config.test_commands:
            proc = subprocess.run(
                ["bash", "-lc", command],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
            )
            results.append(
                {
                    "command": command,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                }
            )
            if proc.returncode != 0:
                break
        return results

    def maybe_commit(self, commit_message: Optional[str]) -> None:
        if not self.config.auto_commit:
            return
        if not commit_message:
            commit_message = "chore(automation): codex-gemini agent run"
        subprocess.run(
            ["git", "add", "."],
            cwd=self.repo_root,
            check=False,
        )
        subprocess.run(
            ["git", "commit", "-m", commit_message],
            cwd=self.repo_root,
            check=False,
        )
        if self.config.push_branch:
            subprocess.run(
                ["git", "push", "origin", self.config.push_branch],
                cwd=self.repo_root,
                check=False,
            )

    def _apply_patch(self, task: Task, patch: Dict[str, Any], index: int) -> Dict[str, Any]:
        diff = patch.get("diff")
        if not diff:
            return {"applied": False, "error": "Missing diff content."}
        patch_path = self.run_dir / f"{task.id}_patch_{index}.diff"
        patch_path.write_text(diff, encoding="utf-8")

        check = subprocess.run(
            ["git", "apply", "--check"],
            cwd=self.repo_root,
            input=diff,
            text=True,
            capture_output=True,
        )
        if check.returncode != 0:
            return {
                "applied": False,
                "error": check.stderr,
                "stage": "check",
            }
        if self.dry_run:
            return {"applied": True, "dry_run": True}

        apply = subprocess.run(
            ["git", "apply"],
            cwd=self.repo_root,
            input=diff,
            text=True,
            capture_output=True,
        )
        if apply.returncode != 0:
            return {
                "applied": False,
                "error": apply.stderr,
                "stage": "apply",
            }
        return {"applied": True}

    def _git_status(self) -> str:
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()

    def _git_diff_stat(self) -> str:
        result = subprocess.run(
            ["git", "diff", "--stat"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()

    def _git_diff_patch(self) -> str:
        result = subprocess.run(
            ["git", "diff", "--unified=2"],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
        )
        diff = result.stdout
        if len(diff) > 8000:
            diff = diff[:8000] + "\n... (diff truncated) ..."
        return diff

    @staticmethod
    def _write_jsonl(path: Path, events: List[Dict[str, Any]]) -> None:
        with path.open("w", encoding="utf-8") as handle:
            for event in events:
                handle.write(json.dumps(event))
                handle.write("\n")





def main() -> None:
    args = parse_args()
    objective = args.objective
    if args.demo and not objective:
        objective = "Audit repository status and identify any obvious automation housekeeping tasks."
    if not objective:
        raise SystemExit("An objective is required. Provide --objective or use --demo.")

    repo_root = args.repo_root.resolve()
    config = load_config(args.config.resolve())
    orchestrator = AgentOrchestrator(repo_root, config, dry_run=args.dry_run or args.demo)

    tasks = orchestrator.plan(objective)
    if args.plan_only:
        return

    for task in tasks:
        execution = orchestrator.execute_task(task, objective)
        task.status = execution.get("status", "skip")
        test_outputs: List[Dict[str, Any]] = []
        if task.status == "apply" and not orchestrator.dry_run:
            test_outputs = orchestrator.run_tests()
        review_payload = (
            orchestrator.review(task, objective, test_outputs)
            if orchestrator.config.review_enabled
            else {}
        )
        review_path = orchestrator.run_dir / f"task_{task.id}.json"
        review_path.write_text(
            json.dumps(
                {
                    "task": task.to_dict(),
                    "execution": execution,
                    "review": review_payload,
                    "tests": test_outputs,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    orchestrator.maybe_commit(args.commit_message)


if __name__ == "__main__":
    main()
