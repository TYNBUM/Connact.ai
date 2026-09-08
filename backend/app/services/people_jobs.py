"""Durable jobs for the single-process workspace server.

Apify run IDs are committed before polling. Restart resumes submitted runs;
ambiguous paid submissions are surfaced rather than submitted twice.
"""

import hashlib
import json
import logging
from datetime import timedelta, timezone
from threading import Event, Thread, Lock
from sqlalchemy import select, update, or_
from fastapi import HTTPException
from ..config import settings
from ..db import Session, WorkspaceRepository
from ..models import (
    PeopleJob,
    Contact,
    ContactDomainProfile,
    SourceEvidence,
    Draft,
    now,
)
from ..providers import people_search, people_enrichment
from ..providers.apify import ApifyProfileProvider
from ..providers.linkedin import linkedin_profile
from .contacts import row, contact_json, upsert_search, lock_contact

ACTIVE = ("queued", "running", "waiting")
_stop = Event()
_thread = None
_enqueue_lock = Lock()
_log = logging.getLogger(__name__)


def fresh(date, hours):
    return date is not None and date.replace(tzinfo=timezone.utc) > now() - timedelta(
        hours=hours
    )


def serialize(repo, job, include_result=True):
    data = row(job)
    data.pop("fingerprint", None)
    # Public response contains run ID for support, never provider credentials.
    if include_result and job.status == "succeeded":
        if job.kind == "search":
            data["result"] = {
                **job.result,
                "items": [
                    contact_json(repo, repo.get(Contact, id))
                    for id in job.result.get("contact_ids", [])
                ],
            }
        elif job.contact_id:
            data["result"] = {
                **job.result,
                "contact": contact_json(repo, repo.get(Contact, job.contact_id)),
            }
    return data


def enqueue(repo, kind, payload, contact=None, force=False):
    if kind not in ("search", "profile", "email", "email_apify"):
        raise HTTPException(422, "Unknown people job type.")
    if contact:
        if kind in ("profile", "email_apify") and (
            settings.people_mode == "mock" or contact.provider == "mock"
        ):
            raise HTTPException(
                409, "Public profile retrieval needs a live LinkedIn contact."
            )
        if kind in ("profile", "email_apify") and not settings.apify_api_key:
            raise HTTPException(503, "Apify is not configured on the server.")
        if kind in ("profile", "email_apify") and not linkedin_profile(
            contact.profile_url
        ):
            raise HTTPException(
                422, "Add a public LinkedIn person URL before retrieving the profile."
            )
        allowed = (
            {"mock"}
            if settings.people_mode == "mock"
            else {"serpapi", "apollo", "manual"}
        )
        if kind == "email" and contact.provider not in allowed:
            raise HTTPException(409, "This contact belongs to another provider mode.")
        payload = {**payload, "contact": row(contact)}
        # Contact dates are not part of the upstream request snapshot.
        payload["contact"].pop("created_at", None)
        payload["contact"].pop("updated_at", None)
    payload = {**payload, "mode": settings.people_mode}
    identity = (
        payload
        if not contact
        else {
            "mode": settings.people_mode,
            "contact_id": contact.id,
            "provider": contact.provider,
            "profile_url": linkedin_profile(contact.profile_url) or contact.profile_url,
            "provider_id": contact.provider_id,
        }
    )
    fingerprint = hashlib.sha256(
        json.dumps({"kind": kind, "input": identity}, sort_keys=True).encode()
    ).hexdigest()
    with _enqueue_lock:
        jobs = repo.all(PeopleJob, PeopleJob.fingerprint == fingerprint)
        active = next((j for j in reversed(jobs) if j.status in ACTIVE), None)
        if active:
            return active, True
        cached = next(
            (
                j
                for j in reversed(jobs)
                if j.status == "succeeded"
                and not j.result.get("cache_invalidated")
                and fresh(
                    j.updated_at, 1 if kind == "search" else settings.people_cache_hours
                )
            ),
            None,
        )
        if cached and not force:
            return cached, True
        job = repo.add(
            PeopleJob,
            kind=kind,
            contact_id=contact.id if contact else None,
            input=payload,
            fingerprint=fingerprint,
        )
        # Commit before worker receives it, including any pending contact changes.
        repo.session.commit()
        return job, False


def apply_email(repo, contact, data, provider=None):
    for key, value in data.items():
        if key in (
            "name",
            "title",
            "company",
            "location",
            "school",
            "profile_url",
            "email",
            "email_status",
        ):
            if (
                key in ("email", "email_status")
                and not data.get("email")
                and contact.email
            ):
                continue
            setattr(contact, key, value)
    for draft in repo.all(Draft, Draft.contact_id == contact.id):
        draft.status = "draft"
        draft.revision += 1
    repo.add(
        SourceEvidence,
        contact_id=contact.id,
        provider=provider or ("mock" if settings.people_mode == "mock" else "apollo"),
        url=contact.profile_url,
        title="On-demand contact enrichment",
        snippet=f"{contact.name} | {contact.title} | {contact.company} | Email status: {contact.email_status}; provider status: {data.get('provider_status',contact.email_status)}; address type: {data.get('email_type','not_provided')}"
        + (
            "; provider checks: "
            + ", ".join(
                f"{key}={value}" for key, value in data["provider_checks"].items()
            )
            if data.get("provider_checks")
            else ""
        ),
        kind="enrichment",
    )


def apply_profile(repo, contact, data):
    for key, value in data["fields"].items():
        setattr(contact, key, value)
    professional = dict(data["professional"])
    evidence = repo.add(
        SourceEvidence,
        contact_id=contact.id,
        provider="apify",
        url=professional["source_url"],
        title="Public professional profile via Apify",
        snippet=" | ".join(
            filter(
                None,
                [
                    professional["summary"][:1200],
                    "Work: "
                    + "; ".join(
                        " · ".join(
                            filter(
                                None,
                                [
                                    x["title"],
                                    x["company"],
                                    x["start_date"],
                                    x["end_date"],
                                ],
                            )
                        )
                        for x in professional["experience"][:15]
                    ),
                    "Education: "
                    + "; ".join(
                        " · ".join(
                            filter(
                                None, [x["school"], x["degree"], x["field_of_study"]]
                            )
                        )
                        for x in professional["education"][:10]
                    ),
                ],
            )
        ),
        kind="profile",
    )
    professional.update(source_id=evidence.id, retrieved_at=now().isoformat())
    rows = repo.all(
        ContactDomainProfile,
        ContactDomainProfile.contact_id == contact.id,
        ContactDomainProfile.domain == "professional",
    )
    if rows:
        rows[0].data = professional
    else:
        repo.add(
            ContactDomainProfile,
            contact_id=contact.id,
            domain="professional",
            data=professional,
        )
    for draft in repo.all(Draft, Draft.contact_id == contact.id):
        draft.status = "draft"
        draft.revision += 1


def verify_identity(contact, before):
    # Provider normalization can update names without changing the canonical person.
    if contact.profile_url != before.get("profile_url") or (
        not contact.profile_url and contact.name != before.get("name")
    ):
        raise HTTPException(
            409,
            "Contact identity changed during this task. No result was attached; start again for the current contact.",
        )


def process_job(job_id):
    with Session() as session:
        job = session.get(PeopleJob, job_id)
        if not job or job.status not in ("queued", "waiting"):
            return
        old_status = job.status
        claimed = session.execute(
            update(PeopleJob)
            .where(PeopleJob.id == job_id, PeopleJob.status == old_status)
            .values(status="running")
        )
        if not claimed.rowcount:
            session.rollback()
            return
        job.attempts += 1
        session.commit()
        repo = WorkspaceRepository(session, job.workspace_id)
        stage = "read"
        try:
            if job.input.get("mode") != settings.people_mode:
                raise HTTPException(
                    409,
                    "Provider mode changed after this task was created. Start a new task in the current mode.",
                )
            contact = repo.get(Contact, job.contact_id) if job.contact_id else None
            if job.result.get("cache_invalidated"):
                raise HTTPException(
                    409,
                    "Contact was edited. Start a new task using the updated contact details.",
                )
            if contact:
                verify_identity(contact, job.input["contact"])
            if job.kind == "search":
                filters = {k: v for k, v in job.input.items() if k != "mode"}
                result = people_search().search(filters)
                found = [upsert_search(repo, item) for item in result["people"]]
                job.result = {
                    "contact_ids": [c.id for c in found],
                    "total": result["total"],
                    "page": filters["page"],
                    "per_page": filters["per_page"],
                    "mode": settings.people_mode,
                    "has_more": result.get(
                        "has_more",
                        filters["page"] * filters["per_page"] < result["total"],
                    ),
                    "total_is_estimate": result.get("total_is_estimate", False),
                }
                job.status = "succeeded"
            elif job.kind == "email":
                data = people_enrichment().enrich(job.input["contact"])
                contact = lock_contact(repo, job.contact_id)
                session.refresh(job)
                if job.result.get("cache_invalidated"):
                    raise HTTPException(
                        409,
                        "Contact was edited. Start a new task using the updated contact details.",
                    )
                verify_identity(contact, job.input["contact"])
                apply_email(repo, contact, data)
                job.result = {"email_status": contact.email_status}
                job.status = "succeeded"
            else:
                provider = ApifyProfileProvider()
                if not job.upstream.get("run_id"):
                    stage = "submission"
                    upstream = provider.start(
                        job.input["contact"]["profile_url"],
                        find_email=job.kind == "email_apify",
                    )
                    job.upstream = upstream
                    job.status = "waiting"
                    job.next_poll_at = now() + timedelta(seconds=5)
                    session.commit()
                    return
                status = provider.poll(job.upstream["run_id"])
                if status["status"] in ("READY", "RUNNING", "TIMING-OUT", "ABORTING"):
                    job.status = "waiting"
                    job.next_poll_at = now() + timedelta(seconds=8)
                elif status["status"] == "SUCCEEDED":
                    data = provider.result(
                        status["dataset_id"] or job.upstream["dataset_id"],
                        job.input["contact"]["profile_url"],
                        find_email=job.kind == "email_apify",
                    )
                    contact = lock_contact(repo, job.contact_id)
                    session.refresh(job)
                    if job.result.get("cache_invalidated"):
                        raise HTTPException(
                            409,
                            "Contact was edited. Start a new task using the updated contact details.",
                        )
                    verify_identity(contact, job.input["contact"])
                    if job.kind == "email_apify":
                        apply_email(repo, contact, data["email"], provider="apify")
                    else:
                        apply_profile(repo, contact, data)
                    job.result = {
                        "fields_found": list(data["fields"]),
                        "experience_count": len(data["professional"]["experience"]),
                        "education_count": len(data["professional"]["education"]),
                    }
                    if job.kind == "email_apify":
                        job.result.update(data["email"])
                    job.status = "succeeded"
                else:
                    job.retryable = False
                    raise HTTPException(
                        502,
                        f"Apify run ended with status {status['status'] or 'unknown'}. Start a fresh profile task to retry.",
                    )
            job.error = ""
            session.commit()
        except Exception as exc:
            # Roll back partial enrichment while retaining the durable job record.
            session.rollback()
            job = session.get(PeopleJob, job_id)
            job.status = "failed"
            if (
                job.kind in ("profile", "email_apify")
                and job.upstream.get("run_id")
                and isinstance(exc, HTTPException)
                and exc.status_code in (429, 502)
            ):
                failures = job.upstream.get("read_failures", 0) + 1
                job.upstream = {**job.upstream, "read_failures": failures}
                if failures <= 3 and "ended with status" not in str(exc.detail):
                    job.status = "waiting"
                    job.next_poll_at = now() + timedelta(seconds=20 * failures)
            job.error = (
                exc.detail
                if isinstance(exc, HTTPException)
                else "The people task failed. Please retry or check server logs."
            )
            if isinstance(exc, HTTPException) and "ended with status" in str(
                exc.detail
            ):
                job.retryable = False
            if job.result.get("cache_invalidated"):
                job.retryable = False
            if stage == "submission":
                job.retryable = False
                job.error += " The launch outcome may be uncertain; check Apify runs before starting another paid request."
            session.commit()


def recover_jobs():
    with Session() as session:
        for job in session.scalars(
            select(PeopleJob).where(PeopleJob.status == "running")
        ):
            if job.kind in ("profile", "email_apify") and job.upstream.get("run_id"):
                job.status = "waiting"
                job.next_poll_at = now()
            else:
                job.status = "failed"
                job.error = "Server restarted during this request. Its outcome is uncertain; check the provider before retrying."
                job.retryable = job.kind not in ("profile", "email_apify")
        session.commit()


def tick():
    with Session() as session:
        ids = session.scalars(
            select(PeopleJob.id)
            .where(
                or_(
                    PeopleJob.status == "queued",
                    (PeopleJob.status == "waiting") & (PeopleJob.next_poll_at <= now()),
                )
            )
            .order_by(PeopleJob.created_at)
            .limit(5)
        ).all()
    for id in ids:
        if _stop.is_set():
            break
        process_job(id)


def start_people_worker():
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    recover_jobs()

    def loop():
        while not _stop.wait(1):
            try:
                tick()
            except Exception:
                _log.error("People worker could not process jobs; will retry.")

    _thread = Thread(target=loop, name="people-jobs", daemon=True)
    _thread.start()


def stop_people_worker():
    global _thread
    _stop.set()
    if _thread:
        _thread.join(timeout=40)
        if not _thread.is_alive():
            _thread = None
