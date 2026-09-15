"""
CTF Platform — Beanie Models: Score, ScoreEvent, Certificate
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class Score(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: uuid.UUID
    team_id: uuid.UUID
    total_points: int = 0
    solve_count: int = 0
    last_solve_at: Optional[datetime] = None
    rank: Optional[int] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "scores"


class ScoreEvent(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    challenge_id: Optional[uuid.UUID] = None
    delta: int
    reason: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "score_events"


class Certificate(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: uuid.UUID
    user_id: uuid.UUID
    team_id: Optional[uuid.UUID] = None
    rank: Optional[int] = None
    score: int = 0
    solve_count: int = 0
    certificate_uid: Indexed(str, unique=True)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "certificates"
