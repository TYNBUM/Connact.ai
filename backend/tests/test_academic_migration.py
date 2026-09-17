import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Draft, PeopleJob, Workspace
from app.sequence_models import Sequence, SequenceStep


BACKEND = Path(__file__).resolve().parents[1]
PREVIOUS_HEAD = "g531ec641012"
ACADEMIC_HEAD = "h642fd751013"


def run_alembic(database_url, *arguments, expect_success=True):
    environment = dict(os.environ)
    environment["DATABASE_URL"] = database_url
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", *arguments],
        cwd=BACKEND,
        env=environment,
        text=True,
        capture_output=True,
        timeout=30,
    )
    if expect_success:
        assert result.returncode == 0, result.stdout + result.stderr
    else:
        assert result.returncode != 0, result.stdout + result.stderr
    return result.stdout + result.stderr


def test_academic_domain_migration_round_trip_handles_cross_domain_document_cache(
    tmp_path,
):
    path = tmp_path / "academic-migration.db"
    database_url = "sqlite:///" + str(path)
    run_alembic(database_url, "upgrade", "head")

    with sqlite3.connect(path) as database:
        database.execute(
            "INSERT INTO workspaces (id, name) VALUES (?, ?)",
            ("migration-workspace", "Migration test"),
        )
        values = {
            "original_name": "same.docx",
            "storage_key": "same.docx",
            "status": "parsed",
            "extracted_text": "same text",
            "parsed_data": "{}",
            "content_hash": "a" * 64,
            "parse_mode": "mock",
            "parse_provider": "mock",
            "parse_model": "mock-model",
            "parse_prompt_version": "resume-parse-v2-domain",
            "workspace_id": "migration-workspace",
            "created_at": "2026-09-16 00:00:00",
            "updated_at": "2026-09-16 00:00:00",
        }
        columns = ", ".join(["id", "domain", *values])
        placeholders = ", ".join("?" for _ in range(len(values) + 2))
        records = (
            ("document-a", "academic", "2026-09-15 00:00:00"),
            ("document-b", "finance", "2026-09-16 00:00:00"),
            ("document-c", "academic", "2026-09-14 00:00:00"),
        )
        for record_id, domain, created_at in records:
            record_values = {**values, "created_at": created_at}
            if record_id == "document-c":
                record_values["content_hash"] = "b" * 64
            database.execute(
                f"INSERT INTO uploaded_documents ({columns}) VALUES ({placeholders})",
                (record_id, domain, *record_values.values()),
            )
        database.commit()

    run_alembic(database_url, "downgrade", PREVIOUS_HEAD)
    with sqlite3.connect(path) as database:
        columns = {
            row[1] for row in database.execute("PRAGMA table_info(uploaded_documents)")
        }
        rows = database.execute(
            "SELECT id, status, error FROM uploaded_documents ORDER BY id"
        ).fetchall()
    assert "domain" not in columns
    assert rows[0][1] == "failed"
    assert "preserved academic domain" in rows[0][2]
    assert rows[1][1:] == ("parsed", None)
    assert rows[2][1] == "failed"
    assert "preserved academic domain" in rows[2][2]

    run_alembic(database_url, "upgrade", "head")
    current = run_alembic(database_url, "current")
    assert ACADEMIC_HEAD in current
    with sqlite3.connect(path) as database:
        restored = database.execute(
            "SELECT id, domain, status FROM uploaded_documents ORDER BY id"
        ).fetchall()
    assert restored == [
        ("document-a", "academic", "failed"),
        ("document-b", "finance", "parsed"),
        ("document-c", "academic", "failed"),
    ]


def test_academic_domain_migration_refuses_lossy_downgrade(tmp_path):
    path = tmp_path / "academic-downgrade-guard.db"
    database_url = "sqlite:///" + str(path)
    run_alembic(database_url, "upgrade", "head")

    engine = create_engine(database_url)
    workspace_id = "academic-downgrade-workspace"
    with Session(engine) as database:
        database.add(Workspace(id=workspace_id, name="Academic downgrade test"))
        draft = Draft(
            workspace_id=workspace_id,
            domain="academic",
            starting_point="PhD Inquiry",
        )
        sequence = Sequence(
            workspace_id=workspace_id,
            name="Academic sequence",
            domain="academic",
        )
        job = PeopleJob(
            workspace_id=workspace_id,
            kind="search",
            domain="academic",
            fingerprint="c" * 64,
            input={},
            result={"domain": "academic"},
        )
        database.add_all([draft, sequence, job])
        database.flush()
        draft_id = draft.id
        database.add(
            SequenceStep(
                workspace_id=workspace_id,
                sequence_id=sequence.id,
                draft_id=draft.id,
                position=0,
                title="Academic introduction",
            )
        )
        database.commit()

    output = run_alembic(
        database_url,
        "downgrade",
        PREVIOUS_HEAD,
        expect_success=False,
    )
    assert "Cannot downgrade the academic-domain MVP" in output
    assert ACADEMIC_HEAD in run_alembic(database_url, "current")
    with sqlite3.connect(path) as database:
        assert database.execute(
            "SELECT domain FROM drafts WHERE id = ?", (draft_id,)
        ).fetchone() == ("academic",)
