"""Weighted scoring engine.

Monthly score for a candidate:
    sum over criteria of (average rating / 5) * weight      -> 0..100

Ranking tie-break: final score, then per-criterion average in order of
descending weight (Supporting Others, Timeliness, Interpersonal, Innovation
with the default weights), then number of evaluations. Anything still tied
is flagged for documented HR review.

Annual score for an employee:
    sum of monthly scores / number of published months they were employed for
Months where they received fewer than `min_evaluations` evaluations count as 0,
so the annual award favours consistent excellence over one strong month.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import app_settings
from app.models import Campaign, CampaignStatus, Criterion, User, Vote, VoteScore, Winner

MAX_RATING = Decimal(5)
TWO_PLACES = Decimal("0.01")


def q2(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


@dataclass
class CriterionResult:
    criterion_id: int
    key: str
    name: str
    weight: Decimal
    average_rating: Decimal
    percent: Decimal  # average rating as % of max
    contribution: Decimal  # weighted points toward the final score

    def as_dict(self) -> dict[str, Any]:
        return {
            "criterion_id": self.criterion_id,
            "key": self.key,
            "name": self.name,
            "weight": float(self.weight),
            "average_rating": float(self.average_rating),
            "percent": float(self.percent),
            "contribution": float(self.contribution),
        }


@dataclass
class CandidateResult:
    user_id: int
    evaluations: int
    final_score: Decimal
    breakdown: list[CriterionResult]
    qualified: bool = True
    rank: int | None = None
    tied_with_next: bool = False
    sort_key: tuple = field(default=(), repr=False)


def criteria_for_campaign(db: Session, campaign: Campaign) -> list[dict[str, Any]]:
    """Frozen criteria if voting has opened, otherwise the live configuration."""
    if campaign.criteria_snapshot:
        return campaign.criteria_snapshot
    return snapshot_criteria(db)


def snapshot_criteria(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(Criterion).where(Criterion.is_active).order_by(Criterion.sort_order)
    ).all()
    return [
        {"id": c.id, "key": c.key, "name": c.name, "weight": str(c.weight), "sort_order": c.sort_order}
        for c in rows
    ]


def rank_candidates(
    criteria: list[dict[str, Any]],
    averages: dict[int, dict[int, Decimal]],
    counts: dict[int, int],
    min_evaluations: int = 1,
) -> list[CandidateResult]:
    """Pure scoring/ranking: `averages[user_id][criterion_id]` is the mean rating."""
    ordered = sorted(criteria, key=lambda c: (-Decimal(str(c["weight"])), c.get("sort_order", 0)))
    results: list[CandidateResult] = []
    for user_id, per_criterion in averages.items():
        breakdown = []
        total = Decimal(0)
        for c in criteria:
            weight = Decimal(str(c["weight"]))
            avg = Decimal(per_criterion.get(c["id"], 0))
            contribution = avg / MAX_RATING * weight
            total += contribution
            breakdown.append(
                CriterionResult(
                    criterion_id=c["id"],
                    key=c["key"],
                    name=c["name"],
                    weight=weight,
                    average_rating=q2(avg),
                    percent=q2(avg / MAX_RATING * 100),
                    contribution=q2(contribution),
                )
            )
        final = q2(total)
        tie_break = tuple(q2(Decimal(per_criterion.get(c["id"], 0))) for c in ordered)
        results.append(
            CandidateResult(
                user_id=user_id,
                evaluations=counts.get(user_id, 0),
                final_score=final,
                breakdown=breakdown,
                qualified=counts.get(user_id, 0) >= min_evaluations,
                sort_key=(final, *tie_break, counts.get(user_id, 0)),
            )
        )

    results.sort(key=lambda r: (r.qualified, r.sort_key), reverse=True)
    rank = 0
    for i, r in enumerate(results):
        if not r.qualified:
            continue
        rank += 1
        r.rank = rank
        nxt = results[i + 1] if i + 1 < len(results) else None
        r.tied_with_next = bool(nxt and nxt.qualified and nxt.sort_key == r.sort_key)
    return results


def campaign_results(db: Session, campaign: Campaign) -> list[CandidateResult]:
    criteria = criteria_for_campaign(db, campaign)
    rows = db.execute(
        select(Vote.candidate_id, VoteScore.criterion_id, func.avg(VoteScore.rating))
        .join(VoteScore, VoteScore.vote_id == Vote.id)
        .where(Vote.campaign_id == campaign.id)
        .group_by(Vote.candidate_id, VoteScore.criterion_id)
    ).all()
    counts = dict(
        db.execute(
            select(Vote.candidate_id, func.count(Vote.id))
            .where(Vote.campaign_id == campaign.id)
            .group_by(Vote.candidate_id)
        ).all()
    )
    averages: dict[int, dict[int, Decimal]] = defaultdict(dict)
    for candidate_id, criterion_id, avg in rows:
        averages[candidate_id][criterion_id] = Decimal(avg)
    min_eval = app_settings.get(db, "min_evaluations")
    return rank_candidates(criteria, averages, counts, min_eval)


@dataclass
class AnnualEntry:
    user_id: int
    annual_score: Decimal
    months_counted: int
    months_recognized: int
    monthly_wins: int
    nominations: int
    best_score: Decimal
    average_when_nominated: Decimal
    monthly: list[dict[str, Any]]


def annual_leaderboard(db: Session, year: int) -> list[AnnualEntry]:
    campaigns = db.scalars(
        select(Campaign)
        .where(Campaign.year == year, Campaign.status == CampaignStatus.published)
        .order_by(Campaign.month)
    ).all()
    if not campaigns:
        return []


    winners = {
        w.campaign_id: w.user_id
        for w in db.scalars(select(Winner).where(Winner.campaign_id.in_([c.id for c in campaigns])))
    }
    monthly: dict[int, list[dict[str, Any]]] = defaultdict(list)
    nominations: dict[int, int] = defaultdict(int)
    for c in campaigns:
        for r in campaign_results(db, c):
            nominations[r.user_id] += r.evaluations
            monthly[r.user_id].append(
                {
                    "campaign_id": c.id,
                    "month": c.month,
                    "score": float(r.final_score) if r.qualified else 0.0,
                    "raw_score": float(r.final_score),
                    "evaluations": r.evaluations,
                    "qualified": r.qualified,
                    "rank": r.rank,
                    "won": winners.get(c.id) == r.user_id,
                }
            )

    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(list(monthly))))}
    entries: list[AnnualEntry] = []
    for user_id, months in monthly.items():
        user = users[user_id]
        months_employed = sum(1 for c in campaigns if _employed_during(user.hire_date, c))
        denominator = max(months_employed, len(months), 1)
        total = sum(Decimal(str(m["score"])) for m in months)
        qualified = [Decimal(str(m["score"])) for m in months if m["qualified"]]
        entries.append(
            AnnualEntry(
                user_id=user_id,
                annual_score=q2(total / denominator),
                months_counted=denominator,
                months_recognized=len(qualified),
                monthly_wins=sum(1 for m in months if m["won"]),
                nominations=nominations[user_id],
                best_score=max(qualified, default=Decimal(0)),
                average_when_nominated=q2(sum(qualified) / len(qualified)) if qualified else Decimal(0),
                monthly=months,
            )
        )
    entries.sort(
        key=lambda e: (e.annual_score, e.monthly_wins, e.average_when_nominated, e.nominations),
        reverse=True,
    )
    return entries


def _employed_during(hire_date: date | None, campaign: Campaign) -> bool:
    return hire_date is None or hire_date <= campaign.end_at.date()
