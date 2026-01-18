"""
Configuration Router - API Keys, Prompt settings, WhatsApp config and Human Mode
"""
import json
import os
from fastapi import APIRouter, HTTPException, Depends
from openai import OpenAI

from database import get_config, set_config, is_tool_enabled, set_tool_enabled, get_all_tools_config
from api.schemas.config import (
    ApiKeysModel, 
    PromptModel, 
    ImprovePromptModel
)
from auth import get_current_user
from models import Usuario

router = APIRouter(
    prefix="/config", 
    tags=["Configuration"],
    responses={401: {"description": "Not authenticated"}}
)


@router.get("/api-keys", summary="Get API keys", description="Retrieve configured API keys with values masked for security.")
async def get_api_keys(current_user: Usuario = Depends(get_current_user)):
    openai_key = get_config("openai_api_key", "")
    return {
        "openai_api_key": openai_key[:8] + "..." if openai_key else "",
    }


@router.put("/api-keys", summary="Update API keys", description="Update API keys for external services like OpenAI.")
async def update_api_keys(keys: ApiKeysModel, current_user: Usuario = Depends(get_current_user)):
    data = keys.dict(exclude_unset=True)
    for key, value in data.items():
        if value and not value.endswith("..."):
            set_config(key, value)
    return {"status": "ok"}


@router.get("/prompt", summary="Get AI prompt config", description="Retrieve the AI agent's system prompt, model settings and business information.")
async def get_prompt(current_user: Usuario = Depends(get_current_user)):
    prompt_sections_str = get_config("prompt_sections", "")
    prompt_sections = None
    if prompt_sections_str:
        try:
            prompt_sections = json.loads(prompt_sections_str)
        except:
            pass
    
    return {
        "system_prompt": get_config("system_prompt", ""),
        "prompt_sections": prompt_sections,
        "model": get_config("model", "gpt-4o-mini"),
        "temperature": float(get_config("temperature", "0.7")),
        "max_tokens": int(get_config("max_tokens", "500")),
        "response_delay": int(get_config("response_delay", "3")),
        "business_name": get_config("business_name", ""),
        "business_type": get_config("business_type", ""),
    }


@router.put("/prompt", summary="Update AI prompt config", description="Update the AI agent's system prompt, model, temperature and other settings.")
async def update_prompt(prompt: PromptModel, current_user: Usuario = Depends(get_current_user)):
    data = prompt.dict()
    for key, value in data.items():
        if value is not None:
            if key == "prompt_sections":
                set_config(key, json.dumps(value) if value else "")
            else:
                set_config(key, str(value))
    return {"status": "ok"}


@router.post("/prompt/improve", summary="AI-powered prompt improvement", description="Use GPT to automatically improve and optimize prompt sections for better agent responses.")
async def improve_prompt(data: ImprovePromptModel, current_user: Usuario = Depends(get_current_user)):
    api_key = get_config("openai_api_key", "") or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No OpenAI API key configured")
    
    client = OpenAI(api_key=api_key)
    
    section_names = {
        "role": "Rol (quién es el agente)",
        "context": "Contexto (situación del negocio)", 
        "task": "Tarea (objetivos principales)",
        "constraints": "Restricciones (reglas y límites)",
        "tone": "Tono (cómo comunicarse)"
    }
    
    if data.section == "all":
        improved_sections = {}
        for section_key in ["role", "context", "task", "constraints", "tone"]:
            current = data.all_sections.get(section_key, "") if data.all_sections else ""
            
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
                max_tokens=300
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
        
        context_str = "\n".join(context_parts) if context_parts else "No hay otras secciones definidas"
        
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
            max_tokens=300
        )
        
        return {"improved": response.choices[0].message.content.strip()}


@router.get("/agent-status", summary="Get agent status", description="Check if the AI agent is currently enabled and responding to messages.")
async def get_agent_status(current_user: Usuario = Depends(get_current_user)):
    enabled = get_config("agent_enabled", "true")
    return {"enabled": enabled.lower() == "true"}


@router.put("/agent-status", summary="Toggle agent status", description="Enable or disable the AI agent. When disabled, incoming messages won't receive automated responses.")
async def set_agent_status(data: dict, current_user: Usuario = Depends(get_current_user)):
    enabled = data.get("enabled", True)
    set_config("agent_enabled", str(enabled).lower())
    return {"status": "ok", "enabled": enabled}


@router.get("/whatsapp", summary="Get WhatsApp config", description="Retrieve WhatsApp API configuration including provider, URL, session and sync settings.")
async def get_whatsapp_config(current_user: Usuario = Depends(get_current_user)):
    api_key = get_config("whatsapp_api_key", "")
    return {
        "provider": get_config("whatsapp_provider", "waha"),
        "api_url": get_config("whatsapp_api_url", ""),
        "api_key": api_key[:8] + "..." if len(api_key) > 8 else api_key,
        "session": get_config("whatsapp_session", "default"),
        "auto_sync": get_config("whatsapp_auto_sync", "true").lower() == "true",
        "sync_interval": int(get_config("whatsapp_sync_interval", "21600")),
        "last_sync": get_config("whatsapp_last_sync", ""),
    }


@router.put("/whatsapp", summary="Update WhatsApp config", description="Update WhatsApp API settings for WAHA or Evolution API integration.")
async def update_whatsapp_config(data: dict, current_user: Usuario = Depends(get_current_user)):
    allowed_keys = ["whatsapp_provider", "whatsapp_api_url", "whatsapp_api_key", 
                    "whatsapp_session", "whatsapp_auto_sync", "whatsapp_sync_interval"]
    
    for key in allowed_keys:
        # Mapear keys del frontend a keys de config
        frontend_key = key.replace("whatsapp_", "")
        if frontend_key in data:
            value = data[frontend_key]
            # No guardar API key si viene enmascarada
            if key == "whatsapp_api_key" and value.endswith("..."):
                continue
            set_config(key, str(value))
    
    return {"status": "ok"}


@router.post("/whatsapp/test", summary="Test WhatsApp connection", description="Verify the WhatsApp API connection is working correctly.")
async def test_whatsapp_connection(current_user: Usuario = Depends(get_current_user)):
    from whatsapp_service import whatsapp_service
    result = await whatsapp_service.test_connection()
    return result


# ==================== MODO HUMANO CONFIG ====================

@router.get("/human-mode", summary="Get human mode config", description="Retrieve settings for human takeover mode including triggers and expiration.")
async def get_human_mode_config(current_user: Usuario = Depends(get_current_user)):
    triggers_str = get_config("human_mode_triggers", '["frustration","complaint","human_request"]')
    try:
        triggers = json.loads(triggers_str)
    except:
        triggers = ["frustration", "complaint", "human_request"]
    
    return {
        "expire_hours": int(get_config("human_mode_expire_hours", "0")),
        "reactivar_command": get_config("human_mode_reactivar_command", "#reactivar"),
        "triggers": triggers,
        "custom_triggers": get_config("human_mode_custom_triggers", ""),
    }


@router.put("/human-mode", summary="Update human mode config", description="Configure when AI should pause and let a human take over the conversation.")
async def update_human_mode_config(data: dict, current_user: Usuario = Depends(get_current_user)):
    if "expire_hours" in data:
        set_config("human_mode_expire_hours", str(data["expire_hours"]))
    if "reactivar_command" in data:
        set_config("human_mode_reactivar_command", data["reactivar_command"])
    if "triggers" in data:
        set_config("human_mode_triggers", json.dumps(data["triggers"]))
    if "custom_triggers" in data:
        set_config("human_mode_custom_triggers", data["custom_triggers"])
    
    return {"status": "ok"}
