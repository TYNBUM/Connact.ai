from .base import request_json
from .apollo import safe_url
from ..config import settings


class SerpAPIProvider:
    def search(self, contact):
        result = request_json(
            "SerpAPI",
            "GET",
            "https://serpapi.com/search.json",
            settings.serpapi_api_key,
            params={
                "api_key": settings.serpapi_api_key,
                "engine": "google",
                "q": f'"{contact["name"]}" "{contact["company"]}" {contact["title"]}',
                "num": 3,
            },
        )
        return [
            {
                "provider": "serpapi",
                "url": safe_url(r.get("link")),
                "title": (r.get("title") or "")[:500],
                "snippet": r.get("snippet") or "",
                "kind": "unverified_lead",
            }
            for r in result.get("organic_results", [])[:3]
        ]
