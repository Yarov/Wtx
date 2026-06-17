"""
Admin API endpoints - PostgreSQL con SQLAlchemy
"""
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import get_config, set_config, get_all_config, is_tool_enabled, set_tool_enabled, get_all_tools_config
from models import SessionLocal, Memoria

router = APIRouter(prefix="/api", tags=["admin"])

DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


# Pydantic Models
class ApiKeysModel(BaseModel):
    openai_api_key: Optional[str] = ""
    whatsapp_api_url: Optional[str] = ""
    whatsapp_api_key: Optional[str] = ""
    whatsapp_session: Optional[str] = ""


class PromptModel(BaseModel):
    system_prompt: Optional[str] = ""
    prompt_sections: Optional[dict] = None
    model: Optional[str] = "gpt-4o-mini"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 500
    business_name: Optional[str] = ""
    business_type: Optional[str] = ""


class ImprovePromptModel(BaseModel):
    section: str
    current_content: Optional[str] = ""
    business_name: Optional[str] = ""
    business_type: Optional[str] = ""
    all_sections: Optional[dict] = None


class ToolToggle(BaseModel):
    enabled: bool


# Stats
@router.get("/stats")
async def get_stats():
    db = SessionLocal()
    try:
        conversations = db.query(Memoria).count()

        memorias = db.query(Memoria).limit(500).all()
        total_messages = 0
        for m in memorias:
            if m.historial:
                try:
                    historial = json.loads(m.historial)
                    total_messages += len(historial)
                except:
                    pass

        return {
            "totalConversations": conversations,
            "totalMessages": total_messages,
        }
    finally:
        db.close()


# API Keys
@router.get("/config/api-keys")
async def get_api_keys():
    openai_key = get_config("openai_api_key", "")
    whatsapp_key = get_config("whatsapp_api_key", "")
    return {
        "openai_api_key": openai_key[:8] + "..." if openai_key else "",
        "whatsapp_api_url": get_config("whatsapp_api_url", ""),
        "whatsapp_api_key": whatsapp_key[:8] + "..." if whatsapp_key else "",
        "whatsapp_session": get_config("whatsapp_session", ""),
    }


@router.put("/config/api-keys")
async def update_api_keys(keys: ApiKeysModel):
    data = keys.dict(exclude_unset=True)
    for key, value in data.items():
        if value and not value.endswith("..."):
            set_config(key, value)
    return {"status": "ok"}


# Prompt
@router.get("/prompt")
async def get_prompt():
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
        "business_name": get_config("business_name", ""),
        "business_type": get_config("business_type", ""),
    }


@router.put("/prompt")
async def update_prompt(prompt: PromptModel):
    data = prompt.dict()
    for key, value in data.items():
        if value is not None:
            if key == "prompt_sections":
                set_config(key, json.dumps(value) if value else "")
            else:
                set_config(key, str(value))
    return {"status": "ok"}


@router.post("/prompt/improve")
async def improve_prompt(data: ImprovePromptModel):
    """Usa IA para mejorar una sección del prompt"""
    import os
    from openai import OpenAI
    
    api_key = get_config("openai_api_key", "") or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return {"error": "No hay API key de OpenAI configurada"}
    
    client = OpenAI(api_key=api_key)
    
    section_names = {
        "role": "Rol (quién es el agente)",
        "context": "Contexto (situación del negocio)", 
        "task": "Tarea (objetivos principales)",
        "constraints": "Restricciones (reglas y límites)",
        "tone": "Tono (cómo comunicarse)"
    }
    
    if data.section == "all":
        # Mejorar todas las secciones
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
        # Mejorar una sección específica
        section_name = section_names.get(data.section, data.section)
        
        # Contexto de otras secciones
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


# Tools
@router.get("/tools")
async def get_tools():
    tools = get_all_tools_config()
    return [
        {"id": t["nombre"], "enabled": t["habilitado"], "description": t["descripcion"]}
        for t in tools
    ]


@router.patch("/tools/{name}")
async def toggle_tool(name: str, data: ToolToggle):
    set_tool_enabled(name, data.enabled)
    return {"status": "ok"}


# Conversations
@router.get("/conversations")
async def get_conversations():
    db = SessionLocal()
    try:
        memorias = db.query(Memoria).order_by(Memoria.updated_at.desc()).limit(100).all()
        result = []
        for m in memorias:
            historial = json.loads(m.historial) if m.historial else []
            ultimo = historial[-1]["content"] if historial else ""
            result.append({
                "telefono": m.telefono,
                "ultimo_mensaje": ultimo[:50] + "..." if len(ultimo) > 50 else ultimo,
                "fecha": m.updated_at.isoformat() if m.updated_at else "",
                "mensajes_count": len(historial),
            })
        return result
    finally:
        db.close()


@router.get("/conversations/{phone}")
async def get_conversation(phone: str):
    db = SessionLocal()
    try:
        memoria = db.query(Memoria).filter(Memoria.telefono == phone).first()
        if memoria and memoria.historial:
            return {"messages": json.loads(memoria.historial)}
        return {"messages": []}
    finally:
        db.close()


@router.delete("/conversations/{phone}")
async def delete_conversation(phone: str):
    db = SessionLocal()
    try:
        db.query(Memoria).filter(Memoria.telefono == phone).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


