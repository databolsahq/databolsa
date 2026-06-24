from __future__ import annotations

import time
from datetime import date, timedelta

import httpx
import polars as pl

from ..core import Connector, DatasetSpec, RawPayload
from ..core.validation import ValidationReport

BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados"

# IPCA dez/2024 publicado pelo IBGE — âncora do spot-check (critério de aceite)
IPCA_SERIES_ID = 433
IPCA_KNOWN = (date(2024, 12, 1), 0.52)
SELIC_META_SERIES_ID = 432  # meta Copom em % a.a. (11 é a taxa diária em % a.d.)


class BcbSgsConnector(Connector):
    source = "bcb_sgs"

    def datasets(self) -> list[DatasetSpec]:
        return [
            DatasetSpec(
                name=f"series_{s['id']}",
                partition={"series_id": str(s["id"])},
                max_age=timedelta(days=1),
                params=dict(s),
                snapshot=bool(s.get("revisable")),
            )
            for s in self.config.get("series", [])
        ]

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        # A API SGS limita consultas de séries diárias a janelas de ~10 anos:
        # buscar em janelas e concatenar.
        series_id = spec.params["id"]
        url = BASE_URL.format(series_id=series_id)
        start = date.fromisoformat(self.config.get("start_date", "2000-01-01"))
        today = date.today()
        throttle = float(self.config.get("throttle_seconds", 0.5))

        rows: list[dict] = []
        window_start = start
        while window_start <= today:
            window_end = min(date(window_start.year + 9, 12, 31), today)
            params = {
                "formato": "json",
                "dataInicial": window_start.strftime("%d/%m/%Y"),
                "dataFinal": window_end.strftime("%d/%m/%Y"),
            }
            try:
                chunk = self.http.get_json(url, params=params)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 404:  # série sem dados nesta janela
                    chunk = None
                else:
                    raise
            if isinstance(chunk, list):
                rows.extend(chunk)
            window_start = date(window_end.year + 1, 1, 1)
            time.sleep(throttle)
        return RawPayload(url=url, json=rows)

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        rows = payload.json or []
        # data_fim sempre presente (null quando a série não tem vigência) —
        # schemas idênticos entre partições permitem scan_parquet global
        columns = {
            "data": [r["data"] for r in rows],
            "valor": [r["valor"] for r in rows],
            "data_fim": [r.get("dataFim") for r in rows],
        }
        schema = {"data": pl.Utf8, "valor": pl.Utf8, "data_fim": pl.Utf8}
        df = pl.DataFrame(columns, schema=schema)
        df = df.with_columns(
            pl.col("data").str.strptime(pl.Date, "%d/%m/%Y"),  # GOTCHA: DD/MM/YYYY, não ISO
            pl.col("valor").str.strip_chars().replace("", None).cast(pl.Float64),
            series_id=pl.lit(int(spec.params["id"])),
            series_name=pl.lit(spec.params.get("name", "")),
            unit=pl.lit(spec.params.get("unit", "")),
            frequency=pl.lit(spec.params.get("frequency", "")),
        )
        df = df.with_columns(pl.col("data_fim").str.strptime(pl.Date, "%d/%m/%Y"))
        return {"": df.sort("data")}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} rows")
        if df.height == 0:
            return report

        has_vigencia = df.get_column("data_fim").null_count() < df.height
        if not has_vigencia:  # séries com vigência repetem `data` legitimamente
            n_dup = df.height - df.get_column("data").n_unique()
            report.add("dates_unique", n_dup == 0, f"{n_dup} duplicated dates")

        # Frescor: pega fonte morta (lição do EMBI congelado em 2024) — exceto
        # séries marcadas como descontinuadas no config
        if not spec.params.get("discontinued"):
            freq = spec.params.get("frequency", "monthly")
            # mensais publicam com lag de até ~3 meses (crédito, fiscal) —
            # o alvo é pegar fonte MORTA (EMBI ficou 2 anos), não lag normal
            max_age_days = {"daily": 15, "monthly": 120}.get(freq)
            if max_age_days:
                latest = df.get_column("data").max()
                age = (date.today() - latest).days
                report.add("freshness", age <= max_age_days, f"última obs {latest} ({age}d)")
        report.add("dates_sorted", df.get_column("data").is_sorted(), "")
        n_null = df.get_column("valor").null_count()
        report.add("values_present", n_null < df.height, f"{n_null}/{df.height} null values")

        series_id = int(spec.params["id"])
        if series_id == IPCA_SERIES_ID:
            ref_date, expected = IPCA_KNOWN
            got = df.filter(pl.col("data") == ref_date).get_column("valor").to_list()
            report.add(
                "ipca_dec_2024_matches_published",
                bool(got) and abs(got[0] - expected) < 0.005,
                f"expected {expected}, got {got}",
            )
        if series_id == SELIC_META_SERIES_ID:
            latest = df.sort("data").get_column("valor").drop_nulls()[-1]
            report.add("selic_meta_plausible", 0 <= latest <= 30, f"latest = {latest}")
        return report
