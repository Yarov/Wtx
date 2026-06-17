"""
Wtx API - WhatsApp AI Agent
"""

import json
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar base de datos ANTES de importar routers
logger.info("Initializing database...")
from database import init_database, init_default_data

init_database()
init_default_data()

# Los defaults per-user se crean en create_user_defaults() al registrar
from models import SessionLocal

logger.info("Database ready")

# Import routers
from api.routers import (
    auth,
    config,
    tools,
    stats,
    conversations,
    contactos,
    campanas,
    jobs,
    business,
    webhook,
    dashboard,
    whatsapp,
    conocimiento,
    funnel,
    capture,
    perfiles,
)

app = FastAPI(title="Wtx API", version="3.0.0", description="WhatsApp AI Agent API")


# Startup event para iniciar el campaign worker
@app.on_event("startup")
async def startup_event():
    import asyncio
    from campaign_engine import campaign_worker

    asyncio.create_task(campaign_worker())
    logger.info("Campaign worker scheduled")


# CORS middleware — allow any localhost port for local dev.
# Explicit origins come from CORS_ORIGINS (comma-separated). "*" is rejected
# because it is invalid combined with allow_credentials=True (and unsafe).
_raw_origins = os.getenv("CORS_ORIGINS", "")
cors_origins = [o.strip() for o in _raw_origins.split(",") if o.strip() and o.strip() != "*"]
if "*" in _raw_origins:
    logger.warning("CORS_ORIGINS contains '*' — ignored (invalid with credentials). Use explicit origins.")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://localhost(:\d+)?$",
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API prefix for all routes
api_prefix = "/api"

# Register routers (auth is public, others will be protected)
app.include_router(auth.router, prefix=api_prefix)
app.include_router(stats.router, prefix=api_prefix)
app.include_router(config.router, prefix=api_prefix)
app.include_router(tools.router, prefix=api_prefix)
app.include_router(conversations.router, prefix=api_prefix)
app.include_router(contactos.router, prefix=api_prefix)
app.include_router(campanas.router, prefix=api_prefix)
app.include_router(jobs.router, prefix=api_prefix)
app.include_router(business.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(whatsapp.router, prefix=api_prefix)
app.include_router(conocimiento.router, prefix=api_prefix)
app.include_router(funnel.router, prefix=api_prefix)
app.include_router(capture.router, prefix=api_prefix)
app.include_router(perfiles.router, prefix=api_prefix)
app.include_router(webhook.router)

# Servir archivos subidos (media)
from fastapi.staticfiles import StaticFiles
import os

os.makedirs("/app/uploads/media", exist_ok=True)
os.makedirs("/app/uploads/received", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")


# WebSocket endpoint
from ws_manager import ws_manager
from auth import decode_token


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Authenticate via query parameter token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        payload = decode_token(token)
        usuario_id = payload.get("sub")
        if usuario_id is None:
            await websocket.close(code=4001, reason="Invalid token payload")
            return
        usuario_id = int(usuario_id)
    except Exception:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    # Scope the realtime channel to the active profile (one WhatsApp number)
    perfil_id = websocket.query_params.get("perfil_id")
    try:
        perfil_id = int(perfil_id) if perfil_id else None
    except (ValueError, TypeError):
        perfil_id = None

    await ws_manager.connect(websocket, usuario_id, perfil_id)
    try:
        while True:
            text = await websocket.receive_text()
            # Handle pong responses from client heartbeat
            try:
                msg = json.loads(text)
                if msg.get("event") == "pong":
                    continue
            except (ValueError, TypeError):
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# Root endpoint
@app.get("/")
async def root():
    return {"status": "ok", "message": "Wtx API v3.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3000)
