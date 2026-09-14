"""
CTF Platform — SQLAlchemy Models: Submission, Solve
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    DateTime, Enum, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.event import Event
    from app.models.team import Team
    from app.models.challenge import Challenge


class SubmissionResult(str, enum.Enum):
    CORRECT = "correct"
    INCORRECT = "incorrect"
    ALREADY_SOLVED = "already_solved"
    RATE_LIMITED = "rate_limited"
    CHALLENGE_NOT_ACTIVE = "challenge_not_active"
    EVENT_NOT_LIVE = "event_not_live"


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # The flag is NEVER stored in plaintext — this is the raw submitted string (truncated for forensic review)
    submitted_flag_preview: Mapped[str] = mapped_column(String(100), nullable=False)  # first 100 chars

    result: Mapped[SubmissionResult] = mapped_column(
        Enum(SubmissionResult, name="submission_result"), nullable=False, index=True
    )

    # Metadata for audit / anti-cheat
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    is_suspicious: Mapped[bool] = mapped_column(default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    challenge: Mapped["Challenge"] = relationship("Challenge", back_populates="submissions")
    event: Mapped["Event"] = relationship("Event", back_populates="submissions")
    user: Mapped["User"] = relationship("User")
    team: Mapped[Optional["Team"]] = relationship("Team")
    solve: Mapped[Optional["Solve"]] = relationship("Solve", back_populates="submission", uselist=False)

    def __repr__(self) -> str:
        return f"<Submission challenge={self.challenge_id} result={self.result}>"


class Solve(Base):
    """
    A Solve is created only when a submission is CORRECT.
    One row per (challenge, team) — enforced by unique constraint.
    """
    __tablename__ = "solves"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False
    )
    points_awarded: Mapped[int] = mapped_column(Integer, nullable=False)
    solved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    from sqlalchemy import UniqueConstraint
    __table_args__ = (
        UniqueConstraint("challenge_id", "team_id", name="uq_solve_challenge_team"),
    )

    challenge: Mapped["Challenge"] = relationship("Challenge", back_populates="solves")
    event: Mapped["Event"] = relationship("Event")
    team: Mapped["Team"] = relationship("Team")
    user: Mapped["User"] = relationship("User")
    submission: Mapped[Submission] = relationship("Submission", back_populates="solve")
