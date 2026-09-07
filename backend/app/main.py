from contextlib import asynccontextmanager
from urllib.parse import urlparse
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import select, text
from .db import Session, get_repo
from .models import Workspace
from .config import settings
from .routers import personas, contacts, finance, drafts


@asynccontextmanager
async def lifespan(app):
    with Session() as db:
        if db.get(Workspace, settings.workspace_id) is None:
            db.add(Workspace(id=settings.workspace_id, name="Personal workspace"))
            db.commit()
    yield


app = FastAPI(title="Connact.ai API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "backend", "testserver"],
)


@app.middleware("http")
async def local_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and urlparse(origin).hostname not in ("localhost", "127.0.0.1"):
        return JSONResponse(
            {"detail": "Local workspace accepts only localhost origins."},
            status_code=403,
        )
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    with Session() as db:
        db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": (
            "postgresql"
            if settings.database_url.startswith("postgresql")
            else "sqlite-test"
        ),
    }


@app.get("/api/config")
def config():
    return {
        "workspace": "Personal workspace",
        "local_only": True,
        "people_mode": settings.people_mode,
        "public_search_mode": settings.public_search_mode,
        "ai_mode": settings.ai_mode,
        "providers": {
            "apollo": bool(settings.apollo_api_key),
            "serpapi": bool(settings.serpapi_api_key),
            "ai": bool(settings.ai_api_key),
        },
    }


for router in (personas.router, contacts.router, finance.router, drafts.router):
    app.include_router(router, prefix="/api")
