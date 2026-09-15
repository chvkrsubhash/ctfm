"""
CTF Platform — User Repository (MongoDB / Beanie)
Database access layer for User and related entities.
"""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Union
from uuid import UUID

from app.models.user import (
    User, Role, UserSession, PasswordResetToken, EmailVerificationToken, ApiKey
)
from app.core.security import generate_secure_token


def _to_uuid(val: Union[UUID, str]) -> UUID:
    if isinstance(val, UUID):
        return val
    return UUID(str(val))


class UserRepository:
    def __init__(self, db=None):
        self.db = db

    # ── User CRUD ─────────────────────────────────────────────────────────
    async def get_by_id(self, user_id: Union[UUID, str]) -> Optional[User]:
        uid = _to_uuid(user_id)
        return await User.get(uid)

    async def get_by_email(self, email: str) -> Optional[User]:
        return await User.find_one(User.email == email.lower())

    async def get_by_username(self, username: str) -> Optional[User]:
        return await User.find_one(User.username == username.lower())

    async def get_by_email_or_username(self, identifier: str) -> Optional[User]:
        ident = identifier.lower()
        return await User.find_one({"$or": [{"email": ident}, {"username": ident}]})

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
            roles=["participant"],
        )
        await user.insert()
        return user

    async def update_last_login(self, user_id: Union[UUID, str]) -> None:
        uid = _to_uuid(user_id)
        user = await User.get(uid)
        if user:
            user.last_login_at = datetime.now(timezone.utc)
            await user.save()

    async def mark_verified(self, user_id: Union[UUID, str]) -> None:
        uid = _to_uuid(user_id)
        user = await User.get(uid)
        if user:
            user.is_verified = True
            await user.save()

    async def update_password(self, user_id: Union[UUID, str], hashed_password: str) -> None:
        uid = _to_uuid(user_id)
        user = await User.get(uid)
        if user:
            user.hashed_password = hashed_password
            await user.save()

    async def email_exists(self, email: str) -> bool:
        user = await User.find_one(User.email == email.lower())
        return user is not None

    async def username_exists(self, username: str) -> bool:
        user = await User.find_one(User.username == username.lower())
        return user is not None

    # ── Roles ─────────────────────────────────────────────────────────────
    async def get_role_by_name(self, name: str) -> Optional[Role]:
        return await Role.find_one(Role.name == name)

    async def assign_role(self, user: User, role_name: str) -> None:
        if role_name not in user.roles:
            user.roles.append(role_name)
            await user.save()

    # ── Email Verification Tokens ─────────────────────────────────────────
    async def create_verification_token(self, user_id: Union[UUID, str]) -> str:
        uid = _to_uuid(user_id)
        # Invalidate previous tokens
        await EmailVerificationToken.find(EmailVerificationToken.user_id == uid).update(
            {"$set": {"used_at": datetime.now(timezone.utc)}}
        )

        raw_token = generate_secure_token(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        token = EmailVerificationToken(
            user_id=uid,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        await token.insert()
        return raw_token

    async def verify_email_token(self, raw_token: str) -> Optional[EmailVerificationToken]:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        now = datetime.now(timezone.utc)
        return await EmailVerificationToken.find_one({
            "token_hash": token_hash,
            "used_at": None,
            "expires_at": {"$gt": now},
        })

    async def consume_verification_token(self, token: EmailVerificationToken) -> None:
        token.used_at = datetime.now(timezone.utc)
        await token.save()

    # ── Password Reset Tokens ─────────────────────────────────────────────
    async def create_reset_token(self, user_id: Union[UUID, str]) -> str:
        uid = _to_uuid(user_id)
        # Invalidate previous tokens
        await PasswordResetToken.find(PasswordResetToken.user_id == uid).update(
            {"$set": {"used_at": datetime.now(timezone.utc)}}
        )

        raw_token = generate_secure_token(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        token = PasswordResetToken(
            user_id=uid,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        await token.insert()
        return raw_token

    async def get_reset_token(self, raw_token: str) -> Optional[PasswordResetToken]:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        now = datetime.now(timezone.utc)
        return await PasswordResetToken.find_one({
            "token_hash": token_hash,
            "used_at": None,
            "expires_at": {"$gt": now},
        })

    async def consume_reset_token(self, token: PasswordResetToken) -> None:
        token.used_at = datetime.now(timezone.utc)
        await token.save()

    # ── Sessions ──────────────────────────────────────────────────────────
    async def create_session(
        self,
        user_id: Union[UUID, str],
        token_jti: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> UserSession:
        uid = _to_uuid(user_id)
        session = UserSession(
            user_id=uid,
            token_jti=token_jti,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        await session.insert()
        return session

    async def get_session_by_jti(self, jti: str) -> Optional[UserSession]:
        now = datetime.now(timezone.utc)
        return await UserSession.find_one({
            "token_jti": jti,
            "is_revoked": False,
            "expires_at": {"$gt": now},
        })

    async def revoke_session(self, jti: str) -> None:
        await UserSession.find(UserSession.token_jti == jti).update(
            {"$set": {"is_revoked": True}}
        )

    async def revoke_all_sessions(self, user_id: Union[UUID, str]) -> None:
        uid = _to_uuid(user_id)
        await UserSession.find(UserSession.user_id == uid).update(
            {"$set": {"is_revoked": True}}
        )
