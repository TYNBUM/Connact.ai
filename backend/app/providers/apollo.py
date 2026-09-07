from .base import request_json
from ..config import settings

BASE = "https://api.apollo.io/api/v1"


def safe_url(value):
    return (
        value
        if isinstance(value, str) and value.startswith(("http://", "https://"))
        else ""
    )


class ApolloProvider:
    def post(self, endpoint, data):
        return request_json(
            "Apollo",
            "POST",
            BASE + endpoint,
            settings.apollo_api_key,
            headers={
                "x-api-key": settings.apollo_api_key,
                "Content-Type": "application/json",
            },
            json=data,
        )

    def search(self, filters):
        payload = {"page": filters["page"], "per_page": filters["per_page"]}
        if filters["title"]:
            payload["person_titles"] = [filters["title"]]
        if filters["location"]:
            payload["person_locations"] = [filters["location"]]
        keywords = [filters["keywords"], filters["sector"]]
        # Current people API supports exact organization filtering by domain / organization id.
        # Company names deliberately map to q_keywords, as documented in the UI.
        if filters["company"]:
            if "." in filters["company"] and " " not in filters["company"]:
                payload["q_organization_domains_list"] = [
                    filters["company"]
                    .removeprefix("https://")
                    .removeprefix("http://")
                    .removeprefix("www.")
                    .strip("/")
                ]
            else:
                keywords.append(filters["company"])
        if any(keywords):
            payload["q_keywords"] = " ".join(x for x in keywords if x)
        result = self.post("/mixed_people/api_search", payload)
        if not isinstance(result.get("people"), list):
            from fastapi import HTTPException

            raise HTTPException(502, "Apollo returned an unexpected search response.")
        people = []
        for p in result["people"][: filters["per_page"]]:
            if not p.get("id"):
                continue
            org = p.get("organization") or {}
            name = p.get("name") or " ".join(
                x
                for x in [
                    p.get("first_name"),
                    p.get("last_name") or p.get("last_name_obfuscated"),
                ]
                if x
            )
            people.append(
                {
                    "provider": "apollo",
                    "provider_id": str(p["id"]),
                    "name": name or "Name unavailable",
                    "title": p.get("title") or "",
                    "company": org.get("name") or "",
                    "location": ", ".join(
                        p[x] for x in ("city", "state", "country") if p.get(x)
                    ),
                    "profile_url": safe_url(p.get("linkedin_url")),
                    "school": "",
                    "sector": "",
                    "email": "",
                    "email_status": "available" if p.get("has_email") else "unknown",
                }
            )
        return {
            "people": people,
            "total": int(
                result.get("total_entries")
                or (result.get("pagination") or {}).get("total_entries")
                or 0
            ),
        }

    def enrich(self, contact):
        result = self.post(
            "/people/match",
            {
                "id": contact["provider_id"],
                "reveal_personal_emails": False,
                "reveal_phone_number": False,
            },
        )
        p = result.get("person")
        if not isinstance(p, dict):
            return {"email": "", "email_status": "unavailable"}
        email = p.get("email") or ""
        if email.endswith("@domain.com") or "email_not_unlocked" in email:
            email = ""
        data = {
            "email": email,
            "email_status": p.get("email_status")
            or ("unverified" if email else "unavailable"),
        }
        if p.get("name"):
            data["name"] = p["name"]
        if p.get("linkedin_url"):
            data["profile_url"] = safe_url(p["linkedin_url"])
        location = ", ".join(p[x] for x in ("city", "state", "country") if p.get(x))
        if location:
            data["location"] = location
        return data
