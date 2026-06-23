"""VLMO — Valores Mobiliários Negociados e Detidos (CVM 44): movimentações de
insiders (administradores, controladores e ligados), mês a mês por companhia.

Dado aberto que nenhum agregador brasileiro estrutura bem — sinal de insider
trading legalizado para a camada de indicadores."""

from __future__ import annotations

import io
import zipfile
from datetime import date, timedelta

import httpx
import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport
from .cvm_common import read_cvm_csv

PETROBRAS_CNPJ = "33.000.167/0001-01"


class CvmVlmoConnector(Connector):
    source = "cvm_vlmo"
    encoding = "latin-1"

    def datasets(self) -> list[DatasetSpec]:
        current_year = date.today().year
        return [
            DatasetSpec(
                name=f"vlmo_{year}",
                partition={"year": str(year)},
                max_age=timedelta(days=1) if year >= current_year else timedelta(days=30),
                params={"year": year},
            )
            for year in self.config.get("years", [])
        ]

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = f"{self.config['base_url']}vlmo_cia_aberta_{spec.params['year']}.zip"
        try:
            return RawPayload(url=url, content=self.http.get_bytes(url))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise SourceNotAvailable(url) from exc
            raise

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        year = spec.params["year"]
        frames: dict[str, pl.DataFrame] = {}
        with zipfile.ZipFile(io.BytesIO(payload.content)) as zf:
            for member in zf.namelist():
                if not member.endswith(".csv"):
                    continue
                stem = member.removesuffix(".csv").removeprefix("vlmo_cia_aberta").strip("_")
                table = stem.removesuffix(str(year)).strip("_") or "vlmo"
                frames[f"table={table}"] = read_cvm_csv(zf.read(member), infer_schema_length=None)
        return frames

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        total = sum(df.height for df in frames.values())
        current_year = date.today().year
        min_rows = 1_000 if spec.params["year"] < current_year else 100
        report.add("non_empty", total > min_rows, f"{total} rows em {sorted(frames)}")
        if total == 0:
            return report
        # Petrobras tem insiders reportando todo ano — âncora de presença
        found = False
        for df in frames.values():
            for col in df.columns:
                if col.startswith("CNPJ") and df.get_column(col).dtype == pl.Utf8:
                    if df.filter(pl.col(col) == PETROBRAS_CNPJ).height:
                        found = True
                        break
            if found:
                break
        report.add("petrobras_present", found, "CNPJ da Petrobras em alguma tabela")
        return report
