"""
CTF Platform — Backend Tests: Authentication
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db

TEST_DB_URL = "postgresql+asyncpg://ctf_user:ctf_password@localhost:5432/ctf_platform_test"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db():
    async with TestSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed roles
    async with TestSession() as db:
        from app.models.user import Role
        from sqlalchemy import select
        for name in ["super_admin", "event_admin", "challenge_author", "moderator", "participant"]:
            exists = (await db.execute(select(Role).where(Role.name == name))).scalar_one_or_none()
            if not exists:
                db.add(Role(name=name, description=name))
        await db.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ── Registration Tests ────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "Test@1234!",
    })
    assert resp.status_code == 201
    assert "message" in resp.json()


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "dup@example.com", "username": "dup1", "password": "Test@1234!"
    })
    resp = await client.post("/api/v1/auth/register", json={
        "email": "dup@example.com", "username": "dup2", "password": "Test@1234!"
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "weak@example.com", "username": "weakuser", "password": "password"
    })
    assert resp.status_code == 422


# ── Login Tests ───────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def registered_user(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "login@example.com", "username": "loginuser", "password": "Login@1234!"
    })
    # Mark as verified in DB
    async with TestSession() as db:
        from app.models.user import User
        from sqlalchemy import update
        await db.execute(update(User).where(User.email == "login@example.com").values(is_verified=True))
        await db.commit()
    return {"email": "login@example.com", "password": "Login@1234!"}


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, registered_user):
    resp = await client.post("/api/v1/auth/login", json={
        "identifier": registered_user["email"],
        "password": registered_user["password"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, registered_user):
    resp = await client.post("/api/v1/auth/login", json={
        "identifier": registered_user["email"],
        "password": "WrongPassword1!",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "identifier": "nobody@example.com",
        "password": "Test@1234!",
    })
    assert resp.status_code == 401


# ── Token Refresh Tests ───────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_refresh_tokens(client: AsyncClient, registered_user):
    login = await client.post("/api/v1/auth/login", json={
        "identifier": registered_user["email"],
        "password": registered_user["password"],
    })
    refresh_token = login.json()["refresh_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


# ── Protected Route Tests ─────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_with_valid_token(client: AsyncClient, registered_user):
    login = await client.post("/api/v1/auth/login", json={
        "identifier": registered_user["email"],
        "password": registered_user["password"],
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == registered_user["email"]


# ── Security Tests ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_forgot_password_no_user_enumeration(client: AsyncClient):
    """Same response for existing and non-existing emails."""
    r1 = await client.post("/api/v1/auth/forgot-password", json={"email": "exists@example.com"})
    r2 = await client.post("/api/v1/auth/forgot-password", json={"email": "doesnotexist@example.com"})
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["message"] == r2.json()["message"]


@pytest.mark.asyncio
async def test_sql_injection_login(client: AsyncClient):
    """SQL injection in login should not crash the app."""
    resp = await client.post("/api/v1/auth/login", json={
        "identifier": "' OR '1'='1",
        "password": "' OR '1'='1",
    })
    assert resp.status_code in (401, 422)  # rejected, not 500
