from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "Interior Studio API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg2://interior:interior@127.0.0.1:5432/interior"
    database_host: str = ""
    database_port: int = 5432
    database_name: str = "interior"
    database_user: str = "interior"
    database_password: str = "interior"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173"
    admin_login_id: str = "admin"
    admin_password: str = "admin1234!"
    management_overview_password: str = ""
    log_level: str = "INFO"
    request_log_enabled: bool = True
    log_health_checks: bool = False
    storage_backend: Literal["local", "r2"] = "local"
    storage_prefix: str = ""
    media_dir: str = "media"
    max_upload_size: int = 15 * 1024 * 1024
    max_scan_upload_size: int = 500 * 1024 * 1024
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_base_url: str = ""
    naver_maps_client_id: str = ""
    naver_maps_client_secret: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    def validate_production_security(self) -> None:
        if not self.is_production:
            return

        errors: list[str] = []
        if "CHANGE_ME" in self.secret_key.upper() or len(self.secret_key) < 32:
            errors.append("SECRET_KEY must be a random value of at least 32 characters")
        if "CHANGE_ME" in self.database_password.upper() or len(self.database_password) < 16:
            errors.append("DATABASE_PASSWORD must be at least 16 characters")
        admin_password_bytes = self.admin_password.encode("utf-8")
        if "CHANGE_ME" in self.admin_password.upper() or len(admin_password_bytes) < 12:
            errors.append("ADMIN_PASSWORD must be at least 12 bytes")
        if len(admin_password_bytes) > 72:
            errors.append("ADMIN_PASSWORD must not exceed 72 bytes")
        if self.management_overview_password:
            overview_password_bytes = self.management_overview_password.encode("utf-8")
            if len(overview_password_bytes) < 12:
                errors.append("MANAGEMENT_OVERVIEW_PASSWORD must be at least 12 bytes")
        origins = self.cors_origin_list
        if not origins or "*" in origins:
            errors.append("CORS_ORIGINS must contain explicit HTTPS origins")
        elif any(not origin.startswith("https://") for origin in origins):
            errors.append("Every production CORS origin must use HTTPS")
        if self.uses_r2 and not self.r2_public_base_url.startswith("https://"):
            errors.append("R2_PUBLIC_BASE_URL must use HTTPS")
        if len({self.secret_key, self.database_password, self.admin_password}) < 3:
            errors.append("SECRET_KEY, DATABASE_PASSWORD, and ADMIN_PASSWORD must be different")

        if errors:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(errors))

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def uses_r2(self) -> bool:
        return self.storage_backend == "r2"

    @property
    def r2_endpoint_url(self) -> str:
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
