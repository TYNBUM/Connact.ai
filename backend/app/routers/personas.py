from typing import Literal
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from ..db import get_repo
from ..config import settings
from ..models import Persona, PersonaRevision, UploadedDocument, Draft
from ..schemas import PersonaInput
from ..services.contacts import row
from ..services.documents import (
    queue_document,
    document_response,
    retry_document,
    process_document,
    wake_document_worker,
)
from time import monotonic, sleep
from ..services.file_storage import file_response

router = APIRouter()


@router.get("/personas")
def personas(
    domain: Literal["finance", "academic"] | None = Query(default=None),
    repo=Depends(get_repo),
):
    conditions = [Persona.domain == domain] if domain else []
    return [row(p) for p in repo.all(Persona, *conditions)]


def attach_document(repo, persona, document_id):
    if not document_id:
        return
    document = repo.get(UploadedDocument, document_id)
    if document.domain != persona.domain:
        raise HTTPException(
            422, "The uploaded document and sender profile must use the same domain."
        )
    document.persona_id = persona.id


@router.post("/personas")
def create(body: PersonaInput, repo=Depends(get_repo)):
    p = repo.add(
        Persona, label=body.label, domain=body.domain, data=body.data.model_dump()
    )
    repo.add(
        PersonaRevision,
        persona_id=p.id,
        domain=p.domain,
        version=p.version,
        data=p.data,
    )
    attach_document(repo, p, body.document_id)
    return row(p)


@router.put("/personas/{id}")
def update(id: str, body: PersonaInput, repo=Depends(get_repo)):
    p = repo.session.scalar(
        repo.query(Persona).where(Persona.id == id).with_for_update()
    )
    if not p:
        raise HTTPException(404, "Persona not found.")
    if body.version != p.version:
        raise HTTPException(
            409, "This persona changed elsewhere. Reopen it before editing."
        )
    requested_domain = body.domain if "domain" in body.model_fields_set else p.domain
    if requested_domain != p.domain:
        raise HTTPException(
            422, "A sender profile's domain cannot be changed after creation."
        )
    p.label, p.data, p.version = body.label, body.data.model_dump(), p.version + 1
    for draft in repo.all(Draft, Draft.persona_id == p.id):
        draft.status = "draft"
        draft.revision += 1
    repo.add(
        PersonaRevision,
        persona_id=p.id,
        domain=p.domain,
        version=p.version,
        data=p.data,
    )
    attach_document(repo, p, body.document_id)
    return row(p)


@router.post("/documents/jobs", status_code=202)
def upload_job(
    file: UploadFile = File(...),
    domain: Literal["finance", "academic"] = Form("finance"),
    repo=Depends(get_repo),
):
    document = queue_document(repo, file, domain)
    response = document_response(document)
    repo.session.commit()
    wake_document_worker()
    return response


@router.get("/documents")
def documents(
    domain: Literal["finance", "academic"] | None = Query(default=None),
    repo=Depends(get_repo),
):
    query = repo.query(UploadedDocument)
    if domain:
        query = query.where(UploadedDocument.domain == domain)
    return [
        document_response(document)
        for document in repo.session.scalars(
            query.order_by(UploadedDocument.created_at.desc()).limit(50)
        ).all()
    ]


@router.get("/documents/{id}/status")
def document_status(id: str, repo=Depends(get_repo)):
    return document_response(repo.get(UploadedDocument, id))


@router.post("/documents/{id}/retry", status_code=202)
def retry_upload(id: str, repo=Depends(get_repo)):
    document = retry_document(repo, repo.get(UploadedDocument, id))
    response = document_response(document)
    repo.session.commit()
    wake_document_worker()
    return response


@router.post("/documents", deprecated=True)
def upload(
    file: UploadFile = File(...),
    domain: Literal["finance", "academic"] = Form("finance"),
    repo=Depends(get_repo),
):
    """Compatibility endpoint; the result now remains available after navigation."""
    document = queue_document(repo, file, domain)
    document_id = document.id
    repo.session.commit()
    process_document(document_id)
    repo.session.expire_all()
    document = repo.get(UploadedDocument, document_id)
    deadline = monotonic() + getattr(settings, "ai_timeout_seconds", 60) + 5
    while document.status in ("queued", "processing") and monotonic() < deadline:
        repo.session.commit()
        sleep(0.05)
        repo.session.expire_all()
        document = repo.get(UploadedDocument, document_id)
    return document_response(document)


@router.get("/documents/{id}/download")
def download(id: str, repo=Depends(get_repo)):
    d = repo.get(UploadedDocument, id)
    return file_response(repo.session, d)
