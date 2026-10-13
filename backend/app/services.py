from datetime import timedelta

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app import app_settings
from app.models import Campaign, CampaignStatus, Role, User, Vote


def candidates_query(db: Session, campaign: Campaign) -> Select[tuple[User]]:
    """Employees who may receive votes in this campaign, per the configured eligibility rules."""
    cutoff = campaign.start_at.date() - timedelta(days=app_settings.get(db, "min_tenure_days"))
    q = select(User).where(
        User.is_active,
        User.is_eligible,
        or_(User.hire_date.is_(None), User.hire_date <= cutoff),
    )
    if not app_settings.get(db, "managers_eligible"):
        q = q.where(User.role == Role.employee)
    return q


def is_eligible_candidate(db: Session, campaign: Campaign, user_id: int) -> bool:
    return db.scalar(candidates_query(db, campaign).where(User.id == user_id)) is not None


def eligible_voter_count(db: Session) -> int:
    return db.scalar(select(func.count(User.id)).where(User.is_active)) or 0


def votes_cast(db: Session, campaign_id: int) -> int:
    return db.scalar(select(func.count(Vote.id)).where(Vote.campaign_id == campaign_id)) or 0


def current_campaign(db: Session) -> Campaign | None:
    """The campaign employees should see: an open one, else the most recent non-draft one."""
    open_campaign = db.scalar(
        select(Campaign)
        .where(Campaign.status == CampaignStatus.open)
        .order_by(Campaign.year.desc(), Campaign.month.desc())
    )
    if open_campaign:
        return open_campaign
    return db.scalar(
        select(Campaign)
        .where(Campaign.status != CampaignStatus.draft)
        .order_by(Campaign.year.desc(), Campaign.month.desc())
    )
