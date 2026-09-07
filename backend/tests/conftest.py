import os
import tempfile
from pathlib import Path

# Explicit isolated test database; never use the running personal workspace DB.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "sqlite:///" + str(Path(tempfile.mkdtemp()) / "test.db")
)
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp()
os.environ["PEOPLE_MODE"] = "mock"
os.environ["AI_MODE"] = "mock"
os.environ["PUBLIC_SEARCH_MODE"] = "mock"

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c
