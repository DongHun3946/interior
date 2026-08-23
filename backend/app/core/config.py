from functools import lru_cache
from pathlib import Path

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
    media_dir: str = "media"
    max_upload_size: int = 15 * 1024 * 1024
    max_scan_upload_size: int = 500 * 1024 * 1024
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
