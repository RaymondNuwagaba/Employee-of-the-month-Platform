"""Demo data for local development: `python -m app.seed` (wipes existing demo data first).

Creates departments, employees (one admin, one HR), published campaigns for the
earlier months of this year with votes and winners, last month closed and
awaiting publication, and an open campaign for the current month.
"""

import calendar
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select

from app import scoring
from app.db import SessionLocal
from app.models import (
    AuditLog,
    Campaign,
    CampaignStatus,
    Criterion,
    Department,
    Role,
    User,
    Vote,
    VoteScore,
    Winner,
)

DEPARTMENTS = ["Information Technology", "Finance", "Operations", "Human Resources", "Customer Service"]

PEOPLE = [
    ("Alice Mwesigwa", "Information Technology", "Systems Administrator", Role.admin),
    ("Grace Achieng", "Human Resources", "HR Manager", Role.hr),
    ("John Doe", "Information Technology", "Network Administrator", Role.employee),
    ("Mary Smith", "Finance", "Accountant", Role.employee),
    ("Peter Okello", "Operations", "Operations Officer", Role.employee),
    ("Sarah Namukasa", "Customer Service", "Customer Care Lead", Role.employee),
    ("David Kato", "Information Technology", "Software Developer", Role.employee),
    ("Esther Nakato", "Finance", "Finance Officer", Role.employee),
    ("Brian Mugisha", "Operations", "Logistics Coordinator", Role.employee),
    ("Joan Atim", "Customer Service", "Customer Care Agent", Role.employee),
    ("Moses Ssempijja", "Information Technology", "IT Support Specialist", Role.employee),
    ("Patricia Akello", "Human Resources", "HR Officer", Role.employee),
    ("Samuel Wasswa", "Operations", "Fleet Supervisor", Role.employee),
    ("Lillian Nabirye", "Finance", "Procurement Officer", Role.employee),
    ("Isaac Tumusiime", "Customer Service", "Customer Care Agent", Role.employee),
    ("Ruth Kyomuhendo", "Operations", "Stores Officer", Role.employee),
    ("Daniel Opio", "Information Technology", "Data Analyst", Role.employee),
    ("Agnes Nanyonga", "Customer Service", "Front Desk Officer", Role.employee),
]

COMMENTS = [
    "Always the first to help when systems go down, even outside their own tasks.",
    "Stayed late to help our team finish the quarterly report on time.",
    "Patient, kind and explains things clearly to new staff.",
    "Came up with a simpler way to track requests that saved us hours every week.",
    "Consistently delivers on time and keeps everyone informed.",
    "Goes out of their way to support colleagues across departments.",
    None,
    None,
    None,
]


def email_for(name: str) -> str:
    return name.lower().replace(" ", ".") + "@company.com"


def main() -> None:
    rng = random.Random(2026)
    db = SessionLocal()
    for model in (AuditLog, Winner, VoteScore, Vote, Campaign, User, Department):
        db.execute(delete(model))
    db.commit()

    depts = {name: Department(name=name) for name in DEPARTMENTS}
    db.add_all(depts.values())
    db.flush()

    users = []
    for i, (name, dept, title, role) in enumerate(PEOPLE):
        users.append(
            User(
                full_name=name,
                email=email_for(name),
                employee_id=f"EMP{i + 1:05d}",
                department_id=depts[dept].id,
                job_title=title,
                role=role,
                hire_date=date(2024, 1, 15) if i != len(PEOPLE) - 1 else date.today() - timedelta(days=10),
            )
        )
    db.add_all(users)
    db.flush()

    criteria = db.scalars(select(Criterion).order_by(Criterion.sort_order)).all()
    snapshot = scoring.snapshot_criteria(db)
    # Some people are consistently stronger, so the annual leaderboard has a story to tell.
    talent = {u.id: rng.uniform(2.8, 4.6) for u in users}

    today = datetime.now(timezone.utc)
    year = today.year
    for month in range(1, today.month + 1):
        last_day = calendar.monthrange(year, month)[1]
        is_current = month == today.month
        start = datetime(year, month, 1, 6, tzinfo=timezone.utc)
        end = (
            datetime(year, month, last_day, 20, tzinfo=timezone.utc)
            if is_current
            else datetime(year, month, 25, 20, tzinfo=timezone.utc)
        )
        c = Campaign(
            name=f"{calendar.month_name[month]} {year} Employee of the Month",
            month=month,
            year=year,
            start_at=start,
            end_at=end,
            status=CampaignStatus.open if is_current else CampaignStatus.closed,
            criteria_snapshot=snapshot,
            created_by=users[1].id,
        )
        db.add(c)
        db.flush()

        voters = [u for u in users if u.hire_date <= end.date()]
        turnout = 0.35 if is_current else rng.uniform(0.7, 0.95)
        for voter in rng.sample(voters, int(len(voters) * turnout)):
            pool = [u for u in users[:-1] if u.id != voter.id]
            weights = [talent[u.id] ** 8 for u in pool]
            candidate = rng.choices(pool, weights=weights)[0]
            base = talent[candidate.id]
            comment = rng.choice(COMMENTS)
            db.add(
                Vote(
                    campaign_id=c.id,
                    voter_id=voter.id,
                    candidate_id=candidate.id,
                    comment=comment,
                    comment_approved=None if comment is None or is_current else rng.random() > 0.15,
                    submitted_at=start + timedelta(days=rng.randint(0, 20), hours=rng.randint(0, 10)),
                    scores=[
                        VoteScore(criterion_id=cr.id, rating=max(1, min(5, round(rng.gauss(base + 0.6, 0.6)))))
                        for cr in criteria
                    ],
                )
            )
        db.flush()

        # Leave last month closed-but-unpublished so the publish flow can be tried.
        if month < today.month - 1:
            ranked = [r for r in scoring.campaign_results(db, c) if r.rank]
            if ranked:
                top = ranked[0]
                db.add(
                    Winner(
                        campaign_id=c.id,
                        user_id=top.user_id,
                        final_score=top.final_score,
                        evaluations=top.evaluations,
                        breakdown=[b.as_dict() for b in top.breakdown],
                        citation="Recognized by colleagues for exceptional teamwork, responsiveness "
                        "and contribution to solving workplace challenges.",
                        published_by=users[1].id,
                        published_at=end + timedelta(days=2),
                    )
                )
                c.status = CampaignStatus.published
    db.commit()
    print(f"Seeded {len(users)} employees and {today.month} campaigns for {year}.")
    print("Dev sign-in accounts: admin alice.mwesigwa@company.com, HR grace.achieng@company.com")


if __name__ == "__main__":
    main()
