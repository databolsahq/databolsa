"""Conectores dos formulários cadastrais da CVM: FCA (valores mobiliários/tickers)
e FRE (capital social/nº de ações, free float)."""

from __future__ import annotations

import io
import zipfile
from datetime import date, timedelta
from typing import ClassVar

import httpx
import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport
from .cvm_common import read_cvm_csv

# Validação FCA: BBAS3 pertence ao Banco do Brasil (CNPJ verificado ao vivo)
BBAS3_CNPJ = "00.000.000/0001-91"
# Validação FRE: capital emitido da Petrobras (verificado ao vivo no FRE 2025 e na B3)
PETROBRAS_CNPJ = "33.000.167/0001-01"
PETROBRAS_ON = 7_442_231_382
PETROBRAS_PN = 5_446_501_379


class _CvmFormConnector(Connector):
    """Base para zips anuais de formulário CVM com um CSV por tabela."""

    form: ClassVar[str]  # "fca" | "fre"

    def datasets(self) -> list[DatasetSpec]:
        current_year = date.today().year
        return [
            DatasetSpec(
                name=f"{self.form}_{year}",
                partition={"year": str(year)},
                # formulários são reapresentados ao longo do tempo
                max_age=timedelta(days=7) if year < current_year else timedelta(days=1),
                params={"year": year},
            )
            for year in self.config.get("years", [])
        ]

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = f"{self.config['base_url']}{self.form}_cia_aberta_{spec.params['year']}.zip"
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
            members = set(zf.namelist())
            for table in self.config.get("tables", []):
                member = f"{self.form}_cia_aberta_{table}_{year}.csv"
                if member in members:
                    frames[f"table={table}"] = read_cvm_csv(zf.read(member))
        return frames


class CvmFcaConnector(_CvmFormConnector):
    """FCA — Formulário Cadastral: mapa ticker ↔ CNPJ ↔ segmento de listagem."""

    source = "cvm_fca"
    encoding = "latin-1"
    form = "fca"

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        vm = frames.get("table=valor_mobiliario", pl.DataFrame())
        report.add("non_empty", vm.height > 0, f"{vm.height} rows in valor_mobiliario")
        if vm.height == 0:
            return report

        # GOTCHA (verificado no dado): Codigo_Negociacao só é preenchido a partir
        # do FCA 2019 — antes disso o mapa ticker↔CNPJ requer ISIN (COTAHIST CODISI)
        if spec.params["year"] < 2019:
            report.skip("companies_with_ticker", "FCA pré-2019 não traz Codigo_Negociacao")
            return report

        with_ticker = vm.filter(
            pl.col("Codigo_Negociacao").is_not_null() & (pl.col("Codigo_Negociacao") != "")
        )
        n_companies = with_ticker.get_column("CNPJ_Companhia").n_unique()
        report.add("companies_with_ticker", n_companies > 300, f"{n_companies} companies")

        bbas = with_ticker.filter(pl.col("Codigo_Negociacao") == "BBAS3")
        ok = bbas.height > 0 and bbas.get_column("CNPJ_Companhia")[0] == BBAS3_CNPJ
        segment_ok = bbas.height > 0 and bbas.get_column("Segmento").str.contains("Novo Mercado").any()
        report.add("bbas3_maps_to_banco_do_brasil", ok and bool(segment_ok), f"{bbas.height} BBAS3 rows")
        return report


class CvmFreConnector(_CvmFormConnector):
    """FRE — Formulário de Referência: capital social (nº de ações) e free float."""

    source = "cvm_fre"
    encoding = "latin-1"
    form = "fre"

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        cs = frames.get("table=capital_social", pl.DataFrame())
        report.add("non_empty", cs.height > 0, f"{cs.height} rows in capital_social")
        if cs.height == 0:
            return report

        n_companies = cs.get_column("CNPJ_Companhia").n_unique()
        report.add("companies_count", n_companies > 300, f"{n_companies} companies")

        if spec.params["year"] == 2025:
            petro = cs.filter(
                (pl.col("CNPJ_Companhia") == PETROBRAS_CNPJ)
                & (pl.col("Tipo_Capital") == "Capital Emitido")
            )
            if petro.height == 0:
                report.add("petrobras_share_count", False, "no Capital Emitido rows for Petrobras")
            else:
                latest = petro.filter(pl.col("Versao") == petro.get_column("Versao").max()).row(0, named=True)
                on, pn = latest["Quantidade_Acoes_Ordinarias"], latest["Quantidade_Acoes_Preferenciais"]
                report.add(
                    "petrobras_share_count",
                    on == PETROBRAS_ON and pn == PETROBRAS_PN,
                    f"ON={on} PN={pn} (esperado {PETROBRAS_ON}/{PETROBRAS_PN})",
                )
        return report
