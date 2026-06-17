"""Níveis diários históricos de índices da B3 (IBOV, IFIX) via API do site
(indexStatisticsProxy/GetPortfolioDay, com index+year).

Fecha o gap apontado na revisão adversarial: o BCB descontinuou a série diária
do IBOV (SGS 7) em set/2019. A resposta é uma matriz dia×mês (`rateValue1..12`,
decimal pt-BR); aqui ela vira formato longo (date, close)."""

from __future__ import annotations

import base64
import json
import time
from datetime import date, timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport

# Cross-check de fonte independente: IBOV no overlap com o SGS 7 do BCB
SGS_IBOV_CHECK = {"year": 2010, "date": date(2010, 1, 4)}


def _b64(params: dict) -> str:
    return base64.b64encode(json.dumps(params).encode()).decode()


def _ptbr_number(value: str | None) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(".", "").replace(",", "."))
    except ValueError:
        return None


class B3IndicesConnector(Connector):
    source = "b3_indices"

    def datasets(self) -> list[DatasetSpec]:
        current_year = date.today().year
        specs: list[DatasetSpec] = []
        for idx in self.config.get("indices", []):
            start = int(idx.get("start_year", 2000))
            for year in range(start, current_year + 1):
                specs.append(
                    DatasetSpec(
                        name=f"{idx['name']}_{year}",
                        partition={"index": idx["name"], "year": str(year)},
                        max_age=None if year < current_year else timedelta(days=1),
                        params={"index": idx["name"], "year": year},
                    )
                )
        return specs

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        params = {
            "index": spec.params["index"],
            "language": "pt-br",
            "year": str(spec.params["year"]),
        }
        url = self.config["base_url"] + "GetPortfolioDay/" + _b64(params)
        payload = self.http.get_json(url)
        time.sleep(float(self.config.get("throttle_seconds", 0.3)))
        if not payload or not payload.get("results"):
            raise SourceNotAvailable(f"{spec.params['index']} {spec.params['year']}: sem dados")
        return RawPayload(url=url, json=payload)

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        year = spec.params["year"]
        rows: list[dict] = []
        for entry in payload.json.get("results", []):
            day = entry.get("day")
            for month in range(1, 13):
                value = _ptbr_number(entry.get(f"rateValue{month}"))
                if value is None:
                    continue  # null = sem pregão neste dia/mês
                try:
                    d = date(year, month, day)
                except ValueError:
                    continue  # dia 31 em mês curto etc.
                rows.append({"data": d, "close": value})
        df = pl.DataFrame(rows, schema={"data": pl.Date, "close": pl.Float64})
        df = df.sort("data").with_columns(index=pl.lit(spec.params["index"]))
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        year = spec.params["year"]
        full_year = year < date.today().year
        min_rows = 100 if full_year else 1
        report.add("row_count", df.height >= min_rows, f"{df.height} pregões (min {min_rows})")
        if df.height == 0:
            return report
        report.add("positive_levels", bool((df.get_column("close") > 0).all()), "")
        report.add("dates_unique", df.get_column("data").n_unique() == df.height, "")

        if spec.params["index"] == "IBOV" and year == SGS_IBOV_CHECK["year"]:
            self._cross_check_sgs(df, report)
        return report

    def _cross_check_sgs(self, df: pl.DataFrame, report: ValidationReport) -> None:
        """IBOV da B3 deve bater com o SGS 7 (BCB) no overlap — fontes independentes."""
        spec = DatasetSpec(name="series_7", partition={"series_id": "7"})
        sgs = self.writer.read_frames("bcb_sgs", spec).get("")
        if sgs is None or sgs.is_empty():
            report.skip("ibov_matches_sgs7", "SGS 7 ainda não extraído")
            return
        ref = SGS_IBOV_CHECK["date"]
        ours = df.filter(pl.col("data") == ref).get_column("close").to_list()
        theirs = sgs.filter(pl.col("data") == ref).get_column("valor").to_list()
        ok = bool(ours and theirs) and abs(ours[0] - theirs[0]) < max(1.0, theirs[0] * 0.001)
        report.add("ibov_matches_sgs7", ok, f"{ref}: b3={ours} sgs={theirs}")
