import hashlib, json
from sqlalchemy.exc import IntegrityError
from ..models import (
    Contact,
    ContactDomainProfile,
    SourceEvidence,
    MatchAssessment,
    PersonaRevision,
    now,
)


def row(obj):
    return {
        c.name: getattr(obj, c.name)
        for c in obj.__table__.columns
        if c.name != "workspace_id"
    }


def contact_json(repo, contact):
    data = row(contact)
    data["domains"] = {
        p.domain: p.data
        for p in repo.all(
            ContactDomainProfile, ContactDomainProfile.contact_id == contact.id
        )
    }
    data["sources"] = [
        row(e)
        for e in repo.all(SourceEvidence, SourceEvidence.contact_id == contact.id)
    ]
    data["assessments"] = [
        row(a)
        for a in repo.all(MatchAssessment, MatchAssessment.contact_id == contact.id)
    ]
    return data


def upsert_search(repo, item):
    existing = repo.all(
        Contact,
        Contact.provider == item["provider"],
        Contact.provider_id == item["provider_id"],
    )
    if existing:
        return existing[0]
    sector = item.pop("sector", "")
    try:
        with repo.session.begin_nested():
            contact = repo.add(Contact, **item)
    except IntegrityError:
        return repo.all(
            Contact,
            Contact.provider == item["provider"],
            Contact.provider_id == item["provider_id"],
        )[0]
    repo.add(
        ContactDomainProfile,
        contact_id=contact.id,
        domain="finance",
        data={"sector": sector},
    )
    repo.add(
        SourceEvidence,
        contact_id=contact.id,
        provider=contact.provider,
        url=contact.profile_url,
        title=(
            "Fictional demo profile"
            if contact.provider == "mock"
            else "Apollo people search"
        ),
        snippet=f"{contact.name} | {contact.title} | {contact.company} | {contact.location}",
        kind="profile",
    )
    return contact


def assess(repo, contact, persona, language, ai, provider):
    data = contact_json(repo, contact)
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                k: data[k]
                for k in ("name", "title", "company", "location", "school", "domains")
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    cached = repo.all(
        MatchAssessment,
        MatchAssessment.contact_id == contact.id,
        MatchAssessment.persona_id == persona.id,
        MatchAssessment.persona_version == persona.version,
        MatchAssessment.contact_fingerprint == fingerprint,
        MatchAssessment.language == language,
        MatchAssessment.provider == provider,
    )
    if cached:
        return row(cached[-1])
    dimensions = {}
    for key, value, goal in [
        ("role", contact.title, persona.data.get("target_roles")),
        (
            "sector",
            data["domains"].get("finance", {}).get("sector"),
            persona.data.get("sectors"),
        ),
        ("location", contact.location, persona.data.get("target_regions")),
    ]:
        if value and goal:
            dimensions[key] = {"contact": value, "goal": goal}
    result = (
        ai.complete("assess", {"dimensions": dimensions})
        if dimensions
        else {"dimensions": []}
    )
    choices = result.get("dimensions", [])
    if not isinstance(choices, list) or any(not isinstance(x, str) for x in choices):
        from fastapi import HTTPException

        raise HTTPException(502, "AI returned invalid recommendation data.")
    choices = [key for key in choices if key in dimensions][:2]
    # AI selects dimensions, server renders only sourced literal facts. No free-form relationship claims.
    if language == "zh":
        reason = "；".join(
            f'已知资料：{dimensions[k]["contact"]}；您的目标：{dimensions[k]["goal"]}'
            for k in choices
        )
        reason = (
            reason + "。可据此探讨职业路径。"
            if reason
            else "资料不足，无法评估与画像的相关性。"
        ) + " 未验证任何共同经历或人际关系。"
    else:
        reason = "; ".join(
            f'Profile: {dimensions[k]["contact"]}. Your focus: {dimensions[k]["goal"]}'
            for k in choices
        )
        reason = (
            reason + ". A possible career conversation to explore."
            if reason
            else "Insufficient profile data to assess relevance."
        ) + " No shared background or relationship is verified."
    revision = repo.all(
        PersonaRevision,
        PersonaRevision.persona_id == persona.id,
        PersonaRevision.version == persona.version,
    )[0]
    sources = [
        x["id"]
        for x in data["sources"]
        if x["kind"] in ("profile", "manual", "enrichment")
    ]
    return row(
        repo.add(
            MatchAssessment,
            contact_id=contact.id,
            persona_id=persona.id,
            persona_revision_id=revision.id,
            persona_version=persona.version,
            contact_fingerprint=fingerprint,
            language=language,
            reason=reason,
            source_ids=sources,
            provider=provider,
        )
    )
