from __future__ import annotations

import io
import zipfile
from datetime import date, timedelta

import httpx
import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport

from .cvm_common import read_cvm_csv

SCOPES = ("con", "ind")  # raw zone guarda ambos; "preferir consolidado" é regra da camada dbt

# Spot-check: receita consolidada Petrobras (CD_CVM 9512) no DFP 2024,
# conta 3.01, ordem do exercício ÚLTIMO, max(VERSAO), escala MIL.
PETROBRAS_CD_CVM = 9512
PETROBRAS_REVENUE_RANGE = (4.0e11, 6.0e11)  # R$ — faixa plausível p/ 2024
SPOT_CHECK_DATASET = ("dfp", 2024)


class CvmDfpItrConnector(Connector):
    """Demonstrações financeiras DFP/ITR + cadastro de companhias (CVM Dados Abertos)."""

    source = "cvm_dfp_itr"
    encoding = "latin-1"  # GOTCHA: CVM publica em ISO-8859-1, não UTF-8

    def datasets(self) -> list[DatasetSpec]:
        current_year = date.today().year
        specs = [
            DatasetSpec(
                name="cad",
                partition={"dataset": "cad"},
                max_age=timedelta(days=7),
                params={"kind": "cad"},
            )
        ]
        for ds in self.config.get("datasets", []):
            for year in self.config.get(f"years_{ds}", self.config.get("years", [])):
                if year >= current_year:
                    max_age = timedelta(days=1)
                elif year == current_year - 1:
                    max_age = timedelta(days=7)  # reapresentações/versões ainda chegam
                else:
                    max_age = None
                specs.append(
                    DatasetSpec(
                        name=f"{ds}_{year}",
                        partition={"dataset": ds, "year": str(year)},
                        max_age=max_age,
                        params={"kind": "statements", "ds": ds, "year": year},
                    )
                )
        return specs

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        base = self.config["base_url"]
        if spec.params["kind"] == "cad":
            url = f"{base}CAD/DADOS/cad_cia_aberta.csv"
        else:
            ds, year = spec.params["ds"], spec.params["year"]
            url = f"{base}DOC/{ds.upper()}/DADOS/{ds}_cia_aberta_{year}.zip"
        try:
            return RawPayload(url=url, content=self.http.get_bytes(url))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:  # ex.: DFP do ano corrente ainda não publicado
                raise SourceNotAvailable(url) from exc
            raise

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        if spec.params["kind"] == "cad":
            return {"": read_cvm_csv(payload.content)}

        ds, year = spec.params["ds"], spec.params["year"]
        frames: dict[str, pl.DataFrame] = {}
        with zipfile.ZipFile(io.BytesIO(payload.content)) as zf:
            members = set(zf.namelist())
            for statement in self.config.get("statements", []):
                for scope in SCOPES:
                    member = f"{ds}_cia_aberta_{statement}_{scope}_{year}.csv"
                    if member not in members:
                        continue
                    frames[f"statement={statement.lower()}/scope={scope}"] = read_cvm_csv(zf.read(member))
        return frames

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        total = sum(df.height for df in frames.values())
        report.add("non_empty", total > 0, f"{total} rows across {len(frames)} files")
        if spec.params["kind"] == "cad" or total == 0:
            return report

        dre_con = frames.get("statement=dre/scope=con")
        if dre_con is not None:
            n_companies = dre_con.get_column("CD_CVM").n_unique()
            # Ano corrente é parcial (DFPs chegam ao longo do ano seguinte ao exercício)
            min_companies = 300 if int(spec.params["year"]) < date.today().year else 1
            report.add(
                "companies_count", n_companies >= min_companies, f"{n_companies} companies in DRE con"
            )
            has_consolidado = dre_con.get_column("GRUPO_DFP").str.contains("Consolidado").any()
            report.add("grupo_dfp_consolidado", bool(has_consolidado), "")

        bpp_con = frames.get("statement=bpp/scope=con")
        if bpp_con is not None:
            # Se o latin-1 foi decodificado errado, os acentos quebram ("Patrimônio" vira mojibake)
            ok = bpp_con.get_column("DS_CONTA").str.contains("Patrimônio Líquido").any()
            report.add("encoding_accents_ok", bool(ok), "'Patrimônio Líquido' found in DS_CONTA")

        if (spec.params.get("ds"), spec.params.get("year")) == SPOT_CHECK_DATASET and dre_con is not None:
            self._spot_check_petrobras(dre_con, report)
        return report

    def _spot_check_petrobras(self, dre_con: pl.DataFrame, report: ValidationReport) -> None:
        rows = dre_con.filter(
            (pl.col("CD_CVM") == PETROBRAS_CD_CVM)
            & (pl.col("CD_CONTA") == "3.01")
            & (pl.col("ORDEM_EXERC") == "ÚLTIMO")
        )
        if rows.height == 0:
            report.add("petrobras_revenue", False, "no rows for CD_CVM=9512 conta 3.01")
            return
        latest = rows.filter(pl.col("VERSAO") == rows.get_column("VERSAO").max()).row(0, named=True)
        value = latest["VL_CONTA"] * (1000 if latest["ESCALA_MOEDA"] == "MIL" else 1)
        low, high = PETROBRAS_REVENUE_RANGE
        report.add(
            "petrobras_revenue",
            low <= value <= high,
            f"receita 2024 = R$ {value:,.0f} (esperado entre {low:.0e} e {high:.0e})",
        )
