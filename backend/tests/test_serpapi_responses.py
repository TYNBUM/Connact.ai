import httpx
import pytest
from fastapi import HTTPException

from app.config import settings
from app.providers.serpapi import (
    SerpAPIPeople,
    SerpAPIProvider,
    normalize_serpapi_response,
)


FULLY_EMPTY_RESPONSE = {
    "search_metadata": {"status": "Success"},
    "error": "Google hasn't returned any results for this query. (Fully empty response)",
}


def transport(monkeypatch, payload):
    original = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: original(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, json=payload)
            ),
            **kwargs,
        ),
    )


def people_filters():
    return {
        "page": 1,
        "per_page": 10,
        "title": "Professor",
        "company": "",
        "location": "",
        "sector": "",
        "keywords": "robotics",
    }


def public_search_contact():
    return {"name": "Ada Lovelace", "company": "University", "title": "Professor"}


def test_normalize_serpapi_response_converts_successful_fully_empty_to_results():
    payload = {
        **FULLY_EMPTY_RESPONSE,
        "search_parameters": {"engine": "google", "q": "no matches"},
    }

    result = normalize_serpapi_response(payload)

    assert result is not payload
    assert result["organic_results"] == []
    assert result["search_metadata"]["status"] == "Success"
    assert "organic_results" not in payload


@pytest.mark.parametrize(
    "metadata",
    [
        {"search_metadata": {"status": "Error"}},
        {},
    ],
)
def test_normalize_serpapi_response_rejects_error_without_success_status(metadata):
    with pytest.raises(HTTPException) as exc:
        normalize_serpapi_response({**metadata, "error": "Invalid API key"})

    assert exc.value.status_code == 502


def test_people_search_treats_http_200_fully_empty_response_as_no_results(monkeypatch):
    monkeypatch.setattr(settings, "serpapi_api_key", "test-only")
    monkeypatch.setattr(settings, "provider_calls_per_minute", 1_000)
    transport(monkeypatch, FULLY_EMPTY_RESPONSE)

    result = SerpAPIPeople(domain="academic").search(people_filters())

    assert result == {
        "people": [],
        "total": 0,
        "total_is_estimate": True,
        "has_more": False,
    }


def test_public_search_treats_http_200_fully_empty_response_as_no_results(monkeypatch):
    monkeypatch.setattr(settings, "serpapi_api_key", "test-only")
    monkeypatch.setattr(settings, "provider_calls_per_minute", 1_000)
    transport(monkeypatch, FULLY_EMPTY_RESPONSE)

    assert SerpAPIProvider().search(public_search_contact()) == []


def test_http_200_serpapi_error_status_still_fails(monkeypatch):
    monkeypatch.setattr(settings, "serpapi_api_key", "test-only")
    monkeypatch.setattr(settings, "provider_calls_per_minute", 1_000)
    transport(
        monkeypatch,
        {
            "search_metadata": {"status": "Error"},
            "error": "Invalid API key",
        },
    )

    with pytest.raises(HTTPException) as exc:
        SerpAPIPeople().search(people_filters())

    assert exc.value.status_code == 502


def test_public_search_rejects_non_list_organic_results_with_502(monkeypatch):
    monkeypatch.setattr(settings, "serpapi_api_key", "test-only")
    monkeypatch.setattr(settings, "provider_calls_per_minute", 1_000)
    transport(
        monkeypatch,
        {
            "search_metadata": {"status": "Success"},
            "organic_results": {"unexpected": "object"},
        },
    )

    with pytest.raises(HTTPException) as exc:
        SerpAPIProvider().search(public_search_contact())

    assert exc.value.status_code == 502
