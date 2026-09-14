"""
CTF Platform — Pydantic Schemas: User, Event, Team, Challenge, Submission, Leaderboard, Notification
"""
import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field

from app.models.event import EventStatus, EventVisibility, ScoringType, RegistrationStatus
from app.models.challenge import ChallengeStatus, Difficulty, FlagType
from app.models.submission import SubmissionResult
from app.models.notification import NotificationType, AnnouncementVisibility
from app.models.team import InvitationStatus


# ── User ──────────────────────────────────────────────────────────────────
class RoleSchema(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class UserPublicSchema(BaseModel):
    id: uuid.UUID
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    country: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class UserPrivateSchema(UserPublicSchema):
    email: str
    bio: Optional[str]
    website: Optional[str]
    is_active: bool
    is_verified: bool
    totp_enabled: bool
    last_login_at: Optional[datetime]
    roles: List[RoleSchema] = []


class UserUpdateSchema(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=255)
    country: Optional[str] = Field(None, min_length=2, max_length=2)


# ── Event ─────────────────────────────────────────────────────────────────
class EventCreateSchema(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    rules: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None
    timezone: str = Field("UTC", max_length=50)
    visibility: EventVisibility = EventVisibility.PUBLIC
    scoring_type: ScoringType = ScoringType.STATIC
    max_participants: Optional[int] = Field(None, ge=1)
    max_teams: Optional[int] = Field(None, ge=1)
    team_size: int = Field(4, ge=1, le=20)
    require_approval: bool = False


class EventUpdateSchema(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    rules: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None
    timezone: Optional[str] = Field(None, max_length=50)
    visibility: Optional[EventVisibility] = None
    status: Optional[EventStatus] = None
    max_participants: Optional[int] = None
    max_teams: Optional[int] = None
    team_size: Optional[int] = Field(None, ge=1, le=20)
    submission_rate_limit: Optional[int] = Field(None, ge=1, le=100)
    dynamic_score_initial: Optional[int] = Field(None, ge=100)
    dynamic_score_minimum: Optional[int] = Field(None, ge=0)


class EventSchema(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str]
    banner_url: Optional[str]
    logo_url: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    registration_start: Optional[datetime]
    registration_end: Optional[datetime]
    timezone: str
    status: EventStatus
    visibility: EventVisibility
    scoring_type: ScoringType
    max_participants: Optional[int]
    max_teams: Optional[int]
    team_size: int
    created_at: datetime
    model_config = {"from_attributes": True}


class EventDetailSchema(EventSchema):
    rules: Optional[str]
    require_approval: bool
    submission_rate_limit: int
    leaderboard_status: str


# ── Team ─────────────────────────────────────────────────────────────────
class TeamCreateSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_private: bool = False


class TeamSchema(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    name: str
    slug: str
    logo_url: Optional[str]
    description: Optional[str]
    is_private: bool
    is_disqualified: bool
    country: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class TeamMemberSchema(BaseModel):
    user: UserPublicSchema
    role: str
    joined_at: datetime
    model_config = {"from_attributes": True}


class TeamDetailSchema(TeamSchema):
    members: List[TeamMemberSchema] = []


class TeamInviteSchema(BaseModel):
    username: str


# ── Category ─────────────────────────────────────────────────────────────
class CategoryCreateSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    icon: Optional[str] = None
    description: Optional[str] = None


class CategorySchema(BaseModel):
    id: int
    event_id: Optional[uuid.UUID]
    name: str
    slug: str
    color: Optional[str]
    icon: Optional[str]
    challenge_count: int = 0
    model_config = {"from_attributes": True}


# ── Challenge ─────────────────────────────────────────────────────────────
class ChallengeCreateSchema(BaseModel):
    category_id: Optional[int] = None
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    points: int = Field(100, ge=0)
    difficulty: Difficulty = Difficulty.MEDIUM
    status: Optional[ChallengeStatus] = ChallengeStatus.PUBLISHED
    flag: Optional[str] = None
    flag_type: Optional[FlagType] = FlagType.STATIC
    is_case_sensitive: Optional[bool] = True


class ChallengeUpdateSchema(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    points: Optional[int] = Field(None, ge=0)
    difficulty: Optional[Difficulty] = None
    status: Optional[ChallengeStatus] = None
    flag: Optional[str] = None
    is_case_sensitive: Optional[bool] = True


class ChallengeFileSchema(BaseModel):
    id: uuid.UUID
    original_filename: str
    file_size: int
    mime_type: str
    download_url: str
    model_config = {"from_attributes": True}


class ChallengeHintSchema(BaseModel):
    id: int
    cost: int
    order_index: int
    is_unlocked: bool = False
    content: Optional[str] = None  # Only populated if unlocked
    model_config = {"from_attributes": True}


class ChallengePublicSchema(BaseModel):
    """Challenge data sent to participants — never includes flags or admin notes."""
    id: uuid.UUID
    event_id: uuid.UUID
    name: str
    slug: str
    description: Optional[str]
    points: int
    current_points: int
    difficulty: Difficulty
    category: Optional[CategorySchema]
    status: ChallengeStatus
    solve_count: int
    is_solved: bool = False
    files: List[ChallengeFileSchema] = []
    hints: List[ChallengeHintSchema] = []
    model_config = {"from_attributes": True}


class ChallengeAdminSchema(ChallengePublicSchema):
    """Admin-only view with additional fields."""
    author_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class FlagCreateSchema(BaseModel):
    flag_value: str = Field(..., min_length=1, max_length=500)
    flag_type: FlagType = FlagType.STATIC
    is_case_sensitive: bool = True


class HintCreateSchema(BaseModel):
    content: str = Field(..., min_length=1)
    cost: int = Field(0, ge=0)
    order_index: int = Field(0, ge=0)


# ── Submission ────────────────────────────────────────────────────────────
class FlagSubmitSchema(BaseModel):
    flag: str = Field(..., min_length=1, max_length=500)


class SubmissionResultSchema(BaseModel):
    result: SubmissionResult
    message: str
    points_awarded: Optional[int] = None


class SubmissionAdminSchema(BaseModel):
    id: uuid.UUID
    challenge_id: uuid.UUID
    challenge_name: str = ""
    user: UserPublicSchema
    team_name: Optional[str] = None
    submitted_flag_preview: str
    result: SubmissionResult
    ip_address: Optional[str]
    user_agent: Optional[str]
    is_suspicious: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Leaderboard ───────────────────────────────────────────────────────────
class LeaderboardEntrySchema(BaseModel):
    rank: int
    team_id: uuid.UUID
    team_name: str
    team_logo: Optional[str]
    country: Optional[str]
    total_points: int
    solve_count: int
    last_solve_at: Optional[datetime]
    model_config = {"from_attributes": True}


class LeaderboardSchema(BaseModel):
    event_id: uuid.UUID
    status: str
    is_frozen: bool
    entries: List[LeaderboardEntrySchema]
    updated_at: datetime


# ── Notification & Announcement ───────────────────────────────────────────
class NotificationSchema(BaseModel):
    id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    metadata: Optional[dict]
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class AnnouncementCreateSchema(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    visibility: AnnouncementVisibility = AnnouncementVisibility.PUBLIC
    is_pinned: bool = False


class AnnouncementSchema(BaseModel):
    id: uuid.UUID
    event_id: Optional[uuid.UUID]
    title: str
    content: str
    visibility: AnnouncementVisibility
    is_pinned: bool
    created_at: datetime
    author: Optional[UserPublicSchema]
    model_config = {"from_attributes": True}


# ── Pagination ────────────────────────────────────────────────────────────
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
    pages: int
