"""IBGE SIDRA — desemprego (PNAD Contínua), PIB trimestral e produção industrial:
as engrenagens de emprego e crescimento da máquina econômica."""

from __future__ import annotations

from datetime import timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload
from ..core.validation import ValidationReport

SPECIAL_VALUES = {"-", "...", "..", "X"}  # zero absoluto / indisponível / não se aplica


class IbgeSidraConnector(Connector):
    source = "ibge_sidra"

    def datasets(self) -> list[DatasetSpec]:
        return [
            DatasetSpec(
                name=t["name"],
                partition={"table": t["name"]},
                max_age=timedelta(days=1),
                params=dict(t),
                snapshot=bool(t.get("revisable")),
            )
            for t in self.config.get("tables", [])
        ]

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = (
            f"{self.config['base_url']}/t/{spec.params['table']}/n1/all"
            f"/v/{spec.params['variable']}/p/all"
        )
        if spec.params.get("classification"):
            url += f"/{spec.params['classification']}"
        url += "/d/s"
        return RawPayload(url=url, json=self.http.get_json(url))

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        rows = payload.json or []
        rows = rows[1:]  # GOTCHA: primeira linha é sempre o cabeçalho
        df = pl.DataFrame(
            {
                "period_code": [r.get("D3C") for r in rows],
                "period_name": [r.get("D3N") for r in rows],
                "valor": [r.get("V") for r in rows],
                "unit": [r.get("MN") for r in rows],
            },
            schema={c: pl.Utf8 for c in ("period_code", "period_name", "valor", "unit")},
        )
        df = df.with_columns(
            pl.when(pl.col("valor").is_in(SPECIAL_VALUES))
            .then(None)
            .otherwise(pl.col("valor"))
            .cast(pl.Float64)
            .alias("valor"),
            table=pl.lit(str(spec.params["table"])),
            series_name=pl.lit(spec.params["name"]),
        )
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} rows")
        if df.height == 0:
            return report
        if spec.params["name"] == "desemprego_pnad":
            latest = df.get_column("valor").drop_nulls()[-1]
            report.add("desemprego_plausible", 3 <= latest <= 20, f"taxa atual = {latest}%")
        return report
