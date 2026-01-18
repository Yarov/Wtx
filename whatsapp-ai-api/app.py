"""
Wtx API - WhatsApp AI Agent
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar base de datos ANTES de importar routers
logger.info("Initializing database...")
from database import init_database, init_default_data

init_database()
init_default_data()
logger.info("Database ready")

# Import routers
from api.routers import (
    auth,
    config,
    inventory, 
    appointments,
    tools,
    stats,
    conversations,
    contactos,
    campanas,
    jobs,
    business,
    webhook,
    dashboard
)

app = FastAPI(
    title="Wtx API", 
    version="3.0.0", 
    description="WhatsApp AI Agent API"
)

# Startup event para iniciar el campaign worker
@app.on_event("startup")
async def startup_event():
    import asyncio
    from campaign_engine import campaign_worker
    asyncio.create_task(campaign_worker())
    logger.info("Campaign worker scheduled")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3001"],
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
app.include_router(inventory.router, prefix=api_prefix)
app.include_router(appointments.router, prefix=api_prefix)
app.include_router(tools.router, prefix=api_prefix)
app.include_router(conversations.router, prefix=api_prefix)
app.include_router(contactos.router, prefix=api_prefix)
app.include_router(campanas.router, prefix=api_prefix)
app.include_router(jobs.router, prefix=api_prefix)
app.include_router(business.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(webhook.router)


# Root endpoint
@app.get("/")
async def root():
    return {
        "status": "ok", 
        "message": "Wtx API v3.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
