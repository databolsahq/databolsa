from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from .storage import MANIFEST_NAME

RUNS_DIRNAME = "_runs"


def run_id(when: datetime) -> str:
    """ID ordenável lexicograficamente, com precisão de ms (evita colisão em
    re-runs manuais no mesmo segundo). Ex.: 20260614T200012345Z."""
    return when.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%S%f")[:-3] + "Z"


def summarize_source(results: list) -> dict:
    """Rollup numérico dos ExtractionResult de uma fonte (uma falha de validação
    conta como erro — é um problema de saúde, não um sucesso)."""
    ok = skip = miss = err = rows = 0
    for r in results:
        rows += r.rows
        if r.skipped:
            skip += 1
        elif r.missing:
            miss += 1
        elif r.error:
            err += 1
        elif r.validation is not None and not r.validation.passed:
            err += 1
        else:
            ok += 1
    return {"ok": ok, "skip": skip, "miss": miss, "err": err, "rows": rows, "datasets": len(results)}


def collect_errors(source: str, results: list) -> list[str]:
    """Strings legíveis dos datasets com erro de fetch ou validação reprovada."""
    errs: list[str] = []
    for r in results:
        if r.error:
            errs.append(f"{source}/{r.dataset}: {r.error}")
        elif r.validation is not None and not r.validation.passed:
            fails = "; ".join(f"{c.name}: {c.detail}" for c in r.validation.failures)
            errs.append(f"{source}/{r.dataset}: validação reprovou ({fails})")
    return errs


class RunLedger:
    """Histórico append-only de execuções do ingest.

    Um JSON por run em <data_root>/_runs/run-<id>.json. Não é um schema rígido:
    é uma projeção dos resultados que o CLI já calcula — legível direto por
    DuckDB (read_json_auto('data/_runs/*.json')) e descartável: apague a pasta e
    o `status` se reconstrói a partir dos manifestos. Vive no lake montado, então
    sobrevive à recriação do container (ao contrário do stdout do supercronic).
    """

    def __init__(self, data_root: Path | str):
        self.dir = Path(data_root) / RUNS_DIRNAME

    def write(self, record: dict) -> Path:
        self.dir.mkdir(parents=True, exist_ok=True)
        path = self.dir / f"run-{record['run_id']}.json"
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
        return path

    def _files(self) -> list[Path]:
        if not self.dir.exists():
            return []
        return sorted(self.dir.glob("run-*.json"))

    def latest(self) -> dict | None:
        files = self._files()
        if not files:
            return None
        return json.loads(files[-1].read_text(encoding="utf-8"))

    def recent(self, n: int = 10) -> list[dict]:
        return [json.loads(p.read_text(encoding="utf-8")) for p in self._files()[-n:]]


def source_health(data_root: Path | str) -> dict[str, dict]:
    """Saúde por fonte derivada dos manifestos no disco (verdade independente do
    ledger): frescor do último fetch bem-sucedido, nº de datasets, ausências
    (negative cache) e validações reprovadas. Reconstrói o `status` mesmo sem
    nenhum run registrado."""
    raw = Path(data_root) / "raw"
    out: dict[str, dict] = {}
    if not raw.exists():
        return out
    now = datetime.now(timezone.utc)
    for src_dir in sorted(p for p in raw.iterdir() if p.is_dir()):
        latest_fetch: datetime | None = None
        missing = failed = datasets = 0
        for mpath in src_dir.rglob(MANIFEST_NAME):
            try:
                m = json.loads(mpath.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            datasets += 1
            if m.get("missing"):
                missing += 1
                continue
            fa = m.get("fetched_at")
            if fa:
                dt = datetime.fromisoformat(fa)
                if latest_fetch is None or dt > latest_fetch:
                    latest_fetch = dt
            val = m.get("validation") or {}
            if val and not val.get("passed", True):
                failed += 1
        out[src_dir.name] = {
            "last_fetch": latest_fetch.isoformat() if latest_fetch else None,
            "age_days": (now - latest_fetch).days if latest_fetch else None,
            "datasets": datasets,
            "missing": missing,
            "failed_validation": failed,
        }
    return out
