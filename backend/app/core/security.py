"""
CTF Platform — Security Utilities
Handles: password hashing (Argon2), JWT creation/verification, TOTP 2FA
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

import pyotp
import qrcode
import qrcode.image.svg
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from io import BytesIO
import base64
from jose import JWTError, jwt

from app.core.config import settings

# ── Password Hashing (Argon2id) ────────────────────────────────────────────
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(plain_password: str) -> str:
    """Hash a password using Argon2id."""
    return ph.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its Argon2 hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Check if a password hash needs to be rehashed (e.g., after parameter upgrade)."""
    return ph.check_needs_rehash(hashed_password)


# ── Flag Hashing ───────────────────────────────────────────────────────────
def hash_flag(flag: str, case_sensitive: bool = True) -> str:
    """
    Hash a CTF flag for secure storage.
    Flags are hashed just like passwords — never stored in plaintext.
    """
    normalized = flag if case_sensitive else flag.lower()
    return ph.hash(normalized)


def verify_flag(submitted: str, stored_hash: str, case_sensitive: bool = True) -> bool:
    """Verify a submitted flag against its stored hash."""
    normalized = submitted if case_sensitive else submitted.lower()
    try:
        return ph.verify(stored_hash, normalized)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ── JWT Tokens ────────────────────────────────────────────────────────────
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    """Create a short-lived JWT access token."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": expire,
        "type": TOKEN_TYPE_ACCESS,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: Union[str, Any]) -> str:
    """Create a long-lived JWT refresh token."""
    expires_delta = timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": expire,
        "type": TOKEN_TYPE_REFRESH,
        "jti": secrets.token_hex(16),  # unique token ID for revocation
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT token.
    Raises JWTError on invalid/expired tokens.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )


def verify_access_token(token: str) -> Optional[str]:
    """
    Verify an access token and return the subject (user_id).
    Returns None if invalid.
    """
    try:
        payload = decode_token(token)
        if payload.get("type") != TOKEN_TYPE_ACCESS:
            return None
        return payload.get("sub")
    except JWTError:
        return None


def verify_refresh_token(token: str) -> Optional[dict]:
    """
    Verify a refresh token and return the full payload.
    Returns None if invalid.
    """
    try:
        payload = decode_token(token)
        if payload.get("type") != TOKEN_TYPE_REFRESH:
            return None
        return payload
    except JWTError:
        return None


# ── Secure Tokens ─────────────────────────────────────────────────────────
def generate_secure_token(nbytes: int = 32) -> str:
    """Generate a cryptographically secure URL-safe token."""
    return secrets.token_urlsafe(nbytes)


def generate_numeric_code(length: int = 6) -> str:
    """Generate a numeric verification code."""
    return "".join([str(secrets.randbelow(10)) for _ in range(length)])


# ── TOTP 2FA ─────────────────────────────────────────────────────────────
def generate_totp_secret() -> str:
    """Generate a new TOTP secret key."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, app_name: str = "CTF Platform") -> str:
    """Get the TOTP provisioning URI for QR code generation."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=app_name)


def generate_totp_qr_code(secret: str, username: str) -> str:
    """Generate a base64-encoded PNG QR code for TOTP enrollment."""
    uri = get_totp_uri(secret, username)
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def verify_totp_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """
    Verify a TOTP code.
    valid_window allows ±1 time step (30s) to account for clock drift.
    """
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=valid_window)


def generate_backup_codes(count: int = 10) -> tuple[list[str], list[str]]:
    """
    Generate backup codes for 2FA recovery.
    Returns (plaintext_codes, hashed_codes).
    Plaintext is shown to user ONCE; only hashes are stored.
    """
    plain = [secrets.token_hex(5).upper() for _ in range(count)]  # e.g. "A1B2C3D4E5"
    hashed = [hash_password(code) for code in plain]
    return plain, hashed


def verify_backup_code(code: str, hashed_codes: list[str]) -> Optional[int]:
    """
    Attempt to verify a backup code against the list of stored hashes.
    Returns the index of the matched code (for invalidation), or None.
    """
    for idx, stored_hash in enumerate(hashed_codes):
        if verify_password(code.upper().strip(), stored_hash):
            return idx
    return None
