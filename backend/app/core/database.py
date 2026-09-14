"""
CTF Platform — Database Engine and Session Management
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from app.core.config import settings


def get_async_db_url(raw_url: str) -> str:
    """Ensure database URL uses postgresql+asyncpg and clean asyncpg-incompatible query parameters."""
    url = raw_url
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]

    parsed = urlparse(url)
    if parsed.query:
        params = parse_qs(parsed.query)
        # asyncpg does not accept channel_binding
        params.pop("channel_binding", None)
        # asyncpg prefers ssl=require over sslmode=require
        if "sslmode" in params:
            val = params.pop("sslmode")[0]
            if "ssl" not in params:
                params["ssl"] = [val]
        new_query = urlencode([(k, v) for k, vals in params.items() for v in vals])
        url = urlunparse(parsed._replace(query=new_query))
    return url


engine = create_async_engine(
    get_async_db_url(settings.DATABASE_URL),
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """Create all tables (used in dev / tests). Use Alembic for production."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables() -> None:
    """Drop all tables (used in tests only)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
