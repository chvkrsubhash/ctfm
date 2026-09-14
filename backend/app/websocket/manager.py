"""
CTF Platform — WebSocket Manager
Manages connected WebSocket clients for real-time updates.
"""
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages active WebSocket connections per user.
    Supports broadcasting to specific users or all connected clients.
    """

    def __init__(self):
        # user_id -> set of WebSocket connections (multiple tabs/sessions)
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        # event_id -> set of WebSocket connections (event-specific feeds)
        self._event_connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)
        logger.info(f"WS connected: user={user_id}")

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        self._connections[user_id].discard(websocket)
        if not self._connections[user_id]:
            del self._connections[user_id]
        # Also remove from event connections
        for sockets in self._event_connections.values():
            sockets.discard(websocket)
        logger.info(f"WS disconnected: user={user_id}")

    async def subscribe_event(self, websocket: WebSocket, event_id: str) -> None:
        """Subscribe a connected client to event-specific broadcasts (leaderboard updates)."""
        self._event_connections[event_id].add(websocket)

    async def send_notification(self, user_id: str, payload: dict[str, Any]) -> None:
        """Send a JSON payload to all connections for a specific user."""
        message = json.dumps(payload)
        dead_sockets = set()
        for ws in self._connections.get(user_id, set()):
            try:
                await ws.send_text(message)
            except Exception:
                dead_sockets.add(ws)
        for ws in dead_sockets:
            self._connections[user_id].discard(ws)

    async def broadcast_event_update(self, event_id: str, payload: dict[str, Any]) -> None:
        """Broadcast a leaderboard / event update to all subscribers of an event."""
        message = json.dumps(payload)
        dead_sockets = set()
        for ws in self._event_connections.get(event_id, set()):
            try:
                await ws.send_text(message)
            except Exception:
                dead_sockets.add(ws)
        for ws in dead_sockets:
            self._event_connections[event_id].discard(ws)

    async def broadcast_global(self, payload: dict[str, Any]) -> None:
        """Broadcast to ALL connected users."""
        message = json.dumps(payload)
        for user_id, sockets in list(self._connections.items()):
            dead = set()
            for ws in sockets:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self._connections[user_id].discard(ws)

    @property
    def connected_count(self) -> int:
        return sum(len(s) for s in self._connections.values())


# Singleton instance shared across the application
ws_manager = WebSocketManager()
