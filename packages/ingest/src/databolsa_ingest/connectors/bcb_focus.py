from __future__ import annotations

import unicodedata
from datetime import date, timedelta
from urllib.parse import quote

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload
from ..core.validation import ValidationReport

BASE_URL = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
PAGE_SIZE = 10_000

COLUMNS: dict[str, pl.DataType] = {
    "Indicador": pl.Utf8,
    "Data": pl.Utf8,
    "DataReferencia": pl.Utf8,
    "Suavizada": pl.Utf8,  # só no recurso Inflacao12Meses (S/N); null nos demais
    "Media": pl.Float64,
    "Mediana": pl.Float64,
    "DesvioPadrao": pl.Float64,
    "Minimo": pl.Float64,
    "Maximo": pl.Float64,
    "numeroRespondentes": pl.Int64,
    "baseCalculo": pl.Int64,
}


def _slug(name: str) -> str:
    norm = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return norm.lower().replace(" ", "_")


class BcbFocusConnector(Connector):
    """Expectativas de mercado (Relatório Focus) via API Olinda/OData do BCB."""

    source = "bcb_focus"

    def datasets(self) -> list[DatasetSpec]:
        specs = []
        for survey_key, survey in self.config.get("surveys", {}).items():
            for indicator in survey.get("indicators", []):
                specs.append(
                    DatasetSpec(
                        name=f"{survey_key}_{_slug(indicator)}",
                        partition={"survey": survey_key, "indicador": _slug(indicator)},
                        max_age=timedelta(days=1),
                        params={"resource": survey["resource"], "indicador": indicator},
                    )
                )
        return specs

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = BASE_URL + spec.params["resource"]
        start = self.config.get("start_date", "2015-01-01")
        # GOTCHA: Olinda rejeita '+' como espaço no $filter (400) — montar a
        # query manualmente com %20 em vez de usar params= do httpx.
        odata_filter = quote(
            f"Indicador eq '{spec.params['indicador']}' and Data ge '{start}'", safe="'"
        )
        rows: list[dict] = []
        skip = 0
        while True:  # Olinda limita $top; paginar com $skip até esgotar
            page_url = f"{url}?$format=json&$filter={odata_filter}&$top={PAGE_SIZE}&$skip={skip}"
            page = self.http.get_json(page_url).get("value", [])
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                break
            skip += PAGE_SIZE
        return RawPayload(url=url, json=rows)

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        rows = payload.json or []
        data = {
            col: [None if r.get(col) is None else str(r[col]) if dtype == pl.Utf8 else r[col] for r in rows]
            for col, dtype in COLUMNS.items()
        }
        df = pl.DataFrame(data, schema=COLUMNS, strict=False).with_columns(
            pl.col("Data").str.strptime(pl.Date, "%Y-%m-%d"),
        ).sort("Data")
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} rows")
        if df.height == 0:
            return report

        latest = df.get_column("Data").max()
        age_days = (date.today() - latest).days
        report.add("survey_fresh", age_days <= 10, f"latest survey {latest} ({age_days} days old)")

        latest_rows = df.filter(pl.col("Data") == latest)
        max_resp = latest_rows.get_column("numeroRespondentes").max()
        min_resp = 10 if spec.partition.get("survey") == "inflacao_12m" else 20
        report.add("enough_respondents", (max_resp or 0) > min_resp, f"max respondents = {max_resp}")

        if spec.params["indicador"] == "IPCA":
            medians = latest_rows.get_column("Mediana").drop_nulls()
            ok = medians.len() > 0 and bool((medians.is_between(0, 20)).all())
            report.add("ipca_median_plausible", ok, f"medians = {medians.to_list()[:5]}")
        return report
