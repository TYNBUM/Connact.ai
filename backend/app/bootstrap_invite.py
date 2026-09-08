"""Idempotent first invitation for hosts without shell access. Never stores a raw token."""

import re
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from .config import settings
from .db import Session
from .auth_models import Invitation, User


def bootstrap_invite():
    email = settings.bootstrap_invite_email.strip().lower()
    token_hash = settings.bootstrap_invite_token_hash
    if not email and not token_hash:
        return
    if (
        settings.auth_mode != "invite"
        or "@" not in email
        or len(email) > 250
        or any(c.isspace() for c in email)
        or not re.fullmatch(r"[a-f0-9]{64}", token_hash)
    ):
        raise RuntimeError("Invalid bootstrap invitation configuration.")
    with Session() as db:
        if db.scalar(select(User.id).where(User.email == email)):
            return
        if db.scalar(select(Invitation.id).where(Invitation.token_hash == token_hash)):
            return
        db.add(
            Invitation(
                email=email,
                token_hash=token_hash,
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
        )
        db.commit()
    print("Initial invitation is ready. No invitation code is written to server logs.")


if __name__ == "__main__":
    bootstrap_invite()
