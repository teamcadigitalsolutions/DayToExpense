"""
DayToExpense — Application Configuration
Reads all settings from environment variables / .env file with safe defaults
"""
from functools import lru_cache
from typing import List, Optional, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = PROJECT_ROOT / "daytoexpense.db"
# Use forward slashes for SQLAlchemy compatibility on Windows
DEFAULT_MYSQL_URL = "mysql+pymysql://admin:admin%40123@127.0.0.1:3307/daytodayexpenses"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "DayToExpense"
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    # Database (MySQL Workbench: 127.0.0.1:3307 / daytodayexpenses / admin / admin@123)
    database_url: str = DEFAULT_MYSQL_URL

    # JWT Authentication
    jwt_secret_key: str = "daytoexpense-dev-secret-key-change-in-production-1234567890"
    jwt_refresh_secret_key: str = "daytoexpense-dev-refresh-secret-key-change-in-production-1234567890"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

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

    # Legacy Migration (MySQL Workbench settings)
    legacy_db_host: str = "127.0.0.1"
    legacy_db_port: int = 3307
    legacy_db_name: str = "daytodayexpenses"
    legacy_db_user: str = "admin"
    legacy_db_password: str = "admin@123"

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.cors_origins, list):
            return self.cors_origins
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

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
