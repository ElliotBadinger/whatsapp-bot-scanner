import json
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, Dict, List

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_ROOT = PACKAGE_ROOT.parent
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from agent_orchestrator.agents import CodexRun, GeminiRun  # noqa: E402
from agent_orchestrator.config import RunnerConfig  # noqa: E402
from agent_orchestrator.main import AgentOrchestrator, Task  # noqa: E402


def make_codex_run(payload: Dict[str, Any]) -> CodexRun:
    message = json.dumps(payload)
    events = [
        {"type": "item.completed", "item": {"type": "agent_message", "text": message}},
    ]
    return CodexRun(
        events=events,
        message=message,
        raw_stdout="\n".join(json.dumps(event) for event in events),
        raw_stderr="",
        returncode=0,
    )


def make_gemini_run(response: Dict[str, Any]) -> GeminiRun:
    response_text = json.dumps(response)
    payload = {"response": response_text}
    return GeminiRun(
        payload=payload,
        response_text=response_text,
        raw_stdout=json.dumps(payload),
        raw_stderr="",
        returncode=0,
    )


class PlannerStub:
    def __init__(self, responses: List[Any]) -> None:
        self._responses = responses
        self.calls = 0

    def run(self, prompt: str, timeout: int) -> CodexRun:
        if self.calls >= len(self._responses):
            raise AssertionError("Planner called more times than configured")
        result = self._responses[self.calls]
        self.calls += 1
        if isinstance(result, Exception):
            raise result
        return result


class ExecutorStub:
    def __init__(self, responses: List[Any]) -> None:
        self._responses = responses
        self.calls = 0

    def run(self, prompt: str, timeout: int) -> GeminiRun:
        if self.calls >= len(self._responses):
            raise AssertionError("Executor called more times than configured")
        result = self._responses[self.calls]
        self.calls += 1
        if isinstance(result, Exception):
            raise result
        return result


class BaseOrchestratorTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo_root = Path(self._tmp.name)
        (self.repo_root / "AGENTS.md").write_text("guidelines", encoding="utf-8")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def make_orchestrator(
        self,
        *,
        config: RunnerConfig,
        planner: PlannerStub,
        executor: ExecutorStub,
        dry_run: bool,
    ) -> AgentOrchestrator:
        class HarnessOrchestrator(AgentOrchestrator):
            def _git_status(self) -> str:  # type: ignore[override]
                return "??"

            def _git_diff_stat(self) -> str:  # type: ignore[override]
                return ""

            def _git_diff_patch(self) -> str:  # type: ignore[override]
                return ""

            def run_tests(self) -> List[Dict[str, Any]]:  # type: ignore[override]
                return [
                    {"command": "echo ok", "returncode": 0, "stdout": "ok\n", "stderr": ""}
                ]

            def review(self, task: Task, objective: str, test_results: List[Dict[str, Any]]) -> Dict[str, Any]:  # type: ignore[override]
                return {"verdict": "pass", "rationale": "ok", "returncode": 0}

            def _apply_patch(self, task: Task, patch: Dict[str, Any], index: int) -> Dict[str, Any]:  # type: ignore[override]
                return {"applied": True, "index": index}

        return HarnessOrchestrator(
            self.repo_root,
            config,
            dry_run=dry_run,
            planner=planner,
            executor=executor,
            reviewer=planner,
        )


class OrchestratorRetryTests(BaseOrchestratorTest):
    def test_plan_retries_until_success(self) -> None:
        plan_payload = {"tasks": [{"id": "plan-1", "title": "Do", "goal": "", "context": "", "artifacts": []}]}
        planner = PlannerStub([RuntimeError("first failure"), make_codex_run(plan_payload)])
        executor = ExecutorStub([make_gemini_run({"status": "skip", "patches": [], "follow_up": []})])
        config = RunnerConfig(max_replan_attempts=2)
        orchestrator = self.make_orchestrator(
            config=config,
            planner=planner,
            executor=executor,
            dry_run=True,
        )

        tasks, payload = orchestrator._plan_with_retries("Test objective")

        self.assertEqual(len(tasks), 1)
        self.assertEqual(payload["tasks"][0]["id"], "plan-1")
        self.assertEqual(planner.calls, 2)
        self.assertTrue((orchestrator.run_dir / "plan.json").exists())

    def test_execute_task_retries_on_failure(self) -> None:
        diff = """diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@\n-old\n+new\n"""
        executor = ExecutorStub(
            [
                RuntimeError("transient network"),
                make_gemini_run({
                    "status": "apply",
                    "summary": "updated",
                    "patches": [
                        {"id": "patch-1", "path": "file.txt", "diff": diff, "confidence": 0.9}
                    ],
                    "follow_up": [],
                }),
            ]
        )
        planner = PlannerStub([make_codex_run({"tasks": []})])
        config = RunnerConfig(max_executor_retries=3)
        orchestrator = self.make_orchestrator(
            config=config,
            planner=planner,
            executor=executor,
            dry_run=False,
        )
        task = Task(id="plan-1", title="", goal="", context="", artifacts=[])

        execution, tests, review = orchestrator.execute_task_with_retries(task, "Fix it")

        self.assertEqual(execution["status"], "apply")
        self.assertEqual(execution["attempt"], 2)
        self.assertEqual(task.attempts, 2)
        self.assertEqual(len(tests), 1)
        self.assertEqual(review.get("verdict"), "pass")
        self.assertEqual(executor.calls, 2)


class OrchestratorIntegrationTests(BaseOrchestratorTest):
    def test_run_objective_plan_only(self) -> None:
        plan_payload = {"tasks": [{"id": "plan-1", "title": "Do", "goal": "", "context": "", "artifacts": []}]}
        planner = PlannerStub([make_codex_run(plan_payload)])
        executor = ExecutorStub([])
        config = RunnerConfig()
        orchestrator = self.make_orchestrator(
            config=config,
            planner=planner,
            executor=executor,
            dry_run=True,
        )

        result = orchestrator.run_objective("Gather info", plan_only=True)

        self.assertEqual(len(result["tasks"]), 1)
        self.assertEqual(result["results"], [])
        self.assertEqual(executor.calls, 0)

    def test_run_objective_full_execution(self) -> None:
        plan_payload = {"tasks": [{"id": "plan-1", "title": "Apply", "goal": "", "context": "", "artifacts": []}]}
        planner = PlannerStub([make_codex_run(plan_payload)])
        diff = """diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@\n-old\n+new\n"""
        executor = ExecutorStub(
            [
                make_gemini_run({
                    "status": "apply",
                    "summary": "updated",
                    "patches": [
                        {"id": "patch-1", "path": "file.txt", "diff": diff, "confidence": 0.8}
                    ],
                    "follow_up": [],
                })
            ]
        )
        config = RunnerConfig()
        orchestrator = self.make_orchestrator(
            config=config,
            planner=planner,
            executor=executor,
            dry_run=False,
        )

        result = orchestrator.run_objective("Apply patch")

        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(result["results"][0]["execution"]["status"], "apply")
        self.assertTrue((orchestrator.run_dir / "task_plan-1.json").exists())
        self.assertTrue(result["run_dir"].startswith("storage/agent_runs/"))


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
