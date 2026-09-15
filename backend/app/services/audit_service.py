"""
CTF Platform — Audit Service (MongoDB / Beanie)
Centralized service for recording security-sensitive actions.
"""
from typing import Optional, Union
from uuid import UUID

from fastapi import Request

from app.models.audit import AuditLog


class AuditService:
    def __init__(self, db=None):
        self.db = db

    async def log(
        self,
        *,
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        actor_id: Optional[Union[UUID, str]] = None,
        request: Optional[Request] = None,
        metadata: Optional[dict] = None,
    ) -> AuditLog:
        ip = None
        ua = None
        if request:
            ip = request.client.host if request.client else None
            ua = request.headers.get("user-agent")

        aid: Optional[UUID] = None
        if actor_id:
            aid = actor_id if isinstance(actor_id, UUID) else UUID(str(actor_id))

        entry = AuditLog(
            actor_id=aid,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip,
            user_agent=ua,
            extra_data=metadata,
        )
        await entry.insert()
        return entry
