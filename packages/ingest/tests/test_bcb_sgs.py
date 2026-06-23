import datetime

import polars as pl
import respx
from httpx import Response

from databolsa_ingest.connectors.bcb_sgs import BcbSgsConnector

CONFIG = {
    "start_date": "2024-01-01",
    "throttle_seconds": 0,
    # discontinued: pula o check de frescor (a fixture tem datas fixas de 2024)
    "series": [{"id": 433, "name": "ipca", "unit": "% a.m.", "frequency": "monthly", "discontinued": True}],
}

PAYLOAD = [
    {"data": "01/11/2024", "valor": "0.39"},
    {"data": "01/12/2024", "valor": "0.52"},
    {"data": "01/01/2025", "valor": ""},
]


@respx.mock
def test_run_parses_brazilian_dates_and_values(writer, http):
    respx.get(url__regex=r"https://api\.bcb\.gov\.br/dados/serie/bcdata\.sgs\.433/dados.*").mock(
        return_value=Response(200, json=PAYLOAD)
    )
    connector = BcbSgsConnector(CONFIG, writer, http)
    results = connector.run()

    assert len(results) == 1
    assert results[0].rows == 3
    assert results[0].validation.passed

    df = pl.read_parquet(results[0].paths[0])
    assert df.get_column("data").dtype == pl.Date
    assert df.get_column("data")[1] == datetime.date(2024, 12, 1)
    assert df.get_column("valor")[1] == 0.52
    assert df.get_column("valor")[2] is None  # valor vazio vira null
    assert df.get_column("series_name")[0] == "ipca"


@respx.mock
def test_second_run_is_idempotent_skip(writer, http):
    respx.get(url__regex=r".*bcdata\.sgs\.433.*").mock(return_value=Response(200, json=PAYLOAD))
    connector = BcbSgsConnector(CONFIG, writer, http)
    connector.run()
    results = connector.run()
    assert results[0].skipped
