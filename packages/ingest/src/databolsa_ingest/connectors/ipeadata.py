"""Séries do IPEADATA (OData4) — destaque: EMBI+ Brasil (risco-país), a
engrenagem de prêmio de risco soberano da máquina econômica."""

from __future__ import annotations

from datetime import timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload
from ..core.validation import ValidationReport

EMBI_RANGE = (50, 2000)  # pontos-base plausíveis


class IpeadataConnector(Connector):
    source = "ipeadata"

    def datasets(self) -> list[DatasetSpec]:
        return [
            DatasetSpec(
                name=s["name"],
                partition={"series": s["name"]},
                max_age=timedelta(days=1),
                params=dict(s),
            )
            for s in self.config.get("series", [])
        ]

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = f"{self.config['base_url']}ValoresSerie(SERCODIGO='{spec.params['code']}')?$format=json"
        payload = self.http.get_json(url)
        return RawPayload(url=url, json=(payload or {}).get("value", []))

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        rows = payload.json or []
        df = pl.DataFrame(
            {
                "data": [r.get("VALDATA") for r in rows],
                "valor": [r.get("VALVALOR") for r in rows],
            },
            schema={"data": pl.Utf8, "valor": pl.Float64},
        )
        df = df.with_columns(
            # VALDATA vem ISO com timezone ("1994-04-29T00:00:00-03:00") — só a data importa
            pl.col("data").str.slice(0, 10).str.strptime(pl.Date, "%Y-%m-%d"),
            series_code=pl.lit(spec.params["code"]),
            series_name=pl.lit(spec.params["name"]),
            unit=pl.lit(spec.params.get("unit", "")),
        ).sort("data")
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} rows")
        if df.height == 0:
            return report
        report.add("dates_sorted", df.get_column("data").is_sorted(), "")
        if spec.params["name"] == "embi_br":
            report.add("deep_history", df.height > 5000, f"{df.height} obs (desde 1994)")
            latest = df.get_column("valor").drop_nulls()[-1]
            low, high = EMBI_RANGE
            report.add("embi_plausible", low <= latest <= high, f"EMBI atual = {latest} bps")
        return report
