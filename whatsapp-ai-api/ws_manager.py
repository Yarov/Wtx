"""
WebSocket Manager - Conexiones real-time con autenticacion por usuario y heartbeat
"""

import asyncio
import json
import logging
import warnings
from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Heartbeat settings
HEARTBEAT_INTERVAL = 30  # seconds between pings
HEARTBEAT_TIMEOUT = 10   # seconds to wait for pong


class ConnectionManager:
    """Gestiona conexiones WebSocket activas, indexadas por (usuario, perfil).

    El scope es por PERFIL: cada número de WhatsApp tiene su propio canal en
    tiempo real, así los chats/notificaciones de un perfil no se filtran a otro.
    """

    def __init__(self):
        # (usuario_id, perfil_id) -> list[WebSocket]
        self.active_connections: dict[tuple, list[WebSocket]] = {}
        # WebSocket -> (usuario_id, perfil_id)
        self._ws_to_key: dict[WebSocket, tuple] = {}
        # WebSocket -> asyncio.Task (heartbeat tasks)
        self._heartbeat_tasks: dict[WebSocket, asyncio.Task] = {}

    @property
    def total_connections(self) -> int:
        return sum(len(conns) for conns in self.active_connections.values())

    async def connect(self, websocket: WebSocket, usuario_id: int, perfil_id: int = None):
        """Accept and register a WebSocket connection for a user+profile"""
        await websocket.accept()
        key = (usuario_id, perfil_id)
        self.active_connections.setdefault(key, []).append(websocket)
        self._ws_to_key[websocket] = key
        task = asyncio.create_task(self._heartbeat(websocket))
        self._heartbeat_tasks[websocket] = task
        logger.info(
            f"WS connected for user {usuario_id} perfil {perfil_id}. "
            f"Total: {self.total_connections}"
        )

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection and clean up"""
        key = self._ws_to_key.pop(websocket, None)
        if key is not None and key in self.active_connections:
            conns = self.active_connections[key]
            if websocket in conns:
                conns.remove(websocket)
            if not conns:
                del self.active_connections[key]
        task = self._heartbeat_tasks.pop(websocket, None)
        if task and not task.done():
            task.cancel()
        logger.info(f"WS disconnected (key {key}). Total: {self.total_connections}")

    async def _send_many(self, conns: list, event: str, data: dict):
        if not conns:
            return
        message = json.dumps(
            {"event": event, "data": data}, ensure_ascii=False, default=str
        )
        disconnected = []
        for conn in list(conns):
            try:
                await conn.send_text(message)
            except Exception:
                disconnected.append(conn)
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_to_perfil(self, usuario_id: int, perfil_id: int, event: str, data: dict):
        """Send event only to connections of a specific user+profile"""
        await self._send_many(self.active_connections.get((usuario_id, perfil_id)), event, data)

    async def broadcast_to_user(self, usuario_id: int, event: str, data: dict):
        """Send event to ALL of a user's connections (every profile). For
        user-level events (e.g. agent on/off). Chat events should use
        broadcast_to_perfil to stay scoped to one number."""
        conns = [c for (uid, _pid), cs in self.active_connections.items() if uid == usuario_id for c in cs]
        await self._send_many(conns, event, data)

    async def broadcast_to_all(self, event: str, data: dict):
        """Send event to ALL connected clients (system-wide)"""
        if not self.active_connections:
            return

        message = json.dumps(
            {"event": event, "data": data}, ensure_ascii=False, default=str
        )
        disconnected = []
        for conns in self.active_connections.values():
            for conn in conns:
                try:
                    await conn.send_text(message)
                except Exception:
                    disconnected.append(conn)

        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast(self, event: str, data: dict):
        """
        DEPRECATED: Use broadcast_to_user() or broadcast_to_all() instead.
        Falls back to broadcast_to_all for backward compatibility.
        """
        warnings.warn(
            "ConnectionManager.broadcast() is deprecated. "
            "Use broadcast_to_user() or broadcast_to_all().",
            DeprecationWarning,
            stacklevel=2,
        )
        await self.broadcast_to_all(event, data)

    async def _heartbeat(self, websocket: WebSocket):
        """Send periodic pings; disconnect if no pong received in time"""
        try:
            while True:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                try:
                    await websocket.send_text(
                        json.dumps({"event": "ping", "data": {}})
                    )
                    # Wait for pong — the receive loop in the endpoint handles
                    # incoming messages including pong. We just check if the
                    # connection is still alive by trying to send.
                    # If send fails the except below triggers disconnect.
                except Exception:
                    logger.info("Heartbeat failed, disconnecting client")
                    self.disconnect(websocket)
                    try:
                        await websocket.close(code=1000)
                    except Exception:
                        pass
                    break
        except asyncio.CancelledError:
            pass


# Singleton
ws_manager = ConnectionManager()
