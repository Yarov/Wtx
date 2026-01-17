"""
Router para configuración del negocio y módulos
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from models import get_db, BusinessConfig
from api.routers.auth import get_current_user
from models import Usuario
from database import get_config, set_config

router = APIRouter(prefix="/business", tags=["business"])


class BusinessConfigModel(BaseModel):
    business_name: str
    business_type: str
    business_description: Optional[str] = ""
    has_inventory: bool = True
    has_appointments: bool = True
    has_schedule: bool = True


def get_or_create_business_config(db: Session) -> BusinessConfig:
    """Obtener o crear configuración del negocio"""
    config = db.query(BusinessConfig).first()
    if not config:
        config = BusinessConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/config")
async def get_business_config(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtener configuración del negocio"""
    config = get_or_create_business_config(db)
    return config.to_dict()


@router.put("/config")
async def update_business_config(
    data: BusinessConfigModel,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualizar configuración del negocio"""
    config = get_or_create_business_config(db)
    
    config.business_name = data.business_name
    config.business_type = data.business_type
    config.business_description = data.business_description
    config.has_inventory = data.has_inventory
    config.has_appointments = data.has_appointments
    config.has_schedule = data.has_schedule
    config.updated_at = datetime.utcnow()
    
    # Actualizar también en configuración general para compatibilidad
    set_config("business_name", data.business_name)
    set_config("business_type", data.business_type)
    
    db.commit()
    
    return {"status": "ok", "config": config.to_dict()}


@router.get("/modules")
async def get_active_modules(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtener módulos activos para el menú dinámico"""
    from models import ToolsConfig
    
    config = get_or_create_business_config(db)
    
    # Verificar también si los tools están habilitados
    inventory_tool = db.query(ToolsConfig).filter(ToolsConfig.nombre == "consultar_inventario").first()
    appointment_tools = db.query(ToolsConfig).filter(ToolsConfig.nombre.in_(["agendar_cita", "ver_citas"])).all()
    
    # El módulo está activo si está en BusinessConfig O si el tool está habilitado
    has_inventory = config.has_inventory or (inventory_tool and inventory_tool.habilitado)
    has_appointments = config.has_appointments or any(t.habilitado for t in appointment_tools)
    
    return {
        "modules": {
            "inventory": has_inventory,
            "appointments": has_appointments,
            "schedule": config.has_schedule,
        },
        "onboarding_completed": config.onboarding_completed
    }


@router.get("/onboarding-status")
async def get_onboarding_status(
    db: Session = Depends(get_db)
):
    """
    Verificar si el onboarding está completado.
    Este endpoint NO requiere autenticación para permitir redirección antes del login.
    """
    config = db.query(BusinessConfig).first()
    
    if not config:
        return {"onboarding_completed": False}
    
    return {"onboarding_completed": config.onboarding_completed}


@router.post("/skip-onboarding")
async def skip_onboarding(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Saltar el onboarding y usar configuración por defecto"""
    config = get_or_create_business_config(db)
    config.onboarding_completed = True
    config.updated_at = datetime.utcnow()
    db.commit()
    
    return {"status": "ok", "message": "Onboarding saltado"}


class ChatMessage(BaseModel):
    message: str
    history: list = []


@router.post("/setup-chat")
async def setup_chat(
    data: ChatMessage,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Chat conversacional para configurar el negocio.
    La IA hace preguntas, analiza respuestas y genera la configuración.
    """
    from openai import OpenAI
    import json
    
    openai_key = get_config("openai_api_key")
    if not openai_key:
        return {
            "response": "Necesito que configures tu API key de OpenAI primero en Configuración.",
            "config_ready": False,
            "needs_api_key": True
        }
    
    client = OpenAI(api_key=openai_key)
    
    system_prompt = """Eres un amigo que ayuda a configurar un asistente de WhatsApp. Habla como si estuvieras en un café platicando.

TU PERSONALIDAD:
- Eres cálido, genuino y te emociona ayudar
- Usas lenguaje natural, no corporativo
- Celebras lo que hace el usuario ("¡Qué padre!", "Me encanta eso")
- Haces comentarios sobre lo que te cuenta antes de preguntar
- Usas emojis con moderación (1-2 por mensaje máximo)

CÓMO CONVERSAR:
- Primero CONECTA con lo que dijo, luego pregunta
- Ejemplo: "Ah, uñas y pestañas, ¡qué buen negocio! 💅 ¿Cómo se llama tu local?"
- NO hagas preguntas tipo encuesta, hazlas naturales
- Una pregunta a la vez, máximo 2 líneas

LO QUE NECESITAS SABER (pregunta natural, no como lista):
1. Nombre del negocio (si no lo mencionó)
2. Qué servicios ofrece (si no quedó claro)
3. Cómo quiere que suene el asistente (casual/formal)
4. Si hay algo que el asistente NO deba hacer

EJEMPLOS DE CÓMO HABLAR:
✅ "Ah, una barbería, ¡genial! ¿Cómo se llama?"
✅ "Suena increíble 🙌 ¿Y cómo te gustaría que hable el asistente con tus clientes?"
✅ "Perfecto. ¿Hay algo que prefieras que el asistente NO haga o prometa?"

❌ NO digas: "¿Qué servicios ofreces?" (muy frío)
❌ NO digas: "¿El asistente debe ser formal o relajado?" (muy robótico)

PARA EL JSON FINAL:
- business_name: el nombre EXACTO que dio (o descripción si no dio nombre)
- business_type: sus palabras exactas, no categorías inventadas
- Deduce has_inventory/has_appointments/has_schedule según el tipo de negocio

CUANDO TENGAS TODO, responde con:
```json
{
  "ready": true,
  "config": {
    "business_name": "nombre exacto del usuario",
    "business_type": "palabras del usuario",
    "business_description": "lo que ofrece",
    "preferred_tone": "tono elegido",
    "restrictions": "restricciones mencionadas",
    "has_inventory": true/false,
    "has_appointments": true/false,
    "has_schedule": true/false
  },
  "prompts": {
    "role": "Rol del agente (2-3 oraciones)",
    "context": "Contexto del negocio (2-3 oraciones)",
    "task": "Objetivo principal (2-3 oraciones)",
    "constraints": "Restricciones (2-3 oraciones)",
    "tone": "Tono de comunicación (1-2 oraciones)"
  },
  "summary": "Resumen amigable"
}
```"""

    messages = [{"role": "system", "content": system_prompt}]
    
    # Agregar historial
    for msg in data.history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    # Agregar mensaje actual
    messages.append({"role": "user", "content": data.message})
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=1200
        )
        
        ai_response = response.choices[0].message.content.strip()
        
        # Verificar si la IA devolvió configuración
        if "```json" in ai_response and '"ready": true' in ai_response:
            # Extraer JSON
            json_str = ai_response.split("```json")[1].split("```")[0].strip()
            config_data = json.loads(json_str)
            
            return {
                "response": config_data.get("summary", "Configuración lista"),
                "config_ready": True,
                "config": config_data.get("config"),
                "prompts": config_data.get("prompts"),
                "history": data.history + [
                    {"role": "user", "content": data.message},
                    {"role": "assistant", "content": ai_response}
                ]
            }
        
        return {
            "response": ai_response,
            "config_ready": False,
            "history": data.history + [
                {"role": "user", "content": data.message},
                {"role": "assistant", "content": ai_response}
            ]
        }
        
    except Exception as e:
        return {
            "response": f"Error: {str(e)}",
            "config_ready": False,
            "error": True
        }


@router.post("/setup-apply")
async def apply_setup_config(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Aplicar la configuración generada por el chat"""
    config_data = data.get("config", {})
    prompts_data = data.get("prompts", {})
    
    config = get_or_create_business_config(db)
    
    config.business_name = config_data.get("business_name", "Mi Negocio")
    config.business_type = config_data.get("business_type", "general")
    config.business_description = config_data.get("business_description", "")
    config.has_inventory = config_data.get("has_inventory", True)
    config.has_appointments = config_data.get("has_appointments", True)
    config.has_schedule = config_data.get("has_schedule", True)
    config.onboarding_completed = True
    config.updated_at = datetime.utcnow()
    
    # Guardar en config general
    set_config("business_name", config.business_name)
    set_config("business_type", config.business_type)
    
    # Guardar prompts generados por la IA del chat
    if prompts_data:
        import json
        
        # Guardar como prompt_sections (formato que usa la página de Agent)
        prompt_sections = {
            "role": prompts_data.get("role", ""),
            "context": prompts_data.get("context", ""),
            "task": prompts_data.get("task", ""),
            "constraints": prompts_data.get("constraints", ""),
            "tone": prompts_data.get("tone", "")
        }
        set_config("prompt_sections", json.dumps(prompt_sections))
        
        # También guardar individualmente para compatibilidad
        set_config("prompt_role", prompts_data.get("role", ""))
        set_config("prompt_context", prompts_data.get("context", ""))
        set_config("prompt_task", prompts_data.get("task", ""))
        set_config("prompt_constraints", prompts_data.get("constraints", ""))
        set_config("prompt_tone", prompts_data.get("tone", ""))
        
        # Construir system_prompt completo
        full_prompt = f"""## ROL
{prompts_data.get('role', '')}

## CONTEXTO
{prompts_data.get('context', '')}

## TAREA
{prompts_data.get('task', '')}

## RESTRICCIONES
{prompts_data.get('constraints', '')}

## TONO
{prompts_data.get('tone', '')}"""
        
        set_config("system_prompt", full_prompt)
    else:
        # Si no hay prompts del chat, generarlos
        await generate_prompts_from_config(config_data, db)
    
    # Activar/desactivar tools
    from models import ToolsConfig
    inventory_tools = ["consultar_inventario"]
    appointment_tools = ["agendar_cita", "ver_citas", "cancelar_cita", "modificar_cita"]
    
    for tool in db.query(ToolsConfig).all():
        if tool.nombre in inventory_tools:
            tool.habilitado = config.has_inventory
        elif tool.nombre in appointment_tools:
            tool.habilitado = config.has_appointments
    
    db.commit()
    
    return {"status": "ok", "config": config.to_dict()}


async def generate_prompts_from_config(config_data: dict, db):
    """Genera prompts personalizados basados en la configuración"""
    from openai import OpenAI
    import json
    
    openai_key = get_config("openai_api_key")
    if not openai_key:
        return
    
    client = OpenAI(api_key=openai_key)
    
    modules = []
    if config_data.get("has_inventory"):
        modules.append("catálogo de productos/servicios")
    if config_data.get("has_appointments"):
        modules.append("sistema de citas")
    if config_data.get("has_schedule"):
        modules.append("horarios de atención")
    
    prompt = f"""Genera la personalidad para un agente de WhatsApp:

Negocio: {config_data.get('business_name')}
Tipo: {config_data.get('business_type')}
Descripción: {config_data.get('business_description')}
Funcionalidades: {', '.join(modules) if modules else 'solo chat'}

Responde SOLO con JSON:
{{
  "role": "descripción del rol (1-2 oraciones)",
  "context": "contexto del negocio (1-2 oraciones)",
  "task": "objetivo principal (1-2 oraciones)",
  "constraints": "restricciones (1-2 oraciones)",
  "tone": "tono de comunicación (1 oración)"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=400
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()
        
        sections = json.loads(content)
        
        # Guardar como prompt_sections (formato que usa la página de Agent)
        prompt_sections = {
            "role": sections.get("role", ""),
            "context": sections.get("context", ""),
            "task": sections.get("task", ""),
            "constraints": sections.get("constraints", ""),
            "tone": sections.get("tone", "")
        }
        set_config("prompt_sections", json.dumps(prompt_sections))
        
        # También guardar individualmente para compatibilidad
        set_config("prompt_role", sections.get("role", ""))
        set_config("prompt_context", sections.get("context", ""))
        set_config("prompt_task", sections.get("task", ""))
        set_config("prompt_constraints", sections.get("constraints", ""))
        set_config("prompt_tone", sections.get("tone", ""))
        
        full_prompt = f"""## ROL
{sections.get('role', '')}

## CONTEXTO
{sections.get('context', '')}

## TAREA
{sections.get('task', '')}

## RESTRICCIONES
{sections.get('constraints', '')}

## TONO
{sections.get('tone', '')}"""
        
        set_config("system_prompt", full_prompt)
        
    except Exception as e:
        print(f"Error generating prompts: {e}")
