"""Carteira teórica vigente dos índices da B3 (constituintes + peso + quantidade
teórica) via API do site (indexProxy/indexCall/GetPortfolioDay, com index+segment).

Fonte irmã do b3_indices (que traz os NÍVEIS diários): aqui é a COMPOSIÇÃO. A B3
rebalanceia jan/mai/set; cada coleta sobrescreve a carteira vigente do índice
(snapshot atual, com a data de referência do header). Pesos vêm em % (pt-BR)."""

from __future__ import annotations

import base64
import json
import time
from datetime import datetime, timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport


def _b64(params: dict) -> str:
    return base64.b64encode(json.dumps(params).encode()).decode()


def _ptbr_number(value: str | None) -> float | None:
    """'0,546' → 0.546 ; '478.558.715' → 478558715.0 (separador pt-BR)."""
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(".", "").replace(",", "."))
    except ValueError:
        return None


def _parse_date(value: str | None) -> datetime.date | None:
    """Header da B3 vem como DD/MM/YY (ex.: '15/06/26')."""
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%d/%m/%y").date()
    except ValueError:
        return None


class B3IndexCompositionConnector(Connector):
    source = "b3_index_composition"

    def datasets(self) -> list[DatasetSpec]:
        specs: list[DatasetSpec] = []
        for code in self.config.get("indices", []):
            specs.append(
                DatasetSpec(
                    name=code,
                    partition={"index": code},
                    max_age=timedelta(days=1),  # rebalanceia trimestral; revalida diário
                    params={"index": code},
                )
            )
        return specs

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        params = {
            "language": "pt-br",
            "pageNumber": 1,
            "pageSize": 500,  # maior carteira (~110) cabe numa página
            "index": spec.params["index"],
            "segment": "1",
        }
        url = self.config["base_url"] + "GetPortfolioDay/" + _b64(params)
        payload = self.http.get_json(url)
        time.sleep(float(self.config.get("throttle_seconds", 0.3)))
        if not payload or not payload.get("results"):
            raise SourceNotAvailable(f"{spec.params['index']}: sem carteira teórica")
        return RawPayload(url=url, json=payload)

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        header = payload.json.get("header", {}) or {}
        effective_date = _parse_date(header.get("date"))
        rows: list[dict] = []
        for entry in payload.json.get("results", []):
            ticker = (entry.get("cod") or "").strip()
            if not ticker:
                continue
            rows.append(
                {
                    "index_code": spec.params["index"],
                    "effective_date": effective_date,
                    "ticker": ticker,
                    "asset_name": entry.get("asset"),
                    "type": (entry.get("type") or "").strip() or None,
                    "weight": _ptbr_number(entry.get("part")),
                    "theoretical_qty": _ptbr_number(entry.get("theoricalQty")),
                }
            )
        df = pl.DataFrame(
            rows,
            schema={
                "index_code": pl.Utf8,
                "effective_date": pl.Date,
                "ticker": pl.Utf8,
                "asset_name": pl.Utf8,
                "type": pl.Utf8,
                "weight": pl.Float64,
                "theoretical_qty": pl.Float64,
            },
        )
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("row_count", df.height >= 1, f"{df.height} componentes")
        if df.height == 0:
            return report
        report.add("tickers_unique", df.get_column("ticker").n_unique() == df.height, "")
        weight_sum = df.get_column("weight").sum() or 0.0
        # soma dos pesos ≈ 100% (tolerância p/ arredondamento da B3)
        report.add("weights_sum_100", 95.0 <= weight_sum <= 105.0, f"Σpeso={weight_sum:.2f}%")
        return report
