from typing import Protocol
from collections import defaultdict, deque
from threading import Lock
from time import monotonic
import httpx
from fastapi import HTTPException
from ..config import settings


class PeopleSearchProvider(Protocol):
    def search(self, filters: dict) -> dict: ...


class PeopleEnrichmentProvider(Protocol):
    def enrich(self, contact: dict) -> dict: ...


class PublicSearchProvider(Protocol):
    def search(self, contact: dict) -> list[dict]: ...


class AIProvider(Protocol):
    def complete(self, task: str, data: dict) -> dict: ...


_calls = defaultdict(deque)
_lock = Lock()


def budget(provider: str):
    # One local worker; no Redis or background work. Every live upstream request is counted.
    with _lock:
        calls, clock = _calls[provider], monotonic()
        while calls and calls[0] < clock - 60:
            calls.popleft()
        if len(calls) >= settings.provider_calls_per_minute:
            raise HTTPException(
                429, f"{provider}: local call limit reached. Retry in a minute."
            )
        calls.append(clock)


def request_json(provider, method, url, key, **kwargs):
    if not key:
        raise HTTPException(
            503,
            f"{provider} is in Live mode but its API key is missing. Configure it on the server.",
        )
    budget(provider)
    try:
        with httpx.Client(timeout=35) as client:
            res = client.request(method, url, **kwargs)
        if res.status_code >= 400:
            code = 429 if res.status_code == 429 else 502
            raise HTTPException(
                code,
                f"{provider} returned HTTP {res.status_code}. Check API access, quota and filters. No mock fallback was used.",
            )
        data = res.json()
        if not isinstance(data, dict) or data.get("error"):
            raise ValueError("Invalid provider result")
        return data
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            502,
            f"{provider} request failed or returned invalid data. No mock fallback was used.",
        )
