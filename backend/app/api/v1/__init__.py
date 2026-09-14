"""CTF Platform — API v1 router."""
from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.routes import (
    users_router, events_router, teams_router, categories_router,
    challenges_router, challenge_router, submissions_router,
    leaderboard_router, announcements_router, notifications_router,
    admin_router, cert_router,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(events_router)
api_router.include_router(teams_router)
api_router.include_router(categories_router)
api_router.include_router(challenges_router)
api_router.include_router(challenge_router)
api_router.include_router(submissions_router)
api_router.include_router(leaderboard_router)
api_router.include_router(announcements_router)
api_router.include_router(notifications_router)
api_router.include_router(admin_router)
api_router.include_router(cert_router)
