"""Criptoativos em BRL via API pública da Binance (sem chave).

Candles diários (histórico completo) e horários (últimas ~6 semanas) por par.
Os ETFs de cripto da B3 (HASH11, QBTC11...) chegam via COTAHIST (CODBDI 14)."""

from __future__ import annotations

import time
from datetime import date, datetime, timedelta, timezone

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload
from ..core.validation import ValidationReport

KLINE_COLUMNS = [
    "open_time", "open", "high", "low", "close", "volume",
    "close_time", "quote_volume", "trades", "taker_base_volume", "taker_quote_volume", "_ignore",
]
PAGE_LIMIT = 1000

# Sanidade: BTC em BRL numa faixa absurda-mente larga (pega erro de unidade/par)
BTC_BRL_RANGE = (50_000, 5_000_000)


class CryptoConnector(Connector):
    source = "crypto"

    def datasets(self) -> list[DatasetSpec]:
        specs = []
        for symbol in self.config.get("symbols", []):
            specs.append(
                DatasetSpec(
                    name=f"{symbol}_1d",
                    partition={"symbol": symbol, "interval": "1d"},
                    max_age=timedelta(days=1),
                    params={"symbol": symbol, "interval": "1d"},
                )
            )
            specs.append(
                DatasetSpec(
                    name=f"{symbol}_1h",
                    partition={"symbol": symbol, "interval": "1h"},
                    max_age=timedelta(hours=1),
                    params={"symbol": symbol, "interval": "1h"},
                )
            )
        return specs

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = self.config["base_url"]
        symbol, interval = spec.params["symbol"], spec.params["interval"]
        rows: list[list] = []
        if interval == "1d":
            start = datetime.fromisoformat(self.config.get("daily_start", "2019-01-01")).replace(
                tzinfo=timezone.utc
            )
            start_ms = int(start.timestamp() * 1000)
            while True:  # pagina do início até hoje (máx 1000 candles por chamada)
                page = self.http.get_json(
                    url,
                    params={
                        "symbol": symbol,
                        "interval": interval,
                        "startTime": str(start_ms),
                        "limit": str(PAGE_LIMIT),
                    },
                )
                if not page:
                    break
                rows.extend(page)
                if len(page) < PAGE_LIMIT:
                    break
                start_ms = page[-1][6] + 1  # close_time do último + 1ms
                time.sleep(0.3)
        else:
            rows = self.http.get_json(
                url, params={"symbol": symbol, "interval": interval, "limit": str(PAGE_LIMIT)}
            ) or []
        return RawPayload(url=url, json=rows)

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        rows = payload.json or []
        data = {col: [r[i] for r in rows] for i, col in enumerate(KLINE_COLUMNS)}
        data.pop("_ignore", None)
        df = pl.DataFrame(data, strict=False)
        if df.height:
            df = df.with_columns(
                pl.from_epoch(pl.col("open_time"), time_unit="ms").alias("open_time"),
                pl.from_epoch(pl.col("close_time"), time_unit="ms").alias("close_time"),
                *[pl.col(c).cast(pl.Float64) for c in ("open", "high", "low", "close", "volume", "quote_volume", "taker_base_volume", "taker_quote_volume")],
                symbol=pl.lit(spec.params["symbol"]),
            )
        if spec.params["interval"] == "1h":
            # a API só devolve ~6 semanas de 1h: merge incremental com o que já
            # existe no lake para não perder histórico a cada rewrite
            existing = self.writer.read_frames(self.source, spec).get("")
            if existing is not None and existing.height:
                df = (
                    pl.concat([existing, df], how="diagonal")
                    .unique(subset=["open_time"], keep="last")
                    .sort("open_time")
                )
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        min_rows = 1000 if spec.params["interval"] == "1d" else 100
        report.add("row_count", df.height >= min_rows, f"{df.height} candles (min {min_rows})")
        if df.height == 0:
            return report
        report.add(
            "times_unique_sorted",
            df.get_column("open_time").is_sorted() and df.get_column("open_time").n_unique() == df.height,
            "",
        )
        if spec.params["symbol"] == "BTCBRL":
            latest = df.sort("open_time").get_column("close")[-1]
            low, high = BTC_BRL_RANGE
            report.add("btc_brl_plausible", low <= latest <= high, f"último close = R$ {latest:,.0f}")
        return report
