"""
CTF Platform — User Repository
Database access layer for User and related entities.
"""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import (
    User, Role, UserSession, PasswordResetToken, EmailVerificationToken, ApiKey
)
from app.core.security import generate_secure_token, hash_password


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── User CRUD ─────────────────────────────────────────────────────────
    async def get_by_id(self, user_id: UUID | str) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.roles))
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .where(User.email == email.lower())
            .options(selectinload(User.roles))
        )
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .where(User.username == username.lower())
            .options(selectinload(User.roles))
        )
        return result.scalar_one_or_none()

    async def get_by_email_or_username(self, identifier: str) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .where(
                or_(
                    User.email == identifier.lower(),
                    User.username == identifier.lower(),
                )
            )
            .options(selectinload(User.roles))
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        email: str,
        username: str,
        hashed_password: str,
        display_name: Optional[str] = None,
    ) -> User:
        user = User(
            email=email.lower(),
            username=username.lower(),
            hashed_password=hashed_password,
            display_name=display_name or username,
        )
        self.db.add(user)
        await self.db.flush()  # get the ID without committing
        return user

    async def update_last_login(self, user_id: UUID | str) -> None:
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(last_login_at=datetime.now(timezone.utc))
        )

    async def mark_verified(self, user_id: UUID | str) -> None:
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(is_verified=True)
        )

    async def update_password(self, user_id: UUID | str, hashed_password: str) -> None:
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(hashed_password=hashed_password)
        )

    async def email_exists(self, email: str) -> bool:
        result = await self.db.execute(
            select(User.id).where(User.email == email.lower())
        )
        return result.scalar_one_or_none() is not None

    async def username_exists(self, username: str) -> bool:
        result = await self.db.execute(
            select(User.id).where(User.username == username.lower())
        )
        return result.scalar_one_or_none() is not None

    # ── Roles ─────────────────────────────────────────────────────────────
    async def get_role_by_name(self, name: str) -> Optional[Role]:
        result = await self.db.execute(select(Role).where(Role.name == name))
        return result.scalar_one_or_none()

    async def assign_role(self, user: User, role_name: str) -> None:
        role = await self.get_role_by_name(role_name)
        if role and role not in user.roles:
            user.roles.append(role)
            await self.db.flush()

    # ── Email Verification Tokens ─────────────────────────────────────────
    async def create_verification_token(self, user_id: UUID | str) -> str:
        """Create a new email verification token. Returns the raw token."""
        # Invalidate any previous tokens
        await self.db.execute(
            update(EmailVerificationToken)
            .where(EmailVerificationToken.user_id == user_id)
            .values(used_at=datetime.now(timezone.utc))
        )

        raw_token = generate_secure_token(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        token = EmailVerificationToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        self.db.add(token)
        await self.db.flush()
        return raw_token

    async def verify_email_token(self, raw_token: str) -> Optional[EmailVerificationToken]:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        result = await self.db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == token_hash,
                EmailVerificationToken.used_at.is_(None),
                EmailVerificationToken.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    async def consume_verification_token(self, token: EmailVerificationToken) -> None:
        token.used_at = datetime.now(timezone.utc)
        await self.db.flush()

    # ── Password Reset Tokens ─────────────────────────────────────────────
    async def create_reset_token(self, user_id: UUID | str) -> str:
        """Create a password reset token. Returns the raw token."""
        # Invalidate previous tokens
        await self.db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user_id)
            .values(used_at=datetime.now(timezone.utc))
        )

        raw_token = generate_secure_token(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        token = PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        self.db.add(token)
        await self.db.flush()
        return raw_token

    async def get_reset_token(self, raw_token: str) -> Optional[PasswordResetToken]:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        result = await self.db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    async def consume_reset_token(self, token: PasswordResetToken) -> None:
        token.used_at = datetime.now(timezone.utc)
        await self.db.flush()

    # ── Sessions ──────────────────────────────────────────────────────────
    async def create_session(
        self,
        user_id: UUID | str,
        token_jti: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> UserSession:
        session = UserSession(
            user_id=user_id,
            token_jti=token_jti,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def get_session_by_jti(self, jti: str) -> Optional[UserSession]:
        result = await self.db.execute(
            select(UserSession).where(
                UserSession.token_jti == jti,
                UserSession.is_revoked == False,
                UserSession.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    async def revoke_session(self, jti: str) -> None:
        await self.db.execute(
            update(UserSession)
            .where(UserSession.token_jti == jti)
            .values(is_revoked=True)
        )

    async def revoke_all_sessions(self, user_id: UUID | str) -> None:
        await self.db.execute(
            update(UserSession)
            .where(UserSession.user_id == user_id)
            .values(is_revoked=True)
        )
