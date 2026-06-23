from __future__ import annotations

import os
from pathlib import Path

import yaml


def find_repo_root(start: Path | None = None) -> Path:
    p = (start or Path.cwd()).resolve()
    for candidate in [p, *p.parents]:
        if (candidate / ".git").exists():
            return candidate
    return p


def default_data_root() -> Path:
    env = os.environ.get("DATABOLSA_DATA_ROOT")
    if env:
        return Path(env).expanduser().resolve()
    return find_repo_root() / "data"


def default_sources_path() -> Path:
    # .../packages/ingest/src/databolsa_ingest/core/config.py -> .../packages/ingest/config/sources.yaml
    return Path(__file__).resolve().parents[3] / "config" / "sources.yaml"


def load_sources(path: Path | str | None = None) -> dict:
    resolved = Path(path) if path else default_sources_path()
    with open(resolved, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
