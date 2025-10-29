from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Callable, Sequence, TYPE_CHECKING

# Ensure research dependencies are importable without prior installation.
REPO_ROOT = Path(__file__).resolve().parents[2]
AUTOGEN_PACKAGES = [
    REPO_ROOT / "Research" / "autogen" / "python" / "packages" / "autogen-agentchat" / "src",
    REPO_ROOT / "Research" / "autogen" / "python" / "packages" / "autogen-core" / "src",
]
for pkg_path in AUTOGEN_PACKAGES:
    if pkg_path.exists() and str(pkg_path) not in sys.path:
        sys.path.insert(0, str(pkg_path))

try:  # pragma: no cover - optional dependency handling
    from autogen_agentchat.agents._base_chat_agent import BaseChatAgent
    from autogen_agentchat.base import Response
    from autogen_agentchat.messages import BaseChatMessage, TextMessage
    from autogen_core import CancellationToken
except ImportError as error:  # pragma: no cover - provides clearer guidance
    raise ImportError(
        "AutoGen packages are required. Install from Research/autogen or add them to PYTHONPATH."
    ) from error


if TYPE_CHECKING:
    from .agents import CodexAgent, GeminiAgent

from .utils import build_artifact_blob, parse_json, render_prompt


class CodexPlannerChatAgent(BaseChatAgent):
    """AutoGen-compatible agent that delegates planning to the Codex CLI."""

    produced_message_types: Sequence[type[BaseChatMessage]] = (TextMessage,)

    def __init__(
        self,
        *,
        codex: CodexAgent,
        guidelines: str,
        git_status: Callable[[], str],
        objective_hint: str = "",
        timeout_seconds: int = 240,
    ) -> None:
        super().__init__(name="codex_planner", description="Generates task plans via Codex CLI.")
        self._codex = codex
        self._guidelines = guidelines
        self._git_status = git_status
        self._objective_hint = objective_hint
        self._timeout = timeout_seconds

    async def on_messages(
        self,
        messages: Sequence[BaseChatMessage],
        cancellation_token: CancellationToken,
    ) -> Response:
        del cancellation_token  # Not used; interface requirement.

        objective = self._objective_hint
        if messages:
            objective = getattr(messages[-1], "content", objective) or objective

        prompt = render_prompt(
            "planner.txt",
            objective=objective,
            guidelines=self._guidelines,
            status=self._git_status(),
        )

        loop = asyncio.get_running_loop()
        run = await loop.run_in_executor(None, lambda: self._codex.run(prompt, timeout=self._timeout))
        message = run.message or run.raw_stdout.strip()
        chat_message = TextMessage(content=message, source=self.name)
        return Response(chat_message=chat_message, inner_messages=None)


class GeminiExecutorChatAgent(BaseChatAgent):
    """AutoGen-compatible agent that applies patches using the Gemini CLI."""

    produced_message_types: Sequence[type[BaseChatMessage]] = (TextMessage,)

    def __init__(
        self,
        *,
        gemini: GeminiAgent,
        repo_root: Path,
        guidelines: str,
        git_status: Callable[[], str],
        timeout_seconds: int = 420,
    ) -> None:
        super().__init__(name="gemini_executor", description="Executes workspace edits via Gemini CLI.")
        self._gemini = gemini
        self._repo_root = repo_root
        self._guidelines = guidelines
        self._git_status = git_status
        self._timeout = timeout_seconds

    async def on_messages(
        self,
        messages: Sequence[BaseChatMessage],
        cancellation_token: CancellationToken,
    ) -> Response:
        del cancellation_token

        if not messages:
            raise ValueError("GeminiExecutorChatAgent requires a task payload.")

        payload_raw = getattr(messages[-1], "content", "")
        if not payload_raw:
            raise ValueError("Empty executor payload.")

        payload = parse_json(payload_raw) if payload_raw.strip().startswith("{") else json.loads(payload_raw)
        objective = payload.get("objective", "")
        task_dict = payload.get("task", {})
        artifacts = task_dict.get("artifacts", [])

        artifacts_blob = build_artifact_blob(self._repo_root, artifacts)
        prompt = render_prompt(
            "executor.txt",
            objective=objective,
            task_json=json.dumps(task_dict, indent=2),
            guidelines=self._guidelines,
            status=self._git_status(),
            artifacts=artifacts_blob,
        )

        loop = asyncio.get_running_loop()
        run = await loop.run_in_executor(None, lambda: self._gemini.run(prompt, timeout=self._timeout))
        message = run.response_text or run.raw_stdout.strip()
        chat_message = TextMessage(content=message, source=self.name)
        return Response(chat_message=chat_message, inner_messages=None)

