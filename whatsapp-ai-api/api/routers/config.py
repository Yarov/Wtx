"""
Configuration router - API Keys, Prompt, Tools, Payments
"""
import json
import os
from fastapi import APIRouter, HTTPException, Depends
from openai import OpenAI

from database import get_config, set_config, is_tool_enabled, set_tool_enabled, get_all_tools_config
from api.schemas.config import (
    ApiKeysModel, 
    PromptModel, 
    ImprovePromptModel,
    PaymentConfigModel
)
from auth import get_current_user
from models import Usuario

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/api-keys")
async def get_api_keys(current_user: Usuario = Depends(get_current_user)):
    """Get API keys (masked)"""
    openai_key = get_config("openai_api_key", "")
    twilio_token = get_config("twilio_auth_token", "")
    return {
        "openai_api_key": openai_key[:8] + "..." if openai_key else "",
        "twilio_account_sid": get_config("twilio_account_sid", ""),
        "twilio_auth_token": twilio_token[:8] + "..." if twilio_token else "",
        "twilio_phone_number": get_config("twilio_phone_number", ""),
    }


@router.put("/api-keys")
async def update_api_keys(keys: ApiKeysModel, current_user: Usuario = Depends(get_current_user)):
    """Update API keys"""
    data = keys.dict(exclude_unset=True)
    for key, value in data.items():
        if value and not value.endswith("..."):
            set_config(key, value)
    return {"status": "ok"}


@router.get("/prompt")
async def get_prompt(current_user: Usuario = Depends(get_current_user)):
    """Get prompt configuration"""
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


@router.put("/prompt")
async def update_prompt(prompt: PromptModel, current_user: Usuario = Depends(get_current_user)):
    """Update prompt configuration"""
    data = prompt.dict()
    for key, value in data.items():
        if value is not None:
            if key == "prompt_sections":
                set_config(key, json.dumps(value) if value else "")
            else:
                set_config(key, str(value))
    return {"status": "ok"}


@router.post("/prompt/improve")
async def improve_prompt(data: ImprovePromptModel, current_user: Usuario = Depends(get_current_user)):
    """Use AI to improve prompt sections"""
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


@router.get("/payments")
async def get_payment_config(current_user: Usuario = Depends(get_current_user)):
    """Get payment configuration"""
    stripe_key = get_config("stripe_secret_key", "")
    mp_token = get_config("mercadopago_access_token", "")
    return {
        "payment_provider": get_config("payment_provider", "none"),
        "stripe_secret_key": stripe_key[:12] + "..." if stripe_key else "",
        "mercadopago_access_token": mp_token[:12] + "..." if mp_token else "",
        "payment_currency": get_config("payment_currency", "MXN"),
    }


@router.put("/payments")
async def update_payment_config(config: PaymentConfigModel, current_user: Usuario = Depends(get_current_user)):
    """Update payment configuration"""
    data = config.dict()
    for key, value in data.items():
        if value and not value.endswith("..."):
            set_config(key, value)
    return {"status": "ok"}


@router.get("/agent-status")
async def get_agent_status(current_user: Usuario = Depends(get_current_user)):
    """Get agent enabled status"""
    enabled = get_config("agent_enabled", "true")
    return {"enabled": enabled.lower() == "true"}


@router.put("/agent-status")
async def set_agent_status(data: dict, current_user: Usuario = Depends(get_current_user)):
    """Set agent enabled status"""
    enabled = data.get("enabled", True)
    set_config("agent_enabled", str(enabled).lower())
    return {"status": "ok", "enabled": enabled}
