"""
CTF Platform — WebSocket API Routes
Provides real-time connections for notifications and leaderboard updates.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.security import verify_access_token
from app.websocket.manager import ws_manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/user")
async def user_websocket(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for per-user notifications.
    Client connects with ?token=<access_token>
    """
    user_id = verify_access_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages (e.g., ping)
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)


@router.websocket("/ws/event/{event_id}")
async def event_websocket(event_id: str, websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for event-specific broadcasts (leaderboard updates, announcements).
    Client connects with ?token=<access_token>
    """
    user_id = verify_access_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await ws_manager.connect(websocket, user_id)
    await ws_manager.subscribe_event(websocket, event_id)

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
