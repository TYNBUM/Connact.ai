from fastapi import APIRouter, Depends, HTTPException
from ..db import get_repo
from ..models import Contact, ContactDomainProfile, SourceEvidence, Draft, now
from ..schemas import ContactInput
from ..services.contacts import row, contact_json
from ..providers import people_enrichment, public_search
from ..config import settings

router = APIRouter()


@router.get("/contacts")
def contacts(repo=Depends(get_repo)):
    return [contact_json(repo, c) for c in repo.all(Contact, Contact.saved == True)]


@router.get("/contacts/{id}")
def detail(id: str, repo=Depends(get_repo)):
    result = contact_json(repo, repo.get(Contact, id))
    result["drafts"] = [row(d) for d in repo.all(Draft, Draft.contact_id == id)]
    return result


def set_fields(repo, c, body):
    data = body.model_dump()
    sector = data.pop("sector")
    email_changed = c.email != data["email"]
    for k, v in data.items():
        setattr(c, k, v)
    if email_changed:
        c.email_status = "unverified" if c.email else "not_requested"
    profiles = repo.all(
        ContactDomainProfile,
        ContactDomainProfile.contact_id == c.id,
        ContactDomainProfile.domain == "finance",
    )
    if profiles:
        profiles[0].data = {"sector": sector}
    else:
        repo.add(
            ContactDomainProfile,
            contact_id=c.id,
            domain="finance",
            data={"sector": sector},
        )
    repo.add(
        SourceEvidence,
        contact_id=c.id,
        provider="manual",
        url=c.profile_url,
        title="User-entered contact details",
        snippet=f"{c.name} | {c.title} | {c.company} | {c.location}",
        kind="manual",
    )


@router.post("/contacts")
def create(body: ContactInput, repo=Depends(get_repo)):
    c = repo.add(Contact, name=body.name, saved=True, provider="manual")
    set_fields(repo, c, body)
    return contact_json(repo, c)


@router.put("/contacts/{id}")
def update(id: str, body: ContactInput, repo=Depends(get_repo)):
    c = repo.get(Contact, id)
    set_fields(repo, c, body)
    for draft in repo.all(Draft, Draft.contact_id == id):
        draft.status = "draft"
        draft.revision += 1
    return contact_json(repo, c)


@router.post("/contacts/{id}/save")
def save(id: str, repo=Depends(get_repo)):
    c = repo.get(Contact, id)
    already = c.saved
    c.saved = True
    return {"contact": contact_json(repo, c), "already_saved": already}


@router.post("/contacts/{id}/enrich")
def enrich(id: str, repo=Depends(get_repo)):
    c = repo.get(Contact, id)
    expected = "mock" if settings.people_mode == "mock" else "apollo"
    if c.provider != expected:
        raise HTTPException(
            409,
            "This contact belongs to a different provider mode. Search again in the active mode, or edit it manually.",
        )
    evidence = repo.all(
        SourceEvidence,
        SourceEvidence.contact_id == id,
        SourceEvidence.kind == "enrichment",
    )
    if evidence:
        return {"contact": contact_json(repo, c), "cached": True}
    data = people_enrichment().enrich(row(c))
    for key, value in data.items():
        setattr(c, key, value)
    for draft in repo.all(Draft, Draft.contact_id == id):
        draft.status = "draft"
        draft.revision += 1
    repo.add(
        SourceEvidence,
        contact_id=id,
        provider=c.provider,
        url=c.profile_url,
        title="On-demand contact enrichment",
        snippet=f"{c.name} | {c.title} | {c.company} | {c.location} | Email status: {c.email_status}",
        kind="enrichment",
    )
    return {"contact": contact_json(repo, c), "cached": False}


@router.post("/contacts/{id}/public-sources")
def sources(id: str, repo=Depends(get_repo)):
    c = repo.get(Contact, id)
    existing = repo.all(
        SourceEvidence,
        SourceEvidence.contact_id == id,
        SourceEvidence.kind == "unverified_lead",
        SourceEvidence.provider
        == ("mock" if settings.public_search_mode == "mock" else "serpapi"),
    )
    if not existing:
        for e in public_search().search(row(c))[:3]:
            repo.add(SourceEvidence, contact_id=id, **e)
    return contact_json(repo, c)
