import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import DEV_SESSION_SECRET, Settings
from app.main import app
from app.routers import auth as auth_router


def ms_login(monkeypatch, oid: str, email: str):
    claims = {"oid": oid, "tid": "t", "name": "Someone", "preferred_username": email}
    monkeypatch.setattr(auth_router, "validate_entra_id_token", lambda _token: claims)
    c = TestClient(app, headers={"X-Requested-With": "eotm"})
    return c.post("/api/auth/microsoft", json={"id_token": "x"})


def test_first_microsoft_sign_in_links_precreated_record(monkeypatch, people, db):
    r = ms_login(monkeypatch, "oid-1", "E1@x.com")
    assert r.status_code == 200, r.text
    assert r.json()["id"] == people["e1@x.com"].id


def test_email_cannot_take_over_account_linked_to_another_microsoft_id(monkeypatch, people):
    assert ms_login(monkeypatch, "oid-1", "e1@x.com").status_code == 200
    r = ms_login(monkeypatch, "oid-2", "e1@x.com")
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "account_conflict"


def test_production_refuses_dev_mode_and_weak_secret():
    strong = "s" * 48
    with pytest.raises(ValidationError):
        Settings(cookie_secure=True, auth_dev_mode=True, session_secret=strong)
    with pytest.raises(ValidationError):
        Settings(cookie_secure=True, auth_dev_mode=False, session_secret=DEV_SESSION_SECRET)
    with pytest.raises(ValidationError):
        Settings(cookie_secure=True, auth_dev_mode=False, session_secret="short")
    assert Settings(cookie_secure=True, auth_dev_mode=False, session_secret=strong).cookie_secure
