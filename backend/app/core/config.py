"""
CTF Platform — Application Configuration
"""
from functools import lru_cache
from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────
    APP_ENV: Literal["development", "production", "testing"] = "development"
    APP_NAME: str = "CTF Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"

    # ── URLs ─────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    # ── Database (MongoDB) ───────────────────────────────────
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "ctf_platform"
    DATABASE_URL: Optional[str] = None

    @property
    def mongo_uri(self) -> str:
        if self.DATABASE_URL and (self.DATABASE_URL.startswith("mongodb://") or self.DATABASE_URL.startswith("mongodb+srv://")):
            return self.DATABASE_URL
        return self.MONGODB_URL

    # ── JWT ──────────────────────────────────────────────────
    JWT_SECRET: str = "CHANGE_ME_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Email (Resend) ───────────────────────────────────────
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "onboarding@resend.dev"
    RESEND_FROM_NAME: str = "CTF Platform"

    # ── Storage ──────────────────────────────────────────────
    STORAGE_PROVIDER: Literal["local", "s3"] = "s3"
    LOCAL_STORAGE_PATH: str = "./storage_files"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-2"
    AWS_S3_BUCKET: Optional[str] = None
    AWS_S3_ENDPOINT_URL: Optional[str] = None

    # ── Rate Limiting ────────────────────────────────────────
    RATE_LIMIT_ENABLED: bool = True
    LOGIN_RATE_LIMIT: str = "10/15minutes"
    SUBMISSION_RATE_LIMIT: str = "10/minute"
    PASSWORD_RESET_RATE_LIMIT: str = "5/hour"

    # ── Security ─────────────────────────────────────────────
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # ── Superadmin Seed ──────────────────────────────────────
    SUPERADMIN_EMAIL: str = "admin@example.com"
    SUPERADMIN_USERNAME: str = "superadmin"
    SUPERADMIN_PASSWORD: str = "CHANGE_ME_STRONG_PASSWORD"

    # ── Postgres (Docker) ────────────────────────────────────
    POSTGRES_USER: str = "ctf_user"
    POSTGRES_PASSWORD: str = "ctf_password"
    POSTGRES_DB: str = "ctf_platform"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
