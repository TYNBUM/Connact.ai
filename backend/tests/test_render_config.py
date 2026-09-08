from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.config import Settings, settings
from app.db import Session
from app.auth_models import Invitation
from app.bootstrap_invite import bootstrap_invite
from app.routers.auth import digest, _attempts


def test_render_postgres_url_uses_installed_driver():
    for url in (
        "postgres://test:password@db.example/app",
        "postgresql://test:password@db.example/app",
    ):
        config = Settings(_env_file=None, database_url=url)
        assert (
            config.database_url == "postgresql+psycopg://test:password@db.example/app"
        )


def test_bootstrap_invitation_not_reissued_on_restart(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_mode", "invite")
    monkeypatch.setattr(settings, "bootstrap_invite_email", "Owner@example.test")
    monkeypatch.setattr(settings, "bootstrap_invite_token_hash", "a" * 64)
    bootstrap_invite()
    with Session() as db:
        record = db.scalar(select(Invitation))
        assert record.email == "owner@example.test"
        record.used_at = datetime.now(timezone.utc)
        record.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
        ident = record.id
    bootstrap_invite()
    with Session() as db:
        rows = db.scalars(select(Invitation)).all()
        assert len(rows) == 1 and rows[0].id == ident
        assert rows[0].used_at is not None
        assert rows[0].expires_at.replace(tzinfo=timezone.utc) < datetime.now(
            timezone.utc
        )


def test_short_bootstrap_code_is_case_sensitive_email_bound_and_single_use(client, monkeypatch):
    import secrets
    import string

    token = "".join(secrets.choice(string.ascii_uppercase) for _ in range(6))
    monkeypatch.setattr(settings, "auth_mode", "invite")
    monkeypatch.setattr(settings, "bootstrap_invite_email", "owner@example.test")
    monkeypatch.setattr(settings, "bootstrap_invite_token_hash", digest(token))
    _attempts.clear()
    bootstrap_invite()
    body = {"email": "wrong@example.test", "password": "test-password-only-123", "invitation": token}
    assert client.post("/api/auth/join", json=body).status_code == 400
    body["email"] = "owner@example.test"
    body["invitation"] = token.lower()
    assert client.post("/api/auth/join", json=body).status_code == 400
    body["invitation"] = token
    assert client.post("/api/auth/join", json=body).status_code == 200
    client.post("/api/auth/logout")
    bootstrap_invite()
    assert client.post("/api/auth/join", json=body).status_code == 400
