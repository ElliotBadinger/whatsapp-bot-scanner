from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class CodexRun:
    """Structured output from a Codex CLI invocation."""

    events: List[Dict[str, Any]]
    message: str
    raw_stdout: str
    raw_stderr: str
    returncode: int


@dataclass
class GeminiRun:
    """Structured output from a Gemini CLI invocation."""

    payload: Dict[str, Any]
    response_text: str
    raw_stdout: str
    raw_stderr: str
    returncode: int


class CodexAgent:
    """Thin wrapper around Codex CLI for planner/reviewer roles."""

    def __init__(self, repo_root: Path, model: Optional[str] = None) -> None:
        self.repo_root = repo_root
        self.model = model

    def run(self, prompt: str, timeout: int = 240) -> CodexRun:
        cmd = ["codex", "exec", "--json", "-C", str(self.repo_root)]
        if self.model:
            cmd.extend(["-m", self.model])
        cmd.append(prompt)

        try:
            result = subprocess.run(
                cmd,
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                f"Gemini CLI timed out after {timeout}s"
            ) from exc


        events: List[Dict[str, Any]] = []
        message = ""
        for line in result.stdout.splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            events.append(event)
            if (
                event.get("type") == "item.completed"
                and isinstance(event.get("item"), dict)
                and event["item"].get("type") == "agent_message"
            ):
                message = event["item"].get("text", "")

        return CodexRun(
            events=events,
            message=message.strip(),
            raw_stdout=result.stdout,
            raw_stderr=result.stderr,
            returncode=result.returncode,
        )


class GeminiAgent:
    """Wrapper around Gemini CLI for executor role."""

    def __init__(self, repo_root: Path, model: Optional[str] = None) -> None:
        self.repo_root = repo_root
        self.model = model

    def run(self, prompt: str, timeout: int = 420) -> GeminiRun:
        cmd = ["gemini", "-o", "json"]
        if self.model:
            cmd.extend(["-m", self.model])
        cmd.append(prompt)

        try:
            result = subprocess.run(
                cmd,
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                f"Gemini CLI timed out after {timeout}s"
            ) from exc

        payload: Dict[str, Any] = {}
        response_text = ""
        if result.stdout:
            try:
                payload = self._extract_json(result.stdout)
            except json.JSONDecodeError:
                payload = {}

        if payload:
            response_text = self._strip_code_fence(payload.get("response", ""))

        return GeminiRun(
            payload=payload,
            response_text=response_text.strip(),
            raw_stdout=result.stdout,
            raw_stderr=result.stderr,
            returncode=result.returncode,
        )

    @staticmethod
    def _extract_json(output: str) -> Dict[str, Any]:
        start = output.find("{")
        end = output.rfind("}")
        if start == -1 or end == -1:
            raise json.JSONDecodeError("No JSON blob found in Gemini output.", output, 0)
        json_blob = output[start : end + 1]
        return json.loads(json_blob)

    @staticmethod
    def _strip_code_fence(text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            # Drop opening fence
            lines = lines[1:]
            # Drop closing fence if present
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines)
        return text
