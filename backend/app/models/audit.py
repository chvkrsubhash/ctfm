"""
CTF Platform — Beanie Models: AuditLog
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class AuditLog(Document):
    """
    Immutable audit trail for all security-sensitive actions.
    """
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    actor_id: Optional[uuid.UUID] = None
    action: Indexed(str)
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    extra_data: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "audit_logs"

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} by {self.actor_id} at {self.created_at}>"
