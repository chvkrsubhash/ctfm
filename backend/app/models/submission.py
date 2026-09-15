"""
CTF Platform — Beanie Models: Submission, Solve
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class SubmissionResult(str, enum.Enum):
    CORRECT = "correct"
    INCORRECT = "incorrect"
    ALREADY_SOLVED = "already_solved"
    RATE_LIMITED = "rate_limited"
    CHALLENGE_NOT_ACTIVE = "challenge_not_active"
    EVENT_NOT_LIVE = "event_not_live"


class Submission(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    challenge_id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    team_id: Optional[uuid.UUID] = None

    submitted_flag_preview: str
    result: SubmissionResult
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_suspicious: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "submissions"

    def __repr__(self) -> str:
        return f"<Submission challenge={self.challenge_id} result={self.result}>"


class Solve(Document):
    """Created only when a submission is CORRECT."""
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    challenge_id: uuid.UUID
    event_id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    submission_id: uuid.UUID
    points_awarded: int
    solved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "solves"
