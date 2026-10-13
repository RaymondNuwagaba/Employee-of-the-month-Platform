"""Microsoft Entra ID token validation and application session handling.

The SPA signs the user in with Microsoft (MSAL), then posts the ID token here.
We validate it against Entra's published signing keys, provision/update the
local user (just-in-time), and issue our own short-lived session in an
httpOnly cookie. Microsoft passwords never touch this application.
"""

from datetime import timedelta
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient

from app.config import get_settings
from app.models import Role, utcnow

_jwks_clients: dict[str, PyJWKClient] = {}


class AuthError(Exception):
    def __init__(self, code: str):
        self.code = code


def _jwks_client(tenant_id: str) -> PyJWKClient:
    if tenant_id not in _jwks_clients:
        _jwks_clients[tenant_id] = PyJWKClient(
            f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys",
            cache_keys=True,
            lifespan=3600,
        )
    return _jwks_clients[tenant_id]


def validate_entra_id_token(id_token: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.entra_enabled:
        raise AuthError("sso_not_configured")
    try:
        signing_key = _jwks_client(settings.entra_tenant_id).get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.entra_client_id,
            issuer=f"https://login.microsoftonline.com/{settings.entra_tenant_id}/v2.0",
            options={"require": ["exp", "iat", "aud", "iss", "oid"]},
        )
    except jwt.PyJWTError as exc:
        raise AuthError("invalid_token") from exc
    if claims.get("tid") != settings.entra_tenant_id:
        raise AuthError("invalid_token")
    return claims


def fetch_graph_profile(graph_token: str, expected_oid: str) -> dict[str, Any]:
    """Directory attributes (department, job title, employee ID) that the ID token lacks."""
    try:
        resp = httpx.get(
            "https://graph.microsoft.com/v1.0/me",
            params={"$select": "id,displayName,mail,userPrincipalName,department,jobTitle,employeeId,accountEnabled"},
            headers={"Authorization": f"Bearer {graph_token}"},
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPError:
        return {}
    profile = resp.json()
    # The Graph token is not issued for us, so only trust it if it describes the same person.
    return profile if profile.get("id") == expected_oid else {}


def role_from_claims(claims: dict[str, Any]) -> Role | None:
    """Map Entra groups (or app roles) to an application role. None = mapping not configured."""
    settings = get_settings()
    groups = set(claims.get("groups") or [])
    app_roles = set(claims.get("roles") or [])
    configured = any([settings.entra_group_admin, settings.entra_group_hr, settings.entra_group_employee])
    if settings.entra_group_admin and settings.entra_group_admin in groups or "EOTM.Admin" in app_roles:
        return Role.admin
    if settings.entra_group_hr and settings.entra_group_hr in groups or "EOTM.HR" in app_roles:
        return Role.hr
    if not configured and not app_roles:
        return None
    if settings.entra_group_employee and settings.entra_group_employee not in groups and "EOTM.Employee" not in app_roles:
        raise AuthError("unauthorized")
    return Role.employee


def create_session_token(user_id: int) -> str:
    settings = get_settings()
    now = utcnow()
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=settings.session_ttl_minutes)}
    return jwt.encode(payload, settings.session_secret, algorithm="HS256")


def read_session_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, get_settings().session_secret, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
