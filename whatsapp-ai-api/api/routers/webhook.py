"""
Webhook Router - Incoming WhatsApp message handling for WAHA and Evolution API
"""
import json
import logging
from fastapi import APIRouter, Request, Response

from whatsapp_service import parse_webhook_message, whatsapp_service
from database import get_config
from agent import responder
from api.routers.contactos import (
    guardar_contacto_mensaje,
    desactivar_modo_humano_por_telefono,
    verificar_modo_humano,
    activar_modo_humano_por_telefono
)
from campaign_engine import marcar_respondido

logger = logging.getLogger(__name__)


def detectar_trigger_modo_humano(mensaje: str, respuesta: str) -> bool:
    """
    Detectar si el mensaje o respuesta contiene triggers para activar modo humano.
    Retorna True si se debe activar modo humano.
    """
    # Obtener triggers configurados
    triggers_str = get_config("human_mode_triggers", '["frustration","complaint","human_request"]')
    custom_triggers_str = get_config("human_mode_custom_triggers", "")
    
    try:
        triggers = json.loads(triggers_str)
    except:
        triggers = ["frustration", "complaint", "human_request"]
    
    texto = (mensaje + " " + respuesta).lower()
    
    # Palabras clave por trigger
    trigger_keywords = {
        "frustration": ["molesto", "enojado", "frustrado", "harto", "cansado de", "no sirve", "pésimo", "horrible", "terrible", "indignado"],
        "complaint": ["queja", "reclamo", "demanda", "problema grave", "inaceptable", "exijo", "reembolso", "devolución"],
        "human_request": ["hablar con humano", "persona real", "agente humano", "hablar con alguien", "asesor", "ejecutivo", "representante", "operador", "supervisor"],
        "urgency": ["urgente", "emergencia", "ahora mismo", "inmediatamente", "lo antes posible", "crítico"],
        "complexity": ["no entiendes", "no me ayudas", "no puedes", "no sabes", "inútil", "no sirves"],
        "negotiation": ["descuento", "rebaja", "precio especial", "promoción", "negociar", "oferta"]
    }
    
    # Verificar triggers habilitados
    for trigger in triggers:
        if trigger in trigger_keywords:
            for keyword in trigger_keywords[trigger]:
                if keyword in texto:
                    logger.info(f"Trigger detectado: {trigger} (keyword: {keyword})")
                    return True
    
    # Verificar triggers personalizados (solo en mensaje del usuario)
    if custom_triggers_str:
        mensaje_lower = mensaje.lower()
        custom_keywords = [k.strip().lower() for k in custom_triggers_str.split(",") if k.strip()]
        for keyword in custom_keywords:
            # Búsqueda flexible: todas las palabras del keyword deben estar en el mensaje
            keyword_words = keyword.split()
            if len(keyword_words) == 1:
                # Palabra única: buscar como substring
                if keyword in mensaje_lower:
                    logger.info(f"Trigger personalizado detectado: {keyword}")
                    return True
            else:
                # Frase: verificar que todas las palabras estén presentes
                if all(word in mensaje_lower for word in keyword_words):
                    logger.info(f"Trigger personalizado detectado: {keyword}")
                    return True
    
    return False

router = APIRouter(tags=["Webhook"])


@router.post("/whatsapp", summary="WhatsApp webhook", description="Receive incoming messages from WAHA or Evolution API. Processes messages, generates AI responses and sends replies.")
async def whatsapp_webhook(request: Request):
    try:
        # Parsear request segun content-type
        content_type = request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            data = await request.json()
        else:
            form_data = await request.form()
            data = dict(form_data)
        
        # Ignorar status callbacks
        if "MessageStatus" in data:
            return Response(content="", media_type="text/plain", status_code=200)
        
        # Parsear mensaje
        parsed = parse_webhook_message(data)
        
        if not parsed:
            logger.debug(f"Webhook ignorado (no es mensaje valido): {data.get('event', 'unknown')}")
            return Response(content='{"status": "ignored"}', media_type="application/json", status_code=200)
        
        from_number = parsed["phone"]
        incoming_msg = parsed["message"]
        contact_name = parsed.get("name", "")
        
        logger.info(f"Message from {from_number} ({contact_name}): {incoming_msg}")
        
        # Guardar/actualizar contacto
        try:
            guardar_contacto_mensaje(from_number, contact_name)
        except Exception as e:
            logger.warning(f"Error guardando contacto: {e}")
        
        # Marcar como respondido en campanas activas
        try:
            await marcar_respondido(from_number)
        except Exception as e:
            logger.warning(f"Error marcando respondido: {e}")
        
        # Verificar comando #reactivar
        reactivar_command = get_config("human_mode_reactivar_command", "#reactivar")
        if incoming_msg.strip().lower() == reactivar_command.lower():
            try:
                if desactivar_modo_humano_por_telefono(from_number):
                    logger.info(f"Modo humano desactivado para {from_number} por comando")
                    return Response(content='{"status": "human_mode_deactivated"}', media_type="application/json", status_code=200)
            except Exception as e:
                logger.warning(f"Error procesando comando reactivar: {e}")
        
        # Verificar modo humano
        try:
            if verificar_modo_humano(from_number):
                logger.info(f"Contacto {from_number} en modo humano, IA no responde")
                return Response(content='{"status": "human_mode_active"}', media_type="application/json", status_code=200)
        except Exception as e:
            logger.warning(f"Error verificando modo humano: {e}")
        
        # Verificar si agente esta habilitado
        agent_enabled = get_config("agent_enabled", "true").lower() == "true"
        
        if not agent_enabled:
            logger.info("Agent is disabled, not responding")
            return Response(content='{"status": "agent_disabled"}', media_type="application/json", status_code=200)
        
        # Generar respuesta con IA
        respuesta = responder(incoming_msg, from_number)
        logger.info(f"Response: {respuesta[:100]}...")
        
        # Detectar triggers para modo humano
        try:
            if detectar_trigger_modo_humano(incoming_msg, respuesta):
                activar_modo_humano_por_telefono(from_number, "Trigger automático detectado")
                logger.info(f"Modo humano activado automáticamente para {from_number}")
        except Exception as e:
            logger.warning(f"Error detectando triggers: {e}")
        
        # Enviar respuesta
        if whatsapp_service.is_configured():
            result = await whatsapp_service.send_message(from_number, respuesta)
            if result["success"]:
                logger.info(f"Mensaje enviado a {from_number}")
            else:
                logger.error(f"Error enviando mensaje: {result.get('error')}")
            return Response(content='{"status": "ok"}', media_type="application/json", status_code=200)
        else:
            logger.warning("WhatsApp no configurado, no se puede enviar respuesta")
            return Response(content='{"status": "whatsapp_not_configured"}', media_type="application/json", status_code=200)
            
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}", exc_info=True)
        return Response(content='{"status": "error"}', media_type="application/json", status_code=500)


@router.post("/api/webhook/whatsapp", summary="WhatsApp webhook (alias)", description="Alternative webhook URL for backwards compatibility.")
async def whatsapp_webhook_alias(request: Request):
    return await whatsapp_webhook(request)
