"""
WhatsApp AI Agent - Clean Architecture
"""
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from twilio.twiml.messaging_response import MessagingResponse

# Import routers
from api.routers import (
    auth,
    config,
    inventory, 
    appointments,
    tools,
    stats,
    conversations
)

from agent import responder
from models import Base, engine
from database import init_default_data
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database
logger.info("🔧 Initializing database...")
Base.metadata.create_all(bind=engine)
init_default_data()
logger.info("✅ Database ready")

app = FastAPI(
    title="WhatsApp AI Agent", 
    version="3.0.0", 
    description="Clean Architecture WhatsApp AI Agent"
)

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

# Backwards compatibility - redirect old routes
@app.get(f"{api_prefix}/availability")
async def get_availability_compat():
    """Backwards compatibility for /api/availability"""
    from api.routers.appointments import get_availability
    return await get_availability()

@app.put(f"{api_prefix}/availability/{{dia_id}}")
async def update_availability_compat(dia_id: int, data: dict):
    """Backwards compatibility for /api/availability/{dia_id}"""
    from api.routers.appointments import update_availability
    from api.schemas.appointments import AvailabilityModel
    model = AvailabilityModel(**data)
    return await update_availability(dia_id, model)

@app.get(f"{api_prefix}/blocked-slots")
async def get_blocked_slots_compat():
    """Backwards compatibility for /api/blocked-slots"""
    from api.routers.appointments import get_blocked_slots
    return await get_blocked_slots()

@app.post(f"{api_prefix}/blocked-slots")
async def add_blocked_slot_compat(data: dict):
    """Backwards compatibility for /api/blocked-slots"""
    from api.routers.appointments import add_blocked_slot
    from api.schemas.appointments import BlockedSlotModel
    model = BlockedSlotModel(**data)
    return await add_blocked_slot(model)

@app.delete(f"{api_prefix}/blocked-slots/{{slot_id}}")
async def delete_blocked_slot_compat(slot_id: int):
    """Backwards compatibility for /api/blocked-slots/{slot_id}"""
    from api.routers.appointments import delete_blocked_slot
    return await delete_blocked_slot(slot_id)

@app.get(f"{api_prefix}/available-slots/{{fecha}}")
async def get_available_slots_compat(fecha: str):
    """Backwards compatibility for /api/available-slots/{fecha}"""
    from api.routers.appointments import get_available_slots
    return await get_available_slots(fecha)

@app.get(f"{api_prefix}/prompt")
async def get_prompt_compat():
    """Backwards compatibility for /api/prompt"""
    from api.routers.config import get_prompt
    return await get_prompt()

@app.put(f"{api_prefix}/prompt")
async def update_prompt_compat(prompt: dict):
    """Backwards compatibility for /api/prompt"""
    from api.routers.config import update_prompt
    from api.schemas.config import PromptModel
    model = PromptModel(**prompt)
    return await update_prompt(model)

@app.post(f"{api_prefix}/prompt/improve")
async def improve_prompt_compat(data: dict):
    """Backwards compatibility for /api/prompt/improve"""
    from api.routers.config import improve_prompt
    from api.schemas.config import ImprovePromptModel
    model = ImprovePromptModel(**data)
    return await improve_prompt(model)

# Root endpoint
@app.get("/")
async def root():
    return {
        "status": "ok", 
        "message": "WhatsApp AI Agent v3.0 - Clean Architecture 🏗️",
        "docs": "/docs",
        "endpoints": {
            "stats": f"{api_prefix}/stats",
            "config": f"{api_prefix}/config",
            "inventory": f"{api_prefix}/inventory",
            "appointments": f"{api_prefix}/appointments", 
            "tools": f"{api_prefix}/tools",
            "conversations": f"{api_prefix}/conversations"
        }
    }


# WhatsApp webhook
@app.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    """
    WhatsApp webhook via Twilio
    """
    try:
        form_data = await request.form()
        data = dict(form_data)
        
        # Status callbacks - ignore
        if "MessageStatus" in data:
            logger.info(f"Status callback: {data.get('MessageStatus')} for {data.get('To')}")
            return Response(content="", media_type="text/plain", status_code=200)
        
        logger.info(f"Incoming message: {data}")
        
        incoming_msg = data.get("Body", "")
        from_number = data.get("From", "")
        
        if not incoming_msg or not from_number:
            logger.warning(f"Incomplete data: Body={incoming_msg}, From={from_number}")
            twiml = MessagingResponse()
            return Response(content=str(twiml), media_type="application/xml")
        
        logger.info(f"💬 Message from {from_number}: {incoming_msg}")
        
        # Check if agent is enabled
        from database import get_config
        agent_enabled = get_config("agent_enabled", "true").lower() == "true"
        
        if not agent_enabled:
            logger.info("🔴 Agent is disabled, not responding")
            twiml = MessagingResponse()
            return Response(content=str(twiml), media_type="application/xml")
        
        respuesta = responder(incoming_msg, from_number)
        logger.info(f"🤖 Response: {respuesta[:100]}...")

        twiml = MessagingResponse()
        twiml.message(respuesta)
        
        return Response(
            content=str(twiml),
            media_type="application/xml"
        )
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}", exc_info=True)
        twiml = MessagingResponse()
        twiml.message("Lo siento, ocurrió un error. Intenta de nuevo.")
        return Response(content=str(twiml), media_type="application/xml")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
