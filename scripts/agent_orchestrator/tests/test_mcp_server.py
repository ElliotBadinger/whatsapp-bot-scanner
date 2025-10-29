from __future__ import annotations

import asyncio
import shutil
import unittest
import uuid
from concurrent.futures import Future
from datetime import datetime, timezone

from scripts.agent_orchestrator import mcp_server


class GetRunStatusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.run_id = f"test-run-{uuid.uuid4().hex[:8]}"
        self.run_dir = mcp_server.REPO_ROOT / "storage" / "agent_runs" / self.run_id
        self.run_dir.mkdir(parents=True, exist_ok=False)

    def tearDown(self) -> None:
        mcp_server.RUN_REGISTRY.pop(self.run_id, None)
        shutil.rmtree(self.run_dir, ignore_errors=True)

    def _register_running_run(self, objective: str = "Test objective") -> None:
        future = Future()
        background_run = mcp_server.BackgroundRun(
            objective=objective,
            run_dir=self.run_dir,
            future=future,
        )
        background_run.started_at = datetime(2025, 1, 1, tzinfo=timezone.utc)
        mcp_server._register_background_run(self.run_id, background_run)

    def _call_status(self, **params):
        payload = {"run_id": self.run_id}
        payload.update(params)
        result = asyncio.run(mcp_server.get_run_status.run(payload))
        return result.structured_content

    def test_running_run_returns_cursor_and_updates(self) -> None:
        self._register_running_run()
        (self.run_dir / "plan.json").write_text("{}", encoding="utf-8")

        data = self._call_status()

        self.assertEqual(data["status"], "running")
        self.assertTrue(data["updates"], "expected at least one update")
        self.assertTrue(data["has_more"], "running run should report more updates coming")

        cursor = data["cursor"]
        next_data = self._call_status(cursor=cursor)

        self.assertEqual(next_data["updates"], [])
        self.assertEqual(next_data["cursor"], cursor)
        self.assertTrue(next_data["has_more"])  # Run still in progress.

    def test_cursor_offset_returns_incremental_updates(self) -> None:
        self._register_running_run()
        (self.run_dir / "plan.json").write_text("{}", encoding="utf-8")

        initial = self._call_status()
        total_updates = len(initial["updates"])
        self.assertGreaterEqual(total_updates, 2)

        partial = self._call_status(cursor="1")
        self.assertEqual(len(partial["updates"]), total_updates - 1)
        self.assertEqual(partial["updates"][0], initial["updates"][1])

    def test_invalid_cursor_raises_value_error(self) -> None:
        with self.assertRaises(ValueError):
            asyncio.run(mcp_server.get_run_status.fn(self.run_id, cursor="not-an-int"))


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
