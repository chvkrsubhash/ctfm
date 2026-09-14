"""
CTF Platform — SQLAlchemy Models: Category, Challenge, ChallengeFlag, ChallengeHint, ChallengeFile
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.user import User
    from app.models.submission import Submission, Solve


class ChallengeStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    HIDDEN = "hidden"
    ARCHIVED = "archived"


class ChallengeVisibility(str, enum.Enum):
    PUBLIC = "public"
    HIDDEN = "hidden"


class Difficulty(str, enum.Enum):
    BEGINNER = "beginner"
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    INSANE = "insane"


class FlagType(str, enum.Enum):
    STATIC = "static"
    DYNAMIC = "dynamic"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=True, index=True
    )  # NULL = global category
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(7))   # hex color e.g. "#FF6B6B"
    icon: Mapped[Optional[str]] = mapped_column(String(50))   # icon name
    description: Mapped[Optional[str]] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("event_id", "slug", name="uq_category_event_slug"),
    )

    event: Mapped[Optional["Event"]] = relationship("Event", back_populates="categories")
    challenges: Mapped[List["Challenge"]] = relationship("Challenge", back_populates="category")


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    points: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    difficulty: Mapped[Difficulty] = mapped_column(
        Enum(Difficulty, name="difficulty"), default=Difficulty.MEDIUM, nullable=False
    )

    # Authoring
    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    author_note: Mapped[Optional[str]] = mapped_column(Text)  # Never sent to frontend

    # Status
    status: Mapped[ChallengeStatus] = mapped_column(
        Enum(ChallengeStatus, name="challenge_status"), default=ChallengeStatus.DRAFT, nullable=False
    )

    # Stats (maintained via trigger / service)
    solve_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # For dynamic scoring: current awarded points
    current_points: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("event_id", "slug", name="uq_challenge_event_slug"),
        CheckConstraint("points >= 0", name="ck_challenge_points_non_negative"),
        CheckConstraint("solve_count >= 0", name="ck_challenge_solve_count_non_negative"),
    )

    event: Mapped["Event"] = relationship("Event", back_populates="challenges")
    category: Mapped[Optional[Category]] = relationship("Category", back_populates="challenges")
    author: Mapped[Optional["User"]] = relationship("User")
    flags: Mapped[List["ChallengeFlag"]] = relationship(
        "ChallengeFlag", back_populates="challenge", cascade="all, delete-orphan"
    )
    hints: Mapped[List["ChallengeHint"]] = relationship(
        "ChallengeHint", back_populates="challenge", cascade="all, delete-orphan", order_by="ChallengeHint.order_index"
    )
    files: Mapped[List["ChallengeFile"]] = relationship(
        "ChallengeFile", back_populates="challenge", cascade="all, delete-orphan"
    )
    submissions: Mapped[List["Submission"]] = relationship("Submission", back_populates="challenge")
    solves: Mapped[List["Solve"]] = relationship("Solve", back_populates="challenge")

    def __repr__(self) -> str:
        return f"<Challenge {self.name} [{self.status}]>"


class ChallengeFlag(Base):
    __tablename__ = "challenge_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    flag_type: Mapped[FlagType] = mapped_column(
        Enum(FlagType, name="flag_type"), default=FlagType.STATIC, nullable=False
    )
    # flag_value stores the HASH — NEVER the plaintext flag
    flag_value: Mapped[str] = mapped_column(String(500), nullable=False)
    is_case_sensitive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_regex: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    challenge: Mapped[Challenge] = relationship("Challenge", back_populates="flags")


class ChallengeHint(Base):
    __tablename__ = "challenge_hints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    cost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        CheckConstraint("cost >= 0", name="ck_hint_cost_non_negative"),
    )

    challenge: Mapped[Challenge] = relationship("Challenge", back_populates="hints")
    unlocks: Mapped[List["HintUnlock"]] = relationship("HintUnlock", back_populates="hint", cascade="all, delete-orphan")


class HintUnlock(Base):
    """Records which teams have unlocked which hints."""
    __tablename__ = "hint_unlocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hint_id: Mapped[int] = mapped_column(Integer, ForeignKey("challenge_hints.id", ondelete="CASCADE"), nullable=False)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    points_deducted: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("hint_id", "team_id", name="uq_hint_unlock"),
    )

    hint: Mapped[ChallengeHint] = relationship("ChallengeHint", back_populates="unlocks")


class ChallengeFile(Base):
    __tablename__ = "challenge_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)  # S3 key or local path
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    challenge: Mapped[Challenge] = relationship("Challenge", back_populates="files")

    def __repr__(self) -> str:
        return f"<ChallengeFile {self.original_filename}>"
