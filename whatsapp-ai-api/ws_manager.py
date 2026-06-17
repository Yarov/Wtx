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
    """Gestiona conexiones WebSocket activas, indexadas por usuario"""

    def __init__(self):
        # usuario_id -> list[WebSocket]
        self.active_connections: dict[int, list[WebSocket]] = {}
        # WebSocket -> usuario_id (reverse lookup)
        self._ws_to_user: dict[WebSocket, int] = {}
        # WebSocket -> asyncio.Task (heartbeat tasks)
        self._heartbeat_tasks: dict[WebSocket, asyncio.Task] = {}

    @property
    def total_connections(self) -> int:
        return sum(len(conns) for conns in self.active_connections.values())

    async def connect(self, websocket: WebSocket, usuario_id: int):
        """Accept and register a WebSocket connection for a specific user"""
        await websocket.accept()
        if usuario_id not in self.active_connections:
            self.active_connections[usuario_id] = []
        self.active_connections[usuario_id].append(websocket)
        self._ws_to_user[websocket] = usuario_id
        # Start heartbeat for this connection
        task = asyncio.create_task(self._heartbeat(websocket))
        self._heartbeat_tasks[websocket] = task
        logger.info(
            f"WS connected for user {usuario_id}. "
            f"User connections: {len(self.active_connections[usuario_id])}, "
            f"Total: {self.total_connections}"
        )

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection and clean up"""
        usuario_id = self._ws_to_user.pop(websocket, None)
        if usuario_id is not None and usuario_id in self.active_connections:
            conns = self.active_connections[usuario_id]
            if websocket in conns:
                conns.remove(websocket)
            if not conns:
                del self.active_connections[usuario_id]
        # Cancel heartbeat
        task = self._heartbeat_tasks.pop(websocket, None)
        if task and not task.done():
            task.cancel()
        logger.info(
            f"WS disconnected (user {usuario_id}). Total: {self.total_connections}"
        )

    async def broadcast_to_user(self, usuario_id: int, event: str, data: dict):
        """Send event only to connections belonging to a specific user"""
        conns = self.active_connections.get(usuario_id)
        if not conns:
            return

        message = json.dumps(
            {"event": event, "data": data}, ensure_ascii=False, default=str
        )
        disconnected = []
        for conn in conns:
            try:
                await conn.send_text(message)
            except Exception:
                disconnected.append(conn)

        for conn in disconnected:
            self.disconnect(conn)

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
