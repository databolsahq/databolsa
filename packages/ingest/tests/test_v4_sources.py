"""Testes da rodada v4: índices B3, VLMO, COPOM,
FII trimestral, merge incremental de cripto, universo de proventos e
vintages/staging-promote do core."""

import io
import zipfile
from datetime import date

import polars as pl

from databolsa_ingest.connectors.b3_corporate_actions import B3CorporateActionsConnector
from databolsa_ingest.connectors.b3_indices import B3IndicesConnector
from databolsa_ingest.connectors.bcb_copom import BcbCopomConnector, _meeting_number
from databolsa_ingest.connectors.crypto import CryptoConnector
from databolsa_ingest.connectors.cvm_fii import CvmFiiConnector
from databolsa_ingest.connectors.cvm_vlmo import CvmVlmoConnector
from databolsa_ingest.core import Connector, DatasetSpec, RawPayload
from databolsa_ingest.core.validation import ValidationReport


# ---------------------------------------------------------------- b3_indices

def test_b3_indices_parse_day_month_matrix(writer, http):
    payload = RawPayload(
        url="u",
        json={
            "results": [
                {"day": 1, "rateValue1": None, "rateValue2": "97.861,28", "rateValue4": "96.054,46"},
                {"day": 31, "rateValue1": "91.012,00", "rateValue2": None, "rateValue4": None},
            ]
        },
    )
    connector = B3IndicesConnector({"base_url": "http://x/"}, writer, http)
    spec = DatasetSpec(name="IBOV_2019", partition={}, params={"index": "IBOV", "year": 2019})
    df = connector.parse(payload, spec)[""]

    # dia 31 em fevereiro/abril não existe e o null é pulado — sobram 3 pregões
    assert df.height == 3
    assert df.get_column("data").to_list() == [date(2019, 1, 31), date(2019, 2, 1), date(2019, 4, 1)]
    assert df.get_column("close")[0] == 91012.0
    report = connector.validate({"": df}, spec)  # ano passado exige >= 100 pregões
    assert not report.passed


def test_b3_indices_cross_check_skips_without_sgs(writer, http):
    connector = B3IndicesConnector({"base_url": "http://x/"}, writer, http)
    spec = DatasetSpec(name="IBOV_2010", partition={}, params={"index": "IBOV", "year": 2010})
    df = pl.DataFrame({"data": [date(2010, 1, 4)], "close": [70045.0], "index": ["IBOV"]})
    report = connector.validate({"": df}, spec)
    checks = {c.name: c for c in report.checks}
    assert "SKIPPED" in checks["ibov_matches_sgs7"].detail


# ------------------------------------------------------------------ cvm_vlmo

def _zip_with(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in members.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_vlmo_parse_generic_members(writer, http):
    csv = "CNPJ_Companhia;Versao\n33.000.167/0001-01;1\n".encode("latin-1")
    payload = RawPayload(url="u", content=_zip_with({
        "vlmo_cia_aberta_con_2024.csv": csv,
        "vlmo_cia_aberta_2024.csv": csv,
    }))
    connector = CvmVlmoConnector({"base_url": "http://x/"}, writer, http)
    spec = DatasetSpec(name="vlmo_2024", partition={}, params={"year": 2024})
    frames = connector.parse(payload, spec)

    assert set(frames) == {"table=con", "table=vlmo"}
    report = connector.validate(frames, spec)
    checks = {c.name: c.passed for c in report.checks}
    assert checks["petrobras_present"]


# ----------------------------------------------------------------- bcb_copom

def test_copom_meeting_number():
    assert _meeting_number("278ª Reunião - 28-29 abril, 2026") == 278
    assert _meeting_number(None) is None


def test_copom_index_parse(writer, http):
    rows = [
        {"Titulo": "278ª Reunião - 28-29 abril, 2026", "DataReferencia": "2026-04-29T03:00:00Z",
         "Url": "/content/copom/atascopom/Copom278.pdf", "LinkPagina": "/p/278"},
    ]
    connector = BcbCopomConnector({"base_url": "http://x/", "site_base_url": "http://x"}, writer, http)
    spec = DatasetSpec(name="atas_index", partition={}, params={"kind": "index", "endpoint": "atascopom"})
    df = connector.parse(RawPayload(url="u", json=rows), spec)[""]
    assert df.get_column("meeting")[0] == 278
    assert df.get_column("Url")[0].endswith(".pdf")


# ------------------------------------------------------- cvm_fii trimestral

def test_fii_inf_trimestral_parse(writer, http):
    csv = "CNPJ_Fundo;Percentual_Vacancia\n11.111/0001-11;7,5\n".encode("latin-1")
    payload = RawPayload(url="u", content=_zip_with({
        "inf_trimestral_fii_geral_2024.csv": csv,
        "inf_trimestral_fii_imovel_2024.csv": csv,
    }))
    connector = CvmFiiConnector({}, writer, http)
    spec = DatasetSpec(name="inf_trimestral_2024", partition={}, params={"kind": "inf_trimestral", "year": 2024})
    frames = connector.parse(payload, spec)
    assert set(frames) == {"table=geral", "table=imovel"}
    assert connector.validate(frames, spec).passed


# ------------------------------------------------------ crypto merge 1h

def test_crypto_1h_incremental_merge(writer, http):
    def kline(open_ms: int, close: str) -> list:
        return [open_ms, "1", "2", "1", close, "10", open_ms + 3_599_999, "1", 1, "1", "1", "0"]

    connector = CryptoConnector({"base_url": "http://x/"}, writer, http)
    spec = DatasetSpec(
        name="BTCBRL_1h",
        partition={"symbol": "BTCBRL", "interval": "1h"},
        params={"symbol": "BTCBRL", "interval": "1h"},
    )
    old = connector.parse(RawPayload(url="u", json=[kline(1_000_000_000_000, "100"), kline(1_000_003_600_000, "200")]), spec)[""]
    writer.write("crypto", spec, {"": old}, RawPayload(url="u"), ValidationReport())

    # nova janela: sobrepõe o 2º candle (close revisto) e adiciona um 3º
    new = connector.parse(
        RawPayload(url="u", json=[kline(1_000_003_600_000, "250"), kline(1_000_007_200_000, "300")]), spec
    )[""]
    assert new.height == 3  # candle antigo preservado, overlap atualizado
    closes = dict(zip(new.get_column("open_time").dt.epoch("ms").to_list(), new.get_column("close").to_list()))
    assert closes[1_000_000_000_000] == 100.0
    assert closes[1_000_003_600_000] == 250.0


# --------------------------------------- b3_corporate_actions: universo deep

def test_deep_universe_includes_delisted_from_cotahist(writer, http):
    companies = pl.DataFrame({"issuingCompany": ["PETR"], "tradingName": ["PETROBRAS"]})
    writer.write(
        "b3_corporate_actions",
        DatasetSpec(name="companies", partition={"dataset": "companies"}),
        {"": companies},
        RawPayload(url="u"),
        ValidationReport(),
    )
    cotahist = pl.DataFrame(
        {
            "codbdi": ["02", "02", "12"],
            "codneg": ["CRUZ3", "PETR4", "HGLG11"],
            "nomres": ["SOUZA CRUZ", "PETROBRAS", "CSHG LOG"],
            "data": [date(2015, 9, 30), date(2024, 1, 2), date(2024, 1, 2)],
        }
    )
    writer.write(
        "b3_cotahist",
        DatasetSpec(name="cotahist_2015", partition={"year": "2015"}),
        {"": cotahist},
        RawPayload(url="u"),
        ValidationReport(),
    )
    connector = B3CorporateActionsConnector({"deep_dividends": "all"}, writer, http)
    universe = {u["issuer"]: u for u in connector._deep_universe()}

    assert universe["PETR"]["listed"] is True
    assert universe["CRUZ"]["listed"] is False  # delistada entra via COTAHIST
    assert "SOUZA CRUZ" in universe["CRUZ"]["names"]
    assert "HGLG" not in universe  # codbdi 12 (FII) fora do universo de ações

    specs = {s.name: s for s in connector.datasets()}
    assert specs["cash_dividends_deep_CRUZ"].max_age is None  # delistada = imutável
    assert specs["cash_dividends_deep_PETR"].max_age is not None


# ------------------------------------------- core: vintages e staging-promote

class _StubConnector(Connector):
    source = "stub"

    def __init__(self, writer, http, *, snapshot=False, passes=True, value=1):
        super().__init__({}, writer, http)
        self._snapshot, self._passes, self._value = snapshot, passes, value

    def datasets(self):
        return [DatasetSpec(name="d", partition={"k": "v"}, snapshot=self._snapshot)]

    def fetch(self, spec):
        return RawPayload(url="u")

    def parse(self, payload, spec):
        return {"": pl.DataFrame({"x": [self._value]})}

    def validate(self, frames, spec):
        report = ValidationReport()
        report.add("check", self._passes, "")
        return report


def test_snapshot_creates_daily_vintage_and_is_idempotent(writer, http):
    connector = _StubConnector(writer, http, snapshot=True)
    [result] = connector.run()
    assert not result.skipped
    expected = writer.raw_root / "stub" / "k=v" / f"snapshot_date={date.today().isoformat()}" / "data.parquet"
    assert expected.exists()
    [again] = connector.run()  # mesmo dia: vintage imutável, pulado
    assert again.skipped


def test_staging_promote_keeps_good_data_on_failed_validation(writer, http):
    [ok] = _StubConnector(writer, http, passes=True, value=1).run()
    assert ok.validation.passed
    [bad] = _StubConnector(writer, http, passes=False, value=2).run(force=True)
    assert bad.error and "mantida" in bad.error
    spec = DatasetSpec(name="d", partition={"k": "v"})
    frames = writer.read_frames("stub", spec)
    assert frames[""].get_column("x").to_list() == [1]  # dado bom preservado


def test_failed_validation_still_writes_on_virgin_partition(writer, http):
    [bad] = _StubConnector(writer, http, passes=False, value=2).run()
    assert bad.error is None  # escrito (com relatório reprovado no manifesto)
    spec = DatasetSpec(name="d", partition={"k": "v"})
    assert writer.read_frames("stub", spec)[""].get_column("x").to_list() == [2]
