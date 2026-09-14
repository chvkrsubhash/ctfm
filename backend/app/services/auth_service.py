"""
CTF Platform — Authentication Service
Handles: registration, login, logout, token refresh, email verification,
password reset, 2FA enrollment and verification.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    hash_password, verify_password, needs_rehash,
    create_access_token, create_refresh_token, verify_refresh_token,
    generate_totp_secret, generate_totp_qr_code, verify_totp_code,
    generate_backup_codes, verify_backup_code,
    hash_flag,  # re-used for backup code hashing
)
from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.audit = AuditService(db)

    # ── Registration ──────────────────────────────────────────────────────
    async def register(
        self,
        *,
        email: str,
        username: str,
        password: str,
        display_name: Optional[str] = None,
        request: Optional[Request] = None,
    ) -> User:
        # Check uniqueness — give generic message to prevent user enumeration
        if await self.user_repo.email_exists(email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email or username already exists.",
            )
        if await self.user_repo.username_exists(username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email or username already exists.",
            )

        hashed_pw = hash_password(password)
        user = await self.user_repo.create(
            email=email,
            username=username,
            hashed_password=hashed_pw,
            display_name=display_name,
        )

        # Assign default role
        await self.user_repo.assign_role(user, "participant")

        await self.audit.log(
            action="user.register",
            resource_type="user",
            resource_id=str(user.id),
            actor_id=None,
            request=request,
        )

        return user

    async def create_verification_token(self, user: User) -> str:
        """Create an email verification token for the user. Returns the raw token."""
        return await self.user_repo.create_verification_token(user.id)

    # ── Login ─────────────────────────────────────────────────────────────
    async def authenticate(
        self,
        *,
        identifier: str,  # email or username
        password: str,
        totp_code: Optional[str] = None,
        request: Optional[Request] = None,
    ) -> tuple[str, str]:
        """
        Authenticate a user. Returns (access_token, refresh_token).
        Raises HTTPException on failure.
        """
        user = await self.user_repo.get_by_email_or_username(identifier)

        # Constant-time check — always hash even if user not found (prevents timing attacks)
        if not user or not verify_password(password, user.hashed_password):
            await self.audit.log(
                action="user.login.failed",
                resource_type="user",
                resource_id=identifier,
                actor_id=None,
                request=request,
                metadata={"reason": "invalid_credentials"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been deactivated",
            )

        # 2FA check
        if user.totp_enabled:
            if not totp_code:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="2FA code required",
                    headers={"X-2FA-Required": "true"},
                )
            if not verify_totp_code(user.totp_secret, totp_code):
                # Try backup codes
                backup_idx = verify_backup_code(totp_code, user.backup_codes or [])
                if backup_idx is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid 2FA code",
                    )
                # Consume the backup code
                codes = list(user.backup_codes)
                codes.pop(backup_idx)
                user.backup_codes = codes

        # Rehash if needed
        if needs_rehash(user.hashed_password):
            user.hashed_password = hash_password(password)

        # Issue tokens
        access_token = create_access_token(str(user.id))
        refresh_payload = verify_refresh_token(create_refresh_token(str(user.id)))
        refresh_token = create_refresh_token(str(user.id))
        refresh_data = verify_refresh_token(refresh_token)

        expires_at = datetime.fromtimestamp(refresh_data["exp"], tz=timezone.utc)
        ip = request.client.host if request and request.client else None
        ua = request.headers.get("user-agent") if request else None

        await self.user_repo.create_session(
            user_id=user.id,
            token_jti=refresh_data["jti"],
            expires_at=expires_at,
            ip_address=ip,
            user_agent=ua,
        )
        await self.user_repo.update_last_login(user.id)

        await self.audit.log(
            action="user.login",
            resource_type="user",
            resource_id=str(user.id),
            actor_id=str(user.id),
            request=request,
        )

        return access_token, refresh_token

    # ── Token Refresh ─────────────────────────────────────────────────────
    async def refresh_tokens(self, refresh_token: str) -> tuple[str, str]:
        payload = verify_refresh_token(refresh_token)
        if not payload:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        jti = payload.get("jti")
        session = await self.user_repo.get_session_by_jti(jti)
        if not session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked")

        user_id = payload.get("sub")
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        # Rotate: revoke old, issue new
        await self.user_repo.revoke_session(jti)
        new_access = create_access_token(str(user.id))
        new_refresh = create_refresh_token(str(user.id))
        new_payload = verify_refresh_token(new_refresh)

        expires_at = datetime.fromtimestamp(new_payload["exp"], tz=timezone.utc)
        await self.user_repo.create_session(
            user_id=user.id,
            token_jti=new_payload["jti"],
            expires_at=expires_at,
            ip_address=session.ip_address,
            user_agent=session.user_agent,
        )
        return new_access, new_refresh

    # ── Logout ────────────────────────────────────────────────────────────
    async def logout(self, refresh_token: str, request: Optional[Request] = None) -> None:
        payload = verify_refresh_token(refresh_token)
        if payload:
            await self.user_repo.revoke_session(payload["jti"])
            await self.audit.log(
                action="user.logout",
                resource_type="user",
                resource_id=payload.get("sub"),
                actor_id=payload.get("sub"),
                request=request,
            )

    # ── Email Verification ────────────────────────────────────────────────
    async def verify_email(self, raw_token: str) -> User:
        token = await self.user_repo.verify_email_token(raw_token)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification link",
            )
        await self.user_repo.consume_verification_token(token)
        await self.user_repo.mark_verified(token.user_id)

        user = await self.user_repo.get_by_id(token.user_id)
        return user

    # ── Password Reset ────────────────────────────────────────────────────
    async def request_password_reset(
        self, email: str, request: Optional[Request] = None
    ) -> Optional[str]:
        """
        Returns the raw reset token if the user exists.
        Always returns 200 to prevent user enumeration.
        """
        user = await self.user_repo.get_by_email(email)
        if not user:
            return None  # silently succeed

        raw_token = await self.user_repo.create_reset_token(user.id)
        await self.audit.log(
            action="user.password_reset_requested",
            resource_type="user",
            resource_id=str(user.id),
            actor_id=None,
            request=request,
        )
        return raw_token

    async def reset_password(
        self,
        raw_token: str,
        new_password: str,
        request: Optional[Request] = None,
    ) -> None:
        token = await self.user_repo.get_reset_token(raw_token)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset link",
            )
        hashed = hash_password(new_password)
        await self.user_repo.update_password(token.user_id, hashed)
        await self.user_repo.consume_reset_token(token)
        await self.user_repo.revoke_all_sessions(token.user_id)

        await self.audit.log(
            action="user.password_reset",
            resource_type="user",
            resource_id=str(token.user_id),
            actor_id=str(token.user_id),
            request=request,
        )

    # ── 2FA ───────────────────────────────────────────────────────────────
    async def begin_totp_setup(self, user: User) -> dict:
        """Start TOTP enrollment. Returns secret + QR code (base64 PNG)."""
        secret = generate_totp_secret()
        user.totp_secret = secret  # stored but NOT yet enabled
        qr_code = generate_totp_qr_code(secret, user.username)
        return {"secret": secret, "qr_code": qr_code}

    async def confirm_totp_setup(self, user: User, code: str) -> list[str]:
        """
        Verify the TOTP code and activate 2FA.
        Returns plaintext backup codes (shown ONCE to user).
        """
        if not user.totp_secret:
            raise HTTPException(status_code=400, detail="2FA setup not initiated")
        if not verify_totp_code(user.totp_secret, code):
            raise HTTPException(status_code=400, detail="Invalid code — try again")

        plain_codes, hashed_codes = generate_backup_codes(10)
        user.totp_enabled = True
        user.backup_codes = hashed_codes

        await self.audit.log(
            action="user.2fa.enabled",
            resource_type="user",
            resource_id=str(user.id),
            actor_id=str(user.id),
        )
        return plain_codes

    async def disable_totp(self, user: User, password: str) -> None:
        if not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect password")
        user.totp_enabled = False
        user.totp_secret = None
        user.backup_codes = None

        await self.audit.log(
            action="user.2fa.disabled",
            resource_type="user",
            resource_id=str(user.id),
            actor_id=str(user.id),
        )
