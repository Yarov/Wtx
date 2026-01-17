from fastapi import FastAPI, Form, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from twilio.twiml.messaging_response import MessagingResponse
from agent import responder
from admin import router as admin_router
from models import Base, engine
from database import init_default_data
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar base de datos
logger.info("🔧 Inicializando base de datos...")
Base.metadata.create_all(bind=engine)
init_default_data()
logger.info("✅ Base de datos lista")

app = FastAPI(title="WhatsApp AI Agent", version="2.0.0", description="WhatsApp AI Agent con PostgreSQL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)


@app.get("/")
async def root():
    return {"status": "ok", "message": "WhatsApp AI Agent activo 🤖"}


@app.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    """
    Webhook para recibir mensajes de WhatsApp vía Twilio
    """
    try:
        form_data = await request.form()
        data = dict(form_data)
        
        # Status callbacks (sent/delivered/read) - ignorar
        if "MessageStatus" in data:
            logger.info(f"Status callback: {data.get('MessageStatus')} para {data.get('To')}")
            return Response(content="", media_type="text/plain", status_code=200)
        
        logger.info(f"Mensaje entrante: {data}")
        
        # Mensaje entrante del usuario
        incoming_msg = data.get("Body", "")
        from_number = data.get("From", "")  # whatsapp:+521XXXXXXXXXX
        
        if not incoming_msg or not from_number:
            logger.warning(f"Datos incompletos: Body={incoming_msg}, From={from_number}")
            twiml = MessagingResponse()
            return Response(content=str(twiml), media_type="application/xml")
        
        logger.info(f"💬 Mensaje de {from_number}: {incoming_msg}")
        
        respuesta = responder(incoming_msg, from_number)
        logger.info(f"🤖 Respuesta: {respuesta[:100]}...")

        twiml = MessagingResponse()
        twiml.message(respuesta)
        
        return Response(
            content=str(twiml),
            media_type="application/xml"
        )
    except Exception as e:
        logger.error(f"Error en webhook: {str(e)}", exc_info=True)
        twiml = MessagingResponse()
        twiml.message("Lo siento, ocurrió un error. Intenta de nuevo.")
        return Response(content=str(twiml), media_type="application/xml")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
