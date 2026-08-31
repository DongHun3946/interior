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
