from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app import audit
from app.config import get_settings
from app.deps import DB, CurrentUser
from app.models import Department, User, utcnow
from app.schemas import UserOut
from app.security import (
    AuthError,
    create_session_token,
    fetch_graph_profile,
    role_from_claims,
    validate_entra_id_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Messages shown to employees; technical details are never exposed.
AUTH_MESSAGES = {
    "unauthorized": "Your organizational account is not authorized to access this platform. "
    "Please contact HR or the system administrator.",
    "account_inactive": "Your organizational account is currently inactive. "
    "Please contact your organization's IT department.",
    "invalid_token": "We could not authenticate your organizational account. Please try again.",
    "account_conflict": "This email is already linked to a different Microsoft account. Please contact HR.",
    "sso_not_configured": "Microsoft sign-in has not been configured yet. Please contact the system administrator.",
}


class MicrosoftLogin(BaseModel):
    id_token: str
    graph_token: str | None = None


class DevLogin(BaseModel):
    email: str


def _start_session(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.session_cookie_name,
        create_session_token(user.id),
        max_age=settings.session_ttl_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _fail(code: str, http_status: int = status.HTTP_401_UNAUTHORIZED):
    raise HTTPException(http_status, {"code": code, "message": AUTH_MESSAGES[code]})


@router.get("/config")
def auth_config():
    s = get_settings()
    return {
        "sso_enabled": s.entra_enabled,
        "tenant_id": s.entra_tenant_id or None,
        "client_id": s.entra_client_id or None,
        "dev_mode": s.auth_dev_mode,
    }


@router.post("/microsoft", response_model=UserOut)
def microsoft_login(body: MicrosoftLogin, request: Request, response: Response, db: DB):
    try:
        claims = validate_entra_id_token(body.id_token)
        role = role_from_claims(claims)
    except AuthError as e:
        _fail(e.code, status.HTTP_403_FORBIDDEN if e.code == "unauthorized" else status.HTTP_401_UNAUTHORIZED)

    oid = claims["oid"]
    profile = fetch_graph_profile(body.graph_token, oid) if body.graph_token else {}
    if profile.get("accountEnabled") is False:
        _fail("account_inactive", status.HTTP_403_FORBIDDEN)

    email = (profile.get("mail") or claims.get("email") or claims.get("preferred_username") or "").lower()
    if not email:
        _fail("invalid_token")

    # Just-in-time provisioning: match by Entra object ID, then by email (records an admin pre-created).
    # The email fallback only claims records not yet linked to a Microsoft account.
    user = db.scalar(select(User).where(User.entra_object_id == oid)) or db.scalar(
        select(User).where(User.email == email, User.entra_object_id.is_(None))
    )
    is_new = user is None
    if user is None:
        if db.scalar(select(User.id).where(User.email == email)):
            # Email belongs to a different Microsoft account (e.g. a reused mailbox). HR must resolve it.
            _fail("account_conflict", status.HTTP_409_CONFLICT)
        user = User(email=email, full_name=claims.get("name") or email)
        db.add(user)
    elif not user.is_active:
        _fail("account_inactive", status.HTTP_403_FORBIDDEN)

    user.entra_object_id = oid
    user.email = email
    user.full_name = profile.get("displayName") or claims.get("name") or user.full_name
    if profile.get("jobTitle"):
        user.job_title = profile["jobTitle"]
    if profile.get("employeeId"):
        user.employee_id = profile["employeeId"]
    if profile.get("department"):
        dept = db.scalar(select(Department).where(Department.name == profile["department"]))
        if dept is None:
            dept = Department(name=profile["department"])
            db.add(dept)
            db.flush()
        user.department_id = dept.id
    if role is not None and role != user.role:
        if not is_new:
            audit.record(db, "role_changed", user=user, entity="user", entity_id=user.id,
                         old=user.role.value, new=role.value, request=request)
        user.role = role
    user.last_login_at = utcnow()
    db.flush()
    audit.record(db, "employee_created" if is_new else "login", user=user, entity="user",
                 entity_id=user.id, request=request)
    db.commit()
    _start_session(response, user)
    return UserOut.of(user)


@router.get("/dev-users", response_model=list[UserOut])
def dev_users(db: DB):
    if not get_settings().auth_dev_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    users = db.scalars(select(User).where(User.is_active).order_by(User.role.desc(), User.full_name)).all()
    return [UserOut.of(u) for u in users]


@router.post("/dev-login", response_model=UserOut)
def dev_login(body: DevLogin, request: Request, response: Response, db: DB):
    if not get_settings().auth_dev_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None:
        _fail("unauthorized", status.HTTP_403_FORBIDDEN)
    if not user.is_active:
        _fail("account_inactive", status.HTTP_403_FORBIDDEN)
    user.last_login_at = utcnow()
    audit.record(db, "login", user=user, entity="user", entity_id=user.id,
                 new={"method": "dev"}, request=request)
    db.commit()
    _start_session(response, user)
    return UserOut.of(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(get_settings().session_cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return UserOut.of(user)
