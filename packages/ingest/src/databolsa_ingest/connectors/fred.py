"""FRED (Federal Reserve) — engrenagem global: Fed Funds, Treasuries, commodities,
dólar e VIX. Requer chave gratuita em FRED_API_KEY; sem ela o conector é pulado."""

from __future__ import annotations

import os
import sys
import time
from datetime import timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload
from ..core.validation import ValidationReport


class FredConnector(Connector):
    source = "fred"

    def _api_key(self) -> str | None:
        return os.environ.get("FRED_API_KEY")

    def datasets(self) -> list[DatasetSpec]:
        if not self._api_key():
            # aviso explícito (a revisão pegou o pulo silencioso passando como sucesso)
            print("  ! fred: FRED_API_KEY ausente — fonte pulada", file=sys.stderr)
            return []
        return [
            DatasetSpec(
                name=s["name"],
                partition={"series_id": s["id"]},
                max_age=timedelta(days=1),
                params=dict(s),
            )
            for s in self.config.get("series", [])
        ]

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        params = {
            "series_id": spec.params["id"],
            "api_key": self._api_key(),
            "file_type": "json",
            "observation_start": self.config.get("start_date", "2000-01-01"),
        }
        payload = self.http.get_json(self.config["base_url"], params=params)
        time.sleep(0.5)  # rate limit FRED: 120 req/min
        return RawPayload(url=self.config["base_url"], json=(payload or {}).get("observations", []))

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        rows = payload.json or []
        df = pl.DataFrame(
            {
                "data": [r.get("date") for r in rows],
                "valor": [r.get("value") for r in rows],
            },
            schema={"data": pl.Utf8, "valor": pl.Utf8},
        )
        df = df.with_columns(
            pl.col("data").str.strptime(pl.Date, "%Y-%m-%d"),
            # FRED usa "." para valor ausente
            pl.when(pl.col("valor") == ".").then(None).otherwise(pl.col("valor")).cast(pl.Float64).alias("valor"),
            series_id=pl.lit(spec.params["id"]),
            series_name=pl.lit(spec.params["name"]),
            unit=pl.lit(spec.params.get("unit", "")),
        ).sort("data")
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} rows")
        if df.height and spec.params["id"] == "FEDFUNDS":
            latest = df.get_column("valor").drop_nulls()[-1]
            report.add("fed_funds_plausible", 0 <= latest <= 10, f"Fed Funds = {latest}%")
        return report
