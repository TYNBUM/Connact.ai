import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from ..config import settings
from ..db import Session
from ..models import Workspace
from ..auth_models import User, LoginSession, Invitation

router = APIRouter(prefix="/auth")
COOKIE = "connact_session"
_attempts = defaultdict(deque)
_lock = threading.Lock()


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return salt + ":" + value


def check_password(password, hashed):
    return hmac.compare_digest(password_hash(password, hashed.split(":")[0]), hashed)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def session_user(db, request):
    token = request.cookies.get(COOKIE, "")
    if not token:
        return None
    session = db.scalar(select(LoginSession).where(LoginSession.token_hash == digest(token)))
    if not session or utc(session.expires_at) <= datetime.now(timezone.utc):
        return None
    return db.get(User, session.user_id)


def workspace_for_request(db, request):
    if settings.auth_mode == "local":
        return settings.workspace_id
    user = session_user(db, request)
    if not user:
        raise HTTPException(401, "Please sign in to your workspace.")
    return user.workspace_id


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=250)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def normalized(cls, value):
        value = value.strip().lower()
        if "@" not in value or any(c.isspace() for c in value):
            raise ValueError("Enter a valid email address.")
        return value


class Join(Credentials):
    invitation: str = Field(min_length=6, max_length=200)


def throttle(email):
    # Single-process invitation pilot. A shared limiter is required for replicas.
    with _lock:
        clock = time.monotonic()
        for key in ("global", digest(email)):
            q = _attempts[key]
            while q and q[0] < clock - 900:
                q.popleft()
            if len(q) >= (100 if key == "global" else 10):
                raise HTTPException(429, "Too many sign-in attempts. Try again in 15 minutes.")
        _attempts["global"].append(clock)
        _attempts[digest(email)].append(clock)


def login_cookie(db, user, response):
    token = secrets.token_urlsafe(32)
    db.add(LoginSession(token_hash=digest(token), user_id=user.id,
                        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.session_days)))
    response.set_cookie(COOKIE, token, max_age=settings.session_days * 86400,
                        httponly=True, secure=settings.public_origin.startswith("https://"),
                        samesite="strict", path="/")


@router.get("/session")
def session(request: Request):
    if settings.auth_mode == "local":
        return {"mode": "local", "authenticated": True, "email": None, "workspace_id": settings.workspace_id}
    with Session() as db:
        user = session_user(db, request)
        return {"mode": "invite", "authenticated": bool(user),
                "email": user.email if user else None, "workspace_id": user.workspace_id if user else None}


@router.post("/login")
def login(body: Credentials, request: Request, response: Response):
    if settings.auth_mode != "invite":
        raise HTTPException(409, "Sign-in is disabled in local mode.")
    throttle(body.email)
    with Session() as db:
        user = db.scalar(select(User).where(User.email == body.email))
        # Run the same expensive operation for an unknown account.
        hashed = user.password_hash if user else password_hash("unused-password", "00" * 16)
        valid = check_password(body.password, hashed)
        if not user or not valid:
            raise HTTPException(401, "Email or password is incorrect.")
        login_cookie(db, user, response)
        db.commit()
        return {"authenticated": True, "email": user.email, "workspace_id": user.workspace_id}


@router.post("/join")
def join(body: Join, response: Response):
    if settings.auth_mode != "invite":
        raise HTTPException(409, "Invitations are disabled in local mode.")
    throttle(body.email)
    with Session() as db:
        invitation = db.scalar(select(Invitation).where(Invitation.token_hash == digest(body.invitation)).with_for_update())
        if (not invitation or invitation.used_at or utc(invitation.expires_at) <= datetime.now(timezone.utc)
                or invitation.email != body.email):
            raise HTTPException(400, "The invitation is invalid, expired, already used, or belongs to another email.")
        workspace = Workspace(id=str(uuid4()), name="Personal workspace")
        db.add(workspace)
        db.flush()
        user = User(email=body.email, password_hash=password_hash(body.password), workspace_id=workspace.id)
        db.add(user)
        try:
            db.flush()
            invitation.used_at = datetime.now(timezone.utc)
            login_cookie(db, user, response)
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "An account already exists. Sign in instead.")
        return {"authenticated": True, "email": user.email, "workspace_id": user.workspace_id}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE, "")
    with Session() as db:
        session = db.scalar(select(LoginSession).where(LoginSession.token_hash == digest(token)))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="strict")
    return {"authenticated": False}
