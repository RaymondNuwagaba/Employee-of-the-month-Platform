"""HR / management and administrator endpoints."""

import calendar
import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app import app_settings, audit, scoring, services
from app.deps import DB, AdminUser, StaffUser
from app.models import (
    AuditLog,
    Campaign,
    CampaignStatus,
    Criterion,
    Department,
    User,
    Vote,
    Winner,
    utcnow,
)
from app.routers.employee import annual_rows
from app.schemas import (
    AuditOut,
    CampaignCreate,
    CampaignOut,
    CampaignResults,
    CampaignUpdate,
    CommentOut,
    CriterionOut,
    CriterionUpdate,
    DepartmentIn,
    DepartmentOut,
    Overview,
    PublishIn,
    ResultRow,
    UserBrief,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- overview ----------


@router.get("/overview", response_model=Overview)
def overview(db: DB, _: StaffUser):
    campaign = services.current_campaign(db)
    total = db.scalar(select(func.count(User.id))) or 0
    voters = services.eligible_voter_count(db)
    votes = services.votes_cast(db, campaign.id) if campaign else 0
    leader = None
    days_remaining = None
    dept_rows: list[dict[str, Any]] = []
    if campaign:
        ranked = [r for r in scoring.campaign_results(db, campaign) if r.rank]
        leader = _result_rows(db, ranked[:1])[0] if ranked else None
        if campaign.is_voting_open:
            days_remaining = max((campaign.end_at - utcnow()).days, 0)
        voted = (
            select(Vote.voter_id).where(Vote.campaign_id == campaign.id).scalar_subquery()
        )
        for name, members, voted_count in db.execute(
            select(
                func.coalesce(Department.name, "Unassigned"),
                func.count(User.id),
                func.count(User.id).filter(User.id.in_(voted)),
            )
            .select_from(User)
            .outerjoin(Department, Department.id == User.department_id)
            .where(User.is_active)
            .group_by(Department.name)
            .order_by(Department.name)
        ):
            dept_rows.append(
                {"department": name, "employees": members, "voted": voted_count,
                 "participation": round(voted_count / members * 100, 1) if members else 0}
            )

    monthly = []
    for c, count in db.execute(
        select(Campaign, func.count(Vote.id))
        .outerjoin(Vote, Vote.campaign_id == Campaign.id)
        .where(Campaign.status != CampaignStatus.draft)
        .group_by(Campaign.id)
        .order_by(Campaign.year.desc(), Campaign.month.desc())
        .limit(12)
    ):
        monthly.append({"label": f"{calendar.month_abbr[c.month]} {c.year}", "votes": count,
                        "participation": round(count / voters * 100, 1) if voters else 0})
    monthly.reverse()

    return Overview(
        current_campaign=CampaignOut.of(campaign) if campaign else None,
        total_employees=total,
        eligible_voters=voters,
        votes_submitted=votes,
        participation=round(votes / voters * 100, 1) if voters else 0,
        days_remaining=days_remaining,
        leader=leader,
        department_participation=dept_rows,
        monthly_participation=monthly,
    )


# ---------- campaigns ----------


@router.get("/campaigns", response_model=list[CampaignOut])
def list_campaigns(db: DB, _: StaffUser):
    rows = db.scalars(select(Campaign).order_by(Campaign.year.desc(), Campaign.month.desc())).all()
    return [CampaignOut.of(c) for c in rows]


@router.post("/campaigns", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(body: CampaignCreate, request: Request, db: DB, user: StaffUser):
    c = Campaign(
        name=body.name or f"{calendar.month_name[body.month]} {body.year} Employee of the Month",
        month=body.month,
        year=body.year,
        start_at=body.start_at,
        end_at=body.end_at,
        created_by=user.id,
    )
    db.add(c)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A campaign already exists for that month.")
    audit.record(db, "campaign_created", user=user, entity="campaign", entity_id=c.id,
                 new=_campaign_audit(c), request=request)
    db.commit()
    return CampaignOut.of(c)


@router.patch("/campaigns/{campaign_id}", response_model=CampaignOut)
def update_campaign(campaign_id: int, body: CampaignUpdate, request: Request, db: DB, user: StaffUser):
    c = _campaign(db, campaign_id)
    if c.status in (CampaignStatus.closed, CampaignStatus.published):
        raise HTTPException(status.HTTP_409_CONFLICT, "Closed campaigns cannot be edited.")
    old = _campaign_audit(c)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    if c.end_at <= c.start_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Voting must close after it opens.")
    audit.record(db, "campaign_updated", user=user, entity="campaign", entity_id=c.id,
                 old=old, new=_campaign_audit(c), request=request)
    db.commit()
    return CampaignOut.of(c)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(campaign_id: int, request: Request, db: DB, user: StaffUser):
    c = _campaign(db, campaign_id)
    if c.status != CampaignStatus.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only draft campaigns can be deleted.")
    audit.record(db, "campaign_deleted", user=user, entity="campaign", entity_id=c.id,
                 old=_campaign_audit(c), request=request)
    db.delete(c)
    db.commit()


@router.post("/campaigns/{campaign_id}/open", response_model=CampaignOut)
def open_campaign(campaign_id: int, request: Request, db: DB, user: StaffUser):
    c = _campaign(db, campaign_id)
    if c.status != CampaignStatus.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only draft campaigns can be opened.")
    if c.end_at <= utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The voting deadline has already passed.")
    snapshot = scoring.snapshot_criteria(db)
    _check_weights([Decimal(x["weight"]) for x in snapshot])
    c.criteria_snapshot = snapshot
    c.status = CampaignStatus.open
    audit.record(db, "campaign_opened", user=user, entity="campaign", entity_id=c.id,
                 new={"criteria": snapshot}, request=request)
    db.commit()
    return CampaignOut.of(c)


@router.post("/campaigns/{campaign_id}/close", response_model=CampaignOut)
def close_campaign(campaign_id: int, request: Request, db: DB, user: StaffUser):
    c = _campaign(db, campaign_id)
    if c.status != CampaignStatus.open:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only open campaigns can be closed.")
    old_end = c.end_at
    c.status = CampaignStatus.closed
    if c.end_at > utcnow():
        c.end_at = utcnow()
    audit.record(db, "campaign_closed", user=user, entity="campaign", entity_id=c.id,
                 old={"end_at": old_end.isoformat()}, new={"end_at": c.end_at.isoformat()}, request=request)
    db.commit()
    return CampaignOut.of(c)


class ReopenIn(BaseModel):
    end_at: datetime
    reason: str = Field(min_length=3, max_length=500)


@router.post("/campaigns/{campaign_id}/reopen", response_model=CampaignOut)
def reopen_campaign(campaign_id: int, body: ReopenIn, request: Request, db: DB, user: AdminUser):
    c = _campaign(db, campaign_id)
    if c.effective_status != CampaignStatus.closed.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only closed, unpublished campaigns can be reopened.")
    new_end = body.end_at
    if new_end <= utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a new deadline in the future.")
    old = _campaign_audit(c)
    c.status = CampaignStatus.open
    c.end_at = new_end
    audit.record(db, "administrator_override", user=user, entity="campaign", entity_id=c.id,
                 old=old, new={**_campaign_audit(c), "reason": body.reason}, request=request)
    db.commit()
    return CampaignOut.of(c)


class ResetVoteIn(BaseModel):
    voter_id: int
    reason: str = Field(min_length=3, max_length=500)


@router.post("/campaigns/{campaign_id}/reset-vote", status_code=status.HTTP_204_NO_CONTENT)
def reset_vote(campaign_id: int, body: ResetVoteIn, request: Request, db: DB, user: AdminUser):
    """Let one employee vote again (e.g. they picked the wrong colleague). Fully audited."""
    c = _campaign(db, campaign_id)
    if not c.is_voting_open:
        raise HTTPException(status.HTTP_409_CONFLICT, "Votes can only be reset while voting is open.")
    v = db.scalar(select(Vote).where(Vote.campaign_id == c.id, Vote.voter_id == body.voter_id))
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That employee has not voted.")
    audit.record(
        db, "administrator_override", user=user, entity="vote", entity_id=v.id,
        old={"voter_id": v.voter_id, "candidate_id": v.candidate_id,
             "ratings": {s.criterion_id: s.rating for s in v.scores}},
        new={"action": "vote_reset", "reason": body.reason}, request=request,
    )
    db.delete(v)
    db.commit()


@router.get("/campaigns/{campaign_id}/results", response_model=CampaignResults)
def campaign_results(campaign_id: int, db: DB, _: StaffUser):
    c = _campaign(db, campaign_id)
    voters = services.eligible_voter_count(db)
    votes = services.votes_cast(db, c.id)
    winner = db.get(Winner, c.id)
    return CampaignResults(
        campaign=CampaignOut.of(c),
        eligible_voters=voters,
        votes_cast=votes,
        participation=round(votes / voters * 100, 1) if voters else 0,
        min_evaluations=app_settings.get(db, "min_evaluations"),
        results=_result_rows(db, scoring.campaign_results(db, c)),
        winner_user_id=winner.user_id if winner else None,
    )


@router.post("/campaigns/{campaign_id}/publish", response_model=CampaignOut)
def publish(campaign_id: int, body: PublishIn, request: Request, db: DB, user: StaffUser):
    c = _campaign(db, campaign_id)
    if c.effective_status != CampaignStatus.closed.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "Close voting before publishing the winner.")
    ranked = [r for r in scoring.campaign_results(db, c) if r.rank]
    if not ranked:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No candidate has enough evaluations to win.")
    top = ranked[0]
    chosen = top
    if body.user_id and body.user_id != top.user_id:
        chosen = next((r for r in ranked if r.user_id == body.user_id), None)
        if chosen is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That employee is not a ranked candidate.")
        # Picking someone other than rank 1 is only acceptable to settle an exact tie, and must be justified.
        if not body.override_reason:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required when not publishing rank 1.")

    db.add(
        Winner(
            campaign_id=c.id,
            user_id=chosen.user_id,
            final_score=chosen.final_score,
            evaluations=chosen.evaluations,
            breakdown=[b.as_dict() for b in chosen.breakdown],
            citation=body.citation,
            override_reason=body.override_reason if chosen is not top else None,
            published_by=user.id,
        )
    )
    c.status = CampaignStatus.published
    if chosen is not top:
        audit.record(db, "administrator_override", user=user, entity="campaign", entity_id=c.id,
                     old={"rank_1": top.user_id}, new={"winner": chosen.user_id, "reason": body.override_reason},
                     request=request)
    audit.record(db, "result_published", user=user, entity="campaign", entity_id=c.id,
                 new={"winner": chosen.user_id, "score": float(chosen.final_score)}, request=request)
    db.commit()
    return CampaignOut.of(c)


# ---------- comments ----------


@router.get("/comments", response_model=list[CommentOut])
def comments(db: DB, _: StaffUser, pending_only: bool = True):
    q = select(Vote, Campaign.name).join(Campaign, Campaign.id == Vote.campaign_id).where(Vote.comment.is_not(None))
    if pending_only:
        q = q.where(Vote.comment_approved.is_(None))
    rows = db.execute(q.order_by(Vote.submitted_at.desc()).limit(200)).unique().all()
    return [
        CommentOut(vote_id=v.id, campaign_name=name, candidate=UserBrief.of(v.candidate),
                   comment=v.comment, approved=v.comment_approved, submitted_at=v.submitted_at)
        for v, name in rows
    ]


class ModerateIn(BaseModel):
    approved: bool


@router.post("/comments/{vote_id}", status_code=status.HTTP_204_NO_CONTENT)
def moderate(vote_id: int, body: ModerateIn, request: Request, db: DB, user: StaffUser):
    v = db.get(Vote, vote_id)
    if v is None or v.comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    old = v.comment_approved
    v.comment_approved = body.approved
    audit.record(db, "comment_moderated", user=user, entity="vote", entity_id=v.id,
                 old=old, new=body.approved, request=request)
    db.commit()


# ---------- employees & departments ----------


@router.get("/employees", response_model=list[UserOut])
def employees(db: DB, _: StaffUser):
    return [UserOut.of(u) for u in db.scalars(select(User).order_by(User.full_name)).unique()]


@router.post("/employees", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_employee(body: UserCreate, request: Request, db: DB, user: AdminUser):
    u = User(**{**body.model_dump(), "email": body.email.lower()})
    db.add(u)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An employee with that email or employee ID exists.")
    audit.record(db, "employee_created", user=user, entity="user", entity_id=u.id,
                 new=body.model_dump(mode="json"), request=request)
    db.commit()
    db.refresh(u)
    return UserOut.of(u)


@router.patch("/employees/{user_id}", response_model=UserOut)
def update_employee(user_id: int, body: UserUpdate, request: Request, db: DB, user: AdminUser):
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    changes = body.model_dump(exclude_unset=True, mode="json")
    if u.id == user.id and (changes.get("role") not in (None, "admin") or changes.get("is_active") is False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove your own admin access.")
    old = {k: _jsonable(getattr(u, k)) for k in changes}
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(u, k, v)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That employee ID is already in use.")
    action = "employee_updated"
    if "role" in changes and old["role"] != changes["role"]:
        action = "role_changed"
    elif changes.get("is_active") is False:
        action = "employee_disabled"
    audit.record(db, action, user=user, entity="user", entity_id=u.id, old=old, new=changes, request=request)
    db.commit()
    db.refresh(u)
    return UserOut.of(u)


@router.get("/departments", response_model=list[DepartmentOut])
def departments(db: DB, _: StaffUser):
    counts = dict(db.execute(select(User.department_id, func.count(User.id)).where(User.is_active)
                             .group_by(User.department_id)).all())
    rows = db.scalars(select(Department).order_by(Department.name)).all()
    return [DepartmentOut(id=d.id, name=d.name, description=d.description, is_active=d.is_active,
                          employee_count=counts.get(d.id, 0)) for d in rows]


@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(body: DepartmentIn, request: Request, db: DB, user: AdminUser):
    d = Department(**body.model_dump())
    db.add(d)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A department with that name exists.")
    audit.record(db, "department_created", user=user, entity="department", entity_id=d.id,
                 new=body.model_dump(), request=request)
    db.commit()
    return DepartmentOut.model_validate(d)


@router.put("/departments/{dept_id}", response_model=DepartmentOut)
def update_department(dept_id: int, body: DepartmentIn, request: Request, db: DB, user: AdminUser):
    d = db.get(Department, dept_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    old = DepartmentIn.model_validate(d, from_attributes=True).model_dump()
    for k, v in body.model_dump().items():
        setattr(d, k, v)
    audit.record(db, "department_updated", user=user, entity="department", entity_id=d.id,
                 old=old, new=body.model_dump(), request=request)
    db.commit()
    return DepartmentOut.model_validate(d)


# ---------- configuration ----------


@router.put("/criteria", response_model=list[CriterionOut])
def update_criteria(body: list[CriterionUpdate], request: Request, db: DB, user: AdminUser):
    criteria = {c.id: c for c in db.scalars(select(Criterion).where(Criterion.is_active))}
    if {b.id for b in body} != set(criteria):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide every active criterion.")
    _check_weights([Decimal(str(b.weight)) for b in body])
    old = [CriterionOut.model_validate(c).model_dump() for c in criteria.values()]
    for b in body:
        c = criteria[b.id]
        c.weight = Decimal(str(b.weight))
        for field in ("name", "description", "question"):
            if getattr(b, field) is not None:
                setattr(c, field, getattr(b, field))
    db.flush()
    new = [CriterionOut.model_validate(c).model_dump() for c in criteria.values()]
    audit.record(db, "scoring_parameters_changed", user=user, entity="criteria", old=old, new=new, request=request)
    db.commit()
    return sorted(new, key=lambda c: c["sort_order"])


@router.get("/settings")
def get_settings_(db: DB, _: StaffUser):
    return app_settings.get_all(db)


@router.put("/settings")
def put_settings(body: dict[str, Any], request: Request, db: DB, user: AdminUser):
    old = app_settings.get_all(db)
    for key, value in body.items():
        if key not in app_settings.DEFAULTS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown setting: {key}")
        expected = type(app_settings.DEFAULTS[key])
        if type(value) is not expected or (expected is int and value < 0):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid value for {key}")
        app_settings.set_value(db, key, value)
    audit.record(db, "settings_changed", user=user, entity="settings", old=old, new=body, request=request)
    db.commit()
    return app_settings.get_all(db)


@router.get("/audit", response_model=list[AuditOut])
def audit_logs(db: DB, _: AdminUser, action: str | None = None, limit: int = 200):
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 1000))
    if action:
        q = q.where(AuditLog.action == action)
    return [
        AuditOut(id=a.id, user=a.user.full_name if a.user else None, action=a.action, entity=a.entity,
                 entity_id=a.entity_id, old_value=a.old_value, new_value=a.new_value,
                 ip_address=a.ip_address, created_at=a.created_at)
        for a in db.scalars(q).unique()
    ]


# ---------- reports ----------


@router.get("/reports/campaign/{campaign_id}.csv")
def campaign_report(campaign_id: int, db: DB, _: StaffUser):
    c = _campaign(db, campaign_id)
    results = _result_rows(db, scoring.campaign_results(db, c))
    criteria = scoring.criteria_for_campaign(db, c)
    voters = services.eligible_voter_count(db)
    votes = services.votes_cast(db, c.id)
    winner = db.get(Winner, c.id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Campaign", c.name])
    w.writerow(["Voting period", c.start_at.date().isoformat(), c.end_at.date().isoformat()])
    w.writerow(["Eligible voters", voters])
    w.writerow(["Votes cast", votes])
    w.writerow(["Participation %", round(votes / voters * 100, 1) if voters else 0])
    w.writerow(["Winner", winner.user.full_name if winner else "Not yet published"])
    w.writerow([])
    w.writerow(["Rank", "Employee", "Department", "Final score", "Evaluations"]
               + [f"{x['name']} ({x['weight']}%) avg rating" for x in criteria])
    for r in results:
        w.writerow([r.rank or "-", r.user.full_name, r.user.department or "", r.final_score, r.evaluations]
                   + [b.average_rating for b in r.breakdown])
    return _csv(buf, f"eotm-{c.year}-{c.month:02d}.csv")


@router.get("/reports/annual/{year}.csv")
def annual_report(year: int, db: DB, _: StaffUser):
    rows = annual_rows(db, year)
    buf = io.StringIO()
    w = csv.writer(buf)
    months = [calendar.month_abbr[m] for m in range(1, 13)]
    w.writerow(["Rank", "Employee", "Department", "Annual score", "Monthly wins", "Months recognized",
                "Nominations", "Best score"] + months)
    for r in rows:
        by_month = {m["month"]: m["raw_score"] for m in r.monthly}
        w.writerow([r.rank, r.user.full_name, r.user.department or "", r.annual_score, r.monthly_wins,
                    r.months_recognized, r.nominations, r.best_score]
                   + [by_month.get(m, "") for m in range(1, 13)])
    return _csv(buf, f"eotm-annual-{year}.csv")


# ---------- helpers ----------


def _campaign(db: DB, campaign_id: int) -> Campaign:
    c = db.get(Campaign, campaign_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return c


def _campaign_audit(c: Campaign) -> dict[str, Any]:
    return {"name": c.name, "month": c.month, "year": c.year, "status": c.status.value if c.status else None,
            "start_at": c.start_at.isoformat(), "end_at": c.end_at.isoformat()}


def _check_weights(weights: list[Decimal]) -> None:
    if sum(weights) != Decimal(100):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Criterion weights must total 100% (currently {sum(weights)}%).")


def _result_rows(db: DB, results: list[scoring.CandidateResult]) -> list[ResultRow]:
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_([r.user_id for r in results]))).unique()}
    return [
        ResultRow(rank=r.rank, user=UserBrief.of(users[r.user_id]), final_score=float(r.final_score),
                  evaluations=r.evaluations, qualified=r.qualified, tied_with_next=r.tied_with_next,
                  breakdown=[b.as_dict() for b in r.breakdown])
        for r in results
    ]


def _jsonable(v: Any) -> Any:
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if hasattr(v, "value"):
        return v.value
    return v


def _csv(buf: io.StringIO, filename: str) -> StreamingResponse:
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})

