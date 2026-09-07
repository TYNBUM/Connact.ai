from fastapi import APIRouter, Depends, HTTPException
from ..db import get_repo
from ..models import Draft, Contact, Persona
from ..schemas import DraftInput, GenerateInput
from ..services.contacts import row
from ..services.drafts import sanitize, preview, plain_text
from ..providers import ai
from ..config import settings

router = APIRouter()


def locked(repo, id, revision):
    d = repo.session.scalar(repo.query(Draft).where(Draft.id == id).with_for_update())
    if not d:
        raise HTTPException(404, "Draft not found.")
    if revision != d.revision:
        raise HTTPException(
            409,
            "This draft changed in another tab. Reopen the latest draft before saving.",
        )
    return d


def apply(repo, d, body):
    if body.contact_id:
        repo.get(Contact, body.contact_id)
    p = repo.get(Persona, body.persona_id) if body.persona_id else None
    for k, v in body.model_dump(exclude={"revision"}).items():
        setattr(d, k, v)
    d.body_html = sanitize(d.body_html)
    d.persona_version = p.version if p else None
    if d.status == "ready" and not preview(repo, d)["can_mark_ready"]:
        raise HTTPException(
            422,
            "Complete the recipient, subject, body and all variables before marking this draft ready.",
        )


@router.get("/drafts")
def drafts(repo=Depends(get_repo)):
    return [
        row(d)
        for d in sorted(repo.all(Draft), key=lambda x: x.updated_at, reverse=True)
    ]


@router.post("/drafts")
def create(body: DraftInput, repo=Depends(get_repo)):
    d = repo.add(Draft)
    apply(repo, d, body)
    return row(d)


@router.get("/drafts/{id}")
def get(id: str, repo=Depends(get_repo)):
    d = repo.get(Draft, id)
    result = row(d)
    result["preview"] = preview(repo, d)
    return result


@router.put("/drafts/{id}")
def update(id: str, body: DraftInput, repo=Depends(get_repo)):
    d = locked(repo, id, body.revision)
    apply(repo, d, body)
    d.revision += 1
    repo.session.flush()
    return row(d)


@router.get("/drafts/{id}/preview")
def get_preview(id: str, repo=Depends(get_repo)):
    return preview(repo, repo.get(Draft, id))


@router.post("/drafts/{id}/generate")
def generate(id: str, body: GenerateInput, repo=Depends(get_repo)):
    d = locked(repo, id, body.revision)
    persona = repo.get(Persona, d.persona_id) if d.persona_id else None
    contact = repo.get(Contact, d.contact_id) if d.contact_id else None
    if body.action == "generate" and not d.purpose.strip():
        raise HTTPException(422, "Enter a contact purpose first.")
    if body.action != "generate" and not plain_text(d.body_html):
        raise HTTPException(422, "Write or generate a message first.")
    data = {
        "persona": persona.data if persona else {},
        "contact": (
            {
                k: getattr(contact, k)
                for k in ("name", "company", "title", "school", "location")
            }
            if contact
            else {}
        ),
        "purpose": d.purpose,
        "language": d.language,
        "starting_point": d.starting_point,
        "tone": d.tone,
        "subject": d.subject,
        "body_html": d.body_html,
    }
    result = ai().complete(body.action, data)
    if (
        not isinstance(result.get("subject"), str)
        or not isinstance(result.get("body_html"), str)
        or not plain_text(result.get("body_html", ""))
    ):
        raise HTTPException(
            502, "AI returned an invalid email. Your draft is unchanged."
        )
    if len(result["subject"]) > 1000 or len(result["body_html"]) > 60000:
        raise HTTPException(502, "AI response exceeds draft limits.")
    d.subject = result["subject"]
    d.body_html = sanitize(result["body_html"])
    d.status = "draft"
    d.revision += 1
    d.persona_version = persona.version if persona else None
    d.generation_provider = settings.ai_mode
    repo.session.flush()
    return row(d)
