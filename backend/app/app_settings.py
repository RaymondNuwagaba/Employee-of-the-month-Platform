"""Admin-configurable business rules, stored in the app_settings table."""

from typing import Any

from sqlalchemy.orm import Session

from app.models import AppSetting

DEFAULTS: dict[str, Any] = {
    # Employees must have been hired at least this many days before voting opens to receive votes
    "min_tenure_days": 30,
    # Candidates need at least this many evaluations to be ranked / win the month
    "min_evaluations": 3,
    # Recognition comments are hidden from the public until HR approves them
    "comments_require_approval": True,
    # HR/management users may also be voted for
    "managers_eligible": True,
}


def get(db: Session, key: str) -> Any:
    row = db.get(AppSetting, key)
    return row.value if row is not None else DEFAULTS[key]


def get_all(db: Session) -> dict[str, Any]:
    return {key: get(db, key) for key in DEFAULTS}


def set_value(db: Session, key: str, value: Any) -> None:
    if key not in DEFAULTS:
        raise KeyError(key)
    row = db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=value))
    else:
        row.value = value
