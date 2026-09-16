from ..config import settings
from .mock import MockAcademicPeople, MockPeople, MockPublic
from .apollo import ApolloProvider
from .serpapi import SerpAPIProvider, SerpAPIPeople
from .ai import MockAI, CompatibleAI
from .base import (
    PeopleSearchProvider,
    PeopleEnrichmentProvider,
    PublicSearchProvider,
    AIProvider,
)


def canonical_people_filters(filters, domain="finance"):
    normalized = {
        key: value.strip() if isinstance(value, str) else value
        for key, value in filters.items()
    }
    if domain == "academic" and not normalized.get("title"):
        normalized["title"] = "Professor"
    return normalized


def people_search(domain="finance") -> PeopleSearchProvider:
    if settings.people_mode == "mock":
        return MockAcademicPeople() if domain == "academic" else MockPeople()
    return SerpAPIPeople(domain=domain)


def people_enrichment() -> PeopleEnrichmentProvider:
    return MockPeople() if settings.people_mode == "mock" else ApolloProvider()


def public_search() -> PublicSearchProvider:
    return MockPublic() if settings.public_search_mode == "mock" else SerpAPIProvider()


def ai() -> AIProvider:
    return MockAI() if settings.ai_mode == "mock" else CompatibleAI()
