"""
CTF Platform — FastAPI Dependencies
Provides reusable dependencies for auth, RBAC, DB sessions, etc.
"""
from typing import Annotated, Optional
from uuid import UUID

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_access_token

bearer_scheme = HTTPBearer(auto_error=False)

# Re-export DB dep
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user_id(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)] = None,
) -> str:
    """
    Extract the authenticated user's ID from the JWT Bearer token.
    Raises 401 if token is missing or invalid.
    """
    token: Optional[str] = None

    # 1. Try Authorization: Bearer header
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials

    # 2. Try HttpOnly cookie fallback
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


CurrentUserID = Annotated[str, Depends(get_current_user_id)]


async def get_current_user(
    user_id: CurrentUserID,
    db: DbSession,
):
    """
    Load the full User model from the database.
    Import lazily to avoid circular imports.
    """
    from app.repositories.user_repository import UserRepository
    from app.models.user import User

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    return user


from app.models.user import User  # noqa: E402 – used in type annotation below

CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_optional_current_user(
    request: Request,
    db: DbSession,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)] = None,
) -> Optional[User]:
    """Return the authenticated User if valid token is provided, else None."""
    token: Optional[str] = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        return None
    user_id = verify_access_token(token)
    if not user_id:
        return None
    from app.repositories.user_repository import UserRepository
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if user and not user.is_active:
        return None
    return user


OptionalCurrentUser = Annotated[Optional[User], Depends(get_optional_current_user)]


def require_roles(*required_roles: str):
    """
    Dependency factory that enforces one or more roles.
    Usage: Depends(require_roles("super_admin", "event_admin"))
    """
    async def _check(current_user: CurrentUser) -> User:
        user_role_names = {r.name for r in current_user.roles}
        if not user_role_names.intersection(required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return _check


def require_verified_email():
    """Enforce that the user has verified their email address."""
    async def _check(current_user: CurrentUser) -> User:
        if not current_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required",
            )
        return current_user
    return _check


SuperAdmin = Annotated[User, Depends(require_roles("super_admin"))]
EventAdmin = Annotated[User, Depends(require_roles("super_admin", "event_admin"))]
ChallengeAuthor = Annotated[User, Depends(require_roles("super_admin", "event_admin", "challenge_author"))]
ModeratorUser = Annotated[User, Depends(require_roles("super_admin", "event_admin", "moderator"))]
