"""
CTF Platform — Events, Registration, Teams, Challenges, Submissions, Leaderboard API (MongoDB / Beanie)
All major platform API routes consolidated in a well-organized v1 router.
"""
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Union

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, UploadFile, File, status
from slugify import slugify

from app.core.deps import CurrentUser, DbSession, EventAdmin, SuperAdmin, ChallengeAuthor, OptionalCurrentUser
from app.core.security import hash_flag, verify_flag
from app.schemas.schemas import (
    EventCreateSchema, EventUpdateSchema, EventSchema, EventDetailSchema,
    TeamCreateSchema, TeamSchema, TeamDetailSchema, TeamInviteSchema,
    CategoryCreateSchema,
    ChallengeCreateSchema, ChallengeUpdateSchema,
    FlagCreateSchema, HintCreateSchema,
    FlagSubmitSchema, SubmissionResultSchema,
    AnnouncementCreateSchema, AnnouncementSchema,
    UserPrivateSchema, UserUpdateSchema,
)
from app.models.event import Event, EventSetting, EventRegistration, EventStatus, EventVisibility, LeaderboardStatus, RegistrationStatus
from app.models.team import Team, TeamMember, TeamInvitation, TeamMemberRole, InvitationStatus
from app.models.challenge import Category, Challenge, ChallengeFlag, ChallengeHint, ChallengeFile, HintUnlock, ChallengeStatus, FlagType, Difficulty
from app.models.submission import Submission, Solve, SubmissionResult
from app.models.score import Score, ScoreEvent, Certificate
from app.models.notification import Announcement, Notification, NotificationType
from app.models.user import User
from app.models.audit import AuditLog
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.storage.storage_service import storage_service
from app.core.config import settings

router = APIRouter()


# ── Helper ────────────────────────────────────────────────────────────────
def _slugify(text: str) -> str:
    return slugify(text, max_length=200)


def _paginate(total: int, page: int, per_page: int) -> dict:
    return {"total": total, "page": page, "per_page": per_page, "pages": math.ceil(total / per_page) if per_page > 0 else 1}


def _to_uuid(val: Union[uuid.UUID, str]) -> uuid.UUID:
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


# ─────────────────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────────────────
users_router = APIRouter(prefix="/users", tags=["Users"])


@users_router.get("/me")
async def get_me(current_user: CurrentUser):
    data = current_user.model_dump()
    data["roles"] = [{"id": i, "name": r} for i, r in enumerate(current_user.roles, 1)]
    return data


@users_router.patch("/me")
async def update_me(body: UserUpdateSchema, current_user: CurrentUser, db: DbSession):
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(current_user, field, val)
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()
    data = current_user.model_dump()
    data["roles"] = [{"id": i, "name": r} for i, r in enumerate(current_user.roles, 1)]
    return data


@users_router.get("/{username}", response_model=dict)
async def get_user_profile(username: str, db: DbSession):
    from app.repositories.user_repository import UserRepository
    user = await UserRepository().get_by_username(username)
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
    query: dict = {"visibility": EventVisibility.PUBLIC.value}
    if status:
        try:
            query["status"] = EventStatus(status).value
        except ValueError:
            pass

    events = await Event.find(query).sort("-created_at").skip((page - 1) * per_page).limit(per_page).to_list()
    total = await Event.find(query).count()
    return {"items": [EventSchema.model_validate(e.model_dump()) for e in events], **_paginate(total, page, per_page)}


@events_router.post("", status_code=201)
async def create_event(body: EventCreateSchema, current_user: EventAdmin, db: DbSession, request: Request):
    slug = _slugify(body.name)
    existing = await Event.find_one(Event.slug == slug)
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    event = Event(
        **body.model_dump(),
        slug=slug,
        created_by=current_user.id,
    )
    await event.insert()
    await AuditService(db).log(
        action="event.create",
        resource_type="event",
        resource_id=str(event.id),
        actor_id=str(current_user.id),
        request=request,
    )
    return EventDetailSchema.model_validate(event.model_dump())


@events_router.get("/{slug}")
async def get_event(slug: str, db: DbSession):
    event = await Event.find_one(Event.slug == slug)
    if not event or event.visibility == EventVisibility.PRIVATE:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventDetailSchema.model_validate(event.model_dump())


@events_router.patch("/{event_id}")
async def update_event(event_id: uuid.UUID, body: EventUpdateSchema, current_user: EventAdmin, db: DbSession, request: Request):
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(event, field, val)
    event.updated_at = datetime.now(timezone.utc)
    await event.save()
    await AuditService(db).log(
        action="event.update",
        resource_type="event",
        resource_id=str(event.id),
        actor_id=str(current_user.id),
        request=request,
    )
    return EventDetailSchema.model_validate(event.model_dump())


@events_router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: uuid.UUID, current_user: SuperAdmin, db: DbSession, request: Request):
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await event.delete()
    await AuditService(db).log(
        action="event.delete",
        resource_type="event",
        resource_id=str(event_id),
        actor_id=str(current_user.id),
        request=request,
    )


# Event Registration
@events_router.post("/{event_id}/register", status_code=201)
async def register_for_event(event_id: uuid.UUID, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks):
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status not in (EventStatus.REGISTRATION_OPEN, EventStatus.UPCOMING):
        raise HTTPException(status_code=400, detail="Registration is not open")

    existing = await EventRegistration.find_one({"event_id": event_id, "user_id": current_user.id})
    if existing:
        raise HTTPException(status_code=409, detail="Already registered")

    reg_status = RegistrationStatus.PENDING if event.require_approval else RegistrationStatus.APPROVED
    reg = EventRegistration(event_id=event_id, user_id=current_user.id, status=reg_status)
    await reg.insert()

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
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    reg = await EventRegistration.find_one({
        "event_id": event_id,
        "user_id": current_user.id,
        "status": RegistrationStatus.APPROVED.value,
    })
    if not reg:
        raise HTTPException(status_code=403, detail="You must be registered for this event")

    # Check not already in a team for this event
    user_memberships = await TeamMember.find(TeamMember.user_id == current_user.id).to_list()
    user_team_ids = [m.team_id for m in user_memberships]
    if user_team_ids:
        existing_event_team = await Team.find_one({"id": {"$in": user_team_ids}, "event_id": event_id})
        if existing_event_team:
            raise HTTPException(status_code=409, detail="Already in a team for this event")

    slug = _slugify(body.name)
    team = Team(
        event_id=event_id,
        name=body.name,
        slug=slug,
        owner_id=current_user.id,
        description=body.description,
        is_private=body.is_private,
    )
    await team.insert()

    member = TeamMember(team_id=team.id, user_id=current_user.id, role=TeamMemberRole.OWNER)
    await member.insert()

    score = Score(event_id=event_id, team_id=team.id)
    await score.insert()

    return TeamSchema.model_validate(team.model_dump())


@teams_router.get("")
async def list_teams(event_id: uuid.UUID, db: DbSession):
    teams = await Team.find({"event_id": event_id, "is_private": False}).to_list()
    return [TeamSchema.model_validate(t.model_dump()) for t in teams]


@teams_router.post("/{team_id}/invite")
async def invite_to_team(event_id: uuid.UUID, team_id: uuid.UUID, body: TeamInviteSchema, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks):
    team = await Team.find_one({"id": team_id, "event_id": event_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the team owner can invite members")

    from app.repositories.user_repository import UserRepository
    invitee = await UserRepository().get_by_username(body.username)
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")

    from app.core.security import generate_secure_token
    token = generate_secure_token(32)
    invitation = TeamInvitation(
        team_id=team_id,
        invitee_id=invitee.id,
        inviter_id=current_user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=2),
    )
    await invitation.insert()

    event = await Event.get(event_id)
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
    now = datetime.now(timezone.utc)
    invitation = await TeamInvitation.find_one({
        "token": token,
        "invitee_id": current_user.id,
        "status": InvitationStatus.PENDING.value,
        "expires_at": {"$gt": now},
    })
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")

    invitation.status = InvitationStatus.ACCEPTED
    invitation.responded_at = now
    await invitation.save()

    member = TeamMember(team_id=invitation.team_id, user_id=current_user.id, role=TeamMemberRole.MEMBER)
    await member.insert()
    return {"message": "Team joined successfully"}


# ─────────────────────────────────────────────────────────────────────────
# CATEGORIES
# ─────────────────────────────────────────────────────────────────────────
categories_router = APIRouter(prefix="/events/{event_id}/categories", tags=["Categories"])


@categories_router.get("")
async def list_categories(event_id: uuid.UUID, db: DbSession):
    cats = await Category.find({"$or": [{"event_id": event_id}, {"event_id": None}]}).sort("order_index").to_list()
    return [{"id": str(c.id), "name": c.name, "slug": c.slug, "color": c.color, "icon": c.icon} for c in cats]


@categories_router.post("", status_code=201)
async def create_category(event_id: uuid.UUID, body: CategoryCreateSchema, current_user: EventAdmin, db: DbSession):
    slug = _slugify(body.name)
    cat = Category(event_id=event_id, name=body.name, slug=slug, color=body.color, icon=body.icon, description=body.description)
    await cat.insert()
    return {"id": str(cat.id), "name": cat.name, "slug": cat.slug, "color": cat.color}


# ─────────────────────────────────────────────────────────────────────────
# CHALLENGES
# ─────────────────────────────────────────────────────────────────────────
challenges_router = APIRouter(prefix="/events/{event_id}/challenges", tags=["Challenges"])


@challenges_router.get("")
async def list_challenges(
    event_id: uuid.UUID,
    db: DbSession,
    current_user: OptionalCurrentUser = None,
    category: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    all_statuses: Optional[bool] = Query(False),
):
    is_privileged = False
    if current_user and any(r in ["super_admin", "event_admin", "challenge_author"] for r in current_user.roles):
        is_privileged = True

    query: dict = {"event_id": event_id}
    if not (all_statuses and is_privileged):
        query["status"] = ChallengeStatus.PUBLISHED.value

    if category:
        try:
            query["category_id"] = _to_uuid(category)
        except Exception:
            pass

    if difficulty:
        try:
            query["difficulty"] = Difficulty(difficulty).value
        except ValueError:
            pass

    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    challenges = await Challenge.find(query).sort("-created_at").to_list()

    solved_challenge_ids = set()
    unlocked_hint_ids = set()
    if current_user:
        user_memberships = await TeamMember.find(TeamMember.user_id == current_user.id).to_list()
        team_ids = [m.team_id for m in user_memberships]
        if team_ids:
            solves = await Solve.find({"team_id": {"$in": team_ids}}).to_list()
            solved_challenge_ids = {s.challenge_id for s in solves}

            unlocks = await HintUnlock.find({"team_id": {"$in": team_ids}}).to_list()
            unlocked_hint_ids = {u.hint_id for u in unlocks}

    result = []
    for ch in challenges:
        is_solved = ch.id in solved_challenge_ids

        # Load related hints, files, flags, and category
        hints_docs = await ChallengeHint.find(ChallengeHint.challenge_id == ch.id).sort("order_index").to_list()
        files_docs = await ChallengeFile.find(ChallengeFile.challenge_id == ch.id).to_list()
        flags_count = await ChallengeFlag.find(ChallengeFlag.challenge_id == ch.id).count() if is_privileged else None

        category_obj = None
        if ch.category_id:
            cat = await Category.get(ch.category_id)
            if cat:
                category_obj = {"id": str(cat.id), "name": cat.name, "color": cat.color}

        hints = []
        for hint in hints_docs:
            unlocked = hint.id in unlocked_hint_ids or is_privileged
            content = hint.content if unlocked else None
            hints.append({
                "id": str(hint.id),
                "cost": hint.cost,
                "order_index": hint.order_index,
                "is_unlocked": unlocked,
                "content": content,
            })

        files = []
        for f in files_docs:
            url = await storage_service.get_file_url(f.storage_key)
            files.append({
                "id": str(f.id),
                "original_filename": f.original_filename,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
                "download_url": url,
            })

        result.append({
            "id": str(ch.id),
            "name": ch.name,
            "slug": ch.slug,
            "description": ch.description,
            "points": ch.points,
            "current_points": ch.current_points,
            "difficulty": ch.difficulty.value if hasattr(ch.difficulty, "value") else str(ch.difficulty),
            "status": ch.status.value if hasattr(ch.status, "value") else str(ch.status),
            "category_id": str(ch.category_id) if ch.category_id else None,
            "category": category_obj,
            "solve_count": ch.solve_count,
            "is_solved": is_solved,
            "flags_count": flags_count,
            "files": files,
            "hints": hints,
        })

    return result


@challenges_router.post("", status_code=201)
async def create_challenge(event_id: uuid.UUID, body: ChallengeCreateSchema, current_user: ChallengeAuthor, db: DbSession, request: Request):
    slug = _slugify(body.name)
    existing = await Challenge.find_one({"event_id": event_id, "slug": slug})
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    cat_id = None
    if body.category_id:
        try:
            cat_id = _to_uuid(body.category_id)
        except Exception:
            pass

    ch = Challenge(
        event_id=event_id,
        category_id=cat_id,
        name=body.name,
        slug=slug,
        description=body.description,
        points=body.points,
        current_points=body.points,
        difficulty=body.difficulty,
        status=body.status or ChallengeStatus.PUBLISHED,
        author_id=current_user.id,
    )
    await ch.insert()

    # Add initial flag if supplied
    if body.flag and body.flag.strip():
        flag_hash = hash_flag(body.flag.strip(), case_sensitive=body.is_case_sensitive if body.is_case_sensitive is not None else True)
        flag = ChallengeFlag(
            challenge_id=ch.id,
            flag_type=body.flag_type or FlagType.STATIC,
            flag_value=flag_hash,
            is_case_sensitive=body.is_case_sensitive if body.is_case_sensitive is not None else True,
        )
        await flag.insert()

    await AuditService(db).log(
        action="challenge.create",
        resource_type="challenge",
        resource_id=str(ch.id),
        actor_id=str(current_user.id),
        request=request,
    )
    return {"id": str(ch.id), "name": ch.name, "slug": ch.slug, "status": ch.status.value, "points": ch.points}


challenge_router = APIRouter(prefix="/challenges", tags=["Challenges"])


@challenge_router.get("/{challenge_id}")
async def get_challenge(challenge_id: uuid.UUID, db: DbSession, current_user: OptionalCurrentUser = None):
    ch = await Challenge.get(challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    is_privileged = False
    if current_user and any(r in ["super_admin", "event_admin", "challenge_author"] for r in current_user.roles):
        is_privileged = True

    if ch.status != ChallengeStatus.PUBLISHED and not is_privileged:
        raise HTTPException(status_code=404, detail="Challenge not found")

    files_docs = await ChallengeFile.find(ChallengeFile.challenge_id == ch.id).to_list()
    hints_docs = await ChallengeHint.find(ChallengeHint.challenge_id == ch.id).sort("order_index").to_list()
    flags_count = await ChallengeFlag.find(ChallengeFlag.challenge_id == ch.id).count() if is_privileged else None

    category_obj = None
    if ch.category_id:
        cat = await Category.get(ch.category_id)
        if cat:
            category_obj = {"id": str(cat.id), "name": cat.name, "color": cat.color}

    files = []
    for f in files_docs:
        url = await storage_service.get_file_url(f.storage_key)
        files.append({
            "id": str(f.id),
            "original_filename": f.original_filename,
            "file_size": f.file_size,
            "mime_type": f.mime_type,
            "download_url": url,
        })

    return {
        "id": str(ch.id),
        "event_id": str(ch.event_id),
        "name": ch.name,
        "slug": ch.slug,
        "description": ch.description,
        "points": ch.points,
        "current_points": ch.current_points,
        "difficulty": ch.difficulty.value if hasattr(ch.difficulty, "value") else str(ch.difficulty),
        "status": ch.status.value if hasattr(ch.status, "value") else str(ch.status),
        "category_id": str(ch.category_id) if ch.category_id else None,
        "category": category_obj,
        "solve_count": ch.solve_count,
        "flags_count": flags_count,
        "hints": [{"id": str(h.id), "cost": h.cost, "order_index": h.order_index, "content": h.content if is_privileged else None} for h in hints_docs],
        "files": files,
    }


@challenge_router.patch("/{challenge_id}")
@challenge_router.put("/{challenge_id}")
async def update_challenge(challenge_id: uuid.UUID, body: ChallengeUpdateSchema, current_user: ChallengeAuthor, db: DbSession, request: Request):
    ch = await Challenge.get(challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    new_flag = data.pop("flag", None)
    is_case_sensitive = data.pop("is_case_sensitive", True)

    for field, val in data.items():
        if field == "category_id" and val:
            try:
                val = _to_uuid(val)
            except Exception:
                pass
        setattr(ch, field, val)

    if "points" in data and ch.solve_count == 0:
        ch.current_points = data["points"]

    ch.updated_at = datetime.now(timezone.utc)
    await ch.save()

    if new_flag and new_flag.strip():
        flag_hash = hash_flag(new_flag.strip(), case_sensitive=is_case_sensitive)
        flag = ChallengeFlag(
            challenge_id=ch.id,
            flag_type=FlagType.STATIC,
            flag_value=flag_hash,
            is_case_sensitive=is_case_sensitive,
        )
        await flag.insert()

    await AuditService(db).log(
        action="challenge.update",
        resource_type="challenge",
        resource_id=str(challenge_id),
        actor_id=str(current_user.id),
        request=request,
    )
    return {"id": str(ch.id), "name": ch.name, "status": ch.status.value, "points": ch.points}


@challenge_router.delete("/{challenge_id}")
async def delete_challenge(challenge_id: uuid.UUID, current_user: ChallengeAuthor, db: DbSession, request: Request):
    ch = await Challenge.get(challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    await ChallengeFlag.find(ChallengeFlag.challenge_id == challenge_id).delete()
    await ChallengeHint.find(ChallengeHint.challenge_id == challenge_id).delete()
    await ChallengeFile.find(ChallengeFile.challenge_id == challenge_id).delete()
    await ch.delete()
    await AuditService(db).log(
        action="challenge.delete",
        resource_type="challenge",
        resource_id=str(challenge_id),
        actor_id=str(current_user.id),
        request=request,
    )
    return {"message": "Challenge deleted successfully"}


@challenge_router.get("/{challenge_id}/flags")
async def list_flags(challenge_id: uuid.UUID, current_user: ChallengeAuthor, db: DbSession):
    flags = await ChallengeFlag.find(ChallengeFlag.challenge_id == challenge_id).to_list()
    return [{"id": str(f.id), "flag_type": f.flag_type.value, "is_case_sensitive": f.is_case_sensitive} for f in flags]


@challenge_router.post("/{challenge_id}/flags", status_code=201)
async def add_flag(challenge_id: uuid.UUID, body: FlagCreateSchema, current_user: ChallengeAuthor, db: DbSession, request: Request):
    ch = await Challenge.get(challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    flag_hash = hash_flag(body.flag_value, case_sensitive=body.is_case_sensitive)
    flag = ChallengeFlag(
        challenge_id=challenge_id,
        flag_type=body.flag_type,
        flag_value=flag_hash,
        is_case_sensitive=body.is_case_sensitive,
    )
    await flag.insert()
    await AuditService(db).log(
        action="flag.create",
        resource_type="challenge",
        resource_id=str(challenge_id),
        actor_id=str(current_user.id),
        request=request,
    )
    return {"message": "Flag added", "flag_id": str(flag.id)}


@challenge_router.delete("/{challenge_id}/flags/{flag_id}")
async def delete_flag(challenge_id: uuid.UUID, flag_id: str, current_user: ChallengeAuthor, db: DbSession, request: Request):
    fid = _to_uuid(flag_id)
    flag = await ChallengeFlag.find_one({"id": fid, "challenge_id": challenge_id})
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    await flag.delete()
    await AuditService(db).log(
        action="flag.delete",
        resource_type="challenge",
        resource_id=str(challenge_id),
        actor_id=str(current_user.id),
        request=request,
    )
    return {"message": "Flag removed"}


@challenge_router.post("/{challenge_id}/hints", status_code=201)
async def add_hint(challenge_id: uuid.UUID, body: HintCreateSchema, current_user: ChallengeAuthor, db: DbSession):
    ch = await Challenge.get(challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    hint = ChallengeHint(challenge_id=challenge_id, content=body.content, cost=body.cost, order_index=body.order_index)
    await hint.insert()
    return {"id": str(hint.id), "cost": hint.cost}


@challenge_router.delete("/{challenge_id}/hints/{hint_id}")
async def delete_hint(challenge_id: uuid.UUID, hint_id: str, current_user: ChallengeAuthor, db: DbSession):
    hid = _to_uuid(hint_id)
    hint = await ChallengeHint.find_one({"id": hid, "challenge_id": challenge_id})
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found")
    await hint.delete()
    return {"message": "Hint deleted"}


@challenge_router.post("/{challenge_id}/hints/{hint_id}/unlock")
async def unlock_hint(challenge_id: uuid.UUID, hint_id: str, current_user: CurrentUser, db: DbSession):
    hid = _to_uuid(hint_id)
    hint = await ChallengeHint.find_one({"id": hid, "challenge_id": challenge_id})
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found")

    ch = await Challenge.get(challenge_id)
    user_memberships = await TeamMember.find(TeamMember.user_id == current_user.id).to_list()
    team_member = None
    for m in user_memberships:
        team = await Team.get(m.team_id)
        if team and team.event_id == ch.event_id:
            team_member = m
            break

    if not team_member:
        raise HTTPException(status_code=403, detail="You must be in a team to unlock hints")

    existing = await HintUnlock.find_one({"hint_id": hid, "team_id": team_member.team_id})
    if existing:
        return {"content": hint.content, "already_unlocked": True}

    if hint.cost > 0:
        score = await Score.find_one({"team_id": team_member.team_id, "event_id": ch.event_id})
        if score:
            score.total_points = max(0, score.total_points - hint.cost)
            await score.save()

        score_evt = ScoreEvent(
            event_id=ch.event_id,
            team_id=team_member.team_id,
            user_id=current_user.id,
            challenge_id=challenge_id,
            delta=-hint.cost,
            reason="hint_unlock",
        )
        await score_evt.insert()

    unlock = HintUnlock(hint_id=hid, team_id=team_member.team_id, user_id=current_user.id, points_deducted=hint.cost)
    await unlock.insert()
    return {"content": hint.content, "points_deducted": hint.cost}


@challenge_router.post("/{challenge_id}/files", status_code=201)
async def upload_challenge_file(
    challenge_id: uuid.UUID,
    current_user: ChallengeAuthor,
    db: DbSession,
    file: UploadFile = File(...),
):
    ch = await Challenge.get(challenge_id)
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
    await cf.insert()
    url = await storage_service.get_file_url(storage_key)
    return {"id": str(cf.id), "filename": cf.original_filename, "download_url": url}


@challenge_router.delete("/{challenge_id}/files/{file_id}")
async def delete_challenge_file(
    challenge_id: uuid.UUID,
    file_id: uuid.UUID,
    current_user: ChallengeAuthor,
    db: DbSession,
):
    cf = await ChallengeFile.find_one({"id": file_id, "challenge_id": challenge_id})
    if not cf:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        await storage_service.delete_challenge_file(cf.storage_key)
    except Exception:
        pass
    await cf.delete()
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
    ch = await Challenge.find_one({"id": challenge_id, "status": ChallengeStatus.PUBLISHED.value})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    event = await Event.get(ch.event_id)
    if not event or event.status != EventStatus.LIVE:
        result_val = SubmissionResult.EVENT_NOT_LIVE
        preview = body.flag[:100]
        sub = Submission(
            challenge_id=challenge_id,
            event_id=ch.event_id,
            user_id=current_user.id,
            submitted_flag_preview=preview,
            result=result_val,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await sub.insert()
        return SubmissionResultSchema(result=result_val, message="Event is not currently live")

    # Find user's team for this event
    user_memberships = await TeamMember.find(TeamMember.user_id == current_user.id).to_list()
    team_id = None
    for m in user_memberships:
        team = await Team.get(m.team_id)
        if team and team.event_id == ch.event_id:
            team_id = team.id
            break

    # Rate limiting: max N submissions per minute per challenge per team
    if team_id and settings.RATE_LIMIT_ENABLED:
        one_minute_ago = datetime.now(timezone.utc) - timedelta(minutes=1)
        recent_count = await Submission.find({
            "challenge_id": challenge_id,
            "team_id": team_id,
            "created_at": {"$gt": one_minute_ago},
        }).count()
        if recent_count >= event.submission_rate_limit:
            preview = body.flag[:100]
            sub = Submission(
                challenge_id=challenge_id,
                event_id=ch.event_id,
                user_id=current_user.id,
                team_id=team_id,
                submitted_flag_preview=preview,
                result=SubmissionResult.RATE_LIMITED,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
            await sub.insert()
            return SubmissionResultSchema(
                result=SubmissionResult.RATE_LIMITED,
                message="Too many submissions. Please wait before trying again.",
            )

    # Check already solved
    if team_id:
        already = await Solve.find_one({"challenge_id": challenge_id, "team_id": team_id})
        if already:
            preview = body.flag[:100]
            sub = Submission(
                challenge_id=challenge_id,
                event_id=ch.event_id,
                user_id=current_user.id,
                team_id=team_id,
                submitted_flag_preview=preview,
                result=SubmissionResult.ALREADY_SOLVED,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
            await sub.insert()
            return SubmissionResultSchema(
                result=SubmissionResult.ALREADY_SOLVED,
                message="Your team already solved this challenge",
            )

    # Verify flag against all stored hashes
    flags = await ChallengeFlag.find(ChallengeFlag.challenge_id == challenge_id).to_list()
    is_correct = False
    for flag_obj in flags:
        if verify_flag(body.flag, flag_obj.flag_value, case_sensitive=flag_obj.is_case_sensitive):
            is_correct = True
            break

    preview = body.flag[:100]
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    if not is_correct:
        sub = Submission(
            challenge_id=challenge_id,
            event_id=ch.event_id,
            user_id=current_user.id,
            team_id=team_id,
            submitted_flag_preview=preview,
            result=SubmissionResult.INCORRECT,
            ip_address=ip,
            user_agent=ua,
        )
        await sub.insert()
        return SubmissionResultSchema(result=SubmissionResult.INCORRECT, message="Incorrect flag. Keep trying!")

    # ── CORRECT FLAG ──────────────────────────────────────────────────────
    points = _calculate_points(event, ch)

    sub = Submission(
        challenge_id=challenge_id,
        event_id=ch.event_id,
        user_id=current_user.id,
        team_id=team_id,
        submitted_flag_preview=preview,
        result=SubmissionResult.CORRECT,
        ip_address=ip,
        user_agent=ua,
    )
    await sub.insert()

    solve = Solve(
        challenge_id=challenge_id,
        event_id=ch.event_id,
        team_id=team_id or current_user.id,
        user_id=current_user.id,
        submission_id=sub.id,
        points_awarded=points,
    )
    await solve.insert()

    ch.solve_count += 1
    if event.scoring_type == ScoringType.DYNAMIC:
        ch.current_points = _calculate_dynamic_points(event, ch.solve_count)
    await ch.save()

    if team_id:
        now = datetime.now(timezone.utc)
        score = await Score.find_one({"team_id": team_id, "event_id": ch.event_id})
        if score:
            score.total_points += points
            score.solve_count += 1
            score.last_solve_at = now
            await score.save()
        else:
            score = Score(
                event_id=ch.event_id,
                team_id=team_id,
                total_points=points,
                solve_count=1,
                last_solve_at=now,
            )
            await score.insert()

        score_evt = ScoreEvent(
            event_id=ch.event_id,
            team_id=team_id,
            user_id=current_user.id,
            challenge_id=challenge_id,
            delta=points,
            reason="solve",
        )
        await score_evt.insert()

    try:
        from app.websocket.manager import ws_manager
        import asyncio
        asyncio.create_task(ws_manager.broadcast_event_update(str(ch.event_id), {
            "type": "leaderboard_update",
            "solve": {"challenge": ch.name, "team_id": str(team_id) if team_id else None, "points": points}
        }))
    except Exception:
        pass

    return SubmissionResultSchema(result=SubmissionResult.CORRECT, message="Correct! 🎉", points_awarded=points)


def _calculate_points(event: Event, challenge: Challenge) -> int:
    if event.scoring_type == ScoringType.DYNAMIC:
        return _calculate_dynamic_points(event, challenge.solve_count)
    return challenge.points


def _calculate_dynamic_points(event: Event, solve_count: int) -> int:
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
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    scores = await Score.find(Score.event_id == event_id).sort("-total_points", "last_solve_at").skip((page - 1) * per_page).limit(per_page).to_list()
    total = await Score.find(Score.event_id == event_id).count()

    entries = []
    for rank, score in enumerate(scores, start=(page - 1) * per_page + 1):
        team = await Team.get(score.team_id)
        if team and team.is_disqualified:
            continue
        entries.append({
            "rank": rank,
            "team_id": str(score.team_id),
            "team_name": team.name if team else "Solo",
            "team_logo": team.logo_url if team else None,
            "country": team.country if team else None,
            "total_points": score.total_points,
            "solve_count": score.solve_count,
            "last_solve_at": score.last_solve_at.isoformat() if score.last_solve_at else None,
        })

    return {
        "event_id": str(event_id),
        "status": event.leaderboard_status.value if hasattr(event.leaderboard_status, "value") else str(event.leaderboard_status),
        "is_frozen": event.leaderboard_status == LeaderboardStatus.FROZEN,
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
    anns = await Announcement.find(Announcement.event_id == event_id).sort("-is_pinned", "-created_at").to_list()
    return [AnnouncementSchema.model_validate(a.model_dump()) for a in anns]


@announcements_router.post("", status_code=201)
async def create_announcement(
    event_id: uuid.UUID,
    body: AnnouncementCreateSchema,
    current_user: EventAdmin,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    ann = Announcement(
        event_id=event_id,
        title=body.title,
        content=body.content,
        visibility=body.visibility,
        is_pinned=body.is_pinned,
        created_by=current_user.id,
    )
    await ann.insert()

    try:
        from app.websocket.manager import ws_manager
        import asyncio
        asyncio.create_task(ws_manager.broadcast_event_update(str(event_id), {
            "type": "announcement",
            "data": {"id": str(ann.id), "title": ann.title, "content": ann.content}
        }))
    except Exception:
        pass

    return AnnouncementSchema.model_validate(ann.model_dump())


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
    svc = NotificationService()
    notifs = await svc.get_user_notifications(current_user.id, unread_only=unread_only, limit=limit)
    unread_count = await svc.get_unread_count(current_user.id)
    from app.schemas.schemas import NotificationSchema
    return {
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type.value if hasattr(n.type, "value") else str(n.type),
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in notifs
        ],
        "unread_count": unread_count,
    }


@notifications_router.post("/{notification_id}/read", status_code=204)
async def mark_notification_read(notification_id: uuid.UUID, current_user: CurrentUser, db: DbSession):
    await NotificationService().mark_read(notification_id, current_user.id)


@notifications_router.post("/read-all", status_code=204)
async def mark_all_read(current_user: CurrentUser, db: DbSession):
    await NotificationService().mark_all_read(current_user.id)


# ─────────────────────────────────────────────────────────────────────────
# ADMIN DASHBOARD
# ─────────────────────────────────────────────────────────────────────────
admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.get("/stats")
async def get_admin_stats(current_user: SuperAdmin, db: DbSession):
    total_events = await Event.count()
    active_events = await Event.find(Event.status == EventStatus.LIVE.value).count()
    total_users = await User.count()
    total_teams = await Team.count()
    total_challenges = await Challenge.count()
    total_submissions = await Submission.count()
    total_solves = await Solve.count()

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
    query = {}
    if action:
        query["action"] = {"$regex": action, "$options": "i"}

    logs = await AuditLog.find(query).sort("-created_at").skip((page - 1) * per_page).limit(per_page).to_list()
    total = await AuditLog.find(query).count()
    return {
        "items": [
            {
                "id": str(l.id),
                "actor_id": str(l.actor_id) if l.actor_id else None,
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
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
    query = {}
    if result:
        try:
            query["result"] = SubmissionResult(result).value
        except ValueError:
            pass
    if event_id:
        query["event_id"] = event_id

    subs = await Submission.find(query).sort("-created_at").skip((page - 1) * per_page).limit(per_page).to_list()
    total = await Submission.find(query).count()

    items = []
    for s in subs:
        ch = await Challenge.get(s.challenge_id)
        user = await User.get(s.user_id)
        items.append({
            "id": str(s.id),
            "challenge": ch.name if ch else None,
            "user": user.username if user else None,
            "submitted_flag_preview": s.submitted_flag_preview,
            "result": s.result.value if hasattr(s.result, "value") else str(s.result),
            "ip_address": s.ip_address,
            "created_at": s.created_at.isoformat(),
        })

    return {
        "items": items,
        **_paginate(total, page, per_page),
    }


@admin_router.get("/challenges")
async def get_all_admin_challenges(
    current_user: SuperAdmin,
    db: DbSession,
    event_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
):
    query = {}
    if event_id:
        query["event_id"] = event_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    chs = await Challenge.find(query).sort("-created_at").to_list()
    items = []
    for c in chs:
        ev = await Event.get(c.event_id)
        cat = await Category.get(c.category_id) if c.category_id else None
        flags_count = await ChallengeFlag.find(ChallengeFlag.challenge_id == c.id).count()
        hints_count = await ChallengeHint.find(ChallengeHint.challenge_id == c.id).count()
        files_count = await ChallengeFile.find(ChallengeFile.challenge_id == c.id).count()

        items.append({
            "id": str(c.id),
            "event_id": str(c.event_id),
            "event_name": ev.name if ev else None,
            "category_id": str(c.category_id) if c.category_id else None,
            "category": {"id": str(cat.id), "name": cat.name, "color": cat.color} if cat else None,
            "name": c.name,
            "slug": c.slug,
            "description": c.description,
            "points": c.points,
            "current_points": c.current_points,
            "difficulty": c.difficulty.value if hasattr(c.difficulty, "value") else str(c.difficulty),
            "status": c.status.value if hasattr(c.status, "value") else str(c.status),
            "solve_count": c.solve_count,
            "flags_count": flags_count,
            "hints_count": hints_count,
            "files_count": files_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return items


@admin_router.get("/users")
async def get_admin_users(
    current_user: SuperAdmin,
    db: DbSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    query = {}
    if search:
        query["$or"] = [
            {"username": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    users = await User.find(query).sort("-created_at").skip((page - 1) * per_page).limit(per_page).to_list()
    total = await User.find(query).count()
    return {
        "items": [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "display_name": u.display_name,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "roles": u.roles,
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
    u = await User.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if "is_active" in body:
        u.is_active = bool(body["is_active"])
    if "roles" in body and isinstance(body["roles"], list):
        u.roles = body["roles"]
    await u.save()
    await AuditService(db).log(
        action="user.status_toggle",
        resource_type="user",
        resource_id=str(user_id),
        actor_id=str(current_user.id),
        request=request,
    )
    return {"id": str(u.id), "is_active": u.is_active, "roles": u.roles}


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
    await AuditService(db).log(
        action="settings.update",
        resource_type="platform",
        resource_id="global",
        actor_id=str(current_user.id),
        request=request,
    )
    return _PLATFORM_SETTINGS


# ─────────────────────────────────────────────────────────────────────────
# CERTIFICATES
# ─────────────────────────────────────────────────────────────────────────
cert_router = APIRouter(prefix="/certificates", tags=["Certificates"])


@cert_router.get("/{cert_uid}")
async def verify_certificate(cert_uid: str, db: DbSession):
    cert = await Certificate.find_one(Certificate.certificate_uid == cert_uid)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    user = await User.get(cert.user_id)
    event = await Event.get(cert.event_id)
    team = await Team.get(cert.team_id) if cert.team_id else None

    return {
        "valid": True,
        "certificate_uid": cert_uid,
        "participant": (user.display_name or user.username) if user else "Participant",
        "team": team.name if team else None,
        "event": event.name if event else "CTF Event",
        "rank": cert.rank,
        "score": cert.score,
        "solve_count": cert.solve_count,
        "generated_at": cert.generated_at.isoformat(),
    }


@cert_router.post("/events/{event_id}/generate", status_code=201)
async def generate_certificates(event_id: uuid.UUID, current_user: EventAdmin, db: DbSession, background_tasks: BackgroundTasks):
    event = await Event.get(event_id)
    if not event or event.status != EventStatus.ENDED:
        raise HTTPException(status_code=400, detail="Event must be in ENDED status to generate certificates")

    import secrets as secrets_mod
    from app.email.email_service import EmailService

    scores = await Score.find(Score.event_id == event_id).sort("-total_points").to_list()

    generated = 0
    for rank, score in enumerate(scores, start=1):
        members = await TeamMember.find(TeamMember.team_id == score.team_id).to_list()
        for member in members:
            existing = await Certificate.find_one({"event_id": event_id, "user_id": member.user_id})
            if existing:
                continue

            uid = secrets_mod.token_urlsafe(32)
            cert = Certificate(
                event_id=event_id,
                user_id=member.user_id,
                team_id=score.team_id,
                rank=rank,
                score=score.total_points,
                solve_count=score.solve_count,
                certificate_uid=uid,
            )
            await cert.insert()

            user = await User.get(member.user_id)
            if user:
                cert_url = f"{settings.FRONTEND_URL}/certificates/{uid}"
                background_tasks.add_task(
                    EmailService.send_certificate_email,
                    to=user.email,
                    username=user.display_name or user.username,
                    event_name=event.name,
                    rank=rank,
                    score=score.total_points,
                    certificate_url=cert_url,
                )
            generated += 1

    return {"message": f"Generated {generated} certificates"}
