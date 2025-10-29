from __future__ import annotations

from dataclasses import dataclass, fields
from pathlib import Path
from typing import List, Optional

import yaml


@dataclass
class RunnerConfig:
    """Configuration knobs for the agent orchestrator."""

    max_replan_attempts: int = 1
    max_executor_retries: int = 2
    review_enabled: bool = True
    test_commands: List[str] = None
    auto_commit: bool = False
    push_branch: Optional[str] = None
    codex_model: Optional[str] = None
    gemini_model: Optional[str] = None
    codex_timeout_seconds: int = 240
    gemini_timeout_seconds: int = 420

    def __post_init__(self) -> None:
        if self.test_commands is None:
            self.test_commands = []


def load_config(path: Optional[Path]) -> RunnerConfig:
    """Load configuration from YAML if present, otherwise return defaults."""

    config = RunnerConfig()
    if path is None:
        return config

    if not path.exists():
        return config

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    valid_fields = {f.name for f in fields(RunnerConfig)}
    for key, value in data.items():
        if key in valid_fields:
            setattr(config, key, value)

    return config


def dump_config(config: RunnerConfig) -> dict:
    """Serialize configuration to a dictionary."""

    return {
        "max_replan_attempts": config.max_replan_attempts,
        "max_executor_retries": config.max_executor_retries,
        "review_enabled": config.review_enabled,
        "test_commands": list(config.test_commands),
        "auto_commit": config.auto_commit,
        "push_branch": config.push_branch,
        "codex_model": config.codex_model,
        "gemini_model": config.gemini_model,
        "codex_timeout_seconds": config.codex_timeout_seconds,
        "gemini_timeout_seconds": config.gemini_timeout_seconds,
    }

