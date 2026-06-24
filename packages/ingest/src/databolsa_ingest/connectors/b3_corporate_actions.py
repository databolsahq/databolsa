"""Proventos (dividendos/JCP), eventos societários (desdobramentos, grupamentos,
bonificações) e nº de ações via API pública do site da B3 (listedCompaniesProxy).

Substitui o dataset CVM/EVENTOS, que está fora do ar (404, verificado 2026-06)."""

from __future__ import annotations

import base64
import json
import time
from datetime import timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport

# Validação: eventos conhecidos da Petrobras (verificados ao vivo na API)
PETR_COMMON_SHARES = 7_442_231_382
PETR_PREFERRED_SHARES = 5_446_501_379

CASH_DIVIDEND_FIELDS = (
    "assetIssued", "paymentDate", "rate", "relatedTo", "approvedOn",
    "isinCode", "label", "lastDatePrior", "remarks",
)
STOCK_DIVIDEND_FIELDS = ("assetIssued", "factor", "approvedOn", "isinCode", "label", "lastDatePrior")
SUBSCRIPTION_FIELDS = (
    "assetIssued", "percentage", "priceUnit", "tradingPeriod",
    "subscriptionDate", "approvedOn", "isinCode", "label", "lastDatePrior",
)


def _b64(params: dict) -> str:
    return base64.b64encode(json.dumps(params).encode()).decode()


def _ptbr_number(value: str | None) -> float | None:
    """'7.442.231.382' -> 7442231382.0 ; '0,55305' -> 0.55305"""
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(".", "").replace(",", "."))
    except ValueError:
        return None


class B3CorporateActionsConnector(Connector):
    source = "b3_corporate_actions"

    def datasets(self) -> list[DatasetSpec]:
        specs = [
            DatasetSpec(
                name="companies",
                partition={"dataset": "companies"},
                max_age=timedelta(days=7),
                params={"kind": "companies"},
            )
        ]
        specs.extend(
            DatasetSpec(
                name=f"supplement_{issuer}",
                partition={"dataset": "supplement", "issuer": issuer},
                # 7d corta ~305 req/dia na API não-oficial; share counts mudam raro
                max_age=timedelta(days=7),
                params={"kind": "supplement", "issuer": issuer},
            )
            for issuer in self._issuers()
        )
        deep_cfg = self.config.get("deep_dividends", self.config.get("deep_dividends_issuers", []))
        if deep_cfg == "all":
            universe = self._deep_universe()
        else:
            universe = [{"issuer": i, "names": [], "listed": True} for i in deep_cfg]
        deep_miss_ttl = timedelta(days=int(self.config.get("deep_miss_ttl_days", 90)))
        specs.extend(
            DatasetSpec(
                name=f"cash_dividends_deep_{u['issuer']}",
                partition={"dataset": "cash_dividends_deep", "issuer": u["issuer"]},
                # delistada não paga mais nada: partição imutável
                max_age=timedelta(days=7) if u["listed"] else None,
                # negative cache: emissor sem proventos é ~permanente. Delistada =
                # re-sonda no máx. a cada deep_miss_ttl (trimestral); listada herda
                # os 7d do max_age. Corta o grosso das ~4.300 sondagens vazias/run.
                miss_ttl=None if u["listed"] else deep_miss_ttl,
                params={"kind": "deep", "issuer": u["issuer"], "names": u["names"]},
            )
            for u in universe
        )
        return specs

    def _deep_universe(self) -> list[dict]:
        """Universo do histórico profundo de proventos: listadas atuais (dataset
        companies) + todo emissor que já passou pelo COTAHIST — a API responde
        para delistadas por tradingName (verificado: SOUZA CRUZ, TELEMAR), o que
        elimina o survivorship bias nos proventos em dinheiro."""
        names_by_issuer: dict[str, list[str]] = {}
        listed: set[str] = set()
        spec = DatasetSpec(name="companies", partition={"dataset": "companies"})
        companies = self.writer.read_frames(self.source, spec).get("")
        if companies is not None and companies.height:
            for issuer, name in companies.select("issuingCompany", "tradingName").iter_rows():
                if issuer and name:
                    listed.add(issuer)
                    names_by_issuer.setdefault(issuer, []).append(name)
        cotahist = self.writer.raw_root / "b3_cotahist"
        if cotahist.exists():
            hist = (
                pl.scan_parquet(str(cotahist / "year=*" / "data.parquet"))
                .filter(pl.col("codbdi") == "02")
                .group_by(pl.col("codneg").str.slice(0, 4).alias("issuer"), "nomres")
                .agg(pl.col("data").max().alias("last_seen"))
                .sort("last_seen", descending=True)
                .collect()
            )
            for issuer, nomres, _ in hist.iter_rows():
                if issuer and issuer.isalpha() and nomres:
                    names = names_by_issuer.setdefault(issuer, [])
                    if nomres not in names:
                        names.append(nomres)
        return [
            {"issuer": issuer, "names": names, "listed": issuer in listed}
            for issuer, names in sorted(names_by_issuer.items())
        ]

    def _issuers(self) -> list[str]:
        """Emissores (prefixo de 4 letras do ticker) derivados do FCA já extraído."""
        issuers: set[str] = set()
        for year in sorted(self.config.get("fca_years", [2026, 2025, 2024, 2023]), reverse=True):
            spec = DatasetSpec(name="", partition={"year": str(year)})
            frames = self.writer.read_frames("cvm_fca", spec)
            vm = frames.get("table=valor_mobiliario")
            if vm is None or "Codigo_Negociacao" not in vm.columns:
                continue
            tickers = (
                vm.filter(
                    pl.col("Codigo_Negociacao").is_not_null()
                    & (pl.col("Codigo_Negociacao").str.len_chars() >= 5)
                    & (pl.col("Mercado") == "Bolsa")
                    & pl.col("Data_Fim_Negociacao").is_null()
                )
                .get_column("Codigo_Negociacao")
                .to_list()
            )
            issuers.update(t[:4] for t in tickers if t[:4].isalpha())
            if issuers:
                break  # ano mais recente com dados basta
        return sorted(issuers)

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        kind = spec.params["kind"]
        base = self.config["base_url"]
        throttle = float(self.config.get("throttle_seconds", 0.5))
        time.sleep(throttle)

        if kind == "companies":
            rows: list[dict] = []
            page = 1
            while True:
                params = {"language": "pt-br", "pageNumber": page, "pageSize": 120}
                payload = self.http.get_json(base + "GetInitialCompanies/" + _b64(params))
                if not payload:
                    break
                rows.extend(payload.get("results", []))
                total = payload.get("page", {}).get("totalRecords", 0)
                if len(rows) >= total or not payload.get("results"):
                    break
                page += 1
                time.sleep(throttle)
            return RawPayload(url=base + "GetInitialCompanies", json=rows)

        if kind == "supplement":
            # GOTCHA (verificado): o parâmetro é issuingCompany (código emissor de
            # 4 letras); codeCVM retorna HTTP 200 com corpo VAZIO
            params = {"issuingCompany": spec.params["issuer"], "language": "pt-br"}
            payload = self.http.get_json(base + "GetListedSupplementCompany/" + _b64(params))
            if not payload:
                raise SourceNotAvailable(f"supplement vazio para {spec.params['issuer']}")
            data = payload[0] if isinstance(payload, list) else payload
            return RawPayload(url=base + "GetListedSupplementCompany", json=data)

        # deep: histórico profundo paginado por tradingName — funciona também
        # para DELISTADAS (nome de pregão vem do COTAHIST via _deep_universe)
        names = list(spec.params.get("names") or [])
        if not names:
            trading_name = self._trading_name(spec.params["issuer"])
            if trading_name:
                names.append(trading_name)
        if not names:
            raise SourceNotAvailable(f"nenhum nome de pregão para {spec.params['issuer']}")
        # GOTCHA: caracteres especiais no tradingName zeram a busca
        # ("AMBEV S/A" → 0 registros; "AMBEV" → 134) — tentar variantes saneadas
        candidates: list[str] = []
        for name in names:
            candidates += [name, name.split("/")[0].strip(), name.split()[0]]
        rows: list[dict] = []
        for name in dict.fromkeys(candidates):  # dedupe preservando ordem
            rows = []
            page = 1
            while True:
                params = {
                    "language": "pt-br",
                    "pageNumber": page,
                    "pageSize": 100,
                    "tradingName": name,
                }
                payload = self.http.get_json(base + "GetListedCashDividends/" + _b64(params))
                results = (payload or {}).get("results", [])
                rows.extend(results)
                total = (payload or {}).get("page", {}).get("totalRecords", 0)
                if not results or len(rows) >= total:
                    break
                page += 1
                time.sleep(throttle)
            if rows:
                break
            time.sleep(throttle)
        if not rows:
            # emissor sem proventos em dinheiro registrados (ou nome não casou) —
            # ausência de dataset, não erro; hit rate é reportado na verificação
            raise SourceNotAvailable(
                f"sem proventos para {spec.params['issuer']} (nomes testados: {list(dict.fromkeys(candidates))})"
            )
        return RawPayload(url=base + "GetListedCashDividends", json=rows)

    def _trading_name(self, issuer: str) -> str | None:
        spec = DatasetSpec(name="companies", partition={"dataset": "companies"})
        frames = self.writer.read_frames(self.source, spec)
        companies = frames.get("")
        if companies is None or "issuingCompany" not in companies.columns:
            return None
        hit = companies.filter(pl.col("issuingCompany") == issuer)
        return hit.get_column("tradingName")[0] if hit.height else None

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        kind = spec.params["kind"]
        if kind == "companies":
            df = pl.DataFrame(payload.json or [], infer_schema_length=None)
            return {"": df}

        if kind == "deep":
            rows = payload.json or []
            df = pl.DataFrame(rows, infer_schema_length=None)
            if "valueCash" in df.columns:
                df = df.with_columns(
                    pl.col("valueCash").map_elements(_ptbr_number, return_dtype=pl.Float64).alias("value_cash_parsed")
                )
            return {"": df.unique()}  # GOTCHA: API devolve linhas duplicadas (1 por ISIN)

        data = payload.json or {}
        frames: dict[str, pl.DataFrame] = {}
        frames["table=share_counts"] = pl.DataFrame(
            [
                {
                    "issuer": spec.params["issuer"],
                    "trading_name": data.get("tradingName"),
                    "common_shares": _ptbr_number(data.get("numberCommonShares")),
                    "preferred_shares": _ptbr_number(data.get("numberPreferredShares")),
                    "total_shares": _ptbr_number(data.get("totalNumberShares")),
                    "stock_capital": _ptbr_number(data.get("stockCapital")),
                    "segment": data.get("segment"),
                }
            ]
        )
        for key, fields, table in (
            ("cashDividends", CASH_DIVIDEND_FIELDS, "cash_dividends"),
            ("stockDividends", STOCK_DIVIDEND_FIELDS, "stock_dividends"),
            ("subscriptions", SUBSCRIPTION_FIELDS, "subscriptions"),
        ):
            rows = [
                {f: item.get(f) for f in fields} | {"issuer": spec.params["issuer"]}
                for item in (data.get(key) or [])
            ]
            schema = {f: pl.Utf8 for f in fields} | {"issuer": pl.Utf8}
            df = pl.DataFrame(rows, schema=schema, strict=False)
            numeric = "rate" if table == "cash_dividends" else "factor" if table == "stock_dividends" else "priceUnit"
            if numeric in df.columns:
                df = df.with_columns(
                    pl.col(numeric).map_elements(_ptbr_number, return_dtype=pl.Float64).alias(f"{numeric}_parsed")
                )
            frames[f"table={table}"] = df
        return frames

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        kind = spec.params["kind"]

        if kind == "companies":
            df = frames.get("", pl.DataFrame())
            report.add("companies_listed", df.height > 3_000, f"{df.height} companies")
            return report

        if kind == "deep":
            df = frames.get("", pl.DataFrame())
            report.add("non_empty", df.height > 0, f"{df.height} dividend records")
            issuer = spec.params["issuer"]
            if df.height and "dateApproval" in df.columns:
                min_year = (
                    df.get_column("dateApproval").drop_nulls().str.slice(-4).cast(pl.Int64, strict=False).min()
                )
                if issuer == "PETR":  # profundidade: retorno total exige histórico longo
                    report.add("petr_history_depth", min_year is not None and min_year <= 2000, f"min(ano)={min_year}")
                if issuer == "CRUZ":  # Souza Cruz delistou em 2015: prova anti-survivorship
                    report.add("delisted_history_present", df.height >= 100, f"{df.height} registros")
            return report

        total = sum(df.height for df in frames.values())
        report.add("non_empty", total > 0, f"{total} rows")
        if spec.params["issuer"] == "PETR":
            cash = frames.get("table=cash_dividends", pl.DataFrame())
            labels = set(cash.get_column("label").drop_nulls().to_list()) if cash.height else set()
            report.add(
                "petr_dividend_types",
                {"DIVIDENDO", "JRS CAP PROPRIO"} <= labels,
                f"labels = {sorted(labels)}",
            )
            stock = frames.get("table=stock_dividends", pl.DataFrame())
            has_split = stock.height > 0 and (stock.get_column("label") == "DESDOBRAMENTO").any()
            report.add("petr_split_present", bool(has_split), "")
            shares = frames.get("table=share_counts", pl.DataFrame())
            on = shares.get_column("common_shares")[0] if shares.height else None
            pn = shares.get_column("preferred_shares")[0] if shares.height else None
            report.add(
                "petr_share_counts_match_fre",
                on == PETR_COMMON_SHARES and pn == PETR_PREFERRED_SHARES,
                f"ON={on} PN={pn} — deve bater com o FRE (fonte independente)",
            )
        return report
