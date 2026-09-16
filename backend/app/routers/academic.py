from fastapi import APIRouter, Depends

from ..config import settings
from ..db import get_repo
from ..models import Contact, PeopleJob, Persona
from ..providers import ai, canonical_people_filters, people_search
from ..schemas import AcademicSearchInput, AssessmentInput
from ..services.contacts import assess, contact_json, upsert_search
from ..services.people_jobs import enqueue, serialize


router = APIRouter(prefix="/academic")


@router.post("/search")
def search(body: AcademicSearchInput, repo=Depends(get_repo)):
    filters = canonical_people_filters(body.model_dump(), "academic")
    result = people_search("academic").search(filters)
    contacts = [upsert_search(repo, item, "academic") for item in result["people"]]
    return {
        "items": [contact_json(repo, contact) for contact in contacts],
        "total": result["total"],
        "page": body.page,
        "per_page": body.per_page,
        "mode": settings.people_mode,
        "domain": "academic",
        "total_is_estimate": result.get("total_is_estimate", False),
        "has_more": result.get(
            "has_more", body.page * body.per_page < result["total"]
        ),
    }


@router.post("/assess")
def assessment(body: AssessmentInput, repo=Depends(get_repo)):
    persona = repo.get(Persona, body.persona_id)
    return [
        assess(
            repo,
            repo.get(Contact, contact_id),
            persona,
            body.language,
            ai(),
            settings.ai_mode,
            "academic",
        )
        for contact_id in dict.fromkeys(body.contact_ids)
    ]


@router.post("/search/jobs", status_code=202)
def start_search(body: AcademicSearchInput, repo=Depends(get_repo)):
    job, cached = enqueue(repo, "search", body.model_dump(), domain="academic")
    return {"job": serialize(repo, job), "cached": cached}


@router.get("/search/jobs")
def search_history(repo=Depends(get_repo)):
    jobs = sorted(
        repo.all(
            PeopleJob, PeopleJob.kind == "search", PeopleJob.domain == "academic"
        ),
        key=lambda job: job.created_at,
        reverse=True,
    )
    return [serialize(repo, job, include_result=False) for job in jobs[:20]]
