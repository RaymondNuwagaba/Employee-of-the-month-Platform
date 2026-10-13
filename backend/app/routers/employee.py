"""Endpoints every signed-in employee can use: campaigns, voting, winners, leaderboards."""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import app_settings, audit, scoring, services
from app.deps import DB, CurrentUser
from app.models import Campaign, CampaignStatus, Criterion, User, Vote, VoteScore, Winner, utcnow
from app.schemas import (
    AnnualRow,
    CampaignOut,
    CandidateOut,
    CriterionOut,
    MyStats,
    MyVoteOut,
    UserBrief,
    VoteIn,
    WinnerOut,
)

router = APIRouter(prefix="/api", tags=["employee"])


@router.get("/criteria", response_model=list[CriterionOut])
def list_criteria(db: DB, _: CurrentUser):
    return db.scalars(select(Criterion).where(Criterion.is_active).order_by(Criterion.sort_order)).all()


@router.get("/campaigns/current")
def current_campaign(db: DB, user: CurrentUser):
    campaign = services.current_campaign(db)
    if campaign is None:
        return {"campaign": None, "my_vote": None, "votes_cast": 0, "eligible_voters": 0}
    return {
        "campaign": CampaignOut.of(campaign),
        "my_vote": _my_vote(db, campaign.id, user.id),
        "votes_cast": services.votes_cast(db, campaign.id),
        "eligible_voters": services.eligible_voter_count(db),
    }


@router.get("/campaigns/{campaign_id}/candidates", response_model=list[CandidateOut])
def candidates(campaign_id: int, db: DB, user: CurrentUser):
    campaign = _get_campaign(db, campaign_id)
    q = services.candidates_query(db, campaign).where(User.id != user.id).order_by(User.full_name)
    return [CandidateOut(**UserBrief.of(u).model_dump()) for u in db.scalars(q).unique()]


@router.post("/votes", response_model=MyVoteOut, status_code=status.HTTP_201_CREATED)
def submit_vote(body: VoteIn, request: Request, db: DB, user: CurrentUser):
    campaign = _get_campaign(db, body.campaign_id)
    if not campaign.is_voting_open:
        raise HTTPException(status.HTTP_409_CONFLICT, "Voting for this campaign is not open.")
    if body.candidate_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot vote for yourself.")
    if not services.is_eligible_candidate(db, campaign, body.candidate_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That colleague is not eligible this month.")

    criteria_ids = {c["id"] for c in scoring.criteria_for_campaign(db, campaign)}
    if set(body.ratings) != criteria_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please rate every criterion.")

    comment = (body.comment or "").strip() or None
    approved = None
    if comment and not app_settings.get(db, "comments_require_approval"):
        approved = True
    vote = Vote(
        campaign_id=campaign.id,
        voter_id=user.id,
        candidate_id=body.candidate_id,
        comment=comment,
        comment_approved=approved,
        scores=[VoteScore(criterion_id=cid, rating=r) for cid, r in body.ratings.items()],
    )
    db.add(vote)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already voted in this campaign.")
    # Who-voted-for-whom stays out of the audit log; the vote row itself is the secure record.
    audit.record(db, "vote_submitted", user=user, entity="campaign", entity_id=campaign.id, request=request)
    db.commit()
    return _my_vote(db, campaign.id, user.id)


@router.get("/winners", response_model=list[WinnerOut])
def winners(db: DB, _: CurrentUser, year: int | None = None):
    q = select(Winner).join(Winner.campaign)
    if year:
        q = q.where(Campaign.year == year)
    rows = db.scalars(q.order_by(Campaign.year.desc(), Campaign.month.desc())).unique().all()
    return [_winner_out(db, w) for w in rows]


@router.get("/winners/{campaign_id}", response_model=WinnerOut)
def winner(campaign_id: int, db: DB, _: CurrentUser):
    w = db.get(Winner, campaign_id)
    if w is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No winner has been announced for this month yet.")
    return _winner_out(db, w)


@router.get("/leaderboard/annual", response_model=list[AnnualRow])
def annual(db: DB, _: CurrentUser, year: int | None = None):
    return annual_rows(db, year or utcnow().year)


def annual_rows(db: DB, year: int) -> list[AnnualRow]:
    entries = scoring.annual_leaderboard(db, year)
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_([e.user_id for e in entries]))).unique()}
    return [
        AnnualRow(
            rank=i + 1,
            user=UserBrief.of(users[e.user_id]),
            annual_score=float(e.annual_score),
            months_counted=e.months_counted,
            months_recognized=e.months_recognized,
            monthly_wins=e.monthly_wins,
            nominations=e.nominations,
            best_score=float(e.best_score),
            average_when_nominated=float(e.average_when_nominated),
            monthly=e.monthly,
        )
        for i, e in enumerate(entries)
    ]


@router.get("/employees/{user_id}/stats", response_model=MyStats)
def employee_stats(user_id: int, db: DB, _: CurrentUser, year: int | None = None):
    if db.get(User, user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return _stats(db, user_id, year or utcnow().year)


@router.get("/employees/{user_id}", response_model=UserBrief)
def employee(user_id: int, db: DB, _: CurrentUser):
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return UserBrief.of(u)


# ---------- helpers ----------


def _get_campaign(db: DB, campaign_id: int) -> Campaign:
    c = db.get(Campaign, campaign_id)
    if c is None or c.status == CampaignStatus.draft:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return c


def _my_vote(db: DB, campaign_id: int, user_id: int) -> MyVoteOut | None:
    v = db.scalar(select(Vote).where(Vote.campaign_id == campaign_id, Vote.voter_id == user_id))
    if v is None:
        return None
    return MyVoteOut(
        campaign_id=campaign_id,
        candidate=UserBrief.of(v.candidate),
        ratings={s.criterion_id: s.rating for s in v.scores},
        comment=v.comment,
        submitted_at=v.submitted_at,
    )


def _winner_out(db: DB, w: Winner) -> WinnerOut:
    comments = db.scalars(
        select(Vote.comment)
        .where(Vote.campaign_id == w.campaign_id, Vote.candidate_id == w.user_id, Vote.comment_approved.is_(True))
        .order_by(Vote.submitted_at)
        .limit(6)
    ).all()
    c = w.campaign
    return WinnerOut(
        campaign_id=c.id,
        campaign_name=c.name,
        month=c.month,
        year=c.year,
        user=UserBrief.of(w.user),
        final_score=float(w.final_score),
        evaluations=w.evaluations,
        breakdown=w.breakdown,
        citation=w.citation,
        comments=list(comments),
        published_at=w.published_at,
    )


BADGE_RULES = [
    ("supporting", 90, "Most Supportive"),
    ("timeliness", 90, "Timeliness Champion"),
    ("interpersonal", 90, "Team Player"),
    ("innovation", 90, "Innovation Champion"),
]


def _stats(db: DB, user_id: int, year: int) -> MyStats:
    rows = annual_rows(db, year)
    mine = next((r for r in rows if r.user.id == user_id), None)
    wins = db.scalars(
        select(Winner).join(Winner.campaign).where(Winner.user_id == user_id).order_by(Campaign.year, Campaign.month)
    ).unique().all()

    badges: list[str] = []
    if wins:
        badges.append("Employee of the Month")
    for w in wins:
        for item in w.breakdown:
            for key, threshold, label in BADGE_RULES:
                if item["key"] == key and item["percent"] >= threshold and label not in badges:
                    badges.append(label)
    if mine:
        streak = best = 0
        for m in mine.monthly:
            streak = streak + 1 if m["qualified"] else 0
            best = max(best, streak)
        if best >= 3:
            badges.append(f"{best}-Month Recognition Streak")

    history = [
        {
            "campaign_id": m["campaign_id"],
            "month": m["month"],
            "year": year,
            "score": m["raw_score"],
            "evaluations": m["evaluations"],
            "rank": m["rank"],
            "won": m["won"],
        }
        for m in (mine.monthly if mine else [])
    ]
    return MyStats(
        year=year,
        nominations=mine.nominations if mine else 0,
        monthly_wins=sum(1 for w in wins if w.campaign.year == year),
        annual_score=mine.annual_score if mine else None,
        annual_rank=mine.rank if mine else None,
        best_score=mine.best_score if mine else None,
        badges=badges,
        history=history,
    )
