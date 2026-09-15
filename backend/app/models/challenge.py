"""
CTF Platform — Beanie Models: Category, Challenge, ChallengeFlag, ChallengeHint, HintUnlock, ChallengeFile
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


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


class Category(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: Optional[uuid.UUID] = None  # None = global category
    name: str
    slug: str
    color: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "categories"


class Challenge(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    name: str
    slug: str
    description: Optional[str] = None
    points: int = 100
    difficulty: Difficulty = Difficulty.MEDIUM

    # Authoring
    author_id: Optional[uuid.UUID] = None
    author_note: Optional[str] = None  # Never sent to frontend

    # Status
    status: ChallengeStatus = ChallengeStatus.DRAFT

    # Stats
    solve_count: int = 0
    current_points: int = 100

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "challenges"

    def __repr__(self) -> str:
        return f"<Challenge {self.name} [{self.status}]>"


class ChallengeFlag(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    challenge_id: uuid.UUID
    flag_type: FlagType = FlagType.STATIC
    flag_value: str  # Hash of flag
    is_case_sensitive: bool = True
    is_regex: bool = False

    class Settings:
        name = "challenge_flags"


class ChallengeHint(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    challenge_id: uuid.UUID
    content: str
    cost: int = 0
    order_index: int = 0

    class Settings:
        name = "challenge_hints"


class HintUnlock(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    hint_id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    unlocked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    points_deducted: int = 0

    class Settings:
        name = "hint_unlocks"


class ChallengeFile(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    challenge_id: uuid.UUID
    original_filename: str
    storage_key: str
    file_size: int
    mime_type: str
    uploaded_by: Optional[uuid.UUID] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "challenge_files"

    def __repr__(self) -> str:
        return f"<ChallengeFile {self.original_filename}>"
