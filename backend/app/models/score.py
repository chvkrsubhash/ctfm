"""
CTF Platform — SQLAlchemy Models: Score, ScoreEvent, Certificate
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.team import Team
    from app.models.user import User
    from app.models.challenge import Challenge


class Score(Base):
    """
    Cached aggregate score per team per event.
    Updated atomically on every correct submission.
    Never calculated on-the-fly — always read from this table for leaderboard.
    """
    __tablename__ = "scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )

    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    solve_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_solve_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rank: Mapped[Optional[int]] = mapped_column(Integer)  # cached rank — updated post-solve

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("total_points >= 0", name="ck_score_points_non_negative"),
        CheckConstraint("solve_count >= 0", name="ck_score_solve_count_non_negative"),
        # Unique team per event
        __import__("sqlalchemy").UniqueConstraint("event_id", "team_id", name="uq_score_event_team"),
    )

    event: Mapped["Event"] = relationship("Event", back_populates="scores")
    team: Mapped["Team"] = relationship("Team", back_populates="score")


class ScoreEvent(Base):
    """
    Immutable log of every point change.
    Score = SUM(ScoreEvent.delta) per team per event.
    """
    __tablename__ = "score_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    challenge_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="SET NULL"), nullable=True
    )
    delta: Mapped[int] = mapped_column(Integer, nullable=False)  # positive = gained, negative = deducted
    reason: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "solve", "hint_unlock", "admin_adjustment"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    event: Mapped["Event"] = relationship("Event")
    team: Mapped["Team"] = relationship("Team")
    user: Mapped["User"] = relationship("User")
    challenge: Mapped[Optional["Challenge"]] = relationship("Challenge")


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    rank: Mapped[Optional[int]] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(Integer, default=0)
    solve_count: Mapped[int] = mapped_column(Integer, default=0)
    certificate_uid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        __import__("sqlalchemy").UniqueConstraint("event_id", "user_id", name="uq_certificate_event_user"),
    )

    event: Mapped["Event"] = relationship("Event")
    user: Mapped["User"] = relationship("User")
    team: Mapped[Optional["Team"]] = relationship("Team")
