"""
CTF Platform — Events, Registration, Teams, Challenges, Submissions, Leaderboard API
All major platform API routes consolidated in a well-organized v1 router.
"""
import math
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, UploadFile, File, status
from sqlalchemy import select, func, update, delete
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession, EventAdmin, SuperAdmin, ChallengeAuthor, OptionalCurrentUser
from app.core.security import hash_flag, verify_flag
from app.schemas.schemas import (
    EventCreateSchema, EventUpdateSchema, EventSchema, EventDetailSchema,
    TeamCreateSchema, TeamSchema, TeamDetailSchema, TeamInviteSchema,
    CategoryCreateSchema, CategorySchema,
    ChallengeCreateSchema, ChallengeUpdateSchema, ChallengePublicSchema, ChallengeAdminSchema,
    FlagCreateSchema, HintCreateSchema, ChallengeHintSchema,
    FlagSubmitSchema, SubmissionResultSchema,
    LeaderboardSchema, LeaderboardEntrySchema,
    NotificationSchema, AnnouncementCreateSchema, AnnouncementSchema,
    UserPrivateSchema, UserUpdateSchema,
)
from app.models.event import Event, EventRegistration, EventStatus, EventVisibility, LeaderboardStatus, RegistrationStatus
from app.models.team import Team, TeamMember, TeamInvitation, TeamMemberRole, InvitationStatus
from app.models.challenge import Category, Challenge, ChallengeFlag, ChallengeHint, ChallengeFile, HintUnlock, ChallengeStatus, FlagType
from app.models.submission import Submission, Solve, SubmissionResult
from app.models.score import Score, ScoreEvent
from app.models.notification import Announcement, Notification, NotificationType
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.storage.storage_service import storage_service
from app.core.config import settings
from slugify import slugify

router = APIRouter()


# ── Helper ────────────────────────────────────────────────────────────────
def _slugify(text: str) -> str:
    return slugify(text, max_length=200)


def _paginate(total: int, page: int, per_page: int) -> dict:
    return {"total": total, "page": page, "per_page": per_page, "pages": math.ceil(total / per_page)}


# ─────────────────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────────────────
users_router = APIRouter(prefix="/users", tags=["Users"])


@users_router.get("/me", response_model=UserPrivateSchema)
async def get_me(current_user: CurrentUser):
    return current_user


@users_router.patch("/me", response_model=UserPrivateSchema)
async def update_me(body: UserUpdateSchema, current_user: CurrentUser, db: DbSession):
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(current_user, field, val)
    await db.flush()
    return current_user


@users_router.get("/{username}", response_model=dict)
async def get_user_profile(username: str, db: DbSession):
    from app.repositories.user_repository import UserRepository
    user = await UserRepository(db).get_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "country": user.country,
        "created_at": user.created_at.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────
# EVENTS
# ─────────────────────────────────────────────────────────────────────────
events_router = APIRouter(prefix="/events", tags=["Events"])


@events_router.get("")
async def list_events(
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
):
    q = select(Event).where(Event.visibility == EventVisibility.PUBLIC)
    if status:
        try:
            q = q.where(Event.status == EventStatus(status))
        except ValueError:
            pass
    q = q.order_by(Event.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    events = (await db.execute(q)).scalars().all()
    total = (await db.execute(select(func.count(Event.id)).where(Event.visibility == EventVisibility.PUBLIC))).scalar_one()
    return {"items": [EventSchema.model_validate(e) for e in events], **_paginate(total, page, per_page)}


@events_router.post("", status_code=201)
async def create_event(body: EventCreateSchema, current_user: EventAdmin, db: DbSession, request: Request):
    slug = _slugify(body.name)
    existing = (await db.execute(select(Event).where(Event.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    event = Event(
        **body.model_dump(),
        slug=slug,
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()
    await AuditService(db).log(action="event.create", resource_type="event", resource_id=str(event.id), actor_id=str(current_user.id), request=request)
    return EventDetailSchema.model_validate(event)


@events_router.get("/{slug}")
async def get_event(slug: str, db: DbSession):
    event = (await db.execute(select(Event).where(Event.slug == slug))).scalar_one_or_none()
    if not event or event.visibility == EventVisibility.PRIVATE:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventDetailSchema.model_validate(event)


@events_router.patch("/{event_id}")
async def update_event(event_id: uuid.UUID, body: EventUpdateSchema, current_user: EventAdmin, db: DbSession, request: Request):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(event, field, val)
    await db.flush()
    await AuditService(db).log(action="event.update", resource_type="event", resource_id=str(event.id), actor_id=str(current_user.id), request=request)
    return EventDetailSchema.model_validate(event)


@events_router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: uuid.UUID, current_user: SuperAdmin, db: DbSession, request: Request):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await AuditService(db).log(action="event.delete", resource_type="event", resource_id=str(event_id), actor_id=str(current_user.id), request=request)


# Event Registration
@events_router.post("/{event_id}/register", status_code=201)
async def register_for_event(event_id: uuid.UUID, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status not in (EventStatus.REGISTRATION_OPEN, EventStatus.UPCOMING):
        raise HTTPException(status_code=400, detail="Registration is not open")

    existing = (await db.execute(
        select(EventRegistration).where(EventRegistration.event_id == event_id, EventRegistration.user_id == current_user.id)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Already registered")

    reg_status = RegistrationStatus.PENDING if event.require_approval else RegistrationStatus.APPROVED
    reg = EventRegistration(event_id=event_id, user_id=current_user.id, status=reg_status)
    db.add(reg)
    await db.flush()

    event_url = f"{settings.FRONTEND_URL}/events/{event.slug}"
    from app.email.email_service import EmailService
    background_tasks.add_task(
        EmailService.send_event_registration_email,
        to=current_user.email,
        username=current_user.display_name or current_user.username,
        event_name=event.name,
        event_url=event_url,
    )
    return {"message": "Registered successfully", "status": reg_status.value}


# ─────────────────────────────────────────────────────────────────────────
# TEAMS
# ─────────────────────────────────────────────────────────────────────────
teams_router = APIRouter(prefix="/events/{event_id}/teams", tags=["Teams"])


@teams_router.post("", status_code=201)
async def create_team(event_id: uuid.UUID, body: TeamCreateSchema, current_user: CurrentUser, db: DbSession):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check user is registered
    reg = (await db.execute(
        select(EventRegistration).where(EventRegistration.event_id == event_id, EventRegistration.user_id == current_user.id, EventRegistration.status == RegistrationStatus.APPROVED)
    )).scalar_one_or_none()
    if not reg:
        raise HTTPException(status_code=403, detail="You must be registered for this event")

    # Check not already in a team
    existing = (await db.execute(
        select(TeamMember).join(Team).where(Team.event_id == event_id, TeamMember.user_id == current_user.id)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Already in a team for this event")

    slug = _slugify(body.name)
    team = Team(event_id=event_id, name=body.name, slug=slug, owner_id=current_user.id,
                description=body.description, is_private=body.is_private)
    db.add(team)
    await db.flush()

    member = TeamMember(team_id=team.id, user_id=current_user.id, role=TeamMemberRole.OWNER)
    db.add(member)

    # Create score record
    score = Score(event_id=event_id, team_id=team.id)
    db.add(score)

    return TeamSchema.model_validate(team)


@teams_router.get("")
async def list_teams(event_id: uuid.UUID, db: DbSession):
    teams = (await db.execute(
        select(Team).where(Team.event_id == event_id, Team.is_private == False)
        .options(selectinload(Team.members).selectinload(TeamMember.user))
    )).scalars().all()
    return [TeamSchema.model_validate(t) for t in teams]


@teams_router.post("/{team_id}/invite")
async def invite_to_team(event_id: uuid.UUID, team_id: uuid.UUID, body: TeamInviteSchema, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks):
    team = (await db.execute(select(Team).where(Team.id == team_id, Team.event_id == event_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the team owner can invite members")

    from app.repositories.user_repository import UserRepository
    invitee = await UserRepository(db).get_by_username(body.username)
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")

    from app.core.security import generate_secure_token
    from datetime import timedelta
    token = generate_secure_token(32)
    invitation = TeamInvitation(
        team_id=team_id, invitee_id=invitee.id, inviter_id=current_user.id,
        token=token, expires_at=datetime.now(timezone.utc) + timedelta(days=2)
    )
    db.add(invitation)
    await db.flush()

    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    inv_url = f"{settings.FRONTEND_URL}/teams/invite/{token}"
    from app.email.email_service import EmailService
    background_tasks.add_task(
        EmailService.send_team_invitation_email,
        to=invitee.email,
        invitee_name=invitee.display_name or invitee.username,
        inviter_name=current_user.display_name or current_user.username,
        team_name=team.name,
        event_name=event.name if event else "",
        invitation_url=inv_url,
    )
    return {"message": f"Invitation sent to {invitee.username}"}


@teams_router.post("/invitations/{token}/accept")
async def accept_team_invitation(event_id: uuid.UUID, token: str, current_user: CurrentUser, db: DbSession):
    invitation = (await db.execute(
        select(TeamInvitation).where(TeamInvitation.token == token, TeamInvitation.invitee_id == current_user.id,
                                     TeamInvitation.status == InvitationStatus.PENDING,
                                     TeamInvitation.expires_at > datetime.now(timezone.utc))
    )).scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")

    invitation.status = InvitationStatus.ACCEPTED
    invitation.responded_at = datetime.now(timezone.utc)

    member = TeamMember(team_id=invitation.team_id, user_id=current_user.id, role=TeamMemberRole.MEMBER)
    db.add(member)
    return {"message": "Team joined successfully"}


# ─────────────────────────────────────────────────────────────────────────
# CATEGORIES
# ─────────────────────────────────────────────────────────────────────────
categories_router = APIRouter(prefix="/events/{event_id}/categories", tags=["Categories"])


@categories_router.get("")
async def list_categories(event_id: uuid.UUID, db: DbSession):
    cats = (await db.execute(
        select(Category).where(Category.event_id == event_id).order_by(Category.order_index)
    )).scalars().all()
    return [{"id": c.id, "name": c.name, "slug": c.slug, "color": c.color, "icon": c.icon} for c in cats]


@categories_router.post("", status_code=201)
async def create_category(event_id: uuid.UUID, body: CategoryCreateSchema, current_user: EventAdmin, db: DbSession):
    slug = _slugify(body.name)
    cat = Category(event_id=event_id, name=body.name, slug=slug, color=body.color, icon=body.icon, description=body.description)
    db.add(cat)
    await db.flush()
    return {"id": cat.id, "name": cat.name, "slug": cat.slug, "color": cat.color}


# ─────────────────────────────────────────────────────────────────────────
# CHALLENGES
# ─────────────────────────────────────────────────────────────────────────
challenges_router = APIRouter(prefix="/events/{event_id}/challenges", tags=["Challenges"])


@challenges_router.get("")
async def list_challenges(
    event_id: uuid.UUID,
    db: DbSession,
    current_user: OptionalCurrentUser = None,
    category: Optional[int] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    all_statuses: Optional[bool] = Query(False),
):
    is_privileged = False
    if current_user and any(r.name in ["super_admin", "event_admin", "challenge_author"] for r in current_user.roles):
        is_privileged = True

    q = select(Challenge).where(Challenge.event_id == event_id)
    if not (all_statuses and is_privileged):
        q = q.where(Challenge.status == ChallengeStatus.PUBLISHED)
    q = q.options(selectinload(Challenge.category), selectinload(Challenge.files), selectinload(Challenge.hints), selectinload(Challenge.flags))

    if category:
        q = q.where(Challenge.category_id == category)
    if difficulty:
        from app.models.challenge import Difficulty
        try:
            q = q.where(Challenge.difficulty == Difficulty(difficulty))
        except ValueError:
            pass
    if search:
        q = q.where(Challenge.name.ilike(f"%{search}%"))

    challenges = (await db.execute(q)).scalars().all()

    # Pre-fetch user's solves and hint unlocks in 2 batch queries instead of N+1
    solved_challenge_ids = set()
    unlocked_hint_ids = set()
    if current_user:
        solved_res = (await db.execute(
            select(Solve.challenge_id).join(Team).join(TeamMember).where(
                TeamMember.user_id == current_user.id,
                TeamMember.team_id == Solve.team_id,
            )
        )).scalars().all()
        solved_challenge_ids = set(solved_res)

        unlocked_res = (await db.execute(
            select(HintUnlock.hint_id).join(TeamMember, HintUnlock.team_id == TeamMember.team_id).where(
                TeamMember.user_id == current_user.id,
            )
        )).scalars().all()
        unlocked_hint_ids = set(unlocked_res)

    result = []
    for ch in challenges:
        is_solved = ch.id in solved_challenge_ids

        # Build hints list (content only if unlocked or privileged)
        hints = []
        for hint in ch.hints:
            unlocked = hint.id in unlocked_hint_ids or is_privileged
            content = hint.content if unlocked else None
            hints.append({
                "id": hint.id,
                "cost": hint.cost,
                "order_index": hint.order_index,
                "is_unlocked": unlocked,
                "content": content,
            })

        files = []
        for f in ch.files:
            url = await storage_service.get_file_url(f.storage_key)
            files.append({"id": str(f.id), "original_filename": f.original_filename, "file_size": f.file_size, "mime_type": f.mime_type, "download_url": url})

        result.append({
            "id": str(ch.id),
            "name": ch.name,
            "slug": ch.slug,
            "description": ch.description,
            "points": ch.points,
            "current_points": ch.current_points,
            "difficulty": ch.difficulty.value,
            "status": ch.status.value,
            "category_id": ch.category_id,
            "category": {"id": ch.category.id, "name": ch.category.name, "color": ch.category.color} if ch.category else None,
            "solve_count": ch.solve_count,
            "is_solved": is_solved,
            "flags_count": len(ch.flags) if is_privileged else None,
            "files": files,
            "hints": hints,
        })

    return result


@challenges_router.post("", status_code=201)
async def create_challenge(event_id: uuid.UUID, body: ChallengeCreateSchema, current_user: ChallengeAuthor, db: DbSession, request: Request):
    slug = _slugify(body.name)
    existing = (await db.execute(select(Challenge).where(Challenge.event_id == event_id, Challenge.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    ch = Challenge(
        event_id=event_id,
        category_id=body.category_id,
        name=body.name,
        slug=slug,
        description=body.description,
        points=body.points,
        current_points=body.points,
        difficulty=body.difficulty,
        status=body.status or ChallengeStatus.PUBLISHED,
        author_id=current_user.id,
    )
    db.add(ch)
    await db.flush()

    # Add initial flag if supplied
    if body.flag and body.flag.strip():
        flag_hash = hash_flag(body.flag.strip(), case_sensitive=body.is_case_sensitive if body.is_case_sensitive is not None else True)
        flag = ChallengeFlag(
            challenge_id=ch.id,
            flag_type=body.flag_type or FlagType.STATIC,
            flag_value=flag_hash,
            is_case_sensitive=body.is_case_sensitive if body.is_case_sensitive is not None else True,
        )
        db.add(flag)
        await db.flush()

    await AuditService(db).log(action="challenge.create", resource_type="challenge", resource_id=str(ch.id), actor_id=str(current_user.id), request=request)
    return {"id": str(ch.id), "name": ch.name, "slug": ch.slug, "status": ch.status.value, "points": ch.points}


challenge_router = APIRouter(prefix="/challenges", tags=["Challenges"])


@challenge_router.get("/{challenge_id}")
async def get_challenge(challenge_id: uuid.UUID, db: DbSession, current_user: OptionalCurrentUser = None):
    ch = (await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
        .options(selectinload(Challenge.category), selectinload(Challenge.files), selectinload(Challenge.hints), selectinload(Challenge.flags))
    )).scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    is_privileged = False
    if current_user and any(r.name in ["super_admin", "event_admin", "challenge_author"] for r in current_user.roles):
        is_privileged = True

    if ch.status != ChallengeStatus.PUBLISHED and not is_privileged:
        raise HTTPException(status_code=404, detail="Challenge not found")

    files = []
    for f in ch.files:
        url = await storage_service.get_file_url(f.storage_key)
        files.append({"id": str(f.id), "original_filename": f.original_filename, "file_size": f.file_size, "mime_type": f.mime_type, "download_url": url})

    return {
        "id": str(ch.id),
        "event_id": str(ch.event_id),
        "name": ch.name,
        "slug": ch.slug,
        "description": ch.description,
        "points": ch.points,
        "current_points": ch.current_points,
        "difficulty": ch.difficulty.value,
        "status": ch.status.value,
        "category_id": ch.category_id,
        "category": {"id": ch.category.id, "name": ch.category.name, "color": ch.category.color} if ch.category else None,
        "solve_count": ch.solve_count,
        "flags_count": len(ch.flags) if is_privileged else None,
        "hints": [{"id": h.id, "cost": h.cost, "order_index": h.order_index, "content": h.content if is_privileged else None} for h in ch.hints],
        "files": files,
    }


@challenge_router.patch("/{challenge_id}")
@challenge_router.put("/{challenge_id}")
async def update_challenge(challenge_id: uuid.UUID, body: ChallengeUpdateSchema, current_user: ChallengeAuthor, db: DbSession, request: Request):
    ch = (await db.execute(select(Challenge).where(Challenge.id == challenge_id))).scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    new_flag = data.pop("flag", None)
    is_case_sensitive = data.pop("is_case_sensitive", True)

    for field, val in data.items():
        setattr(ch, field, val)

    if "points" in data and ch.solve_count == 0:
        ch.current_points = data["points"]

    if new_flag and new_flag.strip():
        flag_hash = hash_flag(new_flag.strip(), case_sensitive=is_case_sensitive)
        flag = ChallengeFlag(
            challenge_id=ch.id,
            flag_type=FlagType.STATIC,
            flag_value=flag_hash,
            is_case_sensitive=is_case_sensitive,
        )
        db.add(flag)

    await db.flush()
    await AuditService(db).log(action="challenge.update", resource_type="challenge", resource_id=str(challenge_id), actor_id=str(current_user.id), request=request)
    return {"id": str(ch.id), "name": ch.name, "status": ch.status.value, "points": ch.points}


@challenge_router.delete("/{challenge_id}")
async def delete_challenge(challenge_id: uuid.UUID, current_user: ChallengeAuthor, db: DbSession, request: Request):
    ch = (await db.execute(select(Challenge).where(Challenge.id == challenge_id))).scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    await db.delete(ch)
    await db.flush()
    await AuditService(db).log(action="challenge.delete", resource_type="challenge", resource_id=str(challenge_id), actor_id=str(current_user.id), request=request)
    return {"message": "Challenge deleted successfully"}


@challenge_router.get("/{challenge_id}/flags")
async def list_flags(challenge_id: uuid.UUID, current_user: ChallengeAuthor, db: DbSession):
    flags = (await db.execute(select(ChallengeFlag).where(ChallengeFlag.challenge_id == challenge_id))).scalars().all()
    return [{"id": f.id, "flag_type": f.flag_type.value, "is_case_sensitive": f.is_case_sensitive, "created_at": f.created_at.isoformat()} for f in flags]


@challenge_router.post("/{challenge_id}/flags", status_code=201)
async def add_flag(challenge_id: uuid.UUID, body: FlagCreateSchema, current_user: ChallengeAuthor, db: DbSession, request: Request):
    ch = (await db.execute(select(Challenge).where(Challenge.id == challenge_id))).scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    flag_hash = hash_flag(body.flag_value, case_sensitive=body.is_case_sensitive)
    flag = ChallengeFlag(
        challenge_id=challenge_id,
        flag_type=body.flag_type,
        flag_value=flag_hash,
        is_case_sensitive=body.is_case_sensitive,
    )
    db.add(flag)
    await db.flush()
    await AuditService(db).log(action="flag.create", resource_type="challenge", resource_id=str(challenge_id), actor_id=str(current_user.id), request=request)
    return {"message": "Flag added", "flag_id": flag.id}


@challenge_router.delete("/{challenge_id}/flags/{flag_id}")
async def delete_flag(challenge_id: uuid.UUID, flag_id: int, current_user: ChallengeAuthor, db: DbSession, request: Request):
    flag = (await db.execute(select(ChallengeFlag).where(ChallengeFlag.id == flag_id, ChallengeFlag.challenge_id == challenge_id))).scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    await db.delete(flag)
    await db.flush()
    await AuditService(db).log(action="flag.delete", resource_type="challenge", resource_id=str(challenge_id), actor_id=str(current_user.id), request=request)
    return {"message": "Flag removed"}


@challenge_router.post("/{challenge_id}/hints", status_code=201)
async def add_hint(challenge_id: uuid.UUID, body: HintCreateSchema, current_user: ChallengeAuthor, db: DbSession):
    ch = (await db.execute(select(Challenge).where(Challenge.id == challenge_id))).scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    hint = ChallengeHint(challenge_id=challenge_id, content=body.content, cost=body.cost, order_index=body.order_index)
    db.add(hint)
    await db.flush()
    return {"id": hint.id, "cost": hint.cost}


@challenge_router.delete("/{challenge_id}/hints/{hint_id}")
async def delete_hint(challenge_id: uuid.UUID, hint_id: int, current_user: ChallengeAuthor, db: DbSession):
    hint = (await db.execute(select(ChallengeHint).where(ChallengeHint.id == hint_id, ChallengeHint.challenge_id == challenge_id))).scalar_one_or_none()
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found")
    await db.delete(hint)
    await db.flush()
    return {"message": "Hint deleted"}


@challenge_router.post("/{challenge_id}/hints/{hint_id}/unlock")
async def unlock_hint(challenge_id: uuid.UUID, hint_id: int, current_user: CurrentUser, db: DbSession):
    """Unlock a hint for the current user's team. Deducts points."""
    hint = (await db.execute(select(ChallengeHint).where(ChallengeHint.id == hint_id, ChallengeHint.challenge_id == challenge_id))).scalar_one_or_none()
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found")

    ch = (await db.execute(select(Challenge).where(Challenge.id == challenge_id))).scalar_one_or_none()
    team_member = (await db.execute(
        select(TeamMember).join(Team).where(Team.event_id == ch.event_id, TeamMember.user_id == current_user.id)
    )).scalar_one_or_none()
    if not team_member:
        raise HTTPException(status_code=403, detail="You must be in a team to unlock hints")

    existing = (await db.execute(
        select(HintUnlock).where(HintUnlock.hint_id == hint_id, HintUnlock.team_id == team_member.team_id)
    )).scalar_one_or_none()
    if existing:
        return {"content": hint.content, "already_unlocked": True}

    if hint.cost > 0:
        await db.execute(
            update(Score).where(Score.team_id == team_member.team_id, Score.event_id == ch.event_id)
            .values(total_points=Score.total_points - hint.cost)
        )
        score_evt = ScoreEvent(
            event_id=ch.event_id, team_id=team_member.team_id, user_id=current_user.id,
            challenge_id=challenge_id, delta=-hint.cost, reason="hint_unlock"
        )
        db.add(score_evt)

    unlock = HintUnlock(hint_id=hint_id, team_id=team_member.team_id, user_id=current_user.id, points_deducted=hint.cost)
    db.add(unlock)
    await db.flush()
    return {"content": hint.content, "points_deducted": hint.cost}


@challenge_router.post("/{challenge_id}/files", status_code=201)
async def upload_challenge_file(
    challenge_id: uuid.UUID,
    current_user: ChallengeAuthor,
    db: DbSession,
    file: UploadFile = File(...),
):
    """Upload a file attachment for a challenge."""
    ch = (await db.execute(select(Challenge).where(Challenge.id == challenge_id))).scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    data = await file.read()
    mime_type = file.content_type or "application/octet-stream"

    storage_key = await storage_service.upload_challenge_file(
        challenge_id=str(challenge_id),
        data=data,
        original_filename=file.filename or "file",
        mime_type=mime_type,
    )

    cf = ChallengeFile(
        challenge_id=challenge_id,
        original_filename=file.filename or "file",
        storage_key=storage_key,
        file_size=len(data),
        mime_type=mime_type,
        uploaded_by=current_user.id,
    )
    db.add(cf)
    await db.flush()
    url = await storage_service.get_file_url(storage_key)
    return {"id": str(cf.id), "filename": cf.original_filename, "download_url": url}


@challenge_router.delete("/{challenge_id}/files/{file_id}")
async def delete_challenge_file(
    challenge_id: uuid.UUID,
    file_id: uuid.UUID,
    current_user: ChallengeAuthor,
    db: DbSession,
):
    """Delete a file attachment for a challenge."""
    cf = (await db.execute(select(ChallengeFile).where(ChallengeFile.id == file_id, ChallengeFile.challenge_id == challenge_id))).scalar_one_or_none()
    if not cf:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        await storage_service.delete_challenge_file(cf.storage_key)
    except Exception:
        pass
    await db.delete(cf)
    await db.flush()
    return {"message": "File deleted"}


# ─────────────────────────────────────────────────────────────────────────
# SUBMISSIONS
# ─────────────────────────────────────────────────────────────────────────
submissions_router = APIRouter(prefix="/challenges", tags=["Submissions"])


@submissions_router.post("/{challenge_id}/submit")
async def submit_flag(
    challenge_id: uuid.UUID,
    body: FlagSubmitSchema,
    current_user: CurrentUser,
    db: DbSession,
    request: Request,
):
    """Submit a flag for a challenge."""
    # Load challenge with event
    ch = (await db.execute(
        select(Challenge).where(Challenge.id == challenge_id, Challenge.status == ChallengeStatus.PUBLISHED)
        .options(selectinload(Challenge.flags))
    )).scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # Load event
    event = (await db.execute(select(Event).where(Event.id == ch.event_id))).scalar_one_or_none()
    if not event or event.status != EventStatus.LIVE:
        result_val = SubmissionResult.EVENT_NOT_LIVE
        preview = body.flag[:100]
        sub = Submission(challenge_id=challenge_id, event_id=ch.event_id, user_id=current_user.id,
                         submitted_flag_preview=preview, result=result_val,
                         ip_address=request.client.host if request.client else None,
                         user_agent=request.headers.get("user-agent"))
        db.add(sub)
        return SubmissionResultSchema(result=result_val, message="Event is not currently live")

    # Find user's team
    team_member = (await db.execute(
        select(TeamMember).join(Team).where(Team.event_id == ch.event_id, TeamMember.user_id == current_user.id)
    )).scalar_one_or_none()
    team_id = team_member.team_id if team_member else None

    # Rate limiting: max N submissions per minute per challenge per team
    if team_id and settings.RATE_LIMIT_ENABLED:
        from datetime import timedelta
        one_minute_ago = datetime.now(timezone.utc) - timedelta(minutes=1)
        recent_count = (await db.execute(
            select(func.count(Submission.id)).where(
                Submission.challenge_id == challenge_id,
                Submission.team_id == team_id,
                Submission.created_at > one_minute_ago,
            )
        )).scalar_one()
        if recent_count >= event.submission_rate_limit:
            preview = body.flag[:100]
            sub = Submission(challenge_id=challenge_id, event_id=ch.event_id, user_id=current_user.id,
                             team_id=team_id, submitted_flag_preview=preview,
                             result=SubmissionResult.RATE_LIMITED,
                             ip_address=request.client.host if request.client else None,
                             user_agent=request.headers.get("user-agent"))
            db.add(sub)
            return SubmissionResultSchema(result=SubmissionResult.RATE_LIMITED, message="Too many submissions. Please wait before trying again.")

    # Check already solved
    if team_id:
        already = (await db.execute(
            select(Solve).where(Solve.challenge_id == challenge_id, Solve.team_id == team_id)
        )).scalar_one_or_none()
        if already:
            preview = body.flag[:100]
            sub = Submission(challenge_id=challenge_id, event_id=ch.event_id, user_id=current_user.id,
                             team_id=team_id, submitted_flag_preview=preview,
                             result=SubmissionResult.ALREADY_SOLVED,
                             ip_address=request.client.host if request.client else None,
                             user_agent=request.headers.get("user-agent"))
            db.add(sub)
            return SubmissionResultSchema(result=SubmissionResult.ALREADY_SOLVED, message="Your team already solved this challenge")

    # Verify flag against all stored hashes
    is_correct = False
    for flag_obj in ch.flags:
        if verify_flag(body.flag, flag_obj.flag_value, case_sensitive=flag_obj.is_case_sensitive):
            is_correct = True
            break

    preview = body.flag[:100]
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    if not is_correct:
        sub = Submission(challenge_id=challenge_id, event_id=ch.event_id, user_id=current_user.id,
                         team_id=team_id, submitted_flag_preview=preview,
                         result=SubmissionResult.INCORRECT, ip_address=ip, user_agent=ua)
        db.add(sub)
        return SubmissionResultSchema(result=SubmissionResult.INCORRECT, message="Incorrect flag. Keep trying!")

    # ── CORRECT FLAG ──────────────────────────────────────────────────────
    # Calculate points (dynamic scoring)
    points = _calculate_points(event, ch)

    sub = Submission(challenge_id=challenge_id, event_id=ch.event_id, user_id=current_user.id,
                     team_id=team_id, submitted_flag_preview=preview,
                     result=SubmissionResult.CORRECT, ip_address=ip, user_agent=ua)
    db.add(sub)
    await db.flush()

    # Create solve record (atomically — DB unique constraint prevents duplicate solves)
    solve = Solve(
        challenge_id=challenge_id, event_id=ch.event_id,
        team_id=team_id, user_id=current_user.id,
        submission_id=sub.id, points_awarded=points,
    )
    db.add(solve)

    # Update challenge solve count
    await db.execute(update(Challenge).where(Challenge.id == challenge_id).values(solve_count=Challenge.solve_count + 1))

    # Update team score atomically
    if team_id:
        now = datetime.now(timezone.utc)
        await db.execute(
            update(Score).where(Score.team_id == team_id, Score.event_id == ch.event_id)
            .values(total_points=Score.total_points + points, solve_count=Score.solve_count + 1, last_solve_at=now)
        )
        score_evt = ScoreEvent(event_id=ch.event_id, team_id=team_id, user_id=current_user.id,
                               challenge_id=challenge_id, delta=points, reason="solve")
        db.add(score_evt)

    await db.flush()

    # Update dynamic points for remaining solvers
    if event.scoring_type.value == "dynamic":
        new_points = _calculate_dynamic_points(event, ch.solve_count + 1)
        await db.execute(update(Challenge).where(Challenge.id == challenge_id).values(current_points=new_points))

    # Broadcast leaderboard update via WebSocket
    from app.websocket.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast_event_update(str(ch.event_id), {
        "type": "leaderboard_update",
        "solve": {"challenge": ch.name, "team_id": str(team_id) if team_id else None, "points": points}
    }))

    return SubmissionResultSchema(result=SubmissionResult.CORRECT, message="Correct! 🎉", points_awarded=points)


def _calculate_points(event: Event, challenge: Challenge) -> int:
    if event.scoring_type.value == "dynamic":
        return _calculate_dynamic_points(event, challenge.solve_count)
    return challenge.points


def _calculate_dynamic_points(event: Event, solve_count: int) -> int:
    """Exponential decay formula for dynamic scoring."""
    import math
    initial = event.dynamic_score_initial
    minimum = event.dynamic_score_minimum
    decay = event.dynamic_score_decay
    if solve_count <= 0:
        return initial
    points = max(minimum, int(initial * math.exp(-decay * solve_count)))
    return points


# ─────────────────────────────────────────────────────────────────────────
# LEADERBOARD
# ─────────────────────────────────────────────────────────────────────────
leaderboard_router = APIRouter(prefix="/events/{event_id}/leaderboard", tags=["Leaderboard"])


@leaderboard_router.get("")
async def get_leaderboard(
    event_id: uuid.UUID,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    q = (
        select(Score, Team)
        .join(Team, Score.team_id == Team.id)
        .where(Score.event_id == event_id, Team.is_disqualified == False)
        .order_by(Score.total_points.desc(), Score.last_solve_at.asc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    rows = (await db.execute(q)).all()

    total = (await db.execute(select(func.count(Score.id)).where(Score.event_id == event_id))).scalar_one()

    entries = []
    for rank, (score, team) in enumerate(rows, start=(page - 1) * per_page + 1):
        entries.append({
            "rank": rank,
            "team_id": str(team.id),
            "team_name": team.name,
            "team_logo": team.logo_url,
            "country": team.country,
            "total_points": score.total_points,
            "solve_count": score.solve_count,
            "last_solve_at": score.last_solve_at.isoformat() if score.last_solve_at else None,
        })

    return {
        "event_id": str(event_id),
        "status": event.leaderboard_status.value,
        "is_frozen": event.leaderboard_status.value == "frozen",
        "entries": entries,
        **_paginate(total, page, per_page),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────
# ANNOUNCEMENTS
# ─────────────────────────────────────────────────────────────────────────
announcements_router = APIRouter(prefix="/events/{event_id}/announcements", tags=["Announcements"])


@announcements_router.get("")
async def list_announcements(event_id: uuid.UUID, db: DbSession):
    anns = (await db.execute(
        select(Announcement).where(Announcement.event_id == event_id)
        .options(selectinload(Announcement.author))
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
    )).scalars().all()
    return [AnnouncementSchema.model_validate(a) for a in anns]


@announcements_router.post("", status_code=201)
async def create_announcement(
    event_id: uuid.UUID,
    body: AnnouncementCreateSchema,
    current_user: EventAdmin,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    ann = Announcement(event_id=event_id, title=body.title, content=body.content,
                       visibility=body.visibility, is_pinned=body.is_pinned, created_by=current_user.id)
    db.add(ann)
    await db.flush()

    # Broadcast via WebSocket
    from app.websocket.manager import ws_manager
    import asyncio
    asyncio.create_task(ws_manager.broadcast_event_update(str(event_id), {
        "type": "announcement",
        "data": {"id": str(ann.id), "title": ann.title, "content": ann.content}
    }))

    return AnnouncementSchema.model_validate(ann)


# ─────────────────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────
notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


@notifications_router.get("")
async def get_notifications(
    current_user: CurrentUser,
    db: DbSession,
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
):
    svc = NotificationService(db)
    notifs = await svc.get_user_notifications(current_user.id, unread_only=unread_only, limit=limit)
    unread_count = await svc.get_unread_count(current_user.id)
    return {"notifications": [NotificationSchema.model_validate(n) for n in notifs], "unread_count": unread_count}


@notifications_router.post("/{notification_id}/read", status_code=204)
async def mark_notification_read(notification_id: uuid.UUID, current_user: CurrentUser, db: DbSession):
    await NotificationService(db).mark_read(notification_id, current_user.id)


@notifications_router.post("/read-all", status_code=204)
async def mark_all_read(current_user: CurrentUser, db: DbSession):
    await NotificationService(db).mark_all_read(current_user.id)


# ─────────────────────────────────────────────────────────────────────────
# ADMIN DASHBOARD
# ─────────────────────────────────────────────────────────────────────────
admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.get("/stats")
async def get_admin_stats(current_user: SuperAdmin, db: DbSession):
    total_events = (await db.execute(select(func.count(Event.id)))).scalar_one()
    active_events = (await db.execute(select(func.count(Event.id)).where(Event.status == EventStatus.LIVE))).scalar_one()
    from app.models.user import User
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_teams = (await db.execute(select(func.count(Team.id)))).scalar_one()
    total_challenges = (await db.execute(select(func.count(Challenge.id)))).scalar_one()
    total_submissions = (await db.execute(select(func.count(Submission.id)))).scalar_one()
    total_solves = (await db.execute(select(func.count(Solve.id)))).scalar_one()

    return {
        "total_events": total_events,
        "active_events": active_events,
        "total_participants": total_users,
        "total_teams": total_teams,
        "total_challenges": total_challenges,
        "total_submissions": total_submissions,
        "total_solves": total_solves,
    }


@admin_router.get("/audit-logs")
async def get_audit_logs(
    current_user: SuperAdmin,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
):
    from app.models.audit import AuditLog
    q = select(AuditLog)
    if action:
        q = q.where(AuditLog.action.ilike(f"%{action}%"))
    q = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    logs = (await db.execute(q)).scalars().all()
    total = (await db.execute(select(func.count(AuditLog.id)))).scalar_one()
    return {
        "items": [{"id": str(l.id), "actor_id": str(l.actor_id) if l.actor_id else None, "action": l.action,
                   "resource_type": l.resource_type, "resource_id": l.resource_id,
                   "ip_address": l.ip_address, "created_at": l.created_at.isoformat()} for l in logs],
        **_paginate(total, page, per_page),
    }


@admin_router.get("/submissions")
async def get_all_submissions(
    current_user: SuperAdmin,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    result: Optional[str] = Query(None),
    event_id: Optional[uuid.UUID] = Query(None),
):
    from sqlalchemy.orm import selectinload
    q = select(Submission).options(selectinload(Submission.user), selectinload(Submission.challenge))
    if result:
        try:
            q = q.where(Submission.result == SubmissionResult(result))
        except ValueError:
            pass
    if event_id:
        q = q.where(Submission.event_id == event_id)
    q = q.order_by(Submission.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    subs = (await db.execute(q)).scalars().all()
    total = (await db.execute(select(func.count(Submission.id)))).scalar_one()
    return {
        "items": [{"id": str(s.id), "challenge": s.challenge.name if s.challenge else None,
                   "user": s.user.username if s.user else None,
                   "submitted_flag_preview": s.submitted_flag_preview,
                   "result": s.result.value, "ip_address": s.ip_address,
                   "created_at": s.created_at.isoformat()} for s in subs],
        **_paginate(total, page, per_page),
    }


@admin_router.get("/challenges")
async def get_all_admin_challenges(
    current_user: SuperAdmin,
    db: DbSession,
    event_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
):
    q = select(Challenge).options(
        selectinload(Challenge.event),
        selectinload(Challenge.category),
        selectinload(Challenge.hints),
        selectinload(Challenge.files),
        selectinload(Challenge.flags),
    )
    if event_id:
        q = q.where(Challenge.event_id == event_id)
    if search:
        q = q.where(Challenge.name.ilike(f"%{search}%"))
    q = q.order_by(Challenge.created_at.desc())
    chs = (await db.execute(q)).scalars().all()
    return [
        {
            "id": str(c.id),
            "event_id": str(c.event_id),
            "event_name": c.event.name if c.event else None,
            "category_id": c.category_id,
            "category": {"id": c.category.id, "name": c.category.name, "color": c.category.color} if c.category else None,
            "name": c.name,
            "slug": c.slug,
            "description": c.description,
            "points": c.points,
            "current_points": c.current_points,
            "difficulty": c.difficulty.value,
            "status": c.status.value,
            "solve_count": c.solve_count,
            "flags_count": len(c.flags),
            "hints_count": len(c.hints),
            "files_count": len(c.files),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in chs
    ]


@admin_router.get("/users")
async def get_admin_users(
    current_user: SuperAdmin,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    from app.models.user import User
    q = select(User).options(selectinload(User.roles))
    if search:
        q = q.where((User.username.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%")))
    q = q.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    users = (await db.execute(q)).scalars().all()
    total = (await db.execute(select(func.count(User.id)))).scalar_one()
    return {
        "items": [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "display_name": u.display_name,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "roles": [r.name.value if hasattr(r.name, "value") else str(r.name) for r in u.roles],
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        **_paginate(total, page, per_page),
    }


@admin_router.patch("/users/{user_id}")
async def update_admin_user(
    user_id: uuid.UUID,
    body: dict,
    current_user: SuperAdmin,
    db: DbSession,
    request: Request,
):
    from app.models.user import User
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if "is_active" in body:
        u.is_active = bool(body["is_active"])
    await db.flush()
    await AuditService(db).log(action="user.status_toggle", resource_type="user", resource_id=str(user_id), actor_id=str(current_user.id), request=request)
    return {"id": str(u.id), "is_active": u.is_active}


_PLATFORM_SETTINGS = {
    "platform_name": "CTF Platform",
    "registration_open": True,
    "email_verification_required": False,
    "maintenance_mode": False,
    "max_teams_per_user": 5,
    "default_theme": "light",
}


@admin_router.get("/settings")
async def get_admin_settings(current_user: SuperAdmin):
    return _PLATFORM_SETTINGS


@admin_router.patch("/settings")
async def update_admin_settings(body: dict, current_user: SuperAdmin, db: DbSession, request: Request):
    for k, v in body.items():
        if k in _PLATFORM_SETTINGS:
            _PLATFORM_SETTINGS[k] = v
    await AuditService(db).log(action="settings.update", resource_type="platform", resource_id="global", actor_id=str(current_user.id), request=request)
    return _PLATFORM_SETTINGS


# ─────────────────────────────────────────────────────────────────────────
# CERTIFICATES
# ─────────────────────────────────────────────────────────────────────────
cert_router = APIRouter(prefix="/certificates", tags=["Certificates"])


@cert_router.get("/{cert_uid}")
async def verify_certificate(cert_uid: str, db: DbSession):
    from app.models.score import Certificate
    cert = (await db.execute(
        select(Certificate).where(Certificate.certificate_uid == cert_uid)
        .options(selectinload(Certificate.user), selectinload(Certificate.event), selectinload(Certificate.team))
    )).scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {
        "valid": True,
        "certificate_uid": cert_uid,
        "participant": cert.user.display_name or cert.user.username,
        "team": cert.team.name if cert.team else None,
        "event": cert.event.name,
        "rank": cert.rank,
        "score": cert.score,
        "solve_count": cert.solve_count,
        "generated_at": cert.generated_at.isoformat(),
    }


@cert_router.post("/events/{event_id}/generate", status_code=201)
async def generate_certificates(event_id: uuid.UUID, current_user: EventAdmin, db: DbSession, background_tasks: BackgroundTasks):
    """Generate certificates for all participants in an ended event."""
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event or event.status != EventStatus.ENDED:
        raise HTTPException(status_code=400, detail="Event must be in ENDED status to generate certificates")

    from app.models.score import Certificate
    import secrets as secrets_mod
    from app.email.email_service import EmailService

    scores = (await db.execute(
        select(Score, Team).join(Team).where(Score.event_id == event_id).order_by(Score.total_points.desc())
    )).all()

    generated = 0
    for rank, (score, team) in enumerate(scores, start=1):
        members = (await db.execute(
            select(TeamMember).where(TeamMember.team_id == team.id).options(selectinload(TeamMember.user))
        )).scalars().all()

        for member in members:
            existing = (await db.execute(
                select(Certificate).where(Certificate.event_id == event_id, Certificate.user_id == member.user_id)
            )).scalar_one_or_none()
            if existing:
                continue

            uid = secrets_mod.token_urlsafe(32)
            cert = Certificate(
                event_id=event_id, user_id=member.user_id, team_id=team.id,
                rank=rank, score=score.total_points, solve_count=score.solve_count,
                certificate_uid=uid,
            )
            db.add(cert)
            await db.flush()

            cert_url = f"{settings.FRONTEND_URL}/certificates/{uid}"
            background_tasks.add_task(
                EmailService.send_certificate_email,
                to=member.user.email,
                username=member.user.display_name or member.user.username,
                event_name=event.name,
                rank=rank,
                score=score.total_points,
                certificate_url=cert_url,
            )
            generated += 1

    return {"message": f"Generated {generated} certificates"}
