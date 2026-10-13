from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import Campaign, Role, User


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- people ----------


class UserBrief(BaseModel):
    id: int
    full_name: str
    department: str | None
    job_title: str | None
    photo_url: str | None

    @classmethod
    def of(cls, u: User) -> "UserBrief":
        return cls(
            id=u.id,
            full_name=u.full_name,
            department=u.department.name if u.department else None,
            job_title=u.job_title,
            photo_url=u.photo_url,
        )


class UserOut(UserBrief):
    email: str
    employee_id: str | None
    department_id: int | None
    role: Role
    is_active: bool
    is_eligible: bool
    hire_date: date | None
    last_login_at: datetime | None

    @classmethod
    def of(cls, u: User) -> "UserOut":
        return cls(
            **UserBrief.of(u).model_dump(),
            email=u.email,
            employee_id=u.employee_id,
            department_id=u.department_id,
            role=u.role,
            is_active=u.is_active,
            is_eligible=u.is_eligible,
            hire_date=u.hire_date,
            last_login_at=u.last_login_at,
        )


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    employee_id: str | None = None
    department_id: int | None = None
    job_title: str | None = None
    role: Role = Role.employee
    hire_date: date | None = None


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    employee_id: str | None = None
    department_id: int | None = None
    job_title: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    is_eligible: bool | None = None
    hire_date: date | None = None
    photo_url: str | None = None


class DepartmentIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    is_active: bool = True


class DepartmentOut(ORM):
    id: int
    name: str
    description: str | None
    is_active: bool
    employee_count: int = 0


# ---------- criteria ----------


class CriterionOut(ORM):
    id: int
    key: str
    name: str
    description: str
    question: str
    weight: float
    sort_order: int


class CriterionUpdate(BaseModel):
    id: int
    weight: float = Field(gt=0, le=100)
    name: str | None = None
    description: str | None = None
    question: str | None = None


# ---------- campaigns ----------


class CampaignOut(BaseModel):
    id: int
    name: str
    month: int
    year: int
    start_at: datetime
    end_at: datetime
    status: str
    effective_status: str
    is_voting_open: bool

    @classmethod
    def of(cls, c: Campaign) -> "CampaignOut":
        return cls(
            id=c.id,
            name=c.name,
            month=c.month,
            year=c.year,
            start_at=c.start_at,
            end_at=c.end_at,
            status=c.status.value,
            effective_status=c.effective_status,
            is_voting_open=c.is_voting_open,
        )


class CampaignCreate(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    start_at: datetime
    end_at: datetime
    name: str | None = None

    @field_validator("end_at")
    @classmethod
    def end_after_start(cls, v: datetime, info):
        start = info.data.get("start_at")
        if start and v <= start:
            raise ValueError("Voting must close after it opens")
        return v


class CampaignUpdate(BaseModel):
    name: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None


# ---------- voting ----------


class VoteIn(BaseModel):
    campaign_id: int
    candidate_id: int
    ratings: dict[int, int]  # criterion_id -> 1..5
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator("ratings")
    @classmethod
    def ratings_in_range(cls, v: dict[int, int]):
        if any(r < 1 or r > 5 for r in v.values()):
            raise ValueError("Each rating must be between 1 and 5")
        return v


class MyVoteOut(BaseModel):
    campaign_id: int
    candidate: UserBrief
    ratings: dict[int, int]
    comment: str | None
    submitted_at: datetime


class CandidateOut(UserBrief):
    pass


# ---------- results ----------


class BreakdownItem(BaseModel):
    criterion_id: int
    key: str
    name: str
    weight: float
    average_rating: float
    percent: float
    contribution: float


class ResultRow(BaseModel):
    rank: int | None
    user: UserBrief
    final_score: float
    evaluations: int
    qualified: bool
    tied_with_next: bool
    breakdown: list[BreakdownItem]


class CampaignResults(BaseModel):
    campaign: CampaignOut
    eligible_voters: int
    votes_cast: int
    participation: float
    min_evaluations: int
    results: list[ResultRow]
    winner_user_id: int | None


class PublishIn(BaseModel):
    user_id: int | None = None  # defaults to rank 1
    citation: str | None = Field(default=None, max_length=1000)
    override_reason: str | None = Field(default=None, max_length=1000)


class WinnerOut(BaseModel):
    campaign_id: int
    campaign_name: str
    month: int
    year: int
    user: UserBrief
    final_score: float
    evaluations: int
    breakdown: list[BreakdownItem]
    citation: str | None
    comments: list[str] = []
    published_at: datetime


class AnnualRow(BaseModel):
    rank: int
    user: UserBrief
    annual_score: float
    months_counted: int
    months_recognized: int
    monthly_wins: int
    nominations: int
    best_score: float
    average_when_nominated: float
    monthly: list[dict[str, Any]]


class MyStats(BaseModel):
    year: int
    nominations: int
    monthly_wins: int
    annual_score: float | None
    annual_rank: int | None
    best_score: float | None
    badges: list[str]
    history: list[dict[str, Any]]


# ---------- admin ----------


class CommentOut(BaseModel):
    vote_id: int
    campaign_name: str
    candidate: UserBrief
    comment: str
    approved: bool | None
    submitted_at: datetime


class AuditOut(BaseModel):
    id: int
    user: str | None
    action: str
    entity: str | None
    entity_id: str | None
    old_value: Any
    new_value: Any
    ip_address: str | None
    created_at: datetime


class Overview(BaseModel):
    current_campaign: CampaignOut | None
    total_employees: int
    eligible_voters: int
    votes_submitted: int
    participation: float
    days_remaining: int | None
    leader: ResultRow | None
    department_participation: list[dict[str, Any]]
    monthly_participation: list[dict[str, Any]]
