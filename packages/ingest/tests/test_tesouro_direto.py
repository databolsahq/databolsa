import datetime

import polars as pl
import respx
from httpx import Response

from databolsa_ingest.connectors.tesouro_direto import TesouroDiretoConnector

CSV_URL = "https://example.com/dl/PrecoTaxaTesouroDireto.csv"
PACKAGE_URL = "https://example.com/ckan/api/3/action/package_show?id=x"

HEADER = (
    "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;"
    "PU Compra Manha;PU Venda Manha;PU Base Manha"
)


def make_csv() -> str:
    base = datetime.date.today().strftime("%d/%m/%Y")
    rows = [
        f"Tesouro Selic;01/03/2031;{base};0,05;0,11;16500,12;16480,55;16480,55",
        f"Tesouro Prefixado;01/01/2029;{base};13,39;13,51;6850,10;6840,22;6840,22",
        f"Tesouro Prefixado com Juros Semestrais;01/01/2033;{base};13,20;13,32;7900,00;7890,00;7890,00",
        f"Tesouro IPCA+;15/05/2035;{base};7,10;7,22;1650,33;1645,90;1645,90",
        f"Tesouro IPCA+ com Juros Semestrais;15/08/2040;{base};7,01;7,13;4200,77;4190,10;4190,10",
    ]
    return "\n".join([HEADER, *rows])


@respx.mock
def test_run_resolves_ckan_and_parses_decimal_comma(writer, http):
    respx.get(url__startswith="https://example.com/ckan/api").mock(
        return_value=Response(
            200,
            json={"result": {"resources": [
                {"url": "https://example.com/other.pdf"},
                {"url": CSV_URL},
            ]}},
        )
    )
    respx.get(CSV_URL).mock(return_value=Response(200, text=make_csv()))

    connector = TesouroDiretoConnector(
        {"ckan_package_url": PACKAGE_URL, "fallback_url": "https://example.com/fallback.csv"},
        writer,
        http,
    )
    results = connector.run()

    assert len(results) == 1
    assert results[0].validation.passed, [c for c in results[0].validation.checks if not c.passed]
    df = pl.read_parquet(results[0].paths[0])
    assert df.get_column("Taxa Compra Manha")[1] == 13.39  # vírgula decimal
    assert df.get_column("Data Base").dtype == pl.Date
    assert df.height == 5
