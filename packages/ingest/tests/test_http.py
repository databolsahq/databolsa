"""HttpClient: classificação de retentável e backoff em 429 (rate limit)."""

import httpx
import respx
from httpx import Response

from databolsa_ingest.core import HttpClient
from databolsa_ingest.core.http import _is_retryable


def _status_error(status: int) -> httpx.HTTPStatusError:
    req = httpx.Request("GET", "https://x")
    return httpx.HTTPStatusError("e", request=req, response=httpx.Response(status, request=req))


def test_is_retryable_classifies_status():
    assert _is_retryable(_status_error(429)) is True   # rate limit → recuar
    assert _is_retryable(_status_error(503)) is True   # 5xx transitório
    assert _is_retryable(_status_error(404)) is False  # ausência → não retentar


@respx.mock
def test_get_json_retries_429_then_succeeds():
    # Retry-After: 0 → backoff zero, teste instantâneo
    route = respx.get("https://api.example.com/x").mock(
        side_effect=[
            Response(429, headers={"Retry-After": "0"}, text="rate limited"),
            Response(200, json={"ok": True}),
        ]
    )
    client = HttpClient()
    try:
        assert client.get_json("https://api.example.com/x") == {"ok": True}
        assert route.call_count == 2  # retentou após o 429
    finally:
        client.close()
