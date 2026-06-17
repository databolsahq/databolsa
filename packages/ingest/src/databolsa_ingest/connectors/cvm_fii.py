"""FIIs via CVM: registro de fundos + informes mensais (PL, valor patrimonial da
cota, dividend yield mensal, carteira tijolo vs papel)."""

from __future__ import annotations

import io
import zipfile
from datetime import date, timedelta

import httpx
import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport
from .cvm_common import read_cvm_csv

INFORME_TABLES = ("geral", "complemento", "ativo_passivo")


class CvmFiiConnector(Connector):
    source = "cvm_fii"
    encoding = "latin-1"

    def datasets(self) -> list[DatasetSpec]:
        current_year = date.today().year
        specs = [
            DatasetSpec(
                name="registro",
                partition={"dataset": "registro"},
                max_age=timedelta(days=7),
                params={"kind": "registro"},
                # cadastro é sobrescrito pela CVM — vintage diário preserva o
                # universo de fundos como era (point-in-time)
                snapshot=True,
            )
        ]
        for kind in ("inf_mensal", "inf_trimestral"):
            specs.extend(
                DatasetSpec(
                    name=f"{kind}_{year}",
                    partition={"dataset": kind, "year": str(year)},
                    max_age=timedelta(days=1) if year >= current_year else timedelta(days=30),
                    params={"kind": kind, "year": year},
                )
                for year in self.config.get(f"years_{kind.removeprefix('inf_')}", self.config.get("years", []))
            )
        return specs

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        if spec.params["kind"] == "registro":
            # GOTCHA: não existe FII/CAD — o registro de FIIs vem do registro geral
            # de fundos (FI/CAD), filtrando Tipo_Fundo == "FII" no consumo
            url = self.config["registry_url"]
        elif spec.params["kind"] == "inf_trimestral":
            url = f"{self.config['informes_trimestrais_base_url']}inf_trimestral_fii_{spec.params['year']}.zip"
        else:
            url = f"{self.config['informes_base_url']}inf_mensal_fii_{spec.params['year']}.zip"
        try:
            return RawPayload(url=url, content=self.http.get_bytes(url))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise SourceNotAvailable(url) from exc
            raise

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        frames: dict[str, pl.DataFrame] = {}
        with zipfile.ZipFile(io.BytesIO(payload.content)) as zf:
            if spec.params["kind"] == "registro":
                for member in zf.namelist():
                    if member.endswith(".csv"):
                        name = member.removesuffix(".csv")
                        frames[f"table={name}"] = read_cvm_csv(zf.read(member), infer_schema_length=None)
            elif spec.params["kind"] == "inf_trimestral":
                # tabelas variam entre anos — gravar todas como vieram
                year = spec.params["year"]
                for member in zf.namelist():
                    if member.endswith(".csv"):
                        table = (
                            member.removeprefix("inf_trimestral_fii_").removesuffix(f"_{year}.csv")
                        )
                        frames[f"table={table}"] = read_cvm_csv(zf.read(member), infer_schema_length=None)
            else:
                year = spec.params["year"]
                members = set(zf.namelist())
                for table in INFORME_TABLES:
                    member = f"inf_mensal_fii_{table}_{year}.csv"
                    if member in members:
                        frames[f"table={table}"] = read_cvm_csv(zf.read(member), infer_schema_length=None)
        return frames

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        total = sum(df.height for df in frames.values())
        report.add("non_empty", total > 0, f"{total} rows across {len(frames)} tables")
        if total == 0:
            return report

        if spec.params["kind"] == "registro":
            reg = frames.get("table=registro_fundo", pl.DataFrame())
            if "Tipo_Fundo" in reg.columns:
                n_fii = reg.filter(pl.col("Tipo_Fundo") == "FII").height
                report.add("fii_count", n_fii > 2_000, f"{n_fii} FIIs no registro")
            else:
                report.add("fii_count", False, "coluna Tipo_Fundo ausente em registro_fundo")
            return report

        if spec.params["kind"] == "inf_trimestral":
            report.add("tables_present", len(frames) >= 2, f"{len(frames)} tabelas: {sorted(frames)}")
            return report

        comp = frames.get("table=complemento", pl.DataFrame())
        dy_col = "Percentual_Dividend_Yield_Mes"
        if comp.is_empty() or dy_col not in comp.columns:
            report.add("dy_present", False, f"complemento sem coluna {dy_col}")
            return report
        n_with_dy = comp.filter(pl.col(dy_col).is_not_null() & (pl.col(dy_col) > 0)).height
        report.add("dy_present", n_with_dy > 100, f"{n_with_dy} informes com DY mensal > 0")
        pl_col = comp.get_column("Patrimonio_Liquido") if "Patrimonio_Liquido" in comp.columns else None
        report.add(
            "patrimonio_liquido_present",
            pl_col is not None and pl_col.drop_nulls().len() > 100,
            "",
        )
        return report
