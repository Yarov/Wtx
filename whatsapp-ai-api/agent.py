"""
Agent - Motor de IA con conocimiento, funnel y captura de datos
Multi-tenant: todas las funciones reciben usuario_id
"""

import os
import json
import logging
from openai import OpenAI
from dotenv import load_dotenv
from database import get_config, is_tool_enabled
from models import SessionLocal

load_dotenv()
logger = logging.getLogger(__name__)


def get_openai_client(usuario_id: int = None):
    api_key = get_config("openai_api_key", "", usuario_id=usuario_id) or os.getenv(
        "OPENAI_API_KEY", ""
    )
    if not api_key:
        raise ValueError("No OpenAI API key configured")
    return OpenAI(api_key=api_key)


# ─── Tool Definitions ───────────────────────────────────────────────────


def get_enabled_tools(usuario_id: int = None, perfil_id: int = None) -> list:
    """Obtener tools habilitados - incluye captura, conocimiento, funnel y transferencia"""
    from capture_service import CaptureService

    capture_properties = {}
    db = SessionLocal()
    try:
        fields = CaptureService.get_fields(db, usuario_id=usuario_id, activo_only=True)
        for f in fields:
            capture_properties[f["nombre"]] = {
                "type": "string",
                "description": f["etiqueta"],
            }
    finally:
        db.close()

    if not capture_properties:
        capture_properties = {
            "nombre": {"type": "string", "description": "Nombre del cliente"}
        }

    all_tools = [
        {
            "id": "guardar_datos_contacto",
            "always": True,
            "definition": {
                "type": "function",
                "function": {
                    "name": "guardar_datos_contacto",
                    "description": "Registrar internamente un dato que el cliente menciono en la conversacion. Llamar cuando el cliente diga su nombre, correo, u otro dato relevante. El cliente NO debe saber que se esta guardando.",
                    "parameters": {
                        "type": "object",
                        "properties": capture_properties,
                    },
                },
            },
        },
        {
            "id": "buscar_conocimiento",
            "always": True,
            "definition": {
                "type": "function",
                "function": {
                    "name": "buscar_conocimiento",
                    "description": "Buscar informacion en la base de conocimiento del negocio. Usar cuando el cliente pregunte sobre precios, servicios, politicas, o cualquier informacion del negocio.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "consulta": {
                                "type": "string",
                                "description": "Termino de busqueda o pregunta a buscar",
                            }
                        },
                        "required": ["consulta"],
                    },
                },
            },
        },
        {
            "id": "avanzar_paso_funnel",
            "always": True,
            "definition": {
                "type": "function",
                "function": {
                    "name": "avanzar_paso_funnel",
                    "description": "Avanzar al cliente al siguiente paso del funnel de ventas. Llamar cuando se cumplan las condiciones del paso actual.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "razon": {
                                "type": "string",
                                "description": "Razon por la que se avanza",
                            }
                        },
                        "required": ["razon"],
                    },
                },
            },
        },
        {
            "id": "transferir_a_humano",
            "always": True,
            "definition": {
                "type": "function",
                "function": {
                    "name": "transferir_a_humano",
                    "description": "Transferir la conversacion a atencion humana. Usar cuando el cliente esta frustrado, tiene una queja grave, solicita hablar con una persona, o la situacion requiere intervencion humana.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "razon": {
                                "type": "string",
                                "description": "Razon de la transferencia",
                            }
                        },
                        "required": ["razon"],
                    },
                },
            },
        },
    ]

    enabled = []
    for t in all_tools:
        if t.get("always") or is_tool_enabled(t["id"], usuario_id=usuario_id, perfil_id=perfil_id):
            enabled.append(t["definition"])
    return enabled


# ─── Tool Execution ──────────────────────────────────────────────────────


def execute_tool(name: str, args: dict, telefono: str, db, usuario_id: int = 1) -> dict:
    """Ejecutar herramienta. Recibe la sesion de DB del caller para evitar sesiones multiples."""
    if name == "guardar_datos_contacto":
        from capture_service import CaptureService
        from message_service import MessageService

        datos = {k: v for k, v in args.items() if v and str(v).strip()}
        saved = CaptureService.save_captured_data(db, usuario_id, telefono, datos)
        parts = [f"{k}: {v}" for k, v in datos.items() if v]
        evento_text = "Datos guardados: " + ", ".join(parts)
        MessageService.add_system_event(
            db, telefono, "datos_guardados", evento_text, metadata=datos, usuario_id=usuario_id
        )
        from lead_scoring import update_lead_score, update_lead_state

        update_lead_score(db, telefono, usuario_id)
        update_lead_state(db, telefono, usuario_id)
        _check_funnel_advance(db, telefono, usuario_id)
        return {
            "resultado": f"Datos guardados correctamente: {', '.join(parts)}",
            "datos": saved,
        }

    elif name == "buscar_conocimiento":
        from knowledge_service import KnowledgeService

        consulta = args.get("consulta", "")
        results = KnowledgeService.search(db, usuario_id, consulta)
        if results:
            context = "\n\n".join(
                [f"**{r['titulo']}**\n{r['contenido']}" for r in results[:3]]
            )
            return {"encontrado": True, "informacion": context}
        return {
            "encontrado": False,
            "informacion": "No se encontro informacion sobre eso en la base de conocimiento.",
        }

    elif name == "avanzar_paso_funnel":
        from funnel_service import FunnelService
        from message_service import MessageService

        razon = args.get("razon", "")
        result = FunnelService.advance_contact(db, usuario_id, telefono, razon)
        if result:
            paso_nuevo = result["paso_nuevo"]
            evento_text = f"Avanzado al paso '{paso_nuevo['nombre']}'. Razon: {razon}"
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
            from lead_scoring import update_lead_score

            update_lead_score(db, telefono, usuario_id)
            return {
                "avanzado": True,
                "paso_nuevo": paso_nuevo["nombre"],
                "titulo": paso_nuevo["titulo"],
            }
        return {
            "avanzado": False,
            "razon": "No se pudo avanzar (no hay siguiente paso)",
        }

    elif name == "transferir_a_humano":
        from message_service import MessageService

        razon = args.get("razon", "Solicitud de atencion humana")
        result = transferir_a_humano(telefono, razon, usuario_id=usuario_id)
        MessageService.add_system_event(
            db,
            telefono,
            "intervencion_humana",
            f"Transferido a atencion humana. Razon: {razon}",
            metadata={"razon": razon},
            usuario_id=usuario_id,
        )
        return {"resultado": result}

    else:
        return {"error": "Funcion no encontrada"}


def transferir_a_humano(
    telefono: str, razon: str = "Solicitud de atencion humana", usuario_id: int = None
) -> str:
    """Transferir la conversacion a atencion humana activando modo humano para el contacto."""
    from api.routers.contactos import activar_modo_humano_por_telefono

    try:
        resultado = activar_modo_humano_por_telefono(
            telefono, razon, usuario_id=usuario_id
        )
        if resultado:
            return "Conversacion transferida a atencion humana. Un asesor atendera al cliente pronto."
        return "No se pudo transferir la conversacion. El contacto no existe."
    except Exception as e:
        return f"Error al transferir: {str(e)}"


def _check_funnel_advance(db, telefono: str, usuario_id: int = 1, cita_agendada: bool = False):
    """Verificar si se debe avanzar automaticamente en el funnel"""
    from funnel_service import FunnelService
    from capture_service import CaptureService

    datos = CaptureService.get_captured_data(db, usuario_id, telefono)
    should_advance = FunnelService.check_advance_conditions(
        db, usuario_id, telefono, datos, cita_agendada=cita_agendada
    )
    if should_advance:
        from message_service import MessageService

        result = FunnelService.advance_contact(
            db, usuario_id, telefono, "Condiciones cumplidas automaticamente"
        )
        if result:
            paso_nuevo = result["paso_nuevo"]
            evento_text = f"Avanzado al paso '{paso_nuevo['nombre']}'. Razon: Condiciones cumplidas automaticamente"
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


# ─── Prompt Builder ──────────────────────────────────────────────────────


def build_system_prompt(db, telefono: str, usuario_id: int = 1, perfil_id: int = None) -> str:
    """Construir system prompt desde la config del frontend.

    Priority order (highest last — LLMs weight recent context more):
    1. Identity & knowledge (role, context, KB) — reference material
    2. Behavior (tone, constraints, tech rules) — how to act
    3. Funnel instruction — WHAT TO DO NOW (highest priority, placed last)
    """
    from datetime import datetime
    from knowledge_service import KnowledgeService
    from capture_service import CaptureService
    from funnel_service import FunnelService
    from models import Contacto

    uid = usuario_id
    pid = perfil_id
    prompt_parts = []

    # ═══════════════════════════════════════════════════════════════════
    # LAYER 1: IDENTITY & KNOWLEDGE (reference material — lowest priority)
    # ═══════════════════════════════════════════════════════════════════

    # ─── 1a. Secciones del prompt: role + context ───
    sections_str = get_config("prompt_sections", "", usuario_id=uid, perfil_id=pid)
    edit_mode = get_config("prompt_edit_mode", "sections", usuario_id=uid, perfil_id=pid)

    # Collect behavior sections separately to place them later
    _constraints = ""
    _tone = ""
    _task = ""

    if edit_mode == "manual":
        manual = get_config("manual_prompt", "", usuario_id=uid, perfil_id=pid)
        if manual:
            prompt_parts.append(manual)
    else:
        try:
            sections = json.loads(sections_str) if sections_str else {}
        except (json.JSONDecodeError, TypeError):
            sections = {}

        agent_name = get_config("agent_name", "Asistente", usuario_id=uid, perfil_id=pid)
        business_name = get_config("business_name", "Mi Negocio", usuario_id=uid, perfil_id=pid)

        role = sections.get("role", "")
        context = sections.get("context", "")
        _task = sections.get("task", "")
        _constraints = sections.get("constraints", "")
        _tone = sections.get("tone", "")

        if agent_name and agent_name not in role:
            role = f"Tu nombre es {agent_name}. {role}"
        if business_name and business_name != "Mi Negocio" and business_name not in context:
            context = f"Trabajas en {business_name}. {context}"

        if role:
            prompt_parts.append(role)
        if context:
            prompt_parts.append(context)

    # ─── 1b. Productos/servicios ───
    agent_products = get_config("agent_products", "", usuario_id=uid, perfil_id=pid)
    if agent_products:
        prompt_parts.append(f"Lo que ofrecemos:\n{agent_products}")

    # ─── 1c. Knowledge base (referencia) ───
    knowledge_context = KnowledgeService.get_context_for_agent(db, uid)
    if knowledge_context:
        prompt_parts.append(knowledge_context)

    # ─── 1e. Fecha/hora ───
    ahora = datetime.now()
    prompt_parts.append(
        f"Hoy es {ahora.strftime('%Y-%m-%d %H:%M')} ({ahora.strftime('%A')})."
    )

    # ═══════════════════════════════════════════════════════════════════
    # LAYER 2: BEHAVIOR (how to act)
    # ═══════════════════════════════════════════════════════════════════

    # ─── 2a. Task, constraints, tone ───
    if _task:
        prompt_parts.append(_task)
    if _constraints:
        prompt_parts.append(_constraints)
    if _tone:
        prompt_parts.append(_tone)

    # ─── 2b. Tools deshabilitados ───
    tools_info = _get_tools_availability_info(uid, pid)
    if tools_info:
        prompt_parts.append(tools_info)

    # ─── 2c. Reglas técnicas mínimas ───
    tech_rules = [
        "Basate solo en la info proporcionada. Si no sabes algo, dilo.",
        "No uses markdown de imagenes ![]().",
    ]
    prompt_parts.append("Reglas:\n" + "\n".join(f"- {r}" for r in tech_rules))

    # ─── 2d. Custom instructions ───
    custom_instructions = get_config("custom_instructions", "", usuario_id=uid, perfil_id=pid)
    if custom_instructions:
        prompt_parts.append(custom_instructions)

    # ─── 2e. Datos del cliente capturados ───
    capture_instructions = CaptureService.get_capture_instructions(db, uid, telefono)
    if capture_instructions:
        prompt_parts.append(capture_instructions)

    # ═══════════════════════════════════════════════════════════════════
    # LAYER 3: CURRENT DIRECTIVE (what to do NOW — highest priority, last)
    # ═══════════════════════════════════════════════════════════════════

    contacto = (
        db.query(Contacto)
        .filter(Contacto.telefono == telefono, Contacto.usuario_id == uid)
        .first()
    )
    funnel_instruction = None
    if contacto and contacto.paso_funnel:
        step_info = FunnelService.get_contact_step_info(db, uid, telefono)
        if step_info["instrucciones"]:
            funnel_instruction = step_info["instrucciones"]
    elif contacto:
        first_step = FunnelService.get_first_step(db, uid)
        if first_step:
            FunnelService.assign_contact_to_step(db, uid, telefono, first_step["nombre"])
            if first_step.get("instrucciones_agente"):
                funnel_instruction = first_step["instrucciones_agente"]

    if funnel_instruction:
        prompt_parts.append(
            ">>> DIRECTIVA PRINCIPAL (sigue esto por encima de todo lo anterior) <<<\n"
            f"{funnel_instruction}\n"
            "Haz EXACTAMENTE lo que dice esta directiva. No agregues acciones extra a menos que esta directiva lo indique explicitamente."
        )

    return "\n\n".join(prompt_parts)


def _send_typing(telefono: str):
    """Enviar indicador 'escribiendo...' al contacto via WhatsApp"""
    import httpx as _httpx

    wa_url = os.getenv("WHATSAPP_API_URL", "http://whatsapp-bridge:3080")
    wa_key = os.getenv("WHATSAPP_API_KEY", "")
    phone_clean = telefono.replace("+", "").replace("@lid", "")
    if not phone_clean.endswith("@c.us"):
        phone_clean = f"{phone_clean}@c.us"
    try:
        with _httpx.Client(timeout=5.0) as c:
            c.post(
                f"{wa_url}/api/sendTyping",
                json={"chatId": phone_clean, "duration": 4},
                headers={"X-Api-Key": wa_key, "Content-Type": "application/json"},
            )
    except Exception:
        pass


def _get_tools_availability_info(usuario_id: int = None, perfil_id: int = None) -> str:
    return ""


# ─── Main Responder ──────────────────────────────────────────────────────


def _sync_to_legacy_memoria(db, telefono: str, usuario_id: int = 1, perfil_id: int = None):
    """Sincronizar mensajes nuevos a la tabla Memoria para compatibilidad"""
    from models import Memoria
    from message_service import MessageService
    from datetime import datetime

    # Si no viene el perfil, resolver el activo del usuario (background sin header)
    if perfil_id is None:
        try:
            from api.routers.perfiles import get_perfil_activo_id
            perfil_id = get_perfil_activo_id(db, usuario_id)
        except Exception:
            perfil_id = None

    msgs = MessageService.get_messages_for_ai(db, telefono, usuario_id=usuario_id, limit=20)
    memoria = db.query(Memoria).filter(Memoria.telefono == telefono).first()
    if memoria:
        memoria.historial = json.dumps(msgs, ensure_ascii=False)
        memoria.updated_at = datetime.utcnow()
        if memoria.perfil_id is None and perfil_id is not None:
            memoria.perfil_id = perfil_id
    else:
        memoria = Memoria(
            telefono=telefono,
            usuario_id=usuario_id,
            perfil_id=perfil_id,
            historial=json.dumps(msgs, ensure_ascii=False),
        )
        db.add(memoria)
    db.commit()


# ─── Skill Helpers ───────────────────────────────────────────────────────────


def _get_enabled_skill_names(usuario_id: int, perfil_id: int = None) -> list[str]:
    """Map tool_config toggles to skill names."""
    # Always-available skills (not togglable)
    return ["human_handoff", "data_capture", "faq", "free_chat"]


def _build_orchestrator_context(db, telefono: str, usuario_id: int, historial: list, perfil_id: int = None) -> dict:
    """Build the full context dict needed by classifier, skills, and prompt builder."""
    from capture_service import CaptureService
    from funnel_service import FunnelService
    from knowledge_service import KnowledgeService
    from models import Contacto

    contacto = (
        db.query(Contacto)
        .filter(Contacto.telefono == telefono, Contacto.usuario_id == usuario_id)
        .first()
    )

    datos_capturados = CaptureService.get_captured_data(db, usuario_id, telefono)
    missing_fields = CaptureService.get_missing_fields(db, usuario_id, telefono)
    pending_names = [f["etiqueta"] for f in missing_fields]

    # Funnel step info
    funnel_step = None
    funnel_instruction = None
    if contacto and contacto.paso_funnel:
        step_info = FunnelService.get_contact_step_info(db, usuario_id, telefono)
        funnel_step = contacto.paso_funnel
        if step_info.get("instrucciones"):
            funnel_instruction = step_info["instrucciones"]
    elif contacto:
        first_step = FunnelService.get_first_step(db, usuario_id)
        if first_step:
            FunnelService.assign_contact_to_step(db, usuario_id, telefono, first_step["nombre"])
            funnel_step = first_step["nombre"]
            if first_step.get("instrucciones_agente"):
                funnel_instruction = first_step["instrucciones_agente"]

    # Knowledge context
    knowledge_context = KnowledgeService.get_context_for_agent(db, usuario_id)

    # Custom instructions
    custom_instructions = get_config("custom_instructions", "", usuario_id=usuario_id, perfil_id=perfil_id)

    return {
        "telefono": telefono,
        "usuario_id": usuario_id,
        "perfil_id": perfil_id,
        "client_name": datos_capturados.get("nombre", ""),
        "datos_capturados": datos_capturados,
        "datos_pendientes": pending_names,
        "pending_fields": pending_names,
        "paso_funnel": funnel_step,
        "funnel_step": funnel_step,
        "funnel_instruction": funnel_instruction,
        "lead_score": contacto.lead_score if contacto else None,
        "lead_state": contacto.estado_lead if contacto else None,
        "captured_data": datos_capturados,
        "message_count": len(historial),
        "active_appointments": [],
        "recent_messages": historial[-3:] if historial else [],
        "historial": historial,
        "knowledge_context": knowledge_context,
        "custom_instructions": custom_instructions,
    }


# ─── Main Responder ──────────────────────────────────────────────────────


def responder(mensaje: str, telefono: str, usuario_id: int = 1, perfil_id: int = None) -> str:
    """Orchestrated responder — classify intent, run skill, then GPT for text only.

    Flow:
    1. Save message + load history
    2. Build context (contact data, funnel, captured fields, etc.)
    3. Classify intent (keywords → funnel → mini AI)
    4. Execute skill pre-actions (deterministic)
    5. Build focused prompt (no tools)
    6. GPT generates text only (1 call, no tool loops)
    7. Post-actions (lead score, funnel advance, save response)
    """
    from message_service import MessageService
    from datetime import datetime
    from intent_classifier import classify_intent
    from skill_executor import execute_skill
    from prompt_builder import build_focused_prompt

    db = SessionLocal()
    try:
        # Resolve the profile this conversation belongs to (defaults to active).
        if perfil_id is None:
            from api.routers.perfiles import get_perfil_activo_id
            perfil_id = get_perfil_activo_id(db, usuario_id)

        client = get_openai_client(usuario_id)

        # Migrate legacy messages
        MessageService.migrate_from_memoria(db, telefono, usuario_id)

        # Dedup check + save incoming message
        from models import MensajeConversacion
        last = (
            db.query(MensajeConversacion)
            .filter(
                MensajeConversacion.telefono == telefono,
                MensajeConversacion.usuario_id == usuario_id,
                MensajeConversacion.rol == "user",
                MensajeConversacion.contenido == mensaje,
            )
            .order_by(MensajeConversacion.created_at.desc())
            .first()
        )
        if not last or (datetime.utcnow() - last.created_at).total_seconds() > 5:
            MessageService.add_message(db, telefono, "user", mensaje, usuario_id=usuario_id, perfil_id=perfil_id)

        # Load history
        historial = MessageService.get_messages_for_ai(db, telefono, usuario_id=usuario_id, limit=20)

        # ── Build context ──
        context = _build_orchestrator_context(db, telefono, usuario_id, historial, perfil_id=perfil_id)
        enabled_skills = _get_enabled_skill_names(usuario_id, perfil_id=perfil_id)

        # Track disabled skills so prompt builder can add restrictions
        context["disabled_skills"] = []

        # ── Classify intent ──
        intent = classify_intent(mensaje, context, enabled_skills, usuario_id)
        logger.info(
            f"Intent: {intent.primary} (secondary={intent.secondary}, "
            f"confidence={intent.confidence}, keywords={intent.matched_keywords})"
        )

        # ── Execute skill pre-actions ──
        _send_typing(telefono)
        skill_result = execute_skill(intent, mensaje, context, db)
        logger.info(
            f"Skill result: {skill_result.get('skill')} "
            f"success={skill_result.get('success')}"
        )

        # If human_handoff was executed successfully, return a brief message
        if intent.primary == "human_handoff" and skill_result.get("success"):
            farewell = "Te voy a comunicar con un asesor que te va a ayudar. Un momento por favor."
            MessageService.add_message(
                db, telefono, "assistant", farewell,
                metadata={"source": "ai", "skill": "human_handoff"}, usuario_id=usuario_id, perfil_id=perfil_id,
            )
            _sync_to_legacy_memoria(db, telefono, usuario_id, perfil_id)
            return farewell

        # ── Build focused prompt ──
        messages = build_focused_prompt(db, context, skill_result)

        # Merge prompt_hint from skill into the last system message
        prompt_hint = skill_result.get("prompt_hint", "")
        secondary_hint = ""
        if skill_result.get("secondary") and skill_result["secondary"].get("prompt_hint"):
            secondary_hint = skill_result["secondary"]["prompt_hint"]

        if prompt_hint or secondary_hint:
            combined_hint = "\n".join(filter(None, [prompt_hint, secondary_hint]))
            if messages and messages[0]["role"] == "system":
                messages[0]["content"] += f"\n\n--- Resultado de acciones ---\n{combined_hint}"

        # ── GPT generates text only ──
        model = get_config("model", "gpt-4o-mini", usuario_id=usuario_id)
        temperature = float(get_config("temperature", "0.7", usuario_id=usuario_id))
        max_tokens = int(get_config("max_tokens", "500", usuario_id=usuario_id))

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        respuesta = response.choices[0].message.content or ""

        if not respuesta:
            respuesta = "Disculpa, no pude procesar tu solicitud. ¿Podrías intentar de nuevo?"

        # ── Post-actions ──
        MessageService.add_message(
            db, telefono, "assistant", respuesta,
            metadata={"source": "ai", "skill": intent.primary}, usuario_id=usuario_id, perfil_id=perfil_id,
        )

        # Lead score update (only if not already done by skill)
        if intent.primary != "data_capture":
            from lead_scoring import update_lead_score, update_lead_state
            update_lead_score(db, telefono, usuario_id)
            update_lead_state(db, telefono, usuario_id)

        # Sync legacy
        _sync_to_legacy_memoria(db, telefono, usuario_id, perfil_id)

        return respuesta

    except Exception as e:
        logger.error(f"Error en responder: {e}", exc_info=True)
        return "Disculpa, hubo un error procesando tu mensaje. Por favor intenta de nuevo."
    finally:
        db.close()
