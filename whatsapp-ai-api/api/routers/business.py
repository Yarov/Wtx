"""
Business Router - Business profile, onboarding and module configuration
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from models import (
    get_db, BusinessConfig, ToolsConfig, Configuracion,
    Memoria, Contacto, Campana, CampanaDestinatario, BackgroundJob, Usuario
)
from api.routers.auth import get_current_user
from api.routers.perfiles import get_current_perfil
from database import get_config, set_config
from models import Perfil

router = APIRouter(
    prefix="/business",
    tags=["Business"],
    responses={401: {"description": "Not authenticated"}}
)


class BusinessConfigModel(BaseModel):
    business_name: str
    business_type: str
    business_description: Optional[str] = ""


def get_or_create_business_config(db: Session, usuario_id: int) -> BusinessConfig:
    """Obtener o crear configuracion del negocio para un usuario"""
    config = db.query(BusinessConfig).filter(
        BusinessConfig.usuario_id == usuario_id
    ).first()
    if not config:
        config = BusinessConfig(usuario_id=usuario_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/config", summary="Get business config", description="Retrieve business profile including name, type and enabled modules.")
async def get_business_config(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    config = get_or_create_business_config(db, current_user.id)
    return config.to_dict()


@router.put("/config", summary="Update business config", description="Update business profile settings and module preferences.")
async def update_business_config(
    data: BusinessConfigModel,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    config = get_or_create_business_config(db, current_user.id)

    config.business_name = data.business_name
    config.business_type = data.business_type
    config.business_description = data.business_description
    config.updated_at = datetime.utcnow()

    # Actualizar tambien en configuracion general para compatibilidad (por perfil)
    set_config("business_name", data.business_name, usuario_id=current_user.id, perfil_id=perfil.id)
    set_config("business_type", data.business_type, usuario_id=current_user.id, perfil_id=perfil.id)
    set_config("business_description", data.business_description or "", usuario_id=current_user.id, perfil_id=perfil.id)

    db.commit()

    return {"status": "ok", "config": config.to_dict()}


@router.get("/modules", summary="Get active modules", description="Get enabled modules for dynamic menu rendering.")
async def get_active_modules(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    config = get_or_create_business_config(db, current_user.id)

    return {
        "modules": {},
        "onboarding_completed": config.onboarding_completed
    }


@router.get("/onboarding-status", summary="Get onboarding status", description="Check if the authenticated user's setup wizard is completed.")
async def get_onboarding_status(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    config = db.query(BusinessConfig).filter(
        BusinessConfig.usuario_id == current_user.id
    ).first()

    if not config:
        return {"onboarding_completed": False}

    return {"onboarding_completed": config.onboarding_completed}


def init_all_default_data(db: Session, usuario_id: int = 0):
    """Inicializar todos los datos por defecto si no existen"""
    initialized = []

    # Configuracion por defecto
    if db.query(Configuracion).filter(Configuracion.usuario_id == usuario_id).count() == 0:
        default_config = [
            ("system_prompt", """Eres un asistente de WhatsApp profesional.
Atiendes a los clientes del negocio, respondes sus dudas y das información.
Responde claro, corto y amable.
Siempre saluda al cliente y ofrece ayuda."""),
            ("model", "gpt-4o-mini"),
            ("temperature", "0.7"),
            ("max_tokens", "500"),
            ("business_name", "Mi Negocio"),
            ("business_type", "servicios"),
        ]
        for clave, valor in default_config:
            db.add(Configuracion(clave=clave, usuario_id=usuario_id, valor=valor))
        initialized.append("configuracion")

    # Herramientas por defecto
    if db.query(ToolsConfig).filter(ToolsConfig.usuario_id == usuario_id).count() == 0:
        default_tools = [
            ("transferir_a_humano", True, "Transferir conversación a atención humana"),
        ]
        for nombre, habilitado, descripcion in default_tools:
            db.add(ToolsConfig(nombre=nombre, usuario_id=usuario_id, habilitado=habilitado, descripcion=descripcion))
        initialized.append("tools")

    return initialized


@router.post("/skip-onboarding", summary="Skip onboarding", description="Skip the setup wizard and use default configuration values.")
async def skip_onboarding(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    config = get_or_create_business_config(db, current_user.id)
    config.onboarding_completed = True
    config.updated_at = datetime.utcnow()

    # Inicializar todos los datos por defecto
    initialized = init_all_default_data(db, usuario_id=current_user.id)

    # SIEMPRE activar todos los tools cuando se salta el onboarding
    all_tools = [
        ("transferir_a_humano", "Transferir conversación a atención humana"),
    ]
    for tool_name, descripcion in all_tools:
        tool = db.query(ToolsConfig).filter(
            ToolsConfig.nombre == tool_name,
            ToolsConfig.usuario_id == current_user.id,
        ).first()
        if tool:
            tool.habilitado = True
        else:
            db.add(ToolsConfig(nombre=tool_name, usuario_id=current_user.id, habilitado=True, descripcion=descripcion))

    # Asegurar que exista configuracion basica
    default_configs = {
        "system_prompt": """Eres un asistente de WhatsApp profesional.
Responde claro, corto y amable.
Siempre saluda al cliente y ofrece ayuda.""",
        "model": "gpt-4o-mini",
        "temperature": "0.7",
        "max_tokens": "500",
        "business_name": "Mi Negocio",
        "business_type": "servicios",
    }
    for clave, valor in default_configs.items():
        existing = db.query(Configuracion).filter(
            Configuracion.clave == clave,
            Configuracion.usuario_id == current_user.id,
        ).first()
        if not existing:
            db.add(Configuracion(clave=clave, usuario_id=current_user.id, valor=valor))
            initialized.append(f"config:{clave}")

    db.commit()

    return {"status": "ok", "message": "Onboarding saltado, todo activado", "initialized": initialized}


@router.post("/restart-onboarding", summary="Restart onboarding", description="Reset onboarding status to reconfigure the business from scratch.")
async def restart_onboarding(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    config = get_or_create_business_config(db, current_user.id)
    config.onboarding_completed = False
    config.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "ok", "message": "Onboarding reiniciado"}


class ChatMessage(BaseModel):
    message: str
    history: list = []


@router.post("/setup-chat", summary="AI setup chat", description="Conversational AI wizard that asks questions and generates business configuration.")
async def setup_chat(
    data: ChatMessage,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    import json
    from agent import get_openai_client

    try:
        client = get_openai_client()
    except ValueError:
        return {
            "response": "La API key de OpenAI no esta configurada. Ve a Configuracion > API Keys para agregarla.",
            "config_ready": False,
            "needs_api_key": True
        }

    system_prompt = """Eres un amigo que ayuda a configurar un asistente de WhatsApp. Habla como si estuvieras en un cafe platicando.

TU PERSONALIDAD:
- Eres calido, genuino y te emociona ayudar
- Usas lenguaje natural, no corporativo
- Celebras lo que hace el usuario ("Que padre!", "Me encanta eso")
- Haces comentarios sobre lo que te cuenta antes de preguntar
- Usas emojis con moderacion (1-2 por mensaje maximo)

COMO CONVERSAR:
- Primero CONECTA con lo que dijo, luego pregunta
- Ejemplo: "Ah, unas y pestanas, que buen negocio! Como se llama tu local?"
- NO hagas preguntas tipo encuesta, hazlas naturales
- Una pregunta a la vez, maximo 2 lineas

LO QUE NECESITAS SABER (pregunta natural, no como lista):
1. Nombre del negocio (si no lo menciono)
2. Que servicios ofrece (si no quedo claro)
3. Como quiere que suene el asistente (casual/formal)
4. Si hay algo que el asistente NO deba hacer

EJEMPLOS DE COMO HABLAR:
- "Ah, una barberia, genial! Como se llama?"
- "Suena increible! Y como te gustaria que hable el asistente con tus clientes?"
- "Perfecto. Hay algo que prefieras que el asistente NO haga o prometa?"

NO digas: "Que servicios ofreces?" (muy frio)
NO digas: "El asistente debe ser formal o relajado?" (muy robotico)

PARA EL JSON FINAL:
- business_name: el nombre EXACTO que dio (o descripcion si no dio nombre)
- business_type: sus palabras exactas, no categorias inventadas

CUANDO TENGAS TODO, responde con:
```json
{
  "ready": true,
  "config": {
    "business_name": "nombre exacto del usuario",
    "business_type": "palabras del usuario",
    "business_description": "lo que ofrece",
    "preferred_tone": "tono elegido",
    "restrictions": "restricciones mencionadas"
  },
  "prompts": {
    "role": "Rol del agente (2-3 oraciones)",
    "context": "Contexto del negocio (2-3 oraciones)",
    "task": "Objetivo principal (2-3 oraciones)",
    "constraints": "Restricciones (2-3 oraciones)",
    "tone": "Tono de comunicacion (1-2 oraciones)"
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

        # Verificar si la IA devolvio configuracion
        if "```json" in ai_response and '"ready": true' in ai_response:
            # Extraer JSON
            json_str = ai_response.split("```json")[1].split("```")[0].strip()
            config_data = json.loads(json_str)

            return {
                "response": config_data.get("summary", "Configuracion lista"),
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


@router.post("/setup-apply", summary="Apply setup config", description="Apply the configuration generated by the AI setup chat wizard.")
async def apply_setup_config(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    config_data = data.get("config", {})
    prompts_data = data.get("prompts", {})
    pid = perfil.id

    config = get_or_create_business_config(db, current_user.id)

    config.business_name = config_data.get("business_name", "Mi Negocio")
    config.business_type = config_data.get("business_type", "general")
    config.business_description = config_data.get("business_description", "")
    config.onboarding_completed = True
    config.updated_at = datetime.utcnow()

    # Guardar en config general (por perfil)
    set_config("business_name", config.business_name, usuario_id=current_user.id, perfil_id=pid)
    set_config("business_type", config.business_type, usuario_id=current_user.id, perfil_id=pid)

    # Guardar prompts generados por la IA del chat
    if prompts_data:
        import json

        # Guardar como prompt_sections (formato que usa la pagina de Agent)
        prompt_sections = {
            "role": prompts_data.get("role", ""),
            "context": prompts_data.get("context", ""),
            "task": prompts_data.get("task", ""),
            "constraints": prompts_data.get("constraints", ""),
            "tone": prompts_data.get("tone", "")
        }
        set_config("prompt_sections", json.dumps(prompt_sections), usuario_id=current_user.id, perfil_id=pid)

        # Tambien guardar individualmente para compatibilidad
        set_config("prompt_role", prompts_data.get("role", ""), usuario_id=current_user.id, perfil_id=pid)
        set_config("prompt_context", prompts_data.get("context", ""), usuario_id=current_user.id, perfil_id=pid)
        set_config("prompt_task", prompts_data.get("task", ""), usuario_id=current_user.id, perfil_id=pid)
        set_config("prompt_constraints", prompts_data.get("constraints", ""), usuario_id=current_user.id, perfil_id=pid)
        set_config("prompt_tone", prompts_data.get("tone", ""), usuario_id=current_user.id, perfil_id=pid)

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

        set_config("system_prompt", full_prompt, usuario_id=current_user.id, perfil_id=pid)
    else:
        # Si no hay prompts del chat, generarlos
        await generate_prompts_from_config(config_data, db, current_user.id, perfil_id=pid)

    db.commit()

    return {"status": "ok", "config": config.to_dict()}


async def generate_prompts_from_config(config_data: dict, db, usuario_id: int = 0, perfil_id: int = None):
    """Genera prompts personalizados basados en la configuracion"""
    import json
    from agent import get_openai_client

    try:
        client = get_openai_client()
    except ValueError:
        return

    modules = []

    prompt = f"""Genera la personalidad para un agente de WhatsApp:

Negocio: {config_data.get('business_name')}
Tipo: {config_data.get('business_type')}
Descripcion: {config_data.get('business_description')}
Funcionalidades: {', '.join(modules) if modules else 'solo chat'}

Responde SOLO con JSON:
{{
  "role": "descripcion del rol (1-2 oraciones)",
  "context": "contexto del negocio (1-2 oraciones)",
  "task": "objetivo principal (1-2 oraciones)",
  "constraints": "restricciones (1-2 oraciones)",
  "tone": "tono de comunicacion (1 oracion)"
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

        # Guardar como prompt_sections (formato que usa la pagina de Agent)
        prompt_sections = {
            "role": sections.get("role", ""),
            "context": sections.get("context", ""),
            "task": sections.get("task", ""),
            "constraints": sections.get("constraints", ""),
            "tone": sections.get("tone", "")
        }
        set_config("prompt_sections", json.dumps(prompt_sections), usuario_id=usuario_id, perfil_id=perfil_id)

        # Tambien guardar individualmente para compatibilidad
        set_config("prompt_role", sections.get("role", ""), usuario_id=usuario_id, perfil_id=perfil_id)
        set_config("prompt_context", sections.get("context", ""), usuario_id=usuario_id, perfil_id=perfil_id)
        set_config("prompt_task", sections.get("task", ""), usuario_id=usuario_id, perfil_id=perfil_id)
        set_config("prompt_constraints", sections.get("constraints", ""), usuario_id=usuario_id, perfil_id=perfil_id)
        set_config("prompt_tone", sections.get("tone", ""), usuario_id=usuario_id, perfil_id=perfil_id)

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

        set_config("system_prompt", full_prompt, usuario_id=usuario_id, perfil_id=perfil_id)

    except Exception as e:
        print(f"Error generating prompts: {e}")


class FactoryResetRequest(BaseModel):
    sections: list = []  # Lista de secciones a resetear, vacia = todo


@router.post("/factory-reset", summary="Factory reset", description="Reset selected or all data to factory defaults.")
async def factory_reset(
    data: FactoryResetRequest = FactoryResetRequest(),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Reset selectivo o completo de la base de datos.
    sections puede incluir: contactos, campanas, conversaciones, configuracion
    Si sections esta vacio, se borra todo.
    Solo usuarios admin pueden ejecutar esto.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar factory reset")

    sections = data.sections if data.sections else [
        'contactos', 'campanas', 'conversaciones', 'configuracion', 'usuarios'
    ]

    deleted = {}

    try:
        uid = current_user.id

        # Campanas (incluye destinatarios)
        if 'campanas' in sections:
            camp_ids = [c.id for c in db.query(Campana.id).filter(Campana.usuario_id == uid).all()]
            if camp_ids:
                deleted["campana_destinatarios"] = db.query(CampanaDestinatario).filter(
                    CampanaDestinatario.campana_id.in_(camp_ids)
                ).delete(synchronize_session='fetch')
            else:
                deleted["campana_destinatarios"] = 0
            deleted["campanas"] = db.query(Campana).filter(Campana.usuario_id == uid).delete()

        # Contactos
        if 'contactos' in sections:
            deleted["contactos"] = db.query(Contacto).filter(Contacto.usuario_id == uid).delete()

        # Conversaciones (memoria)
        if 'conversaciones' in sections:
            deleted["memoria"] = db.query(Memoria).filter(Memoria.usuario_id == uid).delete()

        # Configuracion (incluye tools, business config, prompts)
        if 'configuracion' in sections:
            deleted["tools_config"] = db.query(ToolsConfig).filter(ToolsConfig.usuario_id == uid).delete()
            deleted["configuracion"] = db.query(Configuracion).filter(Configuracion.usuario_id == uid).delete()
            deleted["business_config"] = db.query(BusinessConfig).filter(BusinessConfig.usuario_id == uid).delete()

        # Background jobs siempre se limpian si hay campanas o contactos
        if 'campanas' in sections or 'contactos' in sections:
            deleted["background_jobs"] = db.query(BackgroundJob).filter(BackgroundJob.usuario_id == uid).delete()

        # Usuarios (excepto el usuario actual)
        if 'usuarios' in sections:
            deleted["usuarios"] = db.query(Usuario).filter(Usuario.id != current_user.id).delete()

        # Full reset: eliminar tambien al admin actual
        if 'full_reset' in sections:
            deleted["usuario_admin"] = db.query(Usuario).filter(Usuario.id == current_user.id).delete()

        db.commit()

        # Reinicializar datos por defecto segun lo que se borro
        initialized = []
        if 'configuracion' in sections:
            initialized = init_all_default_data(db, usuario_id=uid)
            db.commit()

        return {
            "status": "ok",
            "message": "Reset completado",
            "deleted": deleted,
            "initialized": initialized,
            "sections_reset": sections
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en factory reset: {str(e)}")
