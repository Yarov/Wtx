"""
Webhook Router - Incoming WhatsApp message handling for WAHA and Evolution API
"""

import json
import logging
import os
import secrets
from fastapi import APIRouter, Request, Response, HTTPException

from whatsapp_service import parse_webhook_message, whatsapp_service
from database import get_config
from agent import responder
from ws_manager import ws_manager
from api.routers.contactos import (
    guardar_contacto_mensaje,
    desactivar_modo_humano_por_telefono,
    verificar_modo_humano,
    activar_modo_humano_por_telefono,
)
from campaign_engine import marcar_respondido

logger = logging.getLogger(__name__)

WEBHOOK_TOKEN = os.getenv("WEBHOOK_TOKEN", "")


def _verify_webhook_token(request: Request) -> None:
    """
    Verifica el token compartido del webhook (header X-Webhook-Token).
    - Si WEBHOOK_TOKEN está configurado: exige match exacto (401 si falla).
    - Si NO está configurado: permite pero advierte (migración suave).
    """
    if not WEBHOOK_TOKEN:
        logger.warning(
            "WEBHOOK_TOKEN not set — webhook is UNAUTHENTICATED. "
            "Set WEBHOOK_TOKEN in the API and the bridge to secure it."
        )
        return

    provided = request.headers.get("x-webhook-token", "")
    if not provided or not secrets.compare_digest(provided, WEBHOOK_TOKEN):
        logger.warning("Rejected webhook call with invalid/missing token")
        raise HTTPException(status_code=401, detail="Invalid webhook token")


def detectar_trigger_modo_humano(mensaje: str, respuesta: str, usuario_id: int = None, perfil_id: int = None) -> bool:
    """
    Detectar si el mensaje o respuesta contiene triggers para activar modo humano.
    Two-layer system:
      Layer 1: Fast keyword pre-filter
      Layer 2: AI intent classification to reduce false positives
    Retorna True si se debe activar modo humano.
    """
    # Layer 1: Quick keyword pre-filter
    keyword_match = _check_keyword_triggers(mensaje, respuesta, usuario_id, perfil_id)
    if not keyword_match:
        return False

    trigger_type, keyword = keyword_match
    logger.info(f"Layer 1 keyword match: {trigger_type} (keyword: {keyword})")

    # Check if AI classification is enabled
    ai_enabled = get_config("human_mode_ai_classification", "true", usuario_id=usuario_id, perfil_id=perfil_id).lower() == "true"
    if not ai_enabled:
        logger.info("AI classification disabled, using keyword match only")
        return True

    # Layer 2: AI intent classification
    return _classify_trigger_intent(mensaje, trigger_type, keyword, usuario_id)


def _check_keyword_triggers(mensaje: str, respuesta: str, usuario_id: int = None, perfil_id: int = None):
    """
    Layer 1: Fast keyword pre-filter.
    Returns (trigger_type, keyword) tuple if match found, None otherwise.
    """
    triggers_str = get_config(
        "human_mode_triggers", '["frustration","complaint","human_request"]',
        usuario_id=usuario_id, perfil_id=perfil_id,
    )
    custom_triggers_str = get_config("human_mode_custom_triggers", "", usuario_id=usuario_id, perfil_id=perfil_id)

    try:
        triggers = json.loads(triggers_str)
    except (json.JSONDecodeError, TypeError):
        triggers = ["frustration", "complaint", "human_request"]

    # Only check the CLIENT's message for triggers, not the agent's response
    # The agent's response could contain trigger words naturally (e.g., "una persona real te atenderá")
    texto = mensaje.lower()

    trigger_keywords = {
        "frustration": ["molesto", "enojado", "frustrado", "harto", "cansado de", "no sirve", "pésimo", "horrible", "terrible", "indignado"],
        "complaint": ["queja", "reclamo", "demanda", "problema grave", "inaceptable", "exijo", "reembolso", "devolución"],
        "human_request": ["hablar con humano", "persona real", "agente humano", "hablar con alguien", "asesor", "ejecutivo", "representante", "operador", "supervisor"],
        "urgency": ["urgente", "emergencia", "ahora mismo", "inmediatamente", "lo antes posible", "crítico"],
        "complexity": ["no entiendes", "no me ayudas", "no puedes", "no sabes", "inútil", "no sirves"],
        "negotiation": ["descuento", "rebaja", "precio especial", "promoción", "negociar", "oferta"],
    }

    for trigger in triggers:
        if trigger in trigger_keywords:
            for keyword in trigger_keywords[trigger]:
                keyword_words = keyword.split()
                if len(keyword_words) == 1:
                    if keyword in texto:
                        return (trigger, keyword)
                else:
                    if all(word in texto for word in keyword_words):
                        return (trigger, keyword)

    if custom_triggers_str:
        mensaje_lower = mensaje.lower()
        custom_keywords = [k.strip().lower() for k in custom_triggers_str.split(",") if k.strip()]
        for keyword in custom_keywords:
            keyword_words = keyword.split()
            if len(keyword_words) == 1:
                if keyword in mensaje_lower:
                    return ("custom", keyword)
            else:
                if all(word in mensaje_lower for word in keyword_words):
                    return ("custom", keyword)

    return None


def _classify_trigger_intent(mensaje: str, trigger_type: str, keyword: str, usuario_id: int = None) -> bool:
    """
    Layer 2: Use AI to verify if the trigger keyword represents genuine intent
    for human intervention, or is just an informational question.
    """
    try:
        from agent import get_openai_client
        client = get_openai_client(usuario_id)

        prompt = f"""Analiza este mensaje de un cliente y determina si REALMENTE necesita intervención humana.

Mensaje del cliente: "{mensaje}"
Se detectó la palabra clave: "{keyword}" (categoría: {trigger_type})

Responde SOLO con "SI" o "NO".
- SI: El cliente genuinamente necesita hablar con un humano, está frustrado de verdad, tiene una emergencia, o hace una queja seria.
- NO: El cliente solo hace una pregunta informativa, pregunta por curiosidad, o la palabra clave aparece en un contexto no urgente.

Ejemplos:
- "Quiero hablar con una persona real" → SI
- "Eres una persona real?" → NO
- "Necesito un notario para la firma" → SI
- "Cuánto cobra el notario?" → NO
- "Estoy harto de que no me respondan" → SI
- "Mi perro tiene sangre en el vómito" → SI"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=10,
            temperature=0,
        )
        answer = response.choices[0].message.content.strip().upper()
        is_genuine = answer.startswith("SI") or answer == "SÍ"
        logger.info(f"Layer 2 AI classification for '{keyword}' ({trigger_type}): {answer} -> {'trigger' if is_genuine else 'no trigger'}")
        return is_genuine
    except Exception as e:
        logger.warning(f"AI trigger classification failed: {e}, falling back to keyword match")
        return True


router = APIRouter(tags=["Webhook"])


@router.post(
    "/whatsapp",
    summary="WhatsApp webhook",
    description="Receive incoming messages from WAHA or Evolution API. Processes messages, generates AI responses and sends replies.",
)
async def whatsapp_webhook(request: Request):
    _verify_webhook_token(request)
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

        # Evento de typing (contacto esta escribiendo)
        if data.get("event") == "typing":
            payload = data.get("payload", {})
            phone = (
                payload.get("from", "")
                .replace("@c.us", "")
                .replace("@s.whatsapp.net", "")
                .replace("@lid", "")
            )
            if phone:
                if not phone.startswith("+"):
                    phone = f"+{phone}"
                from tenant import resolver_perfil_por_session
                from models import SessionLocal as _SL
                _db = _SL()
                try:
                    uid, pid = resolver_perfil_por_session(data.get("session", ""), _db)
                finally:
                    _db.close()
                if uid is not None:
                    await ws_manager.broadcast_to_perfil(uid, pid, "typing", {"telefono": phone})
            return Response(
                content='{"status":"ok"}',
                media_type="application/json",
                status_code=200,
            )

        # Mensaje eliminado
        if data.get("event") == "message_revoked":
            payload = data.get("payload", {})
            phone = (
                payload.get("from", "")
                .replace("@c.us", "")
                .replace("@s.whatsapp.net", "")
                .replace("@lid", "")
            )
            if phone:
                if not phone.startswith("+"):
                    phone = f"+{phone}"
                original = payload.get("originalBody", "")
                from_me = payload.get("fromMe", False)
                try:
                    from message_service import MessageService
                    from models import SessionLocal as _SessionLocal

                    _db = _SessionLocal()
                    rev_uid, rev_pid = None, None
                    try:
                        from tenant import resolver_perfil_por_session
                        rev_uid, rev_pid = resolver_perfil_por_session(data.get("session", ""), _db)
                        who = "Tu" if from_me else "El cliente"
                        MessageService.add_system_event(
                            _db,
                            phone,
                            "mensaje_eliminado",
                            f"{who} elimino un mensaje",
                            metadata={"original": original, "from_me": from_me},
                            usuario_id=rev_uid,
                            perfil_id=rev_pid,
                        )
                    finally:
                        _db.close()
                    if rev_uid is not None:
                        await ws_manager.broadcast_to_perfil(
                            rev_uid, rev_pid,
                            "message_revoked",
                            {"telefono": phone, "original": original, "from_me": from_me},
                        )
                except Exception as e:
                    logger.warning(f"Error guardando mensaje eliminado: {e}")
            return Response(
                content='{"status":"ok"}',
                media_type="application/json",
                status_code=200,
            )

        # Parsear mensaje
        parsed = parse_webhook_message(data)

        if not parsed:
            logger.debug(
                f"Webhook ignorado (no es mensaje valido): {data.get('event', 'unknown')}"
            )
            return Response(
                content='{"status": "ignored"}',
                media_type="application/json",
                status_code=200,
            )

        from_number = parsed["phone"]
        incoming_msg = parsed["message"]
        contact_name = parsed.get("name", "")
        is_from_me = parsed.get("from_me", False)
        media_url = parsed.get("media_url")
        media_type = parsed.get("media_type")
        quoted_msg = parsed.get("quoted_msg")
        session_name = parsed.get("session", "")

        # Single DB session for entire webhook processing
        from message_service import MessageService
        from models import SessionLocal as _SessionLocal, MensajeConversacion
        from datetime import datetime, timedelta
        from tenant import resolver_usuario_por_telefono, resolver_perfil_por_session
        from api.routers.perfiles import get_perfil_activo_id

        _db = _SessionLocal()
        perfil_id = None
        try:
            # Routing: prefer the bridge session ("perfil_<id>") — it tells us
            # exactly which profile (and owner) this WhatsApp number belongs to.
            usuario_id, perfil_id = resolver_perfil_por_session(session_name, _db)
            if usuario_id is None:
                # Fallback: resolve by the contact's phone + the user's active profile.
                usuario_id = resolver_usuario_por_telefono(from_number, _db)
                perfil_id = get_perfil_activo_id(_db, usuario_id)

            logger.info(
                f"{'Outgoing' if is_from_me else 'Message from'} {from_number} ({contact_name}) [user:{usuario_id}]: {incoming_msg[:80]}"
            )

            # Broadcast typing antes del mensaje (para que el frontend vea actividad)
            if not is_from_me:
                await ws_manager.broadcast_to_perfil(usuario_id, perfil_id, "typing", {"telefono": from_number})

            # Construir contenido del mensaje (con media y quoted)
            msg_content = incoming_msg
            msg_metadata = {}
            if media_url:
                msg_metadata["media_url"] = media_url
                msg_metadata["media_type"] = media_type
            if quoted_msg:
                msg_metadata["quoted"] = quoted_msg

            # Determinar rol y fuente
            msg_role = "assistant" if is_from_me else "user"
            if is_from_me:
                msg_metadata["source"] = "phone"  # Respondido desde el celular

            # Guardar/actualizar contacto (entrantes y salientes desde el celular).
            # También para salientes: si respondes a un número desde el celular sin
            # historial entrante, el contacto no existiría y la conversación no
            # aparecería en el dashboard. guardar_contacto_mensaje no pisa nombres
            # ya existentes y está scoped por usuario_id.
            try:
                guardar_contacto_mensaje(from_number, contact_name, db=_db, usuario_id=usuario_id, perfil_id=perfil_id)
            except Exception as e:
                logger.warning(f"Error guardando contacto: {e}")

            # Guardar mensaje (verificar que no sea duplicado)
            try:
                MessageService.migrate_from_memoria(_db, from_number, usuario_id)

                # Verificar duplicado: mismo telefono, rol, contenido en los ultimos 10s
                is_duplicate = False
                if msg_content:
                    recent = (
                        _db.query(MensajeConversacion)
                        .filter(
                            MensajeConversacion.telefono == from_number,
                            MensajeConversacion.rol == msg_role,
                            MensajeConversacion.contenido == msg_content,
                            MensajeConversacion.created_at
                            >= datetime.utcnow() - timedelta(seconds=10),
                        )
                        .first()
                    )
                    is_duplicate = recent is not None

                if not is_duplicate:
                    MessageService.add_message(
                        _db,
                        from_number,
                        msg_role,
                        msg_content,
                        metadata=msg_metadata if msg_metadata else None,
                        usuario_id=usuario_id,
                        perfil_id=perfil_id,
                    )
                    await ws_manager.broadcast_to_perfil(
                        usuario_id,
                        perfil_id,
                        "new_message",
                        {
                            "telefono": from_number,
                            "nombre": contact_name,
                            "mensaje": msg_content[:200],
                            "rol": msg_role,
                            "media_url": media_url,
                        },
                    )
                else:
                    logger.info(f"Duplicate message skipped for {from_number}")
            except Exception as e:
                logger.warning(f"Error guardando mensaje: {e}")

            # Si es mensaje enviado por nosotros (desde cel), no procesar con IA
            if is_from_me:
                return Response(
                    content='{"status": "outgoing_saved"}',
                    media_type="application/json",
                    status_code=200,
                )

            # Marcar como respondido en campanas activas
            try:
                await marcar_respondido(from_number)
            except Exception as e:
                logger.warning(f"Error marcando respondido: {e}")

            # Verificar comando #reactivar
            reactivar_command = get_config("human_mode_reactivar_command", "#reactivar", usuario_id=usuario_id, perfil_id=perfil_id)
            if incoming_msg.strip().lower() == reactivar_command.lower():
                try:
                    if desactivar_modo_humano_por_telefono(from_number, db=_db, usuario_id=usuario_id):
                        logger.info(
                            f"Modo humano desactivado para {from_number} por comando"
                        )
                        return Response(
                            content='{"status": "human_mode_deactivated"}',
                            media_type="application/json",
                            status_code=200,
                        )
                except Exception as e:
                    logger.warning(f"Error procesando comando reactivar: {e}")

            # Verificar modo humano
            try:
                if verificar_modo_humano(from_number, db=_db, usuario_id=usuario_id):
                    logger.info(f"Contacto {from_number} en modo humano, IA no responde")
                    return Response(
                        content='{"status": "human_mode_active"}',
                        media_type="application/json",
                        status_code=200,
                    )
            except Exception as e:
                logger.warning(f"Error verificando modo humano: {e}")
        finally:
            _db.close()

        # Verificar si agente esta habilitado
        agent_enabled = get_config("agent_enabled", "true", usuario_id=usuario_id, perfil_id=perfil_id).lower() == "true"

        if not agent_enabled:
            logger.info("Agent is disabled, not responding")
            return Response(
                content='{"status": "agent_disabled"}',
                media_type="application/json",
                status_code=200,
            )

        # Generar respuesta con el agente (en thread pool para no bloquear event loop)
        import asyncio

        loop = asyncio.get_event_loop()
        respuesta = await loop.run_in_executor(
            None, responder, incoming_msg, from_number, usuario_id, perfil_id
        )

        logger.info(f"Response: {respuesta[:100]}...")

        # Notificar via WebSocket la respuesta del agente
        await ws_manager.broadcast_to_perfil(
            usuario_id,
            perfil_id,
            "new_message",
            {
                "telefono": from_number,
                "nombre": contact_name,
                "mensaje": respuesta[:200],
                "rol": "assistant",
            },
        )

        # Detectar triggers para modo humano
        try:
            if detectar_trigger_modo_humano(incoming_msg, respuesta, usuario_id=usuario_id, perfil_id=perfil_id):
                activar_modo_humano_por_telefono(
                    from_number, "Trigger automático detectado", usuario_id=usuario_id
                )
                logger.info(f"Modo humano activado automáticamente para {from_number}")
        except Exception as e:
            logger.warning(f"Error detectando triggers: {e}")

        # Enviar respuesta usando la sesión del perfil
        if whatsapp_service.is_configured():
            session = f"perfil_{perfil_id}" if perfil_id else "default"
            result = await whatsapp_service.send_message(from_number, respuesta, session=session)
            if result["success"]:
                logger.info(f"Mensaje enviado a {from_number}")
            else:
                logger.error(f"Error enviando mensaje: {result.get('error')}")
            return Response(
                content='{"status": "ok"}',
                media_type="application/json",
                status_code=200,
            )
        else:
            logger.warning("WhatsApp no configurado, no se puede enviar respuesta")
            return Response(
                content='{"status": "whatsapp_not_configured"}',
                media_type="application/json",
                status_code=200,
            )

    except Exception as e:
        logger.error(f"Webhook error: {str(e)}", exc_info=True)
        return Response(
            content='{"status": "error"}',
            media_type="application/json",
            status_code=500,
        )


@router.post(
    "/api/webhook/whatsapp",
    summary="WhatsApp webhook (alias)",
    description="Alternative webhook URL for backwards compatibility.",
)
async def whatsapp_webhook_alias(request: Request):
    return await whatsapp_webhook(request)
