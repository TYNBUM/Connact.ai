from fastapi import APIRouter, Depends
from ..db import get_repo
from ..schemas import SearchInput, AssessmentInput
from ..models import Contact, Persona, PeopleJob
from ..config import settings
from ..providers import canonical_people_filters, people_search, ai
from ..services.contacts import upsert_search, contact_json, assess
from ..services.people_jobs import enqueue, serialize

router = APIRouter(prefix="/finance")


@router.post("/search")
def search(body: SearchInput, repo=Depends(get_repo)):
    filters = canonical_people_filters(body.model_dump(), "finance")
    result = people_search("finance").search(filters)
    contacts = [upsert_search(repo, p, "finance") for p in result["people"]]
    return {
        "items": [contact_json(repo, c) for c in contacts],
        "total": result["total"],
        "page": body.page,
        "per_page": body.per_page,
        "mode": settings.people_mode,
        "total_is_estimate": result.get("total_is_estimate", False),
        "has_more": result.get("has_more", body.page * body.per_page < result["total"]),
    }


@router.post("/assess")
def assessment(body: AssessmentInput, repo=Depends(get_repo)):
    persona = repo.get(Persona, body.persona_id)
    return [
        assess(
            repo,
            repo.get(Contact, id),
            persona,
            body.language,
            ai(),
            settings.ai_mode,
            "finance",
        )
        for id in dict.fromkeys(body.contact_ids)
    ]


@router.post("/search/jobs", status_code=202)
def start_search(body: SearchInput, repo=Depends(get_repo)):
    job, cached = enqueue(repo, "search", body.model_dump(), domain="finance")
    return {"job": serialize(repo, job), "cached": cached}


@router.get("/search/jobs")
def search_history(repo=Depends(get_repo)):
    jobs = sorted(
        repo.all(
            PeopleJob, PeopleJob.kind == "search", PeopleJob.domain == "finance"
        ),
        key=lambda j: j.created_at,
        reverse=True,
    )
    return [serialize(repo, job, include_result=False) for job in jobs[:20]]
