from __future__ import annotations

import io
import zipfile
from datetime import date, timedelta

import httpx
import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport

# Layout fixed-width do COTAHIST (posições 0-indexed) — ver docs/sources.md
FIELDS: dict[str, tuple[int, int]] = {
    "tipreg": (0, 2),
    "data": (2, 10),
    "codbdi": (10, 12),
    "codneg": (12, 24),
    "tpmerc": (24, 27),
    "nomres": (27, 39),
    "especi": (39, 49),
    "preabe": (56, 69),
    "premax": (69, 82),
    "premin": (82, 95),
    "premed": (95, 108),
    "preult": (108, 121),
    "preofc": (121, 134),
    "preofv": (134, 147),
    "totneg": (147, 152),
    "quatot": (152, 170),
    "voltot": (170, 188),
    "preexe": (188, 201),   # preço de exercício (strike) — opções; 2 decimais
    "datven": (202, 210),   # data de vencimento (YYYYMMDD) — opções
    "fatcot": (210, 217),
    "codisi": (230, 242),
    "dismes": (242, 245),
}
PRICE_COLS = ["preabe", "premax", "premin", "premed", "preult", "preofc", "preofv"]
# preexe/datven só existem em opção — fora do frame à vista (mantém o schema estável).
_SPOT_EXCLUDE = ("tipreg", "tpmerc", "preexe", "datven")

# Spot-check externo: close NÃO ajustado de PETR4 em pregão pinado, conferido
# manualmente no site da B3 (Yahoo foi removido: 429 por IP + rede dentro do
# validate + ToS proíbem uso da API não-oficial; golden value fixado localmente.
SPOT_CHECK_YEAR = 2025
SPOT_CHECK_DATE = date(2025, 6, 2)
SPOT_CHECK_PETR4_CLOSE = 31.08


class B3CotahistConnector(Connector):
    source = "b3_cotahist"
    encoding = "latin-1"

    def datasets(self) -> list[DatasetSpec]:
        current_year = date.today().year
        start = int(self.config.get("start_year", 2023))
        end = int(self.config.get("end_year", current_year))
        years = self.config.get("years") or list(range(start, end + 1))
        return [
            DatasetSpec(
                name=f"cotahist_{year}",
                partition={"year": str(year)},
                max_age=None if year < current_year else timedelta(days=1),
                params={"year": year},
            )
            for year in years
        ]

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = f"{self.config['base_url']}COTAHIST_A{spec.params['year']}.ZIP"
        try:
            content = self.http.get_bytes(url)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise SourceNotAvailable(url) from exc
            raise
        if not content.startswith(b"PK"):  # servidor da B3 retorna HTML de erro com HTTP 200
            raise SourceNotAvailable(f"{url}: resposta não é um ZIP (arquivo inexistente?)")
        return RawPayload(url=url, content=content)

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        with zipfile.ZipFile(io.BytesIO(payload.content)) as zf:
            text = zf.read(zf.namelist()[0]).decode(self.encoding)

        codbdi = self.config.get("codbdi", ["02", "12"])  # 02=lote padrão, 12=FII
        lines = pl.DataFrame({"line": text.splitlines()})
        df = lines.filter(
            # GOTCHA (verificado no arquivo real): detalhe é TIPREG=01;
            # 00 é o header ("00COTAHIST.YYYY") e 99 o trailer
            (pl.col("line").str.slice(*_sl("tipreg")) == "01")
            & (pl.col("line").str.slice(*_sl("tpmerc")) == "010")     # mercado à vista
            & (pl.col("line").str.slice(*_sl("codbdi")).is_in(codbdi))
        )
        df = df.with_columns(
            [pl.col("line").str.slice(*_sl(f)).alias(f) for f in FIELDS if f not in _SPOT_EXCLUDE]
        ).drop("line")

        df = df.with_columns(
            pl.col("data").str.strptime(pl.Date, "%Y%m%d"),
            pl.col("codneg").str.strip_chars(),
            pl.col("nomres").str.strip_chars(),
            pl.col("especi").str.strip_chars(),
            pl.col("codisi").str.strip_chars(),
            pl.col("totneg").cast(pl.Int64),
            pl.col("quatot").cast(pl.Int64),
            pl.col("dismes").cast(pl.Int64),
            pl.col("fatcot").cast(pl.Int64),
            pl.col("voltot").cast(pl.Int64) / 100,  # volume em centavos
        )
        # Preços: inteiros sem separador, ajustados pelo fator de cotação (FATCOT)
        df = df.with_columns(
            [(pl.col(c).cast(pl.Int64) / (100 * pl.col("fatcot"))).alias(c) for c in PRICE_COLS]
        )
        return {"": df, "table=options": self._parse_options(lines)}

    def _parse_options(self, lines: pl.DataFrame) -> pl.DataFrame:
        """Frame de opções sobre ações (tpmerc 070=call/080=put, codbdi 78/82).
        Verificado no arquivo real (2026): strike em preexe/100, vencimento em
        datven; underlying_root = 4 primeiras letras do codneg (ex.: PETRF338 → PETR)."""
        opt = lines.filter(
            (pl.col("line").str.slice(*_sl("tipreg")) == "01")
            & (pl.col("line").str.slice(*_sl("tpmerc")).is_in(["070", "080"]))
            & (pl.col("line").str.slice(*_sl("codbdi")).is_in(["78", "82"]))
        )
        if opt.height == 0:
            return opt.select(  # schema vazio estável
                [pl.lit(None).alias(c) for c in (*FIELDS, "option_type", "underlying_root", "strike")]
            ).clear()
        opt = opt.with_columns(
            [pl.col("line").str.slice(*_sl(f)).alias(f) for f in FIELDS if f != "tipreg"]
        ).drop("line")
        opt = opt.with_columns(
            pl.col("data").str.strptime(pl.Date, "%Y%m%d"),
            pl.col("datven").str.strptime(pl.Date, "%Y%m%d", strict=False),
            pl.col("codneg").str.strip_chars(),
            pl.col("nomres").str.strip_chars(),
            pl.col("especi").str.strip_chars(),
            pl.col("codisi").str.strip_chars(),
            pl.col("totneg").cast(pl.Int64),
            pl.col("quatot").cast(pl.Int64),
            pl.col("dismes").cast(pl.Int64),
            pl.col("fatcot").cast(pl.Int64),
            pl.col("voltot").cast(pl.Int64) / 100,
            pl.when(pl.col("tpmerc") == "070").then(pl.lit("call")).otherwise(pl.lit("put")).alias("option_type"),
        )
        opt = opt.with_columns(
            pl.col("codneg").str.slice(0, 4).alias("underlying_root"),
            (pl.col("preexe").cast(pl.Int64) / 100).alias("strike"),  # strike NÃO usa fatcot
        )
        opt = opt.with_columns(
            [(pl.col(c).cast(pl.Int64) / (100 * pl.col("fatcot"))).alias(c) for c in PRICE_COLS]
        )
        return opt.drop("tpmerc", "preexe")

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        year = spec.params["year"]
        full_year = year < date.today().year

        # mercado era bem menor nos anos 1990/2000 — thresholds por época
        if not full_year:
            min_rows, min_tickers = 1_000, 100
        elif year < 2010:
            min_rows, min_tickers = 20_000, 100
        else:
            min_rows, min_tickers = 80_000, 300
        report.add("row_count", df.height > min_rows, f"{df.height} rows (min {min_rows})")
        if df.height == 0:
            return report

        n_tickers = df.get_column("codneg").n_unique()
        report.add("distinct_tickers", n_tickers > min_tickers, f"{n_tickers} tickers")

        # Arquivos antigos da B3 trazem um punhado de closes zerados na fonte —
        # tolerar fração ínfima (raw zone preserva o que a fonte publicou)
        bad_close = df.filter(pl.col("preult") <= 0).height
        report.add(
            "positive_closes",
            bad_close <= max(1, df.height // 2_000),  # ~0,05%
            f"{bad_close} rows with close <= 0 ({100 * bad_close / df.height:.3f}%)",
        )

        # preabe=0 significa "sem negócio na abertura" (comum pré-2010) — só
        # comparar OHLC entre preços efetivamente formados (> 0)
        ohlc_bad = df.filter(
            ((pl.col("premin") > pl.col("preult")) & (pl.col("preult") > 0))
            | ((pl.col("premin") > pl.col("preabe")) & (pl.col("preabe") > 0))
            | ((pl.col("premax") < pl.col("preult")) & (pl.col("preult") > 0))
            | ((pl.col("premax") < pl.col("preabe")) & (pl.col("preabe") > 0))
        ).height
        # Pré-2010, tickers de balcão (sufixo "B", ex.: FAMB11B) publicavam close
        # de referência que pode cair fora do range do dia — tolerância maior
        tolerance = df.height // 100 if year < 2010 else max(1, df.height // 2_000)
        report.add(
            "ohlc_consistent",
            ohlc_bad <= tolerance,
            f"{ohlc_bad} rows violate low<=open,close<=high ({100 * ohlc_bad / df.height:.3f}%)",
        )

        if year == SPOT_CHECK_YEAR:
            self._spot_check_petr4(df, report)
        return report

    def _spot_check_petr4(self, df: pl.DataFrame, report: ValidationReport) -> None:
        ours = (
            df.filter((pl.col("codneg") == "PETR4") & (pl.col("data") == SPOT_CHECK_DATE))
            .get_column("preult")
            .to_list()
        )
        if not ours:
            report.add("petr4_spot_check", False, f"PETR4 missing on {SPOT_CHECK_DATE}")
            return
        diff = abs(ours[0] - SPOT_CHECK_PETR4_CLOSE)
        report.add(
            "petr4_spot_check",
            diff < 0.005,
            f"cotahist={ours[0]:.2f} esperado={SPOT_CHECK_PETR4_CLOSE:.2f} (B3, conferido manualmente)",
        )


def _sl(field: str) -> tuple[int, int]:
    start, end = FIELDS[field]
    return start, end - start  # polars str.slice(offset, length)
