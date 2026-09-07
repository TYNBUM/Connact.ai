from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from ..db import get_repo
from ..config import settings
from ..models import Persona, PersonaRevision, UploadedDocument, Draft
from ..schemas import PersonaInput, PersonaData
from ..services.contacts import row
from ..services.documents import extract_text
from ..providers import ai

router = APIRouter()


@router.get("/personas")
def personas(repo=Depends(get_repo)):
    return [row(p) for p in repo.all(Persona)]


@router.post("/personas")
def create(body: PersonaInput, repo=Depends(get_repo)):
    p = repo.add(Persona, label=body.label, data=body.data.model_dump())
    repo.add(PersonaRevision, persona_id=p.id, version=p.version, data=p.data)
    if body.document_id:
        repo.get(UploadedDocument, body.document_id).persona_id = p.id
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
    p.label, p.data, p.version = body.label, body.data.model_dump(), p.version + 1
    for draft in repo.all(Draft, Draft.persona_id == p.id):
        draft.status = "draft"
        draft.revision += 1
    repo.add(PersonaRevision, persona_id=p.id, version=p.version, data=p.data)
    if body.document_id:
        repo.get(UploadedDocument, body.document_id).persona_id = p.id
    return row(p)


@router.post("/documents")
def upload(file: UploadFile = File(...), repo=Depends(get_repo)):
    name = Path(file.filename or "resume").name[:255]
    ext = Path(name).suffix.lower()
    if ext not in (".pdf", ".docx"):
        raise HTTPException(
            415,
            "Only text-based PDF or DOCX files are supported. You can enter your background manually.",
        )
    content = file.file.read(8 * 1024 * 1024 + 1)
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(
            413, "File exceeds 8 MB. Use a smaller resume or manual entry."
        )
    directory = Path(settings.upload_dir).resolve() / repo.workspace_id
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    key = str(uuid4()) + ext
    path = directory / key
    path.write_bytes(content)
    path.chmod(0o600)
    document = repo.add(
        UploadedDocument,
        original_name=name,
        storage_key=key,
        status="processing",
        extracted_text="",
    )
    try:
        document.extracted_text = extract_text(content, ext)
        result = ai().complete("parse", {"text": document.extracted_text})
        data = PersonaData.model_validate(result.get("data", {})).model_dump()
        document.status = "parsed"
        response = {
            "document_id": document.id,
            "status": "parsed",
            "data": data,
            "extracted_text": document.extracted_text,
            "notice": "Review every field before saving. Mock mode uses section headings; no missing facts are inferred.",
        }
    except Exception as exc:
        document.status = "failed"
        document.error = (
            exc.detail
            if isinstance(exc, HTTPException)
            else (
                str(exc)
                if isinstance(exc, ValueError)
                else "Unable to parse this document. It may be malformed or unsupported. Use manual entry."
            )
        )
        response = {
            "document_id": document.id,
            "status": "failed",
            "error": document.error,
            "data": None,
        }
    repo.session.flush()
    return response


@router.get("/documents/{id}/download")
def download(id: str, repo=Depends(get_repo)):
    d = repo.get(UploadedDocument, id)
    path = Path(settings.upload_dir).resolve() / repo.workspace_id / d.storage_key
    if not path.is_file():
        raise HTTPException(404, "Stored file is missing.")
    return FileResponse(
        path,
        filename=d.original_name,
        media_type="application/octet-stream",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )
