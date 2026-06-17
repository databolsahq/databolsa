from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import typer

from .connectors import CONNECTORS
from .core import (
    ExtractionResult,
    HttpClient,
    RawZoneWriter,
    RunLedger,
    collect_errors,
    run_id,
    source_health,
    summarize_source,
)
from .core.config import default_data_root, load_sources

app = typer.Typer(help="DataBolsa — extratores de dados brutos (PoC)", no_args_is_help=True)


def _resolve_sources(source: str) -> list[str]:
    if source == "all":
        return list(CONNECTORS)
    if source not in CONNECTORS:
        typer.echo(f"fonte desconhecida: {source!r} (disponíveis: {', '.join(CONNECTORS)})", err=True)
        raise typer.Exit(2)
    return [source]


def _echo_results(results: list[ExtractionResult]) -> bool:
    all_ok = True
    for r in results:
        if r.skipped:
            typer.echo(f"  – {r.source}/{r.dataset}: atual, pulado (use --force para re-extrair)")
            continue
        if r.missing:
            typer.echo(f"  – {r.source}/{r.dataset}: indisponível na fonte (ainda não publicado?)")
            continue
        if r.error:
            all_ok = False
            typer.echo(f"  ✗ {r.source}/{r.dataset}: ERRO {r.error}")
            continue
        ok = r.validation is None or r.validation.passed
        all_ok &= ok
        mark = "✓" if ok else "✗"
        checks = ""
        if r.validation:
            passed = sum(c.passed for c in r.validation.checks)
            checks = f" checks={passed}/{len(r.validation.checks)}"
        typer.echo(f"  {mark} {r.source}/{r.dataset}: {r.rows} linhas{checks}")
        if r.validation:
            for c in r.validation.failures:
                typer.echo(f"      FALHA {c.name}: {c.detail}")
    return all_ok


@app.command("list")
def list_sources() -> None:
    """Lista as fontes disponíveis."""
    for name in CONNECTORS:
        typer.echo(name)


@app.command()
def run(
    source: str = typer.Argument("all", help="Nome da fonte ou 'all'"),
    force: bool = typer.Option(False, "--force", help="Re-extrai mesmo datasets atuais"),
    config: Optional[Path] = typer.Option(None, help="Caminho do sources.yaml"),
    data_root: Optional[Path] = typer.Option(None, help="Raiz do data lake (default: <repo>/data)"),
) -> None:
    """Extrai dados das fontes e grava na raw zone (Parquet + manifesto)."""
    cfg = load_sources(config)
    root = data_root or default_data_root()
    writer = RawZoneWriter(root)
    ledger = RunLedger(root)
    http = HttpClient()
    started = datetime.now(timezone.utc)
    t0 = time.monotonic()
    sources_summary: dict[str, dict] = {}
    errors: list[str] = []
    all_ok = True
    try:
        for name in _resolve_sources(source):
            typer.echo(f"{name}:")
            connector = CONNECTORS[name](cfg.get(name, {}), writer, http)
            s0 = time.monotonic()
            try:
                results = connector.run(force=force)
                all_ok &= _echo_results(results)
                summary = summarize_source(results)
                errors.extend(collect_errors(name, results))
            except Exception as exc:  # uma fonte quebrada não impede as demais
                all_ok = False
                typer.echo(f"  ✗ {name}: ERRO FATAL {type(exc).__name__}: {exc}")
                summary = {"ok": 0, "skip": 0, "miss": 0, "err": 0, "rows": 0, "datasets": 0}
                summary["fatal"] = f"{type(exc).__name__}: {exc}"
                errors.append(f"{name}: FATAL {type(exc).__name__}: {exc}")
            summary["duration_s"] = round(time.monotonic() - s0, 1)
            sources_summary[name] = summary
    finally:
        http.close()
        finished = datetime.now(timezone.utc)
        record = {
            "run_id": run_id(started),
            "trigger": os.environ.get("DATABOLSA_RUN_TRIGGER", "cli"),
            "requested": source,
            "force": force,
            "started_at": started.isoformat(),
            "finished_at": finished.isoformat(),
            "duration_s": round(time.monotonic() - t0, 1),
            "exit": 0 if all_ok else 1,
            "sources": sources_summary,
            "errors": errors[:50],  # cap: o ledger é um resumo, não o log inteiro
            # Snapshot de saúde por fonte (frescor/validação de todo o lake, não só
            # do que esta run tocou). last_fetch é absoluto → o consumidor (API/web)
            # recalcula a idade no momento do request. Deixa a API servir run+saúde
            # de um único arquivo, sem reescanear manifestos em TS.
            "health": source_health(root),
        }
        try:
            path = ledger.write(record)
            typer.echo(f"\n→ run registrado: {path}")
        except Exception as exc:  # ledger é observabilidade, nunca derruba o run
            typer.echo(f"\n(aviso: falha ao gravar ledger: {exc})", err=True)
    raise typer.Exit(0 if all_ok else 1)


@app.command()
def validate(
    source: str = typer.Argument("all", help="Nome da fonte ou 'all'"),
    config: Optional[Path] = typer.Option(None, help="Caminho do sources.yaml"),
    data_root: Optional[Path] = typer.Option(None, help="Raiz do data lake (default: <repo>/data)"),
    write: bool = typer.Option(
        False,
        "--write",
        help="Persiste o veredito reavaliado no manifesto (reavalia dado em disco após mudar uma regra, sem re-baixar)",
    ),
) -> None:
    """Re-roda os validadores contra os parquets já extraídos (sem rede para fetch)."""
    cfg = load_sources(config)
    writer = RawZoneWriter(data_root or default_data_root())
    http = HttpClient()
    all_ok = True
    try:
        for name in _resolve_sources(source):
            typer.echo(f"{name}:")
            connector = CONNECTORS[name](cfg.get(name, {}), writer, http)
            all_ok &= _echo_results(connector.revalidate(write=write))
    finally:
        http.close()
    raise typer.Exit(0 if all_ok else 1)


def _health_flag(h: dict, r: dict) -> str:
    if r.get("fatal") or r.get("err", 0) or h.get("failed_validation", 0):
        return "✗ erro"
    age = h.get("age_days")
    if age is None:
        return "⚠ sem dado"
    if age > 7:  # heurística de debug; o frescor "certo" é por-fonte (max_age)
        return f"⚠ {age}d s/ refresh"
    return "✓"


@app.command()
def status(
    data_root: Optional[Path] = typer.Option(None, help="Raiz do data lake (default: <repo>/data)"),
    as_json: bool = typer.Option(False, "--json", help="Saída em JSON (última run + saúde)"),
) -> None:
    """Mostra a última execução e a saúde por fonte (frescor + validação).

    Lê o ledger (data/_runs/) e os manifestos no disco — funciona mesmo sem run
    registrada. OK/SKIP/MISS/ERR refletem a ÚLTIMA run; LAST FETCH/AGE vêm dos
    manifestos (último fetch bem-sucedido por fonte)."""
    root = data_root or default_data_root()
    latest = RunLedger(root).latest()
    health = source_health(root)

    if as_json:
        typer.echo(json.dumps({"latest_run": latest, "health": health}, indent=2, ensure_ascii=False))
        return

    if latest:
        typer.echo(
            f"última run: {latest['started_at']}  [{latest['trigger']}]  "
            f"{latest['duration_s']}s  exit={latest['exit']}  ({len(latest['sources'])} fontes)"
        )
        if latest.get("errors"):
            typer.echo(f"  {len(latest['errors'])} erro(s); ex.: {latest['errors'][0]}")
    else:
        typer.echo("nenhuma run registrada ainda (rode `databolsa-ingest run`).")
    typer.echo("")

    run_src = (latest or {}).get("sources", {})
    header = (
        f"{'SOURCE':<24} {'LAST FETCH':<17} {'AGE':>5}  "
        f"{'OK':>4} {'SKIP':>5} {'MISS':>4} {'ERR':>4}  HEALTH"
    )
    typer.echo(header)
    typer.echo("-" * len(header))
    for name in sorted(set(health) | set(run_src)):
        h = health.get(name, {})
        r = run_src.get(name, {})
        last = (h.get("last_fetch") or "—")[:16].replace("T", " ")
        age = h.get("age_days")
        age_s = f"{age}d" if age is not None else "—"
        typer.echo(
            f"{name:<24} {last:<17} {age_s:>5}  "
            f"{r.get('ok', 0):>4} {r.get('skip', 0):>5} {r.get('miss', 0):>4} "
            f"{r.get('err', 0):>4}  {_health_flag(h, r)}"
        )


if __name__ == "__main__":
    app()
