import base64
import json

from databolsa_ingest.connectors.b3_corporate_actions import (
    B3CorporateActionsConnector,
    _b64,
    _ptbr_number,
)
from databolsa_ingest.core import DatasetSpec, RawPayload

SUPPLEMENT = {
    "tradingName": "PETROBRAS",
    "numberCommonShares": "7.442.231.382",
    "numberPreferredShares": "5.446.501.379",
    "totalNumberShares": "12.888.732.761",
    "stockCapital": "205.431.960.490,52",
    "segment": "NIVEL 2",
    "cashDividends": [
        {
            "assetIssued": "BRPETRACNPR6",
            "paymentDate": "21/08/2025",
            "rate": "0,35337",
            "relatedTo": "1º Trimestre/2025",
            "approvedOn": "12/05/2025",
            "isinCode": "BRPETRACNPR6",
            "label": "JRS CAP PROPRIO",
            "lastDatePrior": "02/06/2025",
            "remarks": "",
        },
        {
            "assetIssued": "BRPETRACNPR6",
            "paymentDate": "20/05/2025",
            "rate": "0,91360",
            "relatedTo": "Anual/2024",
            "approvedOn": "16/04/2025",
            "isinCode": "BRPETRACNPR6",
            "label": "DIVIDENDO",
            "lastDatePrior": "25/04/2025",
            "remarks": "",
        },
    ],
    "stockDividends": [
        {
            "assetIssued": "BRPETRACNPR6",
            "factor": "100,00000000000",
            "approvedOn": "24/03/2008",
            "isinCode": "BRPETRACNPR6",
            "label": "DESDOBRAMENTO",
            "lastDatePrior": "25/04/2008",
        }
    ],
    "subscriptions": [],
}


def test_ptbr_number():
    assert _ptbr_number("7.442.231.382") == 7442231382.0
    assert _ptbr_number("0,55305") == 0.55305
    assert _ptbr_number("205.431.960.490,52") == 205431960490.52
    assert _ptbr_number("") is None
    assert _ptbr_number(None) is None


def test_b64_params_roundtrip():
    encoded = _b64({"issuingCompany": "PETR", "language": "pt-br"})
    assert json.loads(base64.b64decode(encoded)) == {"issuingCompany": "PETR", "language": "pt-br"}


def test_parse_supplement_and_petr_validation(writer, http):
    connector = B3CorporateActionsConnector({"base_url": "http://x/"}, writer, http)
    spec = DatasetSpec(
        name="supplement_PETR",
        partition={"dataset": "supplement", "issuer": "PETR"},
        params={"kind": "supplement", "issuer": "PETR"},
    )
    frames = connector.parse(RawPayload(url="u", json=SUPPLEMENT), spec)

    shares = frames["table=share_counts"]
    assert shares.get_column("common_shares")[0] == 7442231382.0

    cash = frames["table=cash_dividends"]
    assert cash.height == 2
    assert cash.get_column("rate_parsed").to_list() == [0.35337, 0.9136]

    checks = {c.name: c for c in connector.validate(frames, spec).checks}
    assert checks["petr_dividend_types"].passed
    assert checks["petr_split_present"].passed
    assert checks["petr_share_counts_match_fre"].passed
