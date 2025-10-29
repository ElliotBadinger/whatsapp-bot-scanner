from __future__ import annotations

import json
from pathlib import Path
from string import Template
from typing import Any, Dict, List

MAX_ARTIFACT_CHARS = 6000
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


def load_guidelines(repo_root: Path) -> str:
    """Load shared repository guidelines."""

    path = repo_root / "AGENTS.md"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def render_prompt(name: str, **kwargs: Any) -> str:
    """Render a prompt template from the prompts directory."""

    template_path = PROMPTS_DIR / name
    template = Template(template_path.read_text(encoding="utf-8"))
    return template.safe_substitute(**kwargs)


def build_artifact_blob(repo_root: Path, artifacts: List[str]) -> str:
    """Assemble artifact snippets for executor prompts."""

    if not artifacts:
        return "No artifacts requested by planner."

    parts: List[str] = []
    for artifact in artifacts:
        artifact_path = repo_root / artifact
        header = f"### {artifact}"
        if artifact_path.exists() and artifact_path.is_file():
            content = artifact_path.read_text(encoding="utf-8", errors="ignore")
            truncated = False
            if len(content) > MAX_ARTIFACT_CHARS:
                content = content[:MAX_ARTIFACT_CHARS]
                truncated = True
            section = f"{header}\n```\n{content}\n```"
            if truncated:
                section += "\n<!-- truncated -->"
        else:
            section = f"{header}\nFile not found in repository."
        parts.append(section)
    return "\n\n".join(parts)


def parse_json(raw: str) -> Any:
    """Parse JSON responses allowing fenced code blocks."""

    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        raw = "\n".join(lines)
    if not raw:
        return {}
    return json.loads(raw)

