import os

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://localhost:5432/eotm_test")
os.environ["AUTH_DEV_MODE"] = "true"

from datetime import date, timedelta  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User  # noqa: E402

HERE = os.path.dirname(os.path.dirname(__file__))


@pytest.fixture(scope="session", autouse=True)
def migrated():
    cfg = Config(os.path.join(HERE, "alembic.ini"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def clean():
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE audit_logs, winners, vote_scores, votes, campaigns, app_settings, users, departments "
            "RESTART IDENTITY CASCADE"
        ))
    yield


@pytest.fixture
def db():
    s = SessionLocal()
    yield s
    s.close()


@pytest.fixture
def people(db):
    old = date.today() - timedelta(days=365)
    users = [
        User(full_name="Admin", email="admin@x.com", role=Role.admin, hire_date=old),
        User(full_name="Hr", email="hr@x.com", role=Role.hr, hire_date=old),
        *[User(full_name=f"Emp {i}", email=f"e{i}@x.com", hire_date=old) for i in range(1, 6)],
        User(full_name="Newbie", email="new@x.com", hire_date=date.today()),
    ]
    db.add_all(users)
    db.commit()
    return {u.email: u for u in users}


def login(email: str) -> TestClient:
    c = TestClient(app, headers={"X-Requested-With": "eotm"})
    r = c.post("/api/auth/dev-login", json={"email": email})
    assert r.status_code == 200, r.text
    return c
