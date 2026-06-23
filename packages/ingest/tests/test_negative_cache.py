"""Negative cache (memoização de "sem dados") no Connector.run/RawZoneWriter.

Garante que: (1) um SourceNotAvailable é memoizado e pula a re-sondagem dentro do
TTL; (2) o marcador expira e re-sonda; (3) erro transitório NÃO é memoizado; (4)
um 404 não esconde dado real previamente extraído (mesma regra do staging-promote)."""

import json
from datetime import datetime, timedelta, timezone

import polars as pl

from databolsa_ingest.core import Connector, DatasetSpec, RawPayload, SourceNotAvailable


class _Stub(Connector):
    source = "stub"

    def __init__(self, writer, spec, behavior, data=None):
        super().__init__({}, writer, None)  # http não é usado pelos stubs
        self._spec = spec
        self._behavior = behavior  # "missing" | "transient" | "data"
        self._data = data or [{"a": 1}]
        self.fetch_calls = 0

    def datasets(self):
        return [self._spec]

    def fetch(self, spec):
        self.fetch_calls += 1
        if self._behavior == "missing":
            raise SourceNotAvailable("sem dados")
        if self._behavior == "transient":
            raise RuntimeError("timeout/429 transitório")
        return RawPayload(url="http://x", json=self._data)

    def parse(self, payload, spec):
        return {"": pl.DataFrame(payload.json)}


def test_missing_is_memoized_and_skipped(writer):
    spec = DatasetSpec(name="d", partition={"issuer": "AAAA"}, max_age=timedelta(days=7))
    c = _Stub(writer, spec, "missing")
    r1 = c.run()
    assert r1[0].missing and c.fetch_calls == 1
    assert writer.read_manifest("stub", spec)["missing"] is True
    r2 = c.run()  # dentro do TTL → pula, sem rede
    assert r2[0].skipped and c.fetch_calls == 1  # não re-sondou


def test_missing_reprobed_after_ttl(writer):
    spec = DatasetSpec(name="d", partition={"issuer": "AAAA"}, max_age=timedelta(days=7))
    c = _Stub(writer, spec, "missing")
    c.run()
    path = writer.manifest_path("stub", spec)
    m = json.loads(path.read_text())
    m["fetched_at"] = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    path.write_text(json.dumps(m))
    c.run()
    assert c.fetch_calls == 2  # TTL vencido → re-sondou


def test_transient_error_not_memoized(writer):
    spec = DatasetSpec(name="d", partition={"issuer": "AAAA"}, max_age=timedelta(days=7))
    c = _Stub(writer, spec, "transient")
    r1 = c.run()
    assert r1[0].error and not r1[0].missing
    assert writer.read_manifest("stub", spec) is None  # nada memoizado
    c.run()
    assert c.fetch_calls == 2  # re-tenta no próximo run (ausência != falha)


def test_missing_does_not_overwrite_good_data(writer):
    # max_age=0 força re-fetch a cada run → exercita o caminho 404-após-sucesso
    spec = DatasetSpec(name="d", partition={"issuer": "AAAA"}, max_age=timedelta(0))
    _Stub(writer, spec, "data", data=[{"a": 1}, {"a": 2}]).run()
    assert writer.read_manifest("stub", spec)["rows"] == 2

    gone = _Stub(writer, spec, "missing")
    r = gone.run()
    assert r[0].missing
    m = writer.read_manifest("stub", spec)
    assert m["rows"] == 2 and not m.get("missing")  # dado real preservado
    assert writer.read_frames("stub", spec)[""].height == 2
