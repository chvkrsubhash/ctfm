"""
CTF Platform — Beanie Models: Announcement, Notification
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class AnnouncementVisibility(str, enum.Enum):
    PUBLIC = "public"
    EVENT_ONLY = "event_only"
    TEAM_ONLY = "team_only"


class NotificationType(str, enum.Enum):
    EVENT_STARTED = "event_started"
    EVENT_ENDING = "event_ending"
    EVENT_ENDED = "event_ended"
    ANNOUNCEMENT = "announcement"
    TEAM_INVITATION = "team_invitation"
    TEAM_JOINED = "team_joined"
    CHALLENGE_SOLVED = "challenge_solved"
    ADMIN_MESSAGE = "admin_message"
    CERTIFICATE_READY = "certificate_ready"


class Announcement(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: Optional[uuid.UUID] = None  # None = platform-wide
    title: str
    content: str
    visibility: AnnouncementVisibility = AnnouncementVisibility.PUBLIC
    created_by: Optional[uuid.UUID] = None
    is_pinned: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "announcements"


class Notification(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    user_id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    extra_data: Optional[dict] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read_at: Optional[datetime] = None

    class Settings:
        name = "notifications"
