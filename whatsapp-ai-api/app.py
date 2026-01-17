"""
WhatsApp AI Agent - Clean Architecture
"""
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware

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
    jobs
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

# Startup event para iniciar el campaign worker
@app.on_event("startup")
async def startup_event():
    import asyncio
    from campaign_engine import campaign_worker
    asyncio.create_task(campaign_worker())
    logger.info("🚀 Campaign worker scheduled")

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


# WhatsApp webhook - Soporta WAHA, Evolution API y Twilio
@app.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    """
    WhatsApp webhook unificado para WAHA, Evolution API y Twilio
    """
    from whatsapp_service import parse_webhook_message, whatsapp_service
    from database import get_config
    
    try:
        # Intentar parsear como JSON (WAHA/Evolution)
        content_type = request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            data = await request.json()
        else:
            # Fallback a form data (Twilio)
            form_data = await request.form()
            data = dict(form_data)
        
        # Status callbacks - ignore
        if "MessageStatus" in data:
            return Response(content="", media_type="text/plain", status_code=200)
        
        # Parsear mensaje según el formato
        parsed = parse_webhook_message(data)
        
        if not parsed:
            logger.debug(f"Webhook ignorado (no es mensaje válido): {data.get('event', 'unknown')}")
            return Response(content='{"status": "ignored"}', media_type="application/json", status_code=200)
        
        from_number = parsed["phone"]
        incoming_msg = parsed["message"]
        contact_name = parsed.get("name", "")
        
        logger.info(f"💬 Message from {from_number} ({contact_name}): {incoming_msg}")
        
        # Guardar/actualizar contacto automáticamente
        try:
            from api.routers.contactos import guardar_contacto_mensaje
            guardar_contacto_mensaje(from_number, contact_name)
        except Exception as e:
            logger.warning(f"Error guardando contacto: {e}")
        
        # Marcar como respondido en campañas activas
        try:
            from campaign_engine import marcar_respondido
            await marcar_respondido(from_number)
        except Exception as e:
            logger.warning(f"Error marcando respondido: {e}")
        
        # Check if agent is enabled
        agent_enabled = get_config("agent_enabled", "true").lower() == "true"
        
        if not agent_enabled:
            logger.info("🔴 Agent is disabled, not responding")
            return Response(content='{"status": "agent_disabled"}', media_type="application/json", status_code=200)
        
        # Generar respuesta con IA
        respuesta = responder(incoming_msg, from_number)
        logger.info(f"🤖 Response: {respuesta[:100]}...")
        
        # Enviar respuesta via WAHA/Evolution
        if whatsapp_service.is_configured():
            result = await whatsapp_service.send_message(from_number, respuesta)
            if result["success"]:
                logger.info(f"✅ Mensaje enviado a {from_number}")
            else:
                logger.error(f"❌ Error enviando mensaje: {result.get('error')}")
            return Response(content='{"status": "ok"}', media_type="application/json", status_code=200)
        else:
            # WhatsApp no configurado
            logger.warning("⚠️ WhatsApp no configurado, no se puede enviar respuesta")
            return Response(content='{"status": "whatsapp_not_configured"}', media_type="application/json", status_code=200)
            
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}", exc_info=True)
        return Response(content='{"status": "error"}', media_type="application/json", status_code=500)


# Webhook alternativo para compatibilidad
@app.post("/api/webhook/whatsapp")
async def whatsapp_webhook_api(request: Request):
    """Alias del webhook en /api/webhook/whatsapp"""
    return await whatsapp_webhook(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
