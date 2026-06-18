"""
Skill Executor - Deterministic pre-actions that run BEFORE GPT.

Instead of relying on GPT to choose tools via function calling (unreliable),
the orchestrator runs these skill functions deterministically, then passes
the results to GPT for natural language generation only.

Each skill function:
1. Receives a context dict + the DB session
2. Executes deterministic pre-actions (search, validate, send)
3. Returns a result dict with data + a prompt_hint for GPT
"""

import json
import logging
import os
import re
import time
import unicodedata
from typing import Any

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize(text: str) -> str:
    """Remove accents and lowercase for flexible matching."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _clean_phone(telefono: str) -> str:
    """Normalize phone to WhatsApp chatId format."""
    phone = telefono.replace("+", "").replace("@lid", "")
    if not phone.endswith("@c.us"):
        phone = f"{phone}@c.us"
    return phone


def _make_result(
    skill: str,
    success: bool,
    data: dict | None = None,
    prompt_hint: str | None = None,
    events: list | None = None,
) -> dict:
    """Build a uniform skill result dict."""
    return {
        "skill": skill,
        "success": success,
        "data": data or {},
        "prompt_hint": prompt_hint,
        "events": events or [],
    }


def _check_funnel_advance(
    db, telefono: str, usuario_id: int = 1, cita_agendada: bool = False
) -> dict | None:
    """Check and auto-advance funnel step if conditions are met.

    Returns the advance result dict or None.
    """
    from capture_service import CaptureService
    from funnel_service import FunnelService
    from message_service import MessageService

    datos = CaptureService.get_captured_data(db, usuario_id, telefono)
    should_advance = FunnelService.check_advance_conditions(
        db, usuario_id, telefono, datos, cita_agendada=cita_agendada
    )
    if not should_advance:
        return None

    result = FunnelService.advance_contact(
        db, usuario_id, telefono, "Condiciones cumplidas automaticamente"
    )
    if result:
        paso_nuevo = result["paso_nuevo"]
        evento_text = (
            f"Avanzado al paso '{paso_nuevo['nombre']}'. "
            "Razon: Condiciones cumplidas automaticamente"
        )
        MessageService.add_system_event(
            db,
            telefono,
            "paso_avanzado",
            evento_text,
            metadata={
                "paso_anterior": result["paso_anterior"],
                "paso_nuevo": paso_nuevo["nombre"],
            },
            usuario_id=usuario_id,
        )
    return result


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------


def skill_human_handoff(message: str, context: dict, db) -> dict:
    """Transfer conversation to a human agent."""
    from message_service import MessageService
    from agent import transferir_a_humano

    telefono = context["telefono"]
    usuario_id = context.get("usuario_id", 1)
    razon = context.get("razon", "Solicitud de atencion humana")

    try:
        result_text = transferir_a_humano(telefono, razon, usuario_id=usuario_id)

        MessageService.add_system_event(
            db,
            telefono,
            "intervencion_humana",
            f"Transferido a atencion humana. Razon: {razon}",
            metadata={"razon": razon},
            usuario_id=usuario_id,
        )

        return _make_result(
            skill="human_handoff",
            success=True,
            data={"result": result_text},
            prompt_hint="Informa al cliente que un asesor humano tomara la conversacion pronto. Se breve y amable.",
            events=[{"type": "intervencion_humana", "razon": razon}],
        )
    except Exception as e:
        logger.error(f"skill_human_handoff error: {e}", exc_info=True)
        return _make_result(
            skill="human_handoff",
            success=False,
            data={"error": str(e)},
            prompt_hint="No se pudo transferir a un humano. Disculpate e intenta de nuevo.",
        )


def skill_data_capture(message: str, context: dict, db) -> dict:
    """Extract contact data from the message using regex patterns.

    Unlike the GPT tool version, this runs deterministically: we scan the
    message for emails, phones, and names, then save whatever we find.
    """
    from capture_service import CaptureService
    from lead_scoring import update_lead_score, update_lead_state
    from message_service import MessageService

    telefono = context["telefono"]
    usuario_id = context.get("usuario_id", 1)

    try:
        datos_extraidos: dict[str, str] = {}

        # --- Email extraction ---
        email_match = re.search(
            r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", message
        )
        if email_match:
            datos_extraidos["email"] = email_match.group(0).lower()

        # --- Phone extraction (numbers with 7+ digits) ---
        phone_match = re.search(r"(?:\+?\d[\d\s\-]{6,}\d)", message)
        if phone_match:
            raw_phone = re.sub(r"[\s\-]", "", phone_match.group(0))
            # Only save if it looks different from the contact's own number
            if raw_phone.replace("+", "") != telefono.replace("+", ""):
                datos_extraidos["telefono_extra"] = raw_phone

        # --- Name from context (if provided by orchestrator) ---
        nombre_from_context = context.get("datos_capturados", {}).get("nombre")
        if not nombre_from_context:
            # Simple heuristic: "me llamo X" / "soy X" / "mi nombre es X"
            name_patterns = [
                r"(?:me llamo|soy|mi nombre es)\s+([A-Z\u00C0-\u024F][a-z\u00E0-\u024F]+(?:\s+[A-Z\u00C0-\u024F][a-z\u00E0-\u024F]+)?)",
            ]
            for pattern in name_patterns:
                name_match = re.search(pattern, message, re.IGNORECASE)
                if name_match:
                    datos_extraidos["nombre"] = name_match.group(1).strip()
                    break

        events = []
        if datos_extraidos:
            saved = CaptureService.save_captured_data(db, usuario_id, telefono, datos_extraidos)
            parts = [f"{k}: {v}" for k, v in datos_extraidos.items()]
            evento_text = "Datos guardados: " + ", ".join(parts)
            MessageService.add_system_event(
                db,
                telefono,
                "datos_guardados",
                evento_text,
                metadata=datos_extraidos,
                usuario_id=usuario_id,
            )
            events.append({"type": "datos_guardados", "datos": datos_extraidos})
            update_lead_score(db, telefono, usuario_id)
            update_lead_state(db, telefono, usuario_id)

        # ¿Datos mínimos completos? -> pasar a un humano (modelo de primer contacto)
        obligatorios = [
            f for f in CaptureService.get_fields(db, usuario_id) if f.get("obligatorio")
        ]
        pending = CaptureService.get_missing_fields(db, usuario_id, telefono)
        pending_names = [f["etiqueta"] for f in pending]

        if obligatorios and not pending:
            # Lead calificado: ya tenemos los datos mínimos -> handoff automático
            from agent import transferir_a_humano

            transferir_a_humano(
                telefono, "Datos mínimos completos: lead calificado", usuario_id=usuario_id
            )
            MessageService.add_system_event(
                db,
                telefono,
                "intervencion_humana",
                "Lead calificado (datos mínimos completos). Transferido a atención humana.",
                metadata={"razon": "datos_completos"},
                usuario_id=usuario_id,
            )
            events.append({"type": "intervencion_humana", "razon": "datos_completos"})
            hint = (
                "Ya tienes todos los datos del cliente. Despídete de forma breve y amable y dile "
                "que en un momento un asesor lo va a contactar. NO sigas haciendo más preguntas."
            )
        elif pending_names:
            hint = (
                "Datos pendientes por capturar: " + ", ".join(pending_names) + ". "
                "Busca obtener estos datos de forma natural durante la conversacion, sin pedirlos todos de golpe."
            )
        else:
            hint = "Continúa la conversación de forma natural y útil."

        if datos_extraidos:
            captured_desc = ", ".join(f"{k}={v}" for k, v in datos_extraidos.items())
            hint = f"Datos extraidos del mensaje: {captured_desc}. " + hint

        return _make_result(
            skill="data_capture",
            success=bool(datos_extraidos),
            data={
                "captured": datos_extraidos,
                "pending_fields": pending_names,
            },
            prompt_hint=hint,
            events=events,
        )
    except Exception as e:
        logger.error(f"skill_data_capture error: {e}", exc_info=True)
        return _make_result(
            skill="data_capture",
            success=False,
            data={"error": str(e)},
            prompt_hint=None,
        )


def skill_faq(message: str, context: dict, db) -> dict:
    """Search the knowledge base for answers."""
    from knowledge_service import KnowledgeService

    usuario_id = context.get("usuario_id", 1)

    try:
        results = KnowledgeService.search(db, usuario_id, message)

        if results:
            kb_context = "\n\n".join(
                [f"**{r['titulo']}**\n{r['contenido']}" for r in results[:3]]
            )
            return _make_result(
                skill="faq",
                success=True,
                data={"results": results[:3]},
                prompt_hint=(
                    f"Informacion encontrada en la base de conocimiento:\n{kb_context}\n"
                    "Usa esta informacion para responder al cliente de forma natural. "
                    "No copies textualmente, adapta el contenido."
                ),
            )

        return _make_result(
            skill="faq",
            success=False,
            data={"results": []},
            prompt_hint=(
                "No se encontro informacion sobre eso en la base de conocimiento. "
                "Responde con lo que sepas o indica que no tienes esa informacion."
            ),
        )
    except Exception as e:
        logger.error(f"skill_faq error: {e}", exc_info=True)
        return _make_result(
            skill="faq",
            success=False,
            data={"error": str(e)},
            prompt_hint="No se pudo buscar en la base de conocimiento. Responde con lo que sepas.",
        )


def skill_free_chat(message: str, context: dict, db) -> dict:
    """Default fallback -- no pre-actions, GPT uses general personality prompt."""
    return _make_result(
        skill="free_chat",
        success=True,
        data={},
        prompt_hint=None,
    )


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

SKILL_MAP: dict[str, Any] = {
    "human_handoff": skill_human_handoff,
    "data_capture": skill_data_capture,
    "faq": skill_faq,
    "free_chat": skill_free_chat,
}


def execute_skill(intent_result, message: str, context: dict, db) -> dict:
    """Route to the correct skill function based on intent.

    Args:
        intent_result: An object with ``primary`` (str) and optionally
            ``secondary`` (str | None) attributes indicating the detected intent.
        message: The raw user message.
        context: Context dict with telefono, usuario_id, datos_capturados, etc.
        db: SQLAlchemy database session (caller-managed).

    Returns:
        Skill result dict.  If a secondary intent exists, its result is nested
        under the ``"secondary"`` key.
    """
    primary = getattr(intent_result, "primary", None) or "free_chat"
    secondary = getattr(intent_result, "secondary", None)

    # Modelo de primer contacto: en cada mensaje intentamos capturar los datos
    # mínimos del cliente; al completarlos, data_capture pasa la conversación a
    # un humano. Por eso forzamos data_capture como skill secundario salvo que
    # el principal ya sea captura o handoff.
    if not secondary and primary not in ("data_capture", "human_handoff"):
        secondary = "data_capture"

    skill_fn = SKILL_MAP.get(primary, skill_free_chat)
    logger.info(f"Executing skill: {primary} (secondary: {secondary})")

    try:
        result = skill_fn(message, context, db)
    except Exception as e:
        logger.error(f"Skill '{primary}' crashed: {e}", exc_info=True)
        result = _make_result(
            skill=primary,
            success=False,
            data={"error": str(e)},
            prompt_hint="Hubo un error interno. Disculpate con el cliente.",
        )

    # Run secondary intent if present
    if secondary:
        secondary_fn = SKILL_MAP.get(secondary)
        if secondary_fn:
            logger.info(f"Executing secondary skill: {secondary}")
            try:
                secondary_result = secondary_fn(message, context, db)
                result["secondary"] = secondary_result
            except Exception as e:
                logger.error(f"Secondary skill '{secondary}' crashed: {e}", exc_info=True)
                result["secondary"] = _make_result(
                    skill=secondary,
                    success=False,
                    data={"error": str(e)},
                    prompt_hint=None,
                )

    return result
