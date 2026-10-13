from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog, User


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def record(
    db: Session,
    action: str,
    *,
    user: User | None = None,
    entity: str | None = None,
    entity_id: Any = None,
    old: Any = None,
    new: Any = None,
    request: Request | None = None,
) -> None:
    """Add an audit entry to the current transaction (committed with the change it describes)."""
    db.add(
        AuditLog(
            user_id=user.id if user else None,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            old_value=old,
            new_value=new,
            ip_address=client_ip(request),
        )
    )
