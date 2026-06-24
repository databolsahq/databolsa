import json
from datetime import datetime, timedelta, timezone

import polars as pl

from databolsa_ingest.core import DatasetSpec, RawPayload
from databolsa_ingest.core.validation import ValidationReport


def _write(writer, spec):
    frames = {"": pl.DataFrame({"x": [1, 2, 3]})}
    report = ValidationReport()
    report.add("non_empty", True, "3 rows")
    return writer.write("dummy", spec, frames, RawPayload(url="http://example"), report)


def test_write_creates_parquet_and_manifest(writer):
    spec = DatasetSpec(name="d1", partition={"year": "2024"})
    paths = _write(writer, spec)
    assert paths[0].exists()
    assert paths[0].name == "data.parquet"
    manifest = writer.read_manifest("dummy", spec)
    assert manifest["rows"] == 3
    assert manifest["validation"]["passed"] is True


def test_immutable_dataset_is_current_forever(writer):
    spec = DatasetSpec(name="d1", partition={"year": "2020"}, max_age=None)
    assert not writer.is_current("dummy", spec)
    _write(writer, spec)
    assert writer.is_current("dummy", spec)


def test_max_age_expires(writer):
    spec = DatasetSpec(name="d1", partition={"year": "2024"}, max_age=timedelta(days=1))
    _write(writer, spec)
    assert writer.is_current("dummy", spec)

    path = writer.manifest_path("dummy", spec)
    manifest = json.loads(path.read_text())
    manifest["fetched_at"] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    path.write_text(json.dumps(manifest))
    assert not writer.is_current("dummy", spec)


def test_write_missing_is_current_within_ttl(writer):
    spec = DatasetSpec(name="d1", partition={"issuer": "XXXX"}, max_age=timedelta(days=7))
    assert not writer.is_current("dummy", spec)
    writer.write_missing("dummy", spec, url=None, detail="sem dados")
    manifest = writer.read_manifest("dummy", spec)
    assert manifest["missing"] is True
    assert writer.is_current("dummy", spec)  # marcador dentro do TTL → pula


def test_write_missing_expires(writer):
    spec = DatasetSpec(name="d1", partition={"issuer": "XXXX"}, max_age=timedelta(days=7))
    writer.write_missing("dummy", spec, url=None, detail="sem dados")
    path = writer.manifest_path("dummy", spec)
    manifest = json.loads(path.read_text())
    manifest["fetched_at"] = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    path.write_text(json.dumps(manifest))
    assert not writer.is_current("dummy", spec)  # TTL (7d) vencido → re-sonda


def test_update_validation_rewrites_only_validation_block(writer):
    spec = DatasetSpec(name="d1", partition={"year": "2024"})
    _write(writer, spec)  # manifesto inicial com passed=True
    before = writer.read_manifest("dummy", spec)

    failing = ValidationReport()
    failing.add("some_check", False, "boom")
    assert writer.update_validation("dummy", spec, failing) is True

    after = writer.read_manifest("dummy", spec)
    assert after["validation"]["passed"] is False  # veredito atualizado
    # resto do manifesto preservado (sem refetch)
    assert after["fetched_at"] == before["fetched_at"]
    assert after["rows"] == before["rows"]
    assert after["files"] == before["files"]


def test_update_validation_skips_absent_and_missing(writer):
    spec = DatasetSpec(name="d1", partition={"issuer": "XXXX"}, max_age=timedelta(days=7))
    report = ValidationReport()
    report.add("x", True, "")
    # sem manifesto ainda → nada a atualizar
    assert writer.update_validation("dummy", spec, report) is False
    # marcador de ausência (negative cache) não é sobrescrito por uma revalidação
    writer.write_missing("dummy", spec, url=None, detail="sem dados")
    assert writer.update_validation("dummy", spec, report) is False
    assert writer.read_manifest("dummy", spec)["missing"] is True


def test_read_frames_roundtrip(writer):
    spec = DatasetSpec(name="d1", partition={"dataset": "dfp", "year": "2024"})
    frames = {
        "statement=dre/scope=con": pl.DataFrame({"a": [1]}),
        "statement=bpa/scope=ind": pl.DataFrame({"a": [1, 2]}),
    }
    report = ValidationReport()
    writer.write("dummy", spec, frames, RawPayload(url="u"), report)
    loaded = writer.read_frames("dummy", spec)
    assert set(loaded) == set(frames)
    assert loaded["statement=bpa/scope=ind"].height == 2
