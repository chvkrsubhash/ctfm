"""
CTF Platform — Notification Service (MongoDB / Beanie)
Handles in-app notifications and WebSocket broadcasts.
"""
from datetime import datetime, timezone
from typing import Optional, Union
from uuid import UUID

from app.models.notification import Notification, NotificationType


def _to_uuid(val: Union[UUID, str]) -> UUID:
    if isinstance(val, UUID):
        return val
    return UUID(str(val))


class NotificationService:
    def __init__(self, db=None):
        self.db = db

    async def create(
        self,
        *,
        user_id: Union[UUID, str],
        type: NotificationType,
        title: str,
        message: str,
        metadata: Optional[dict] = None,
    ) -> Notification:
        uid = _to_uuid(user_id)
        notification = Notification(
            user_id=uid,
            type=type,
            title=title,
            message=message,
            extra_data=metadata,
        )
        await notification.insert()

        # Broadcast via WebSocket if user is connected
        try:
            from app.websocket.manager import ws_manager
            await ws_manager.send_notification(str(uid), {
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
        except Exception:
            pass

        return notification

    async def get_user_notifications(
        self,
        user_id: Union[UUID, str],
        *,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        uid = _to_uuid(user_id)
        query: dict = {"user_id": uid}
        if unread_only:
            query["is_read"] = False
        return await Notification.find(query).sort("-created_at").skip(offset).limit(limit).to_list()

    async def mark_read(self, notification_id: Union[UUID, str], user_id: Union[UUID, str]) -> None:
        nid = _to_uuid(notification_id)
        uid = _to_uuid(user_id)
        await Notification.find({"id": nid, "user_id": uid}).update(
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc)}}
        )

    async def mark_all_read(self, user_id: Union[UUID, str]) -> None:
        uid = _to_uuid(user_id)
        await Notification.find({"user_id": uid, "is_read": False}).update(
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc)}}
        )

    async def get_unread_count(self, user_id: Union[UUID, str]) -> int:
        uid = _to_uuid(user_id)
        return await Notification.find({"user_id": uid, "is_read": False}).count()
