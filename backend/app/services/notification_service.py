"""
CTF Platform — Notification Service
Handles in-app notifications and WebSocket broadcasts.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id: UUID | str,
        type: NotificationType,
        title: str,
        message: str,
        metadata: Optional[dict] = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            extra_data=metadata,
        )
        self.db.add(notification)
        await self.db.flush()

        # Broadcast via WebSocket if user is connected
        from app.websocket.manager import ws_manager
        await ws_manager.send_notification(str(user_id), {
            "type": "notification",
            "data": {
                "id": str(notification.id),
                "type": type.value,
                "title": title,
                "message": message,
                "metadata": metadata,
                "is_read": False,
            }
        })
        return notification

    async def get_user_notifications(
        self,
        user_id: UUID | str,
        *,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        q = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            q = q.where(Notification.is_read == False)
        q = q.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def mark_read(self, notification_id: UUID | str, user_id: UUID | str) -> None:
        from datetime import datetime, timezone
        await self.db.execute(
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )

    async def mark_all_read(self, user_id: UUID | str) -> None:
        from datetime import datetime, timezone
        await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )

    async def get_unread_count(self, user_id: UUID | str) -> int:
        from sqlalchemy import func
        result = await self.db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        return result.scalar_one() or 0
