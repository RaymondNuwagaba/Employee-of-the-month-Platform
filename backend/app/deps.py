from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Role, User
from app.security import read_session_token

DB = Annotated[Session, Depends(get_db)]


def get_current_user(request: Request, db: DB) -> User:
    token = request.cookies.get(get_settings().session_cookie_name)
    user_id = read_session_token(token) if token else None
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "account_inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role):
    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this area")
        return user

    return checker


StaffUser = Annotated[User, Depends(require_roles(Role.hr, Role.admin))]
AdminUser = Annotated[User, Depends(require_roles(Role.admin))]
