"""
CTF Platform — Beanie Models: Team, TeamMember, TeamInvitation
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class TeamMemberRole(str, enum.Enum):
    OWNER = "owner"
    MEMBER = "member"


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class Team(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_id: uuid.UUID
    name: str
    slug: str
    owner_id: Optional[uuid.UUID] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    is_private: bool = False
    is_disqualified: bool = False
    disqualification_reason: Optional[str] = None
    country: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "teams"

    def __repr__(self) -> str:
        return f"<Team {self.name} @ event={self.event_id}>"


class TeamMember(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    team_id: uuid.UUID
    user_id: uuid.UUID
    role: TeamMemberRole = TeamMemberRole.MEMBER
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "team_members"


class TeamInvitation(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    team_id: uuid.UUID
    invitee_id: uuid.UUID
    inviter_id: uuid.UUID
    token: Indexed(str, unique=True)
    status: InvitationStatus = InvitationStatus.PENDING
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    responded_at: Optional[datetime] = None

    class Settings:
        name = "team_invitations"
