import datetime
import io
import zipfile

from databolsa_ingest.connectors.b3_cotahist import B3CotahistConnector
from databolsa_ingest.core import DatasetSpec, RawPayload

# (campo, largura) na ordem do layout COTAHIST — total 245 chars
LAYOUT = [
    ("tipreg", 2), ("data", 8), ("codbdi", 2), ("codneg", 12), ("tpmerc", 3),
    ("nomres", 12), ("especi", 10), ("prazot", 3), ("modref", 4),
    ("preabe", 13), ("premax", 13), ("premin", 13), ("premed", 13), ("preult", 13),
    ("preofc", 13), ("preofv", 13), ("totneg", 5), ("quatot", 18), ("voltot", 18),
    ("preexe", 13), ("indopc", 1), ("datven", 8), ("fatcot", 7), ("ptoexe", 13),
    ("codisi", 12), ("dismes", 3),
]


def make_line(**overrides) -> str:
    values = {
        "tipreg": "01", "data": "20240102", "codbdi": "02", "codneg": "PETR4",
        "tpmerc": "010", "nomres": "PETROBRAS", "especi": "PN", "prazot": "",
        "modref": "R$", "preabe": 4113, "premax": 4200, "premin": 4100,
        "premed": 4150, "preult": 4188, "preofc": 4180, "preofv": 4190,
        "totneg": 100, "quatot": 1000, "voltot": 12345678, "preexe": 0,
        "indopc": "0", "datven": "99991231", "fatcot": 1, "ptoexe": 0,
        "codisi": "BRPETRACNPR6", "dismes": 102,
    }
    values.update(overrides)
    parts = []
    for field, width in LAYOUT:
        v = values[field]
        parts.append(str(v).zfill(width) if isinstance(v, int) else str(v).ljust(width))
    line = "".join(parts)
    assert len(line) == 245
    return line


def make_payload(lines: list[str]) -> RawPayload:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("COTAHIST_A2024.TXT", "\n".join(lines).encode("latin-1"))
    return RawPayload(url="http://x", content=buf.getvalue())


def _connector(writer, http):
    return B3CotahistConnector({"base_url": "http://x/", "years": [2024]}, writer, http)


def test_parse_decodes_prices_and_filters(writer, http):
    lines = [
        make_line(),
        make_line(codneg="VALE3", codbdi="02", preult=6500),
        make_line(codneg="PETRA10", tpmerc="070"),   # opção: fora
        make_line(codneg="HGLG11", codbdi="12"),     # FII (BDI 12): entra desde a v2
        make_line(codneg="XPTO34", codbdi="10"),     # BDR: fora
        make_line(tipreg="99"),                      # trailer: fora
    ]
    spec = DatasetSpec(name="cotahist_2024", partition={"year": "2024"}, params={"year": 2024})
    frames = _connector(writer, http).parse(make_payload(lines), spec)
    df = frames[""]

    assert df.height == 3
    assert set(df.get_column("codneg").to_list()) == {"PETR4", "VALE3", "HGLG11"}
    assert set(df.get_column("codbdi").to_list()) == {"02", "12"}
    petr = df.filter(df.get_column("codneg") == "PETR4")
    assert petr.get_column("preult")[0] == 41.88     # inteiro sem separador / 100
    assert petr.get_column("voltot")[0] == 123456.78  # volume em centavos
    assert petr.get_column("data")[0] == datetime.date(2024, 1, 2)


def test_parse_honors_fatcot(writer, http):
    lines = [make_line(codneg="XPTO3", preult=100000, fatcot=1000)]
    spec = DatasetSpec(name="cotahist_2024", partition={"year": "2024"}, params={"year": 2024})
    df = _connector(writer, http).parse(make_payload(lines), spec)[""]
    assert df.get_column("preult")[0] == 1.0  # raw / 100 / fatcot
