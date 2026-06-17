import pytest

from databolsa_ingest.core import HttpClient, RawZoneWriter


@pytest.fixture
def writer(tmp_path):
    return RawZoneWriter(tmp_path / "data")


@pytest.fixture
def http():
    client = HttpClient(timeout=5.0)
    yield client
    client.close()
