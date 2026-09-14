"""
CTF Platform — SQLAlchemy Models: Event, EventSettings, EventRegistration
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, Enum, ForeignKey,
    Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.team import Team
    from app.models.challenge import Challenge, Category
    from app.models.submission import Submission
    from app.models.score import Score
    from app.models.notification import Announcement


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


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    rules: Mapped[Optional[str]] = mapped_column(Text)
    banner_url: Mapped[Optional[str]] = mapped_column(String(500))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Dates
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    registration_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    registration_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)

    # Status & visibility
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status"), default=EventStatus.DRAFT, nullable=False
    )
    visibility: Mapped[EventVisibility] = mapped_column(
        Enum(EventVisibility, name="event_visibility"), default=EventVisibility.PUBLIC, nullable=False
    )
    scoring_type: Mapped[ScoringType] = mapped_column(
        Enum(ScoringType, name="scoring_type"), default=ScoringType.STATIC, nullable=False
    )
    leaderboard_status: Mapped[LeaderboardStatus] = mapped_column(
        Enum(LeaderboardStatus, name="leaderboard_status"), default=LeaderboardStatus.LIVE, nullable=False
    )

    # Limits
    max_participants: Mapped[Optional[int]] = mapped_column(Integer)
    max_teams: Mapped[Optional[int]] = mapped_column(Integer)
    team_size: Mapped[int] = mapped_column(Integer, default=4, nullable=False)

    # Submission config
    submission_rate_limit: Mapped[int] = mapped_column(Integer, default=10)  # per minute
    require_approval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Dynamic scoring config
    dynamic_score_initial: Mapped[int] = mapped_column(Integer, default=500)
    dynamic_score_minimum: Mapped[int] = mapped_column(Integer, default=100)
    dynamic_score_decay: Mapped[float] = mapped_column(default=0.5)

    # Ownership
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("team_size >= 1", name="ck_event_team_size_positive"),
        CheckConstraint("dynamic_score_minimum >= 0", name="ck_event_dynamic_min_non_negative"),
    )

    # ── Relationships ─────────────────────────────────────────
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])
    settings: Mapped[List["EventSetting"]] = relationship(
        "EventSetting", back_populates="event", cascade="all, delete-orphan"
    )
    registrations: Mapped[List["EventRegistration"]] = relationship(
        "EventRegistration", back_populates="event", cascade="all, delete-orphan"
    )
    categories: Mapped[List["Category"]] = relationship("Category", back_populates="event", cascade="all, delete-orphan")
    challenges: Mapped[List["Challenge"]] = relationship("Challenge", back_populates="event", cascade="all, delete-orphan")
    teams: Mapped[List["Team"]] = relationship("Team", back_populates="event", cascade="all, delete-orphan")
    submissions: Mapped[List["Submission"]] = relationship("Submission", back_populates="event")
    scores: Mapped[List["Score"]] = relationship("Score", back_populates="event", cascade="all, delete-orphan")
    announcements: Mapped[List["Announcement"]] = relationship("Announcement", back_populates="event", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Event {self.slug} [{self.status}]>"


class EventSetting(Base):
    __tablename__ = "event_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (UniqueConstraint("event_id", "key", name="uq_event_setting"),)

    event: Mapped[Event] = relationship("Event", back_populates="settings")


class EventRegistration(Base):
    __tablename__ = "event_registrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[RegistrationStatus] = mapped_column(
        Enum(RegistrationStatus, name="registration_status"),
        default=RegistrationStatus.APPROVED,
        nullable=False,
    )
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_event_registration_user"),
    )

    event: Mapped[Event] = relationship("Event", back_populates="registrations")
    user: Mapped["User"] = relationship("User")
    team: Mapped[Optional["Team"]] = relationship("Team")

    def __repr__(self) -> str:
        return f"<EventRegistration event={self.event_id} user={self.user_id} [{self.status}]>"
