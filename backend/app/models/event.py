"""
CTF Platform — Beanie Models: Event, EventSetting, EventRegistration
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    REGISTRATION_OPEN = "registration_open"
    UPCOMING = "upcoming"
    LIVE = "live"
    ENDED = "ended"
    ARCHIVED = "archived"


class EventVisibility(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    INVITE_ONLY = "invite_only"


class ScoringType(str, enum.Enum):
    STATIC = "static"
    DYNAMIC = "dynamic"


class LeaderboardStatus(str, enum.Enum):
    LIVE = "live"
    FROZEN = "frozen"
    FINAL = "final"


class RegistrationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class Event(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    name: str
    slug: Indexed(str, unique=True)
    description: Optional[str] = None
    rules: Optional[str] = None
    banner_url: Optional[str] = None
    logo_url: Optional[str] = None

    # Dates
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None
    timezone: str = "UTC"

    # Status & visibility
    status: EventStatus = EventStatus.DRAFT
    visibility: EventVisibility = EventVisibility.PUBLIC
    scoring_type: ScoringType = ScoringType.STATIC
    leaderboard_status: LeaderboardStatus = LeaderboardStatus.LIVE

    # Limits
    max_participants: Optional[int] = None
    max_teams: Optional[int] = None
    team_size: int = 4

    # Submission config
    submission_rate_limit: int = 10  # per minute
    require_approval: bool = False

    # Dynamic scoring config
    dynamic_score_initial: int = 500
    dynamic_score_minimum: int = 100
    dynamic_score_decay: float = 0.5

    # Ownership
    created_by: Optional[uuid.UUID] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "events"

    def __repr__(self) -> str:
        return f"<Event {self.slug} [{self.status}]>"


class EventSetting(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: uuid.UUID
    key: str
    value: Optional[str] = None

    class Settings:
        name = "event_settings"


class EventRegistration(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: uuid.UUID
    user_id: uuid.UUID
    team_id: Optional[uuid.UUID] = None
    status: RegistrationStatus = RegistrationStatus.APPROVED
    registered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None

    class Settings:
        name = "event_registrations"

    def __repr__(self) -> str:
        return f"<EventRegistration event={self.event_id} user={self.user_id} [{self.status}]>"
