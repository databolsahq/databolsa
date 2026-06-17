from __future__ import annotations

import io
from datetime import date, timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload
from ..core.validation import ValidationReport

BOND_FAMILY_PREFIXES = ("Tesouro Selic", "Tesouro Prefixado", "Tesouro IPCA+")
DATE_COLS = ("Data Vencimento", "Data Base")


class TesouroDiretoConnector(Connector):
    """Preços e taxas históricos dos títulos do Tesouro Direto (tesourotransparente/CKAN)."""

    source = "tesouro_direto"

    def datasets(self) -> list[DatasetSpec]:
        return [DatasetSpec(name="preco_taxa", partition={}, max_age=timedelta(days=1))]

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = self._resolve_url()
        return RawPayload(url=url, content=self.http.get_bytes(url))

    def _resolve_url(self) -> str:
        # O UUID do resource no CKAN rotaciona: resolver via package_show,
        # com a URL estática conhecida como fallback.
        fallback = self.config.get("fallback_url", "")
        package_url = self.config.get("ckan_package_url")
        if not package_url:
            return fallback
        try:
            payload = self.http.get_json(package_url)
            for resource in payload["result"]["resources"]:
                url = resource.get("url", "")
                if url.lower().endswith(".csv") and "precotaxa" in url.lower():
                    return url
        except Exception:
            pass
        return fallback

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        df = pl.read_csv(
            io.BytesIO(payload.content),
            separator=";",
            decimal_comma=True,  # GOTCHA: decimais com vírgula ("5,32")
            encoding="utf8-lossy",
            infer_schema_length=10_000,
        )
        df = df.with_columns(
            [pl.col(c).str.strptime(pl.Date, "%d/%m/%Y") for c in DATE_COLS if c in df.columns]
        )
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} rows")
        if df.height == 0:
            return report

        families = set(df.get_column("Tipo Titulo").unique().to_list())
        missing = [p for p in BOND_FAMILY_PREFIXES if not any(f.startswith(p) for f in families)]
        report.add(
            "bond_families_present",
            len(families) >= 5 and not missing,
            f"{len(families)} tipos; faltando: {missing or 'nenhum'}",
        )

        # PU = 0 significa "título não ofertado naquele dia" — não é dado inválido
        pu = df.get_column("PU Base Manha").drop_nulls()
        nonzero = pu.filter(pu > 0)
        ok_pu = nonzero.len() > 0 and bool((pu >= 0).all()) and bool((nonzero <= 100_000).all())
        report.add(
            "pu_plausible",
            ok_pu,
            f"PU não-zero range = [{nonzero.min()}, {nonzero.max()}], zeros = {pu.len() - nonzero.len()}",
        )

        latest = df.get_column("Data Base").max()
        age = (date.today() - latest).days
        report.add("data_fresh", age <= 10, f"latest Data Base = {latest} ({age} days old)")
        return report
