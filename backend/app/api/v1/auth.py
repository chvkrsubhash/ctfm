"""
CTF Platform — Auth API Routes
Handles: register, login, logout, refresh, verify email, forgot/reset password, 2FA
"""
from fastapi import APIRouter, BackgroundTasks, Cookie, Request, Response, status
from fastapi.responses import JSONResponse
from typing import Optional

from app.core.deps import CurrentUser, DbSession
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest,
    LogoutRequest, ForgotPasswordRequest, ResetPasswordRequest,
    VerifyEmailRequest, ChangePasswordRequest,
    TotpSetupResponse, TotpConfirmRequest, TotpConfirmResponse, TotpDisableRequest,
)
from app.services.auth_service import AuthService
from app.email.email_service import EmailService
from app.core.config import settings
from app.core.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: DbSession,
    background_tasks: BackgroundTasks,
    request: Request,
):
    """Register a new participant account."""
    svc = AuthService(db)
    user = await svc.register(
        email=body.email,
        username=body.username,
        password=body.password,
        display_name=body.display_name,
        request=request,
    )
    raw_token = await svc.create_verification_token(user)

    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"
    background_tasks.add_task(
        EmailService.send_verification_email,
        to=user.email,
        username=user.display_name or user.username,
        verification_url=verify_url,
    )

    return {"message": "Account created. Please check your email to verify your account."}


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: DbSession,
    response: Response,
    request: Request,
):
    """Login with email/username + password + optional TOTP."""
    svc = AuthService(db)
    access_token, refresh_token = await svc.authenticate(
        identifier=body.identifier,
        password=body.password,
        totp_code=body.totp_code,
        request=request,
    )

    # Set refresh token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    db: DbSession,
    response: Response,
    body: Optional[RefreshRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(default=None, alias="refresh_token"),
):
    """Exchange a refresh token for new access + refresh tokens."""
    svc = AuthService(db)
    token = (body.refresh_token if body else None) or refresh_token_cookie
    if not token:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Refresh token required")

    new_access, new_refresh = await svc.refresh_tokens(token)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    db: DbSession,
    response: Response,
    request: Request,
    body: Optional[LogoutRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(default=None, alias="refresh_token"),
):
    """Logout by revoking the refresh token."""
    token = (body.refresh_token if body else None) or refresh_token_cookie
    if token:
        svc = AuthService(db)
        await svc.logout(token, request=request)

    response.delete_cookie("refresh_token")
    response.delete_cookie("access_token")


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest, db: DbSession, background_tasks: BackgroundTasks):
    """Verify user email with token from email link."""
    svc = AuthService(db)
    user = await svc.verify_email(body.token)
    background_tasks.add_task(
        EmailService.send_welcome_email,
        to=user.email,
        username=user.display_name or user.username,
    )
    return {"message": "Email verified successfully. Welcome!"}


@router.post("/resend-verification")
async def resend_verification(
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """Resend email verification to the logged-in user."""
    if current_user.is_verified:
        return {"message": "Email is already verified."}

    svc = AuthService(db)
    raw_token = await svc.create_verification_token(current_user)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"
    background_tasks.add_task(
        EmailService.send_verification_email,
        to=current_user.email,
        username=current_user.display_name or current_user.username,
        verification_url=verify_url,
    )
    return {"message": "Verification email sent."}


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: DbSession,
    background_tasks: BackgroundTasks,
    request: Request,
):
    """
    Request a password reset. Always returns 200 to prevent user enumeration.
    """
    svc = AuthService(db)
    raw_token = await svc.request_password_reset(body.email, request=request)

    if raw_token:
        from app.repositories.user_repository import UserRepository
        user = await UserRepository(db).get_by_email(body.email)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
        background_tasks.add_task(
            EmailService.send_password_reset_email,
            to=user.email,
            username=user.display_name or user.username,
            reset_url=reset_url,
        )

    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: DbSession, request: Request):
    """Reset password using the token from the reset email."""
    svc = AuthService(db)
    await svc.reset_password(body.token, body.new_password, request=request)
    return {"message": "Password reset successfully. Please login with your new password."}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Change password for the authenticated user."""
    if not verify_password(body.current_password, current_user.hashed_password):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    from app.repositories.user_repository import UserRepository
    await UserRepository(db).update_password(current_user.id, hash_password(body.new_password))
    return {"message": "Password changed successfully."}


# ── 2FA Endpoints ─────────────────────────────────────────────────────────
@router.post("/2fa/setup", response_model=TotpSetupResponse)
async def totp_setup(current_user: CurrentUser, db: DbSession):
    """Begin TOTP 2FA setup. Returns secret + QR code."""
    svc = AuthService(db)
    data = await svc.begin_totp_setup(current_user)
    return TotpSetupResponse(secret=data["secret"], qr_code=data["qr_code"])


@router.post("/2fa/confirm", response_model=TotpConfirmResponse)
async def totp_confirm(body: TotpConfirmRequest, current_user: CurrentUser, db: DbSession):
    """Confirm TOTP setup with a verification code. Returns backup codes (shown once)."""
    svc = AuthService(db)
    backup_codes = await svc.confirm_totp_setup(current_user, body.code)
    return TotpConfirmResponse(
        backup_codes=backup_codes,
        message="2FA enabled. Save these backup codes in a safe place — they will not be shown again.",
    )


@router.post("/2fa/disable")
async def totp_disable(body: TotpDisableRequest, current_user: CurrentUser, db: DbSession):
    """Disable 2FA (requires password confirmation)."""
    svc = AuthService(db)
    await svc.disable_totp(current_user, body.password)
    return {"message": "Two-factor authentication disabled."}
