import enum
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    employee = "employee"
    hr = "hr"
    admin = "admin"


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    closed = "closed"
    published = "published"


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entra_object_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    employee_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    job_title: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role"), default=Role.employee, server_default="employee"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Admin can exclude someone from being voted for (e.g. extended leave)
    is_eligible: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    hire_date: Mapped[date | None] = mapped_column(Date)
    photo_url: Mapped[str | None] = mapped_column(String(500))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=utcnow
    )

    department: Mapped[Department | None] = relationship(lazy="joined")


class Criterion(Base):
    __tablename__ = "criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    question: Mapped[str] = mapped_column(Text, default="")
    weight: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        UniqueConstraint("year", "month", name="uq_campaign_period"),
        CheckConstraint("month BETWEEN 1 AND 12", name="ck_campaign_month"),
        CheckConstraint("end_at > start_at", name="ck_campaign_dates"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    month: Mapped[int] = mapped_column(SmallInteger)
    year: Mapped[int] = mapped_column(SmallInteger)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus, name="campaign_status"),
        default=CampaignStatus.draft,
        server_default="draft",
    )
    # Criteria and weights frozen when voting opens, so later weight changes
    # never rewrite historical results: [{id, key, name, weight, sort_order}]
    criteria_snapshot: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def is_voting_open(self) -> bool:
        now = utcnow()
        return self.status == CampaignStatus.open and self.start_at <= now <= self.end_at

    @property
    def effective_status(self) -> str:
        """Status as employees experience it: an open campaign past its deadline is closed."""
        if self.status == CampaignStatus.open:
            now = utcnow()
            if now > self.end_at:
                return CampaignStatus.closed.value
            if now < self.start_at:
                return "scheduled"
        return self.status.value


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (
        UniqueConstraint("campaign_id", "voter_id", name="uq_vote_once_per_campaign"),
        CheckConstraint("voter_id <> candidate_id", name="ck_no_self_vote"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    voter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    candidate_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    comment: Mapped[str | None] = mapped_column(Text)
    # None = pending review, True = approved for public display, False = rejected
    comment_approved: Mapped[bool | None] = mapped_column(Boolean)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scores: Mapped[list["VoteScore"]] = relationship(
        back_populates="vote", cascade="all, delete-orphan", lazy="selectin"
    )
    candidate: Mapped[User] = relationship(foreign_keys=[candidate_id], lazy="joined")


class VoteScore(Base):
    __tablename__ = "vote_scores"
    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5", name="ck_rating_range"),)

    vote_id: Mapped[int] = mapped_column(ForeignKey("votes.id", ondelete="CASCADE"), primary_key=True)
    criterion_id: Mapped[int] = mapped_column(ForeignKey("criteria.id"), primary_key=True)
    rating: Mapped[int] = mapped_column(SmallInteger)

    vote: Mapped[Vote] = relationship(back_populates="scores")


class Winner(Base):
    __tablename__ = "winners"

    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    final_score: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    evaluations: Mapped[int] = mapped_column(Integer)
    breakdown: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    citation: Mapped[str | None] = mapped_column(Text)
    override_reason: Mapped[str | None] = mapped_column(Text)
    published_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="joined")
    campaign: Mapped[Campaign] = relationship(lazy="joined")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[Any] = mapped_column(JSONB)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    old_value: Mapped[Any | None] = mapped_column(JSONB)
    new_value: Mapped[Any | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user: Mapped[User | None] = relationship(lazy="joined")
