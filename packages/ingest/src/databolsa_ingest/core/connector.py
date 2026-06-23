from __future__ import annotations

import sys
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, replace
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, ClassVar

import polars as pl

from .http import HttpClient
from .storage import RawZoneWriter
from .validation import ValidationReport


class SourceNotAvailable(Exception):
    """A fonte não tem este dataset (ex.: 404 no DFP do ano corrente, ainda não publicado)."""


@dataclass
class DatasetSpec:
    """Unidade de extração: uma série SGS, um ano de COTAHIST, um zip DFP..."""

    name: str
    partition: dict[str, str] = field(default_factory=dict)
    max_age: timedelta | None = None  # None = imutável: nunca re-baixa se já existe
    params: dict[str, Any] = field(default_factory=dict)
    # Fonte REVISÁVEL (IBC-Br, PIB, crédito, cadastros): grava 1 vintage imutável
    # por dia em snapshot_date= — backtest macro lê o dado como era (point-in-time)
    snapshot: bool = False
    # Negative cache: por quanto tempo confiar num "sem dados" antes de re-sondar.
    # None → deriva de max_age (ou MISS_TTL_DEFAULT se max_age também é None).
    miss_ttl: timedelta | None = None


@dataclass
class RawPayload:
    url: str
    content: bytes | None = None
    json: Any | None = None
    fetched_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ExtractionResult:
    source: str
    dataset: str
    skipped: bool = False
    missing: bool = False
    error: str | None = None
    rows: int = 0
    paths: list[Path] = field(default_factory=list)
    validation: ValidationReport | None = None


class Connector(ABC):
    """Interface base de todo extrator da raw zone.

    Contrato: fetch() traz o payload fiel da fonte, parse() decodifica formato
    (encoding, fixed-width, separador decimal) sem transformar semântica — a
    transformação pertence à camada dbt futura. Dados são SEMPRE escritos, mesmo
    com validação reprovada: o relatório fica no manifesto para auditoria.
    """

    source: ClassVar[str]
    encoding: ClassVar[str] = "utf-8"

    def __init__(self, config: dict, writer: RawZoneWriter, http: HttpClient):
        self.config = config or {}
        self.writer = writer
        self.http = http

    @abstractmethod
    def datasets(self) -> list[DatasetSpec]: ...

    @abstractmethod
    def fetch(self, spec: DatasetSpec) -> RawPayload: ...

    @abstractmethod
    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        """Retorna {sub-partição relativa ('' para a raiz do dataset): dataframe}."""

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        total = sum(df.height for df in frames.values())
        report.add("non_empty", total > 0, f"{total} rows")
        return report

    def run(self, *, force: bool = False) -> list[ExtractionResult]:
        results: list[ExtractionResult] = []
        specs = self.datasets()
        total = len(specs)
        started = last_beat = time.monotonic()
        for i, spec in enumerate(specs, 1):
            # Heartbeat: o CLI só imprime o resultado da fonte ao FIM (run()
            # retorna a lista inteira). Em fontes grandes (b3_corporate_actions
            # sonda ~4.300 emissores em série) isso é ~1h de silêncio que parece
            # travamento. Emite progresso vivo no stderr — a quantos vai, qual
            # dataset agora, e quanto pulou — sem poluir fontes pequenas.
            now = time.monotonic()
            if total > 50 and (i == 1 or i % 100 == 0 or now - last_beat >= 15):
                last_beat = now
                skipped = sum(1 for r in results if r.skipped)
                print(
                    f"  … {self.source}: {i - 1}/{total} ({skipped} pulados, "
                    f"{now - started:.0f}s) → {spec.name}",
                    file=sys.stderr,
                    flush=True,
                )
            if spec.snapshot:
                spec = replace(
                    spec,
                    partition={**spec.partition, "snapshot_date": date.today().isoformat()},
                    max_age=None,  # cada vintage é imutável; amanhã é outra partição
                )
            if not force and self.writer.is_current(self.source, spec):
                results.append(ExtractionResult(self.source, spec.name, skipped=True))
                continue
            try:
                payload = self.fetch(spec)
                frames = self.parse(payload, spec)
                report = self.validate(frames, spec)
                # staging-promote: não sobrescrever dado aprovado com dado reprovado
                # (partição virgem ainda recebe dado reprovado, p/ auditoria)
                if not report.passed:
                    previous = self.writer.read_manifest(self.source, spec)
                    if previous and previous.get("validation", {}).get("passed"):
                        fails = "; ".join(f"{c.name}: {c.detail}" for c in report.failures)
                        results.append(
                            ExtractionResult(
                                self.source,
                                spec.name,
                                error=f"validação reprovou ({fails}) — partição anterior aprovada foi mantida",
                            )
                        )
                        continue
                paths = self.writer.write(self.source, spec, frames, payload, report)
            except SourceNotAvailable as exc:
                # negative cache: memoiza "sem dados" p/ não re-sondar todo run.
                # Só quando NÃO há manifesto bem-sucedido anterior — nunca esconder
                # dado real atrás de um marcador de ausência (mesma regra do
                # staging-promote acima). Erros transitórios (429/5xx/timeout) caem
                # no except genérico abaixo e NÃO são memoizados.
                previous = self.writer.read_manifest(self.source, spec)
                if previous is None or previous.get("missing"):
                    self.writer.write_missing(self.source, spec, url=None, detail=str(exc))
                results.append(ExtractionResult(self.source, spec.name, missing=True))
                continue
            except Exception as exc:  # um dataset com problema não derruba o resto da fonte
                results.append(
                    ExtractionResult(self.source, spec.name, error=f"{type(exc).__name__}: {exc}")
                )
                continue
            results.append(
                ExtractionResult(
                    self.source,
                    spec.name,
                    rows=sum(df.height for df in frames.values()),
                    paths=paths,
                    validation=report,
                )
            )
        return results

    def revalidate(self, *, write: bool = False) -> list[ExtractionResult]:
        """Roda os validadores contra os parquets já existentes, sem rede. Com
        write=True, persiste o veredito reavaliado no manifesto (atualiza dado em
        disco após mudar uma regra, sem re-baixar)."""
        results: list[ExtractionResult] = []
        for spec in self.datasets():
            frames = self.writer.read_frames(self.source, spec)
            if not frames:
                results.append(ExtractionResult(self.source, spec.name, missing=True))
                continue
            report = self.validate(frames, spec)
            if write:
                self.writer.update_validation(self.source, spec, report)
            results.append(
                ExtractionResult(
                    self.source,
                    spec.name,
                    rows=sum(df.height for df in frames.values()),
                    validation=report,
                )
            )
        return results
