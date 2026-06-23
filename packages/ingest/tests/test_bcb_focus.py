import datetime

import polars as pl
import respx
from httpx import Response

from databolsa_ingest.connectors import bcb_focus
from databolsa_ingest.connectors.bcb_focus import BcbFocusConnector

CONFIG = {
    "start_date": "2024-01-01",
    "surveys": {"anuais": {"resource": "ExpectativasMercadoAnuais", "indicators": ["IPCA"]}},
}


def make_row(median: float) -> dict:
    return {
        "Indicador": "IPCA",
        "Data": datetime.date.today().isoformat(),
        "DataReferencia": 2026,  # anuais devolve int; mensais devolve "MM/YYYY"
        "Media": median + 0.02,
        "Mediana": median,
        "DesvioPadrao": 0.3,
        "Minimo": median - 1,
        "Maximo": median + 1,
        "numeroRespondentes": 95,
        "baseCalculo": 0,
    }


@respx.mock
def test_fetch_pages_with_skip(writer, http, monkeypatch):
    monkeypatch.setattr(bcb_focus, "PAGE_SIZE", 2)
    pages = {
        "0": [make_row(4.3), make_row(4.4)],
        "2": [make_row(4.5)],
    }

    def respond(request):
        skip = dict(request.url.params)["$skip"]
        return Response(200, json={"value": pages.get(skip, [])})

    respx.get(url__startswith="https://olinda.bcb.gov.br/").mock(side_effect=respond)

    connector = BcbFocusConnector(CONFIG, writer, http)
    results = connector.run()

    assert results[0].rows == 3
    assert results[0].validation.passed, results[0].validation.failures
    df = pl.read_parquet(results[0].paths[0])
    assert df.get_column("DataReferencia").dtype == pl.Utf8
    assert df.get_column("Mediana").to_list() == [4.3, 4.4, 4.5]
