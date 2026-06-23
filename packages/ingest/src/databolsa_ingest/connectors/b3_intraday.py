"""Cotações intraday (minuto a minuto, delay ~15 min) via API do site da B3.

Cobre o gap de intraday possível com dados abertos: a B3 só vende tempo real
(Up2Data); o site publica o pregão corrente com atraso de 15 minutos."""

from __future__ import annotations

import time
from datetime import date, timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport


class B3IntradayConnector(Connector):
    source = "b3_intraday"

    def datasets(self) -> list[DatasetSpec]:
        # particiona pela data do PREGÃO (probe leve no IBOV), não pela data de
        # execução — rodar no sábado não grava o pregão de sexta em date=sábado
        session = self._session_date() or date.today().isoformat()
        return [
            DatasetSpec(
                name=f"intraday_{ticker}",
                partition={"ticker": ticker, "session_date": session},
                max_age=timedelta(minutes=15),
                params={"ticker": ticker, "session_date": session},
            )
            for ticker in self.config.get("watchlist", [])
        ]

    def _session_date(self) -> str | None:
        try:
            payload = self.http.get_json(self.config["base_url"] + "IBOV")
            return (payload or {}).get("TradgFlr", {}).get("date")
        except Exception:
            return None

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        url = self.config["base_url"] + spec.params["ticker"]
        payload = self.http.get_json(url)
        if not payload or payload.get("BizSts", {}).get("cd") != "OK":
            raise SourceNotAvailable(f"{url}: {payload.get('BizSts') if payload else 'vazio'}")
        time.sleep(float(self.config.get("throttle_seconds", 0.3)))
        return RawPayload(url=url, json=payload)

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        trading = payload.json.get("TradgFlr", {})
        session_date = trading.get("date")
        quotes = trading.get("scty", {}).get("lstQtn", [])
        df = pl.DataFrame(
            {
                "ticker": [spec.params["ticker"]] * len(quotes),
                "session_date": [session_date] * len(quotes),
                "time": [q.get("dtTm") for q in quotes],
                "close": [q.get("closPric") for q in quotes],
                "fluctuation_pct": [q.get("prcFlcn") for q in quotes],
            },
            schema={
                "ticker": pl.Utf8,
                "session_date": pl.Utf8,
                "time": pl.Utf8,
                "close": pl.Float64,
                "fluctuation_pct": pl.Float64,
            },
        )
        return {"": df}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} minute bars")
        if df.height == 0:
            return report
        closes = df.get_column("close").drop_nulls()
        report.add("positive_prices", bool((closes > 0).all()), f"range [{closes.min()}, {closes.max()}]")
        n_times = df.get_column("time").n_unique()
        report.add("minute_resolution", n_times == df.height, f"{n_times} timestamps únicos")
        return report
