"""
DayToExpense — Application Configuration
Reads all settings from environment variables / .env file with safe defaults
"""

from functools import lru_cache
from typing import List, Optional, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
ENV_FILE_PATH = (
    BACKEND_DIR / ".env" if (BACKEND_DIR / ".env").exists() else PROJECT_ROOT / ".env"
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "DayToExpense"
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    # Database — loaded strictly from backend/.env (DATABASE_URL)
    database_url: str = ""

    # JWT Authentication
    jwt_secret_key: str = "daytoexpense-dev-secret-key-change-in-production-1234567890"
    jwt_refresh_secret_key: str = (
        "daytoexpense-dev-refresh-secret-key-change-in-production-1234567890"
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS
    cors_origins: str = (
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    )

    # File Uploads
    upload_directory: str = "uploads"
    max_upload_size_mb: int = 10
    allowed_upload_extensions: str = "jpg,jpeg,png,pdf,xlsx,csv"

    # Application Defaults
    base_currency: str = "INR"
    default_timezone: str = "Asia/Kolkata"
    default_date_format: str = "DD/MM/YYYY"

    # Rate Limiting
    rate_limit_login: str = "5/minute"
    rate_limit_register: str = "3/minute"
    rate_limit_api: str = "100/minute"

    # Email (optional)
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: str = "noreply@daytoexpense.com"

    # Legacy Migration (loaded strictly from backend/.env)
    legacy_db_host: str = ""
    legacy_db_port: int = 5432
    legacy_db_name: str = ""
    legacy_db_user: str = ""
    legacy_db_password: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.cors_origins, list):
            return self.cors_origins
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() == "development"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
