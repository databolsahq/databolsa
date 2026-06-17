import json
from datetime import datetime, timedelta, timezone

from databolsa_ingest.core import (
    ExtractionResult,
    RunLedger,
    collect_errors,
    run_id,
    source_health,
    summarize_source,
)
from databolsa_ingest.core.validation import ValidationReport


def _manifest(root, source, partition, **fields):
    d = root / "raw" / source
    for k, v in partition.items():
        d = d / f"{k}={v}"
    d.mkdir(parents=True, exist_ok=True)
    (d / "_manifest.json").write_text(json.dumps(fields), encoding="utf-8")


def test_summarize_source_counts_each_outcome():
    fail = ValidationReport()
    fail.add("freshness", False, "obs antiga")
    results = [
        ExtractionResult("s", "ok", rows=100),
        ExtractionResult("s", "skipped", skipped=True),
        ExtractionResult("s", "missing", missing=True),
        ExtractionResult("s", "errored", error="ReadTimeout"),
        ExtractionResult("s", "bad_validation", validation=fail),  # conta como erro
    ]
    assert summarize_source(results) == {
        "ok": 1, "skip": 1, "miss": 1, "err": 2, "rows": 100, "datasets": 5,
    }


def test_collect_errors_captures_fetch_and_validation():
    fail = ValidationReport()
    fail.add("freshness", False, "obs antiga")
    results = [
        ExtractionResult("s", "good", rows=1),  # não vira erro
        ExtractionResult("s", "errored", error="ReadTimeout"),
        ExtractionResult("s", "bad", validation=fail),
    ]
    errs = collect_errors("s", results)
    assert errs == [
        "s/errored: ReadTimeout",
        "s/bad: validação reprovou (freshness: obs antiga)",
    ]


def test_run_id_is_sortable_and_utc():
    a = run_id(datetime(2026, 6, 14, 20, 0, 0, tzinfo=timezone.utc))
    b = run_id(datetime(2026, 6, 14, 20, 0, 1, tzinfo=timezone.utc))
    assert a < b and a.endswith("Z") and a.startswith("20260614T2000")


def test_ledger_write_latest_recent_roundtrip(tmp_path):
    led = RunLedger(tmp_path / "data")
    assert led.latest() is None  # vazio antes de qualquer run
    ids = []
    for sec in range(3):
        rid = run_id(datetime(2026, 6, 14, 20, 0, sec, tzinfo=timezone.utc))
        ids.append(rid)
        led.write({"run_id": rid, "exit": 0, "sources": {}})
    assert led.latest()["run_id"] == ids[-1]
    assert [r["run_id"] for r in led.recent(2)] == ids[-2:]
    # escrita atômica: nenhum .tmp sobra para confundir o glob run-*.json
    assert not list((tmp_path / "data" / "_runs").glob("*.tmp"))


def test_source_health_freshness_missing_and_validation(tmp_path):
    root = tmp_path / "data"
    now = datetime.now(timezone.utc)
    older = (now - timedelta(days=12)).isoformat()
    newer = now.isoformat()
    # fonte com dois datasets: a saúde usa o fetch MAIS recente
    _manifest(root, "bcb_sgs", {"id": "1"}, fetched_at=older, validation={"passed": True})
    _manifest(root, "bcb_sgs", {"id": "2"}, fetched_at=newer, validation={"passed": True})
    # validação reprovada
    _manifest(root, "cvm_fca", {"y": "2026"}, fetched_at=newer, validation={"passed": False})
    # negative-cache miss: sem fetch bem-sucedido
    _manifest(root, "b3", {"i": "XPTO"}, missing=True, fetched_at=newer)

    health = source_health(root)
    assert health["bcb_sgs"]["age_days"] == 0  # pega o dataset mais novo
    assert health["bcb_sgs"]["datasets"] == 2
    assert health["bcb_sgs"]["failed_validation"] == 0
    assert health["cvm_fca"]["failed_validation"] == 1
    assert health["b3"]["missing"] == 1
    assert health["b3"]["last_fetch"] is None  # miss não conta como fetch


def test_source_health_empty_lake(tmp_path):
    assert source_health(tmp_path / "nonexistent") == {}
