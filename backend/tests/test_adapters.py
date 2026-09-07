import httpx
import pytest
from fastapi import HTTPException
from app.config import settings
from app.providers.apollo import ApolloProvider
from app.providers.serpapi import SerpAPIProvider
from app.providers.ai import CompatibleAI


def transport(monkeypatch, handler):
    original = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kw: original(transport=httpx.MockTransport(handler), **kw),
    )


def test_apollo_contract_and_no_email_during_search(monkeypatch):
    import json

    monkeypatch.setattr(settings, "apollo_api_key", "test-only")

    def handle(req):
        assert req.url.path == "/api/v1/mixed_people/api_search"
        body = json.loads(req.content)
        assert body["person_titles"] == ["Analyst"] and body["person_locations"] == [
            "New York"
        ]
        assert body["q_organization_domains_list"] == ["firm.example"]
        assert "Private Equity" in body["q_keywords"]
        return httpx.Response(
            200,
            json={
                "people": [
                    {
                        "id": "123",
                        "first_name": "Jane",
                        "last_name_obfuscated": "D***",
                        "title": "Analyst",
                        "has_email": True,
                        "organization": {"name": "Firm"},
                    }
                ],
                "total_entries": 1,
            },
        )

    transport(monkeypatch, handle)
    r = ApolloProvider().search(
        {
            "title": "Analyst",
            "company": "firm.example",
            "location": "New York",
            "keywords": "investments",
            "sector": "Private Equity",
            "page": 1,
            "per_page": 10,
        }
    )
    assert (
        r["people"][0]["name"] == "Jane D***"
        and r["people"][0]["email"] == ""
        and r["people"][0]["location"] == ""
    )


def test_live_failures_are_visible(monkeypatch):
    monkeypatch.setattr(settings, "apollo_api_key", "test-only")
    transport(monkeypatch, lambda r: httpx.Response(403, json={"error": "no access"}))
    with pytest.raises(HTTPException) as exc:
        ApolloProvider().enrich({"provider_id": "123"})
    assert exc.value.status_code == 502 and "No mock fallback" in exc.value.detail


def test_serpapi_preserves_source_and_bounds(monkeypatch):
    monkeypatch.setattr(settings, "serpapi_api_key", "test-only")
    transport(
        monkeypatch,
        lambda r: httpx.Response(
            200,
            json={
                "organic_results": [
                    {
                        "title": "Profile",
                        "link": "https://firm.example/bio",
                        "snippet": "Jane, analyst",
                    }
                ]
                * 10
            },
        ),
    )
    rows = SerpAPIProvider().search(
        {"name": "Jane", "company": "Firm", "title": "Analyst"}
    )
    assert (
        len(rows) == 3
        and rows[0]["kind"] == "unverified_lead"
        and rows[0]["url"] == "https://firm.example/bio"
    )


def test_ai_contract_and_malformed_response(monkeypatch):
    import json

    monkeypatch.setattr(settings, "ai_api_key", "test-only")

    def handle(req):
        body = json.loads(req.content)
        assert (
            req.url.path.endswith("/chat/completions")
            and body["response_format"]["type"] == "json_object"
        )
        assert "UNTRUSTED" in body["messages"][0]["content"]
        return httpx.Response(
            200, json={"choices": [{"message": {"content": "not json"}}]}
        )

    transport(monkeypatch, handle)
    with pytest.raises(HTTPException) as exc:
        CompatibleAI().complete("generate", {})
    assert exc.value.status_code == 502
