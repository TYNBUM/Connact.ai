from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import (
    String,
    Text,
    JSON,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


def now():
    return datetime.now(timezone.utc)


class Identity:
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )


class Scoped(Identity):
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )


class Workspace(Identity, Base):
    __tablename__ = "workspaces"
    name: Mapped[str] = mapped_column(String(150), default="Personal workspace")


class Persona(Scoped, Base):
    __tablename__ = "personas"
    label: Mapped[str] = mapped_column(String(150))
    domain: Mapped[str] = mapped_column(String(30), default="finance")
    version: Mapped[int] = mapped_column(Integer, default=1)
    data: Mapped[dict] = mapped_column(JSON)


class PersonaRevision(Scoped, Base):
    __tablename__ = "persona_revisions"
    __table_args__ = (UniqueConstraint("workspace_id", "persona_id", "version"),)
    persona_id: Mapped[str] = mapped_column(ForeignKey("personas.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)


class UploadedDocument(Scoped, Base):
    __tablename__ = "uploaded_documents"
    original_name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30))
    error: Mapped[str | None] = mapped_column(Text)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    persona_id: Mapped[str | None] = mapped_column(ForeignKey("personas.id"))


class Contact(Scoped, Base):
    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("workspace_id", "provider", "provider_id"),)
    provider: Mapped[str] = mapped_column(String(30), default="manual")
    provider_id: Mapped[str | None] = mapped_column(String(160))
    saved: Mapped[bool] = mapped_column(Boolean, default=False)
    name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(250), default="")
    company: Mapped[str] = mapped_column(String(250), default="")
    location: Mapped[str] = mapped_column(String(250), default="")
    school: Mapped[str] = mapped_column(String(250), default="")
    profile_url: Mapped[str] = mapped_column(Text, default="")
    email: Mapped[str] = mapped_column(String(250), default="")
    email_status: Mapped[str] = mapped_column(String(60), default="not_requested")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")


class ContactDomainProfile(Scoped, Base):
    __tablename__ = "contact_domain_profiles"
    __table_args__ = (UniqueConstraint("workspace_id", "contact_id", "domain"),)
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id"), index=True)
    domain: Mapped[str] = mapped_column(String(30))
    data: Mapped[dict] = mapped_column(JSON)


class SourceEvidence(Scoped, Base):
    __tablename__ = "source_evidence"
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id"), index=True)
    provider: Mapped[str] = mapped_column(String(30))
    url: Mapped[str] = mapped_column(Text, default="")
    title: Mapped[str] = mapped_column(String(500))
    snippet: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(40), default="profile")
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MatchAssessment(Scoped, Base):
    __tablename__ = "match_assessments"
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id"), index=True)
    persona_id: Mapped[str] = mapped_column(ForeignKey("personas.id"))
    persona_revision_id: Mapped[str] = mapped_column(ForeignKey("persona_revisions.id"))
    persona_version: Mapped[int] = mapped_column(Integer)
    contact_fingerprint: Mapped[str] = mapped_column(String(64))
    language: Mapped[str] = mapped_column(String(10), default="en")
    reason: Mapped[str] = mapped_column(Text)
    source_ids: Mapped[list] = mapped_column(JSON)
    provider: Mapped[str] = mapped_column(String(30))


class Draft(Scoped, Base):
    __tablename__ = "drafts"
    contact_id: Mapped[str | None] = mapped_column(
        ForeignKey("contacts.id"), index=True
    )
    persona_id: Mapped[str | None] = mapped_column(ForeignKey("personas.id"))
    persona_version: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str] = mapped_column(String(10), default="en")
    purpose: Mapped[str] = mapped_column(Text, default="")
    starting_point: Mapped[str] = mapped_column(String(60), default="Networking")
    tone: Mapped[str] = mapped_column(String(30), default="professional")
    subject: Mapped[str] = mapped_column(Text, default="")
    body_html: Mapped[str] = mapped_column(Text, default="<p></p>")
    status: Mapped[str] = mapped_column(String(30), default="draft")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    generation_provider: Mapped[str] = mapped_column(String(30), default="manual")
