"""
CTF Platform — Beanie Models: User, Role, Session, Tokens, API Keys
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from beanie import Document, Indexed
from pydantic import Field


class Role(Document):
    name: Indexed(str, unique=True)
    description: Optional[str] = None
    permissions: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "roles"

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


class User(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    email: Indexed(str, unique=True)
    username: Indexed(str, unique=True)
    display_name: Optional[str] = None
    hashed_password: str
    avatar_url: Optional[str] = None
    country: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None

    # Account state
    is_active: bool = True
    is_verified: bool = False

    # 2FA
    totp_secret: Optional[str] = None
    totp_enabled: bool = False
    backup_codes: Optional[List[str]] = None

    # Roles assigned to user
    roles: List[str] = ["participant"]

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login_at: Optional[datetime] = None

    class Settings:
        name = "users"

    @property
    def role_names(self) -> set[str]:
        return set(self.roles)

    def has_role(self, *role_names: str) -> bool:
        return bool(self.role_names.intersection(role_names))

    def __repr__(self) -> str:
        return f"<User {self.username}>"


class UserSession(Document):
    """Tracks active refresh token sessions for revocation support."""
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    user_id: uuid.UUID
    token_jti: Indexed(str, unique=True)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_revoked: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime

    class Settings:
        name = "sessions"


class PasswordResetToken(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    user_id: uuid.UUID
    token_hash: Indexed(str, unique=True)
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "password_reset_tokens"


class EmailVerificationToken(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    user_id: uuid.UUID
    token_hash: Indexed(str, unique=True)
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "email_verification_tokens"


class ApiKey(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    user_id: uuid.UUID
    name: str
    key_hash: Indexed(str, unique=True)
    key_prefix: str
    scopes: Optional[List[str]] = None
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "api_keys"
