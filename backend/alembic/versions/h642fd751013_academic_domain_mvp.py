"""Add workspace-domain isolation for the academic MVP."""

from alembic import op
import sqlalchemy as sa


revision = "h642fd751013"
down_revision = "g531ec641012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "persona_revisions",
        sa.Column(
            "domain", sa.String(30), nullable=False, server_default="finance"
        ),
    )
    op.add_column(
        "uploaded_documents",
        sa.Column(
            "domain", sa.String(30), nullable=False, server_default="finance"
        ),
    )
    op.add_column(
        "drafts",
        sa.Column(
            "domain", sa.String(30), nullable=False, server_default="finance"
        ),
    )
    op.add_column(
        "people_jobs",
        sa.Column(
            "domain", sa.String(30), nullable=False, server_default="finance"
        ),
    )
    op.add_column(
        "sequences",
        sa.Column(
            "domain", sa.String(30), nullable=False, server_default="finance"
        ),
    )

    op.execute(
        "UPDATE persona_revisions SET domain = COALESCE("
        "(SELECT personas.domain FROM personas WHERE personas.id = persona_revisions.persona_id), "
        "'finance')"
    )
    op.execute(
        "UPDATE uploaded_documents SET domain = CASE "
        "WHEN error LIKE 'Academic-domain downgrade preserved academic domain.%' "
        "THEN 'academic' ELSE COALESCE("
        "(SELECT personas.domain FROM personas WHERE personas.id = uploaded_documents.persona_id), "
        "'finance') END"
    )
    op.execute(
        "UPDATE drafts SET domain = COALESCE("
        "(SELECT personas.domain FROM personas WHERE personas.id = drafts.persona_id), "
        "'finance')"
    )
    op.execute(
        "UPDATE sequences SET domain = COALESCE("
        "(SELECT personas.domain FROM personas WHERE personas.id = sequences.persona_id), "
        "(SELECT drafts.domain FROM sequence_steps "
        "JOIN drafts ON drafts.id = sequence_steps.draft_id "
        "WHERE sequence_steps.sequence_id = sequences.id "
        "ORDER BY sequence_steps.position LIMIT 1), "
        "'finance')"
    )

    op.create_index(
        "ix_people_jobs_domain", "people_jobs", ["domain"], unique=False
    )
    op.drop_index(
        "uq_documents_cached_parse", table_name="uploaded_documents"
    )
    op.create_index(
        "uq_documents_cached_parse",
        "uploaded_documents",
        [
            "workspace_id",
            "domain",
            "content_hash",
            "parse_mode",
            "parse_provider",
            "parse_model",
            "parse_prompt_version",
        ],
        unique=True,
        sqlite_where=sa.text(
            "content_hash IS NOT NULL AND status IN ('queued', 'processing', 'parsed')"
        ),
        postgresql_where=sa.text(
            "content_hash IS NOT NULL AND status IN ('queued', 'processing', 'parsed')"
        ),
    )


def downgrade():
    if op.get_context().as_sql:
        # Keep generated offline SQL safe too: execution stops at the named check
        # before any domain column is removed when Academic records exist.
        op.execute(
            "CREATE TEMPORARY TABLE academic_domain_downgrade_guard ("
            "blocked INTEGER CONSTRAINT cannot_downgrade_academic_records "
            "CHECK (blocked = 0))"
        )
        op.execute(
            "INSERT INTO academic_domain_downgrade_guard (blocked) SELECT CASE "
            "WHEN EXISTS (SELECT 1 FROM drafts WHERE domain = 'academic') "
            "OR EXISTS (SELECT 1 FROM sequences WHERE domain = 'academic') "
            "OR EXISTS (SELECT 1 FROM people_jobs WHERE domain = 'academic') "
            "THEN 1 ELSE 0 END"
        )
        op.execute("DROP TABLE academic_domain_downgrade_guard")
    else:
        connection = op.get_bind()
        blocked_tables = [
            table
            for table in ("drafts", "sequences", "people_jobs")
            if connection.execute(
                sa.text(
                    f"SELECT 1 FROM {table} WHERE domain = 'academic' LIMIT 1"
                )
            ).first()
        ]
        if blocked_tables:
            raise RuntimeError(
                "Cannot downgrade the academic-domain MVP while Academic drafts, "
                "sequences, or people jobs exist; the previous schema cannot preserve "
                "their domain. Export or remove those records before downgrading."
            )
    op.drop_index(
        "uq_documents_cached_parse", table_name="uploaded_documents"
    )
    # Preserve the removed domain in a durable marker. Active academic parses
    # cannot remain cacheable in the legacy schema, where they would look finance-only.
    op.execute(
        "UPDATE uploaded_documents SET "
        "status = CASE WHEN status IN ('queued', 'processing', 'parsed') "
        "THEN 'failed' ELSE status END, "
        "error = 'Academic-domain downgrade preserved academic domain. ' "
        "|| COALESCE(error, '') WHERE domain = 'academic'"
    )
    # The pre-domain cache key cannot represent one active parse per domain.
    # Keep the oldest record active and retain later records as auditable failures
    # before restoring the narrower legacy unique index.
    op.execute(
        "UPDATE uploaded_documents SET status = 'failed', "
        "error = 'Academic-domain downgrade deactivated this duplicate cached parse.' "
        "WHERE id IN ("
        "SELECT id FROM ("
        "SELECT id, ROW_NUMBER() OVER ("
        "PARTITION BY workspace_id, content_hash, parse_mode, parse_provider, "
        "parse_model, parse_prompt_version "
        "ORDER BY CASE WHEN domain = 'finance' THEN 0 ELSE 1 END, created_at, id"
        ") AS duplicate_rank FROM uploaded_documents "
        "WHERE content_hash IS NOT NULL "
        "AND status IN ('queued', 'processing', 'parsed')"
        ") AS ranked_documents WHERE duplicate_rank > 1"
        ")"
    )
    op.create_index(
        "uq_documents_cached_parse",
        "uploaded_documents",
        [
            "workspace_id",
            "content_hash",
            "parse_mode",
            "parse_provider",
            "parse_model",
            "parse_prompt_version",
        ],
        unique=True,
        sqlite_where=sa.text(
            "content_hash IS NOT NULL AND status IN ('queued', 'processing', 'parsed')"
        ),
        postgresql_where=sa.text(
            "content_hash IS NOT NULL AND status IN ('queued', 'processing', 'parsed')"
        ),
    )
    op.drop_index("ix_people_jobs_domain", table_name="people_jobs")
    op.drop_column("sequences", "domain")
    op.drop_column("people_jobs", "domain")
    op.drop_column("drafts", "domain")
    op.drop_column("uploaded_documents", "domain")
    op.drop_column("persona_revisions", "domain")
