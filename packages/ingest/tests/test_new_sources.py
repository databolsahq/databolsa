"""Testes dos conectores v3: intraday B3, cripto (Binance), IPEADATA e IBGE SIDRA."""

import datetime

import polars as pl

from databolsa_ingest.connectors.b3_intraday import B3IntradayConnector
from databolsa_ingest.connectors.crypto import CryptoConnector
from databolsa_ingest.connectors.ibge_sidra import IbgeSidraConnector
from databolsa_ingest.connectors.ipeadata import IpeadataConnector
from databolsa_ingest.core import DatasetSpec, RawPayload


def test_intraday_parse(writer, http):
    payload = RawPayload(
        url="u",
        json={
            "BizSts": {"cd": "OK"},
            "TradgFlr": {
                "date": "2026-06-12",
                "scty": {
                    "lstQtn": [
                        {"closPric": 41.01, "dtTm": "10:07:00", "prcFlcn": -1.79},
                        {"closPric": 41.06, "dtTm": "10:08:00", "prcFlcn": -1.67},
                    ]
                },
            },
        },
    )
    connector = B3IntradayConnector({"base_url": "http://x/", "watchlist": ["PETR4"]}, writer, http)
    spec = DatasetSpec(name="intraday_PETR4", partition={}, params={"ticker": "PETR4"})
    df = connector.parse(payload, spec)[""]

    assert df.height == 2
    assert df.get_column("close").to_list() == [41.01, 41.06]
    assert df.get_column("session_date")[0] == "2026-06-12"
    report = connector.validate({"": df}, spec)
    assert report.passed


def test_crypto_parse_klines(writer, http):
    kline = [
        1781136000000, "319376.0", "327366.0", "319376.0", "324891.0", "116.55",
        1781222399999, "37773758.01", 55484, "60.12", "19488207.26", "0",
    ]
    connector = CryptoConnector({"base_url": "http://x/", "symbols": ["BTCBRL"]}, writer, http)
    spec = DatasetSpec(name="BTCBRL_1d", partition={}, params={"symbol": "BTCBRL", "interval": "1d"})
    df = connector.parse(RawPayload(url="u", json=[kline]), spec)[""]

    assert df.get_column("close")[0] == 324891.0
    assert df.get_column("open_time")[0] == datetime.datetime(2026, 6, 11, 0, 0)
    assert df.get_column("symbol")[0] == "BTCBRL"


def test_ipeadata_parse_tz_dates(writer, http):
    rows = [
        {"SERCODIGO": "JPM366_EMBI366", "VALDATA": "1994-04-29T00:00:00-03:00", "VALVALOR": 1120.0},
        {"SERCODIGO": "JPM366_EMBI366", "VALDATA": "2026-06-10T00:00:00-03:00", "VALVALOR": 195.0},
    ]
    connector = IpeadataConnector(
        {"base_url": "http://x/", "series": [{"code": "JPM366_EMBI366", "name": "embi_br"}]},
        writer,
        http,
    )
    spec = DatasetSpec(name="embi_br", partition={}, params={"code": "JPM366_EMBI366", "name": "embi_br"})
    df = connector.parse(RawPayload(url="u", json=rows), spec)[""]

    assert df.get_column("data")[0] == datetime.date(1994, 4, 29)
    assert df.get_column("valor")[1] == 195.0


def test_sidra_parse_skips_header_and_special_values(writer, http):
    rows = [
        {"V": "Valor", "D3C": "Trimestre Móvel (Código)", "D3N": "Trimestre Móvel", "MN": "Unidade"},
        {"V": "6.2", "D3C": "202601", "D3N": "jan-fev-mar 2026", "MN": "%"},
        {"V": "...", "D3C": "202602", "D3N": "fev-mar-abr 2026", "MN": "%"},
    ]
    connector = IbgeSidraConnector(
        {"base_url": "http://x", "tables": [{"table": 6381, "variable": 4099, "name": "desemprego_pnad"}]},
        writer,
        http,
    )
    spec = DatasetSpec(name="desemprego_pnad", partition={}, params={"table": 6381, "variable": 4099, "name": "desemprego_pnad"})
    df = connector.parse(RawPayload(url="u", json=rows), spec)[""]

    assert df.height == 2  # header fora
    assert df.get_column("valor").to_list() == [6.2, None]  # "..." vira null
