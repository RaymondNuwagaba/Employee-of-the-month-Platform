from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import login


def make_open_campaign(admin: TestClient, month_offset: int = 0) -> dict:
    now = datetime.now(timezone.utc)
    month_index = now.month - 1 + month_offset
    year = now.year + month_index // 12
    month = month_index % 12 + 1
    r = admin.post("/api/admin/campaigns", json={
        "month": month, "year": year,
        "start_at": (now - timedelta(hours=1)).isoformat(),
        "end_at": (now + timedelta(days=5)).isoformat(),
    })
    assert r.status_code == 201, r.text
    r = admin.post(f"/api/admin/campaigns/{r.json()['id']}/open")
    assert r.status_code == 200, r.text
    return r.json()


def ratings(client: TestClient, value=5) -> dict:
    return {str(c["id"]): value for c in client.get("/api/criteria").json()}


def vote(client, campaign_id, candidate_id, value=5, **extra):
    return client.post("/api/votes", json={
        "campaign_id": campaign_id, "candidate_id": candidate_id, "ratings": ratings(client, value), **extra,
    })


def test_requires_sign_in_and_csrf_header(people):
    anon = TestClient(app)
    assert anon.get("/api/auth/me").status_code == 401
    assert anon.post("/api/auth/dev-login", json={"email": "e1@x.com"}).status_code == 403


def test_full_monthly_cycle(people):
    admin = login("admin@x.com")
    campaign = make_open_campaign(admin)
    cid = campaign["id"]
    e = {i: people[f"e{i}@x.com"].id for i in range(1, 6)}

    voter = login("e1@x.com")
    candidates = {c["id"] for c in voter.get(f"/api/campaigns/{cid}/candidates").json()}
    assert e[1] not in candidates  # cannot see yourself
    assert people["new@x.com"].id not in candidates  # under 30 days tenure

    assert vote(voter, cid, e[1]).status_code == 400  # self vote
    assert vote(voter, cid, people["new@x.com"].id).status_code == 400  # ineligible
    partial = voter.post("/api/votes", json={"campaign_id": cid, "candidate_id": e[2], "ratings": {}})
    assert partial.status_code == 400  # must rate every criterion
    assert vote(voter, cid, e[2], comment="Great help").status_code == 201
    assert vote(voter, cid, e[3]).status_code == 409  # one vote per campaign
    assert voter.get("/api/campaigns/current").json()["my_vote"]["candidate"]["id"] == e[2]

    for i in (3, 4, 5):
        assert vote(login(f"e{i}@x.com"), cid, e[2], value=4).status_code == 201
    assert vote(login("hr@x.com"), cid, e[3]).status_code == 201

    # Employees cannot see results or admin pages
    assert voter.get(f"/api/admin/campaigns/{cid}/results").status_code == 403
    assert admin.post(f"/api/admin/campaigns/{cid}/publish", json={}).status_code == 409  # still open

    assert admin.post(f"/api/admin/campaigns/{cid}/close").status_code == 200
    assert vote(login("e2@x.com"), cid, e[3]).status_code == 409  # closed

    results = admin.get(f"/api/admin/campaigns/{cid}/results").json()
    top = results["results"][0]
    assert top["user"]["id"] == e[2]
    assert top["evaluations"] == 4
    assert top["final_score"] == 85.0  # (5 + 4*3)/4 = 4.25 avg on every criterion -> 85
    # e3 has only one evaluation (< 3 minimum): listed but unranked
    assert next(r for r in results["results"] if r["user"]["id"] == e[3])["rank"] is None

    assert admin.post(f"/api/admin/campaigns/{cid}/publish", json={"citation": "Thanks!"}).status_code == 200
    winners = voter.get("/api/winners").json()
    assert winners[0]["user"]["id"] == e[2]
    assert winners[0]["comments"] == []  # pending HR approval

    vote_id = admin.get("/api/admin/comments").json()[0]["vote_id"]
    assert admin.post(f"/api/admin/comments/{vote_id}", json={"approved": True}).status_code == 204
    assert voter.get(f"/api/winners/{cid}").json()["comments"] == ["Great help"]

    annual = voter.get("/api/leaderboard/annual").json()
    assert annual[0]["user"]["id"] == e[2] and annual[0]["monthly_wins"] == 1

    actions = {a["action"] for a in admin.get("/api/admin/audit").json()}
    assert {"campaign_created", "campaign_opened", "vote_submitted", "campaign_closed", "result_published"} <= actions


def test_override_publish_only_allowed_for_exact_tie(people):
    admin = login("admin@x.com")
    campaign = make_open_campaign(admin)
    cid = campaign["id"]
    e2 = people["e2@x.com"].id
    e3 = people["e3@x.com"].id

    for email in ("e1@x.com", "e4@x.com", "e5@x.com"):
        assert vote(login(email), cid, e2, value=5).status_code == 201
    for email in ("admin@x.com", "hr@x.com", "e2@x.com"):
        assert vote(login(email), cid, e3, value=4).status_code == 201

    assert admin.post(f"/api/admin/campaigns/{cid}/close").status_code == 200
    results = admin.get(f"/api/admin/campaigns/{cid}/results").json()["results"]
    assert results[0]["user"]["id"] == e2
    assert next(r for r in results if r["user"]["id"] == e3)["rank"] == 2

    r = admin.post(
        f"/api/admin/campaigns/{cid}/publish",
        json={"user_id": e3, "override_reason": "Preference"},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "Overrides are only allowed to settle an exact tie."


def test_override_publish_allowed_for_exact_tie(people):
    admin = login("admin@x.com")
    campaign = make_open_campaign(admin)
    cid = campaign["id"]
    e2 = people["e2@x.com"].id
    e3 = people["e3@x.com"].id

    for email in ("e1@x.com", "e4@x.com", "e5@x.com"):
        assert vote(login(email), cid, e2, value=5).status_code == 201
    for email in ("admin@x.com", "hr@x.com", "e2@x.com"):
        assert vote(login(email), cid, e3, value=5).status_code == 201

    assert admin.post(f"/api/admin/campaigns/{cid}/close").status_code == 200
    results = admin.get(f"/api/admin/campaigns/{cid}/results").json()["results"]
    assert results[0]["tied_with_next"]

    r = admin.post(
        f"/api/admin/campaigns/{cid}/publish",
        json={"user_id": e3, "override_reason": "Tie settled by HR review"},
    )
    assert r.status_code == 200, r.text
    assert admin.get(f"/api/winners/{cid}").json()["user"]["id"] == e3


def test_weights_must_total_100(people):
    admin = login("admin@x.com")
    crit = admin.get("/api/criteria").json()
    body = [{"id": c["id"], "weight": 25} for c in crit]
    body[0]["weight"] = 30
    assert admin.put("/api/admin/criteria", json=body).status_code == 400
    body[0]["weight"] = 25
    assert admin.put("/api/admin/criteria", json=body).status_code == 200
    assert login("e1@x.com").put("/api/admin/criteria", json=body).status_code == 403


def test_disabled_employee_loses_access(people):
    admin = login("admin@x.com")
    emp = login("e1@x.com")
    r = admin.patch(f"/api/admin/employees/{people['e1@x.com'].id}", json={"is_active": False})
    assert r.status_code == 200
    assert emp.get("/api/auth/me").status_code == 403
    assert TestClient(app, headers={"X-Requested-With": "eotm"}).post(
        "/api/auth/dev-login", json={"email": "e1@x.com"}).status_code == 403
