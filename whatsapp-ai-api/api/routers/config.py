"""
Configuration Router - API Keys, Prompt settings, WhatsApp config, Human Mode, Test Chat and Health Check
"""

import json
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from openai import OpenAI

from database import (
    get_config,
    set_config,
    is_tool_enabled,
    set_tool_enabled,
    get_all_tools_config,
)
from api.schemas.config import ApiKeysModel, PromptModel, ImprovePromptModel
from auth import get_current_user
from api.routers.perfiles import get_current_perfil
from models import (
    Usuario, Perfil, SessionLocal, Configuracion, ToolsConfig,
    Contacto, MensajeConversacion, BusinessConfig,
    DocumentoConocimiento, FunnelPaso, CampoCaptura,
)

router = APIRouter(
    prefix="/config",
    tags=["Configuration"],
    responses={401: {"description": "Not authenticated"}},
)


@router.get(
    "/api-keys",
    summary="Get API keys",
    description="Retrieve configured API keys with values masked for security.",
)
async def get_api_keys(current_user: Usuario = Depends(get_current_user)):
    openai_key = get_config("openai_api_key", "", usuario_id=current_user.id)
    return {
        "openai_api_key": openai_key[:8] + "..." if openai_key else "",
    }


@router.put(
    "/api-keys",
    summary="Update API keys",
    description="Update API keys for external services like OpenAI.",
)
async def update_api_keys(
    keys: ApiKeysModel, current_user: Usuario = Depends(get_current_user)
):
    data = keys.dict(exclude_unset=True)
    for key, value in data.items():
        if value and not value.endswith("..."):
            set_config(key, value, usuario_id=current_user.id)
    return {"status": "ok"}


@router.get(
    "/prompt",
    summary="Get AI prompt config",
    description="Retrieve the AI agent's system prompt, model settings and business information.",
)
async def get_prompt(
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    uid = current_user.id
    pid = perfil.id
    prompt_sections_str = get_config("prompt_sections", "", usuario_id=uid, perfil_id=pid)
    prompt_sections = None
    if prompt_sections_str:
        try:
            prompt_sections = json.loads(prompt_sections_str)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "system_prompt": get_config("system_prompt", "", usuario_id=uid, perfil_id=pid),
        "prompt_sections": prompt_sections,
        "model": get_config("model", "gpt-4o-mini", usuario_id=uid, perfil_id=pid),
        "temperature": float(get_config("temperature", "0.7", usuario_id=uid, perfil_id=pid)),
        "max_tokens": int(get_config("max_tokens", "500", usuario_id=uid, perfil_id=pid)),
        "response_delay": int(get_config("response_delay", "3", usuario_id=uid, perfil_id=pid)),
        "business_name": get_config("business_name", "", usuario_id=uid, perfil_id=pid),
        "business_type": get_config("business_type", "", usuario_id=uid, perfil_id=pid),
        "edit_mode": get_config("prompt_edit_mode", "sections", usuario_id=uid, perfil_id=pid),
        "manual_prompt": get_config("manual_prompt", "", usuario_id=uid, perfil_id=pid),
        "orchestrator_mode": get_config("orchestrator_mode", "false", usuario_id=uid, perfil_id=pid) in ("true", "1", "yes"),
    }


@router.put(
    "/prompt",
    summary="Update AI prompt config",
    description="Update the AI agent's system prompt, model, temperature and other settings. Optionally clear conversation memory if clear_memory is true.",
)
async def update_prompt(
    prompt: PromptModel,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from models import SessionLocal, Memoria

    uid = current_user.id
    pid = perfil.id
    data = prompt.dict()

    # Extraer flags especiales
    clear_memory = data.pop("clear_memory", False)
    orchestrator_mode = data.pop("orchestrator_mode", None)

    # Guardar orchestrator_mode como string "true"/"false"
    if orchestrator_mode is not None:
        set_config("orchestrator_mode", "true" if orchestrator_mode else "false", usuario_id=uid, perfil_id=pid)

    # Actualizar configuración
    for key, value in data.items():
        if value is not None:
            if key == "prompt_sections":
                set_config(key, json.dumps(value) if value else "", usuario_id=uid, perfil_id=pid)
            elif key == "edit_mode":
                set_config("prompt_edit_mode", str(value), usuario_id=uid, perfil_id=pid)
            else:
                set_config(key, str(value), usuario_id=uid, perfil_id=pid)

    # Solo limpiar memoria si se solicitó explícitamente
    response = {"status": "ok"}
    if clear_memory:
        db = SessionLocal()
        try:
            from models import MensajeConversacion

            deleted_legacy = db.query(Memoria).filter(
                Memoria.usuario_id == current_user.id
            ).delete()
            deleted_new = db.query(MensajeConversacion).filter(
                MensajeConversacion.usuario_id == current_user.id
            ).delete()
            db.commit()
            response["memoria_limpiada"] = deleted_legacy + deleted_new
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Error clearing memory: {str(e)}"
            )
        finally:
            db.close()

    return response


@router.post(
    "/prompt/improve",
    summary="AI-powered prompt improvement",
    description="Use GPT to automatically improve and optimize prompt sections for better agent responses.",
)
async def improve_prompt(
    data: ImprovePromptModel, current_user: Usuario = Depends(get_current_user)
):
    api_key = get_config("openai_api_key", "", usuario_id=current_user.id) or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No OpenAI API key configured")

    client = OpenAI(api_key=api_key)

    section_names = {
        "role": "Rol (quién es el agente)",
        "context": "Contexto (situación del negocio)",
        "task": "Tarea (objetivos principales)",
        "constraints": "Restricciones (reglas y límites)",
        "tone": "Tono (cómo comunicarse)",
    }

    if data.section == "all":
        improved_sections = {}
        for section_key in ["role", "context", "task", "constraints", "tone"]:
            current = (
                data.all_sections.get(section_key, "") if data.all_sections else ""
            )

            prompt = f"""Mejora el siguiente texto para un prompt de IA de atención al cliente.
Negocio: {data.business_name} ({data.business_type})
Sección: {section_names.get(section_key, section_key)}

Texto actual:
{current}

Instrucciones:
- Mantén la esencia pero hazlo más efectivo
- Sé específico y claro
- Usa un estilo profesional
- Máximo 3-4 oraciones
- Responde SOLO con el texto mejorado, sin explicaciones"""

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=300,
            )
            improved_sections[section_key] = response.choices[0].message.content.strip()

        return {"improved_sections": improved_sections}
    else:
        section_name = section_names.get(data.section, data.section)

        context_parts = []
        if data.all_sections:
            for key, name in section_names.items():
                if key != data.section and data.all_sections.get(key):
                    context_parts.append(f"{name}: {data.all_sections[key][:100]}...")

        context_str = (
            "\n".join(context_parts)
            if context_parts
            else "No hay otras secciones definidas"
        )

        prompt = f"""Mejora el siguiente texto para un prompt de IA de atención al cliente.

Negocio: {data.business_name} ({data.business_type})
Sección a mejorar: {section_name}

Contexto del resto del prompt:
{context_str}

Texto actual a mejorar:
{data.current_content}

Instrucciones:
- Mantén la esencia pero hazlo más efectivo y profesional
- Sé específico y detallado
- Considera el contexto del negocio
- Máximo 4-5 oraciones
- Responde SOLO con el texto mejorado, sin explicaciones ni comillas"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300,
        )

        return {"improved": response.choices[0].message.content.strip()}


@router.get(
    "/agent-status",
    summary="Get agent status",
    description="Check if the AI agent is currently enabled and responding to messages.",
)
async def get_agent_status(
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    enabled = get_config("agent_enabled", "true", usuario_id=current_user.id, perfil_id=perfil.id)
    return {"enabled": enabled.lower() == "true"}


@router.put(
    "/agent-status",
    summary="Toggle agent status",
    description="Enable or disable the AI agent. When disabled, incoming messages won't receive automated responses.",
)
async def set_agent_status(
    data: dict,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    enabled = data.get("enabled", True)
    set_config("agent_enabled", str(enabled).lower(), usuario_id=current_user.id, perfil_id=perfil.id)
    return {"status": "ok", "enabled": enabled}


@router.get(
    "/whatsapp",
    summary="Get WhatsApp config",
    description="Retrieve WhatsApp API configuration including provider, URL, session and sync settings.",
)
async def get_whatsapp_config(current_user: Usuario = Depends(get_current_user)):
    api_key = get_config("whatsapp_api_key", "", usuario_id=current_user.id)
    return {
        "provider": get_config("whatsapp_provider", "waha", usuario_id=current_user.id),
        "api_url": get_config("whatsapp_api_url", "", usuario_id=current_user.id),
        "api_key": api_key[:8] + "..." if len(api_key) > 8 else api_key,
        "session": get_config("whatsapp_session", "default", usuario_id=current_user.id),
        "auto_sync": get_config("whatsapp_auto_sync", "true", usuario_id=current_user.id).lower() == "true",
        "sync_interval": int(get_config("whatsapp_sync_interval", "21600", usuario_id=current_user.id)),
        "last_sync": get_config("whatsapp_last_sync", "", usuario_id=current_user.id),
    }


@router.put(
    "/whatsapp",
    summary="Update WhatsApp config",
    description="Update WhatsApp API settings for WAHA or Evolution API integration.",
)
async def update_whatsapp_config(
    data: dict, current_user: Usuario = Depends(get_current_user)
):
    allowed_keys = [
        "whatsapp_provider",
        "whatsapp_api_url",
        "whatsapp_api_key",
        "whatsapp_session",
        "whatsapp_auto_sync",
        "whatsapp_sync_interval",
    ]

    for key in allowed_keys:
        # Mapear keys del frontend a keys de config
        frontend_key = key.replace("whatsapp_", "")
        if frontend_key in data:
            value = data[frontend_key]
            # No guardar API key si viene enmascarada
            if key == "whatsapp_api_key" and value.endswith("..."):
                continue
            set_config(key, str(value), usuario_id=current_user.id)

    return {"status": "ok"}


@router.post(
    "/whatsapp/test",
    summary="Test WhatsApp connection",
    description="Verify the WhatsApp API connection is working correctly.",
)
async def test_whatsapp_connection(current_user: Usuario = Depends(get_current_user)):
    from whatsapp_service import whatsapp_service
    from api.routers.perfiles import get_perfil_activo_id

    db = SessionLocal()
    try:
        perfil_id = get_perfil_activo_id(db, current_user.id)
    finally:
        db.close()
    session = f"perfil_{perfil_id}" if perfil_id else "default"
    result = await whatsapp_service.test_connection(session=session)
    return result


# ==================== AGENT CONFIG (nuevo) ====================


@router.get("/agent-config", summary="Get full agent configuration")
async def get_agent_config(
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    """Config estructurada del agente - 4 tabs: General, Mensajes, Captura, Config IA"""
    uid = current_user.id
    pid = perfil.id
    triggers_str = get_config(
        "human_mode_triggers", '["frustration","complaint","human_request"]',
        usuario_id=uid, perfil_id=pid,
    )
    try:
        triggers = json.loads(triggers_str)
    except (json.JSONDecodeError, TypeError):
        triggers = ["frustration", "complaint", "human_request"]

    return {
        # Tab General
        "agent_name": get_config("agent_name", "Asistente", usuario_id=uid, perfil_id=pid),
        "agent_role": get_config("agent_role", "asistente virtual", usuario_id=uid, perfil_id=pid),
        "agent_personality": get_config(
            "agent_personality", "profesional, amable y entusiasta",
            usuario_id=uid, perfil_id=pid,
        ),
        "agent_language": get_config("agent_language", "Espanol", usuario_id=uid, perfil_id=pid),
        "agent_tone": get_config("agent_tone", "Casual y amigable", usuario_id=uid, perfil_id=pid),
        "business_name": get_config("business_name", "Mi Negocio", usuario_id=uid, perfil_id=pid),
        "business_type": get_config("business_type", "Servicios Profesionales", usuario_id=uid, perfil_id=pid),
        "business_description": get_config("business_description", "", usuario_id=uid, perfil_id=pid),
        "agent_products": get_config("agent_products", "", usuario_id=uid, perfil_id=pid),
        # Tab Mensajes
        "welcome_message": get_config("welcome_message", "", usuario_id=uid, perfil_id=pid),
        "fallback_message": get_config(
            "fallback_message",
            "Disculpa, no entendi tu mensaje. Podrias reformularlo de otra manera.",
            usuario_id=uid, perfil_id=pid,
        ),
        "human_mode_triggers": triggers,
        "human_mode_custom_triggers": get_config("human_mode_custom_triggers", "", usuario_id=uid, perfil_id=pid),
        "human_mode_expire_hours": int(get_config("human_mode_expire_hours", "0", usuario_id=uid, perfil_id=pid)),
        "human_mode_reactivar_command": get_config(
            "human_mode_reactivar_command", "#reactivar",
            usuario_id=uid, perfil_id=pid,
        ),
        # Tab Config IA
        "model": get_config("model", "gpt-4o-mini", usuario_id=uid, perfil_id=pid),
        "temperature": float(get_config("temperature", "0.7", usuario_id=uid, perfil_id=pid)),
        "max_tokens": int(get_config("max_tokens", "500", usuario_id=uid, perfil_id=pid)),
        "custom_instructions": get_config("custom_instructions", "", usuario_id=uid, perfil_id=pid),
        # API Key (masked) — vive a nivel USUARIO (la cascada cae a perfil_id=0)
        "openai_api_key": (
            lambda k: k[:8] + "..." if len(k) > 8 else ("Configurada" if k else "")
        )(get_config("openai_api_key", "", usuario_id=uid) or os.getenv("OPENAI_API_KEY", "")),
        "has_api_key": bool(
            get_config("openai_api_key", "", usuario_id=uid) or os.getenv("OPENAI_API_KEY", "")
        ),
        "uses_global_key": not bool(get_config("openai_api_key", "", usuario_id=uid)),
    }


@router.put("/agent-config", summary="Update full agent configuration")
async def update_agent_config(
    data: dict,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    """Guardar configuracion completa del agente"""
    uid = current_user.id
    pid = perfil.id
    allowed_keys = [
        "agent_name",
        "agent_role",
        "agent_personality",
        "agent_language",
        "agent_tone",
        "business_name",
        "business_type",
        "business_description",
        "agent_products",
        "welcome_message",
        "fallback_message",
        "human_mode_custom_triggers",
        "human_mode_expire_hours",
        "human_mode_reactivar_command",
        "model",
        "temperature",
        "max_tokens",
        "custom_instructions",
    ]

    for key in allowed_keys:
        if key in data:
            set_config(key, str(data[key]), usuario_id=uid, perfil_id=pid)

    # API Key - solo guardar si no viene masked. Se guarda a nivel USUARIO.
    if "openai_api_key" in data:
        val = data["openai_api_key"]
        if val and not val.endswith("...") and val != "Configurada":
            set_config("openai_api_key", val, usuario_id=uid, perfil_id=0)

    # Triggers es una lista JSON
    if "human_mode_triggers" in data:
        set_config("human_mode_triggers", json.dumps(data["human_mode_triggers"]), usuario_id=uid, perfil_id=pid)

    return {"status": "ok"}


# ==================== MODO HUMANO CONFIG ====================


@router.get(
    "/human-mode",
    summary="Get human mode config",
    description="Retrieve settings for human takeover mode including triggers and expiration.",
)
async def get_human_mode_config(
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    uid = current_user.id
    pid = perfil.id
    triggers_str = get_config(
        "human_mode_triggers", '["frustration","complaint","human_request"]',
        usuario_id=uid, perfil_id=pid,
    )
    try:
        triggers = json.loads(triggers_str)
    except (json.JSONDecodeError, TypeError):
        triggers = ["frustration", "complaint", "human_request"]

    return {
        "expire_hours": int(get_config("human_mode_expire_hours", "0", usuario_id=uid, perfil_id=pid)),
        "reactivar_command": get_config("human_mode_reactivar_command", "#reactivar", usuario_id=uid, perfil_id=pid),
        "triggers": triggers,
        "custom_triggers": get_config("human_mode_custom_triggers", "", usuario_id=uid, perfil_id=pid),
    }


@router.put(
    "/human-mode",
    summary="Update human mode config",
    description="Configure when AI should pause and let a human take over the conversation.",
)
async def update_human_mode_config(
    data: dict,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    uid = current_user.id
    pid = perfil.id
    if "expire_hours" in data:
        set_config("human_mode_expire_hours", str(data["expire_hours"]), usuario_id=uid, perfil_id=pid)
    if "reactivar_command" in data:
        set_config("human_mode_reactivar_command", data["reactivar_command"], usuario_id=uid, perfil_id=pid)
    if "triggers" in data:
        set_config("human_mode_triggers", json.dumps(data["triggers"]), usuario_id=uid, perfil_id=pid)
    if "custom_triggers" in data:
        set_config("human_mode_custom_triggers", data["custom_triggers"], usuario_id=uid, perfil_id=pid)

    return {"status": "ok"}


# ==================== TEST CHAT ====================


@router.post("/test-chat", summary="Test AI agent chat", description="Send a test message to the AI agent without going through WhatsApp.")
async def test_chat(
    data: dict,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    """Send a test message and get the AI response. Uses a dedicated test phone number."""
    mensaje = data.get("mensaje", "").strip()
    if not mensaje:
        raise HTTPException(status_code=400, detail="El campo 'mensaje' es requerido")

    uid = current_user.id
    pid = perfil.id
    reset = data.get("reset", False)
    test_phone = f"test_{uid}_{pid}_000"

    api_key = get_config("openai_api_key", "", usuario_id=uid) or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No hay API key de OpenAI configurada.")

    db = SessionLocal()
    try:
        # Ensure test contact exists
        contacto = db.query(Contacto).filter(Contacto.telefono == test_phone, Contacto.usuario_id == uid).first()
        if not contacto:
            contacto = Contacto(
                telefono=test_phone, nombre="Test Chat", usuario_id=uid,
                perfil_id=pid,
                estado="activo", origen="manual",
            )
            db.add(contacto)
            db.commit()

        if reset:
            db.query(MensajeConversacion).filter(
                MensajeConversacion.telefono == test_phone, MensajeConversacion.usuario_id == uid
            ).delete()
            contacto.paso_funnel = None
            contacto.datos_capturados = None
            contacto.lead_score = 0
            contacto.modo_humano = False
            db.commit()
            return {"respuesta": "Conversación reiniciada", "tools_called": [], "reset": True}
    finally:
        db.close()

    try:
        import re
        from agent import responder, build_system_prompt

        # Get prompt preview
        db2 = SessionLocal()
        try:
            prompt_preview = build_system_prompt(db2, test_phone, uid, perfil_id=pid)[:500]
        finally:
            db2.close()

        # Timestamp before calling agent (to filter only NEW events)
        before_call = datetime.utcnow()

        # Call the agent
        respuesta = responder(mensaje, test_phone, uid, perfil_id=pid)

        # Clean markdown image syntax — doesn't render in WhatsApp
        respuesta = re.sub(r'!\[.*?\]\(.*?\)\s*', '', respuesta)
        respuesta = re.sub(r'\n{3,}', '\n\n', respuesta).strip()

        # Extract metadata — only events created AFTER our call
        db3 = SessionLocal()
        try:
            c = db3.query(Contacto).filter(Contacto.telefono == test_phone, Contacto.usuario_id == uid).first()
            new_events = db3.query(MensajeConversacion).filter(
                MensajeConversacion.telefono == test_phone,
                MensajeConversacion.usuario_id == uid,
                MensajeConversacion.rol == "system",
                MensajeConversacion.created_at >= before_call,
            ).order_by(MensajeConversacion.created_at).all()

            # Build tools_called as descriptive list
            tools_called = []
            for e in new_events:
                if e.tipo_evento == "media_enviada":
                    tools_called.append(f"📷 {e.contenido}")
                elif e.tipo_evento == "datos_guardados":
                    tools_called.append(f"💾 {e.contenido}")
                elif e.tipo_evento == "cita_agendada":
                    tools_called.append(f"📅 {e.contenido}")
                elif e.tipo_evento == "paso_avanzado":
                    tools_called.append(f"⬆️ {e.contenido}")
                elif e.tipo_evento == "intervencion_humana":
                    tools_called.append(f"🚨 {e.contenido}")
        finally:
            db3.close()

        return {
            "respuesta": respuesta,
            "tools_called": tools_called,
            "paso_funnel": c.paso_funnel if c else None,
            "lead_score": c.lead_score if c else 0,
            "datos_capturados": json.loads(c.datos_capturados) if c and c.datos_capturados else None,
            "prompt_preview": prompt_preview,
            "model": get_config("model", "gpt-4o-mini", usuario_id=uid, perfil_id=pid),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== AGENT HEALTH CHECK ====================


@router.get("/agent-health", summary="Agent health check", description="Returns agent configuration health status.")
async def agent_health(
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    uid = current_user.id
    pid = perfil.id
    db = SessionLocal()
    try:
        sections = []
        weights = {}

        # Identity
        s = _health_identity(db, uid, pid)
        sections.append(s); weights[s["id"]] = 20

        # Knowledge Base
        s = _health_knowledge(db, uid)
        sections.append(s); weights[s["id"]] = 15

        # Funnel
        s = _health_funnel(db, uid)
        sections.append(s); weights[s["id"]] = 10

        # Capture fields
        s = _health_capture(db, uid)
        sections.append(s); weights[s["id"]] = 5

        # Tools
        s = _health_tools(db, uid)
        sections.append(s); weights[s["id"]] = 5

        # AI Config
        s = _health_ai_config(uid, pid)
        sections.append(s); weights[s["id"]] = 15

        # Human Mode
        s = _health_human_mode(uid, pid)
        sections.append(s); weights[s["id"]] = 5

        # Score
        total_weight = sum(weights.values())
        weighted_sum = sum(s["score"] * weights.get(s["id"], 0) for s in sections)
        overall = int(weighted_sum / total_weight) if total_weight > 0 else 0

        # Metrics 7d
        ago = datetime.utcnow() - timedelta(days=7)
        metrics = {
            "conversations_7d": db.query(MensajeConversacion.telefono).filter(
                MensajeConversacion.usuario_id == uid, MensajeConversacion.created_at >= ago
            ).distinct().count(),
            "human_transfers_7d": db.query(Contacto).filter(
                Contacto.usuario_id == uid, Contacto.modo_humano == True, Contacto.modo_humano_desde >= ago
            ).count(),
            "data_captured_7d": db.query(MensajeConversacion).filter(
                MensajeConversacion.usuario_id == uid, MensajeConversacion.tipo_evento == "datos_guardados",
                MensajeConversacion.created_at >= ago
            ).count(),
        }

        return {"score": overall, "sections": sections, "metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


def _score_status(score):
    return "ok" if score >= 75 else ("warning" if score >= 50 else "error")


def _health_identity(db, uid, pid=None):
    items = []; score = 0; mx = 4
    for key, label, default in [
        ("agent_name", "Nombre agente", "Asistente"),
        ("agent_role", "Rol", "asistente virtual"),
        ("business_name", "Negocio", "Mi Negocio"),
        ("business_description", "Descripción", ""),
    ]:
        val = get_config(key, default, usuario_id=uid, perfil_id=pid)
        ok = bool(val) and val != default and len(val) > 3
        items.append({"key": key, "label": label, "status": "ok" if ok else "warning", "value": val[:80] if val else "(vacío)"})
        if ok: score += 1
    pct = int(score / mx * 100)
    return {"id": "identity", "name": "Identidad del agente", "status": _score_status(pct), "score": pct, "items": items}


def _health_knowledge(db, uid):
    items = []
    total = db.query(DocumentoConocimiento).filter(DocumentoConocimiento.usuario_id == uid, DocumentoConocimiento.activo == True).count()
    cats = db.query(DocumentoConocimiento.categoria).filter(DocumentoConocimiento.usuario_id == uid, DocumentoConocimiento.activo == True).distinct().count()
    items.append({"key": "docs", "label": "Documentos activos", "status": "ok" if total >= 3 else ("warning" if total > 0 else "error"), "value": str(total)})
    items.append({"key": "categories", "label": "Categorías", "status": "ok" if cats >= 2 else "warning", "value": str(cats)})
    score = min(100, total * 20) if total > 0 else 0
    return {"id": "knowledge", "name": "Base de conocimiento", "status": _score_status(score), "score": score, "items": items}


def _health_funnel(db, uid):
    items = []
    steps = db.query(FunnelPaso).filter(FunnelPaso.usuario_id == uid, FunnelPaso.activo == True).count()
    with_instructions = db.query(FunnelPaso).filter(
        FunnelPaso.usuario_id == uid, FunnelPaso.activo == True, FunnelPaso.instrucciones_agente != None
    ).count()
    items.append({"key": "steps", "label": "Pasos activos", "status": "ok" if steps > 0 else "warning", "value": str(steps)})
    items.append({"key": "instructions", "label": "Con instrucciones", "status": "ok" if with_instructions == steps else "warning", "value": f"{with_instructions}/{steps}"})
    score = 100 if steps > 0 and with_instructions == steps else (60 if steps > 0 else 0)
    return {"id": "funnel", "name": "Funnel de ventas", "status": _score_status(score), "score": score, "items": items}


def _health_capture(db, uid):
    items = []
    fields = db.query(CampoCaptura).filter(CampoCaptura.usuario_id == uid, CampoCaptura.activo == True).count()
    required = db.query(CampoCaptura).filter(CampoCaptura.usuario_id == uid, CampoCaptura.activo == True, CampoCaptura.obligatorio == True).count()
    items.append({"key": "fields", "label": "Campos activos", "status": "ok" if fields > 0 else "warning", "value": str(fields)})
    items.append({"key": "required", "label": "Obligatorios", "status": "ok", "value": str(required)})
    score = 100 if fields >= 2 else (50 if fields > 0 else 0)
    return {"id": "capture", "name": "Captura de datos", "status": _score_status(score), "score": score, "items": items}


def _health_tools(db, uid):
    items = []
    tools = db.query(ToolsConfig).filter(ToolsConfig.usuario_id.in_([0, uid])).all()
    enabled = sum(1 for t in tools if t.habilitado)
    items.append({"key": "enabled", "label": "Habilitadas", "status": "ok", "value": f"{enabled}/{len(tools)}"})
    score = 100 if enabled > 0 else 50
    return {"id": "tools", "name": "Herramientas", "status": _score_status(score), "score": score, "items": items}


def _health_ai_config(uid, pid=None):
    items = []; score = 0
    key = get_config("openai_api_key", "", usuario_id=uid) or os.getenv("OPENAI_API_KEY", "")
    items.append({"key": "key", "label": "API Key", "status": "ok" if key else "error", "value": "Configurada" if key else "Falta"})
    if key: score += 50
    model = get_config("model", "gpt-4o-mini", usuario_id=uid, perfil_id=pid)
    items.append({"key": "model", "label": "Modelo", "status": "ok", "value": model})
    score += 50
    return {"id": "ai_config", "name": "Configuración IA", "status": _score_status(score), "score": score, "items": items}


def _health_human_mode(uid, pid=None):
    items = []; score = 0
    triggers_str = get_config("human_mode_triggers", "[]", usuario_id=uid, perfil_id=pid)
    try:
        triggers = json.loads(triggers_str)
    except:
        triggers = []
    items.append({"key": "triggers", "label": "Triggers", "status": "ok" if triggers else "warning", "value": f"{len(triggers)} categorías"})
    if triggers: score += 50
    expire = int(get_config("human_mode_expire_hours", "0", usuario_id=uid, perfil_id=pid))
    items.append({"key": "expire", "label": "Auto-expiración", "status": "ok" if expire > 0 else "warning", "value": f"{expire}h" if expire > 0 else "No"})
    if expire > 0: score += 50
    return {"id": "human_mode", "name": "Modo humano", "status": _score_status(score), "score": score, "items": items}


# ==================== SKILLS STATUS ====================


@router.get("/skills-status", summary="Get skills status", description="Returns the status and configuration summary of each skill for the frontend Skills tab.")
async def get_skills_status(
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    uid = current_user.id
    pid = perfil.id
    db = SessionLocal()
    try:
        orchestrator_mode = get_config("orchestrator_mode", "false", usuario_id=uid, perfil_id=pid) in ("true", "1", "yes")

        # --- Data Capture ---
        campos = db.query(CampoCaptura).filter(
            CampoCaptura.usuario_id == uid, CampoCaptura.activo == True
        ).all()
        campos_count = len(campos)
        obligatorios_count = sum(1 for c in campos if c.obligatorio)
        dc_config_complete = campos_count > 0

        if campos_count > 0:
            dc_summary = f"{campos_count} campos activos"
            field_names = []
            for c in sorted(campos, key=lambda x: x.orden):
                name = c.etiqueta or c.nombre
                field_names.append(f"{name}*" if c.obligatorio else name)
            dc_detail = ", ".join(field_names)
        else:
            dc_summary = "Sin campos"
            dc_detail = ""

        # --- FAQ / Knowledge ---
        docs_count = db.query(DocumentoConocimiento).filter(
            DocumentoConocimiento.usuario_id == uid, DocumentoConocimiento.activo == True
        ).count()
        cats_count = db.query(DocumentoConocimiento.categoria).filter(
            DocumentoConocimiento.usuario_id == uid, DocumentoConocimiento.activo == True
        ).distinct().count()
        faq_config_complete = docs_count > 0
        faq_summary = f"{docs_count} documentos" if docs_count > 0 else "Sin documentos"
        faq_detail = f"{cats_count} categorías" if cats_count > 0 else ""

        # --- Human Handoff ---
        triggers_str = get_config("human_mode_triggers", '["frustration","complaint","human_request"]', usuario_id=uid, perfil_id=pid)
        try:
            triggers = json.loads(triggers_str)
        except (json.JSONDecodeError, TypeError):
            triggers = []
        triggers_count = len(triggers)
        expire_hours = int(get_config("human_mode_expire_hours", "0", usuario_id=uid, perfil_id=pid))

        hh_summary = f"{triggers_count} triggers activos" if triggers_count > 0 else "Sin triggers"
        hh_detail = f"Auto-expira: {expire_hours}h" if expire_hours > 0 else "Sin auto-expiración"

        return {
            "orchestrator_mode": orchestrator_mode,
            "skills": {
                "data_capture": {
                    "enabled": True,
                    "config_complete": dc_config_complete,
                    "summary": dc_summary,
                    "detail": dc_detail,
                    "stats": {"campos": campos_count, "obligatorios": obligatorios_count},
                },
                "faq": {
                    "enabled": True,
                    "config_complete": faq_config_complete,
                    "summary": faq_summary,
                    "detail": faq_detail,
                    "stats": {"documentos": docs_count, "categorias": cats_count},
                },
                "human_handoff": {
                    "enabled": True,
                    "config_complete": True,
                    "summary": hh_summary,
                    "detail": hh_detail,
                    "stats": {"triggers": triggers_count, "expire_hours": expire_hours},
                },
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
