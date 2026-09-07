from fastapi import APIRouter, Depends
from ..db import get_repo
from ..schemas import SearchInput, AssessmentInput
from ..models import Contact, Persona
from ..config import settings
from ..providers import people_search, ai
from ..services.contacts import upsert_search, contact_json, assess

router = APIRouter(prefix="/finance")


@router.post("/search")
def search(body: SearchInput, repo=Depends(get_repo)):
    result = people_search().search(body.model_dump())
    contacts = [upsert_search(repo, p) for p in result["people"]]
    return {
        "items": [contact_json(repo, c) for c in contacts],
        "total": result["total"],
        "page": body.page,
        "per_page": body.per_page,
        "mode": settings.people_mode,
    }


@router.post("/assess")
def assessment(body: AssessmentInput, repo=Depends(get_repo)):
    persona = repo.get(Persona, body.persona_id)
    return [
        assess(
            repo, repo.get(Contact, id), persona, body.language, ai(), settings.ai_mode
        )
        for id in dict.fromkeys(body.contact_ids)
    ]
