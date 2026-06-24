from __future__ import annotations

from typing import Any

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

# B3 e Tesouro bloqueiam o User-Agent default do httpx; usar um UA de navegador real.
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


class NonJsonResponse(Exception):
    """HTTP 200 com corpo não-JSON — APIs do BCB devolvem HTML de erro sob throttling."""


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.TransportError, NonJsonResponse)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        # 5xx = erro transitório do servidor; 429 = rate limit (recuar e retentar)
        return exc.response.status_code >= 500 or exc.response.status_code == 429
    return False


def _wait_backoff(retry_state) -> float:
    """Recuo exponencial; num 429 honra o header Retry-After (limitado a 60s)."""
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
        retry_after = exc.response.headers.get("Retry-After")
        if retry_after is not None:
            try:
                return min(float(retry_after), 60.0)
            except ValueError:
                pass  # Retry-After pode vir como HTTP-date — cai no exponencial
    return wait_exponential(multiplier=1, max=30)(retry_state)


_retry = retry(
    retry=retry_if_exception(_is_retryable),
    stop=stop_after_attempt(3),
    wait=_wait_backoff,
    reraise=True,
)


class HttpClient:
    def __init__(self, timeout: float = 30.0):
        self._client = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
            follow_redirects=True,
        )

    @_retry
    def get_bytes(self, url: str, params: dict[str, Any] | None = None) -> bytes:
        resp = self._client.get(url, params=params)
        resp.raise_for_status()
        return resp.content

    @_retry
    def get_json(self, url: str, params: dict[str, Any] | None = None) -> Any:
        resp = self._client.get(url, params=params)
        resp.raise_for_status()
        if not resp.content.strip():
            return None
        try:
            return resp.json()
        except ValueError as exc:
            preview = resp.text[:200]
            raise NonJsonResponse(f"resposta não-JSON de {resp.request.url}: {preview!r}") from exc

    def close(self) -> None:
        self._client.close()
