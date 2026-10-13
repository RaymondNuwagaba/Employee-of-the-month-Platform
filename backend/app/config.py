from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEV_SESSION_SECRET = "change-me-in-production-please-use-a-long-random-string"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://localhost:5432/eotm"

    # Application session (issued after Microsoft sign-in succeeds)
    session_secret: str = DEV_SESSION_SECRET
    session_ttl_minutes: int = 480
    session_cookie_name: str = "eotm_session"
    cookie_secure: bool = False  # set True behind HTTPS

    # Microsoft Entra ID (OpenID Connect)
    entra_tenant_id: str = ""
    entra_client_id: str = ""
    # Entra group object IDs mapped to application roles
    entra_group_admin: str = ""
    entra_group_hr: str = ""
    entra_group_employee: str = ""  # if set, only members of this group (or HR/admin) may sign in

    # Development-only login that bypasses Microsoft. NEVER enable in production.
    auth_dev_mode: bool = False

    cors_origins: list[str] = ["http://localhost:5173"]

    @model_validator(mode="after")
    def _production_safety(self) -> "Settings":
        # COOKIE_SECURE=true means we are served over HTTPS, i.e. a real deployment.
        if self.cookie_secure:
            if self.auth_dev_mode:
                raise ValueError("AUTH_DEV_MODE must be false when COOKIE_SECURE=true (production)")
            if self.session_secret == DEV_SESSION_SECRET or len(self.session_secret) < 32:
                raise ValueError("SESSION_SECRET must be a random value of at least 32 characters in production")
        return self

    @property
    def entra_enabled(self) -> bool:
        return bool(self.entra_tenant_id and self.entra_client_id)


@lru_cache
def get_settings() -> Settings:
    return Settings()
