"""
ZCampaigns Router - Bulk messaging campaigns management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timedelta
from typing import Optional
import json

from models import get_db, Campana, CampanaDestinatario, Contacto
from api.routers.auth import get_current_user
from models import Usuario

router = APIRouter(
    prefix="/campanas", 
    tags=["Campaigns"],
    responses={401: {"description": "Not authenticated"}}
)


@router.get("", summary="List campaigns", description="Retrieve all messaging campaigns with optional status filter and pagination.")
async def listar_campanas(
    estado: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = db.query(Campana)
    
    if estado:
        query = query.filter(Campana.estado == estado)
    
    total = query.count()
    offset = (page - 1) * limit
    campanas = query.order_by(Campana.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "campanas": [c.to_dict() for c in campanas],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/stats", summary="Get campaign statistics", description="Get campaign metrics: total, drafts, sending and completed counts.")
async def stats_campanas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    total = db.query(Campana).count()
    borradores = db.query(Campana).filter(Campana.estado == "borrador").count()
    enviando = db.query(Campana).filter(Campana.estado == "enviando").count()
    completadas = db.query(Campana).filter(Campana.estado == "completada").count()
    
    return {
        "total": total,
        "borradores": borradores,
        "enviando": enviando,
        "completadas": completadas
    }


@router.get("/{campana_id}", summary="Get campaign by ID", description="Retrieve detailed information for a specific campaign.")
async def obtener_campana(
    campana_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campana.to_dict()


@router.post("", summary="Create campaign", description="Create a new bulk messaging campaign with name, message template and recipient filters.")
async def crear_campana(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    nombre = data.get("nombre", "").strip()
    mensaje = data.get("mensaje", "").strip()
    
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre es requerido")
    if not mensaje:
        raise HTTPException(status_code=400, detail="Mensaje es requerido")
    
    campana = Campana(
        nombre=nombre,
        descripcion=data.get("descripcion"),
        mensaje=mensaje,
        tipo=data.get("tipo", "unica"),
        estado="borrador",
        velocidad=data.get("velocidad", 30),
        filtro_tipo=data.get("filtro_tipo"),
        filtro_valor=json.dumps(data.get("filtro_valor")) if data.get("filtro_valor") else None,
    )
    
    # Programar si se especifica
    if data.get("programada_para"):
        campana.programada_para = datetime.fromisoformat(data["programada_para"])
        campana.estado = "programada"
    
    db.add(campana)
    db.commit()
    db.refresh(campana)
    
    # Calcular destinatarios
    await _calcular_destinatarios(campana, db)
    
    return campana.to_dict()


@router.put("/{campana_id}", summary="Update campaign", description="Modify campaign details. Only allowed for draft, scheduled or paused campaigns.")
async def actualizar_campana(
    campana_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    if campana.estado not in ["borrador", "programada", "pausada"]:
        raise HTTPException(status_code=400, detail="No se puede editar una campaña en progreso")
    
    if "nombre" in data:
        campana.nombre = data["nombre"]
    if "descripcion" in data:
        campana.descripcion = data["descripcion"]
    if "mensaje" in data:
        campana.mensaje = data["mensaje"]
    if "velocidad" in data:
        campana.velocidad = data["velocidad"]
    if "filtro_tipo" in data:
        campana.filtro_tipo = data["filtro_tipo"]
    if "filtro_valor" in data:
        campana.filtro_valor = json.dumps(data["filtro_valor"]) if data["filtro_valor"] else None
    
    db.commit()
    
    # Recalcular destinatarios
    await _calcular_destinatarios(campana, db)
    
    db.refresh(campana)
    return campana.to_dict()


@router.delete("/{campana_id}", summary="Delete campaign", description="Permanently delete a campaign and all its recipients.")
async def eliminar_campana(
    campana_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    # Eliminar destinatarios
    db.query(CampanaDestinatario).filter(CampanaDestinatario.campana_id == campana_id).delete()
    db.delete(campana)
    db.commit()
    
    return {"status": "ok"}


@router.post("/{campana_id}/iniciar", summary="Start campaign", description="Begin sending messages to all recipients in the campaign.")
async def iniciar_campana(
    campana_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    if campana.estado not in ["borrador", "programada", "pausada"]:
        raise HTTPException(status_code=400, detail=f"No se puede iniciar una campaña en estado '{campana.estado}'")
    
    # Verificar que hay destinatarios
    if campana.total_destinatarios == 0:
        await _calcular_destinatarios(campana, db)
        if campana.total_destinatarios == 0:
            raise HTTPException(status_code=400, detail="No hay destinatarios para esta campaña")
    
    campana.estado = "enviando"
    campana.iniciada_at = datetime.utcnow()
    db.commit()
    
    return {"status": "ok", "message": "Campaña iniciada"}


@router.post("/{campana_id}/pausar", summary="Pause campaign", description="Temporarily stop sending messages. Can be resumed later.")
async def pausar_campana(
    campana_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    if campana.estado != "enviando":
        raise HTTPException(status_code=400, detail="Solo se pueden pausar campañas en envío")
    
    campana.estado = "pausada"
    db.commit()
    
    return {"status": "ok", "message": "Campaña pausada"}


@router.post("/{campana_id}/reanudar", summary="Resume campaign", description="Continue sending messages from where it was paused.")
async def reanudar_campana(
    campana_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    if campana.estado != "pausada":
        raise HTTPException(status_code=400, detail="Solo se pueden reanudar campañas pausadas")
    
    campana.estado = "enviando"
    db.commit()
    
    return {"status": "ok", "message": "Campaña reanudada"}


@router.post("/{campana_id}/cancelar", summary="Cancel campaign", description="Stop the campaign permanently. Cannot be resumed.")
async def cancelar_campana(
    campana_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    if campana.estado == "completada":
        raise HTTPException(status_code=400, detail="No se puede cancelar una campaña completada")
    
    campana.estado = "cancelada"
    db.commit()
    
    return {"status": "ok", "message": "Campaña cancelada"}


@router.get("/{campana_id}/destinatarios", summary="List recipients", description="Get all recipients for a campaign with their delivery status.")
async def listar_destinatarios(
    campana_id: int,
    estado: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = db.query(CampanaDestinatario).filter(CampanaDestinatario.campana_id == campana_id)
    
    if estado:
        query = query.filter(CampanaDestinatario.estado == estado)
    
    total = query.count()
    offset = (page - 1) * limit
    destinatarios = query.offset(offset).limit(limit).all()
    
    # Enriquecer con datos del contacto
    result = []
    for d in destinatarios:
        contacto = db.query(Contacto).filter(Contacto.id == d.contacto_id).first()
        item = d.to_dict()
        if contacto:
            item["contacto"] = {
                "telefono": contacto.telefono,
                "nombre": contacto.nombre
            }
        result.append(item)
    
    return {
        "destinatarios": result,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.post("/{campana_id}/preview", summary="Preview message", description="See how the message will look with variables replaced using sample data.")
async def preview_mensaje(
    campana_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    # Obtener un contacto de ejemplo
    contacto = db.query(Contacto).first()
    
    mensaje = campana.mensaje
    if contacto:
        mensaje = mensaje.replace("{nombre}", contacto.nombre or "Cliente")
        mensaje = mensaje.replace("{telefono}", contacto.telefono)
    else:
        mensaje = mensaje.replace("{nombre}", "Juan Pérez")
        mensaje = mensaje.replace("{telefono}", "+52 55 1234 5678")
    
    return {"preview": mensaje}


@router.post("/mejorar-mensaje")
async def mejorar_mensaje_ia(
    data: dict,
    current_user: Usuario = Depends(get_current_user)
):
    """
    Usar IA para generar o mejorar un mensaje de campaña.
    Body: { "mensaje": "texto actual", "objetivo": "promocion|reactivacion|informativo|personalizado", "instrucciones": "opcional" }
    """
    from openai import OpenAI
    from database import get_config
    
    mensaje_actual = data.get("mensaje", "").strip()
    objetivo = data.get("objetivo", "promocion")
    instrucciones = data.get("instrucciones", "").strip()
    
    api_key = get_config("openai_api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key de OpenAI no configurada")
    
    client = OpenAI(api_key=api_key)
    
    # Definir contexto según objetivo
    objetivos_desc = {
        "promocion": "una promoción o descuento especial para atraer clientes",
        "reactivacion": "reactivar clientes que no han comprado en un tiempo",
        "informativo": "informar sobre novedades, horarios o cambios importantes",
        "recordatorio": "recordar una cita o evento próximo",
        "agradecimiento": "agradecer a los clientes por su preferencia",
        "personalizado": instrucciones or "un mensaje personalizado según las instrucciones"
    }
    
    objetivo_desc = objetivos_desc.get(objetivo, objetivos_desc["promocion"])
    
    if mensaje_actual:
        prompt = f"""Mejora el siguiente mensaje de WhatsApp para una campaña de marketing.

Mensaje actual:
{mensaje_actual}

Objetivo: {objetivo_desc}
{f'Instrucciones adicionales: {instrucciones}' if instrucciones else ''}

Requisitos:
- Mantén el mensaje corto (máximo 3-4 líneas)
- Usa un tono amigable y cercano
- Incluye un llamado a la acción claro
- Puedes usar emojis con moderación
- Usa la variable {{nombre}} para personalizar
- Responde SOLO con el mensaje mejorado, sin explicaciones"""
    else:
        prompt = f"""Genera un mensaje de WhatsApp para una campaña de marketing.

Objetivo: {objetivo_desc}
{f'Instrucciones: {instrucciones}' if instrucciones else ''}

Requisitos:
- Mensaje corto (máximo 3-4 líneas)
- Tono amigable y cercano
- Incluye un llamado a la acción claro
- Usa emojis con moderación
- Usa la variable {{nombre}} para personalizar (ej: "Hola {{nombre}}")
- Responde SOLO con el mensaje, sin explicaciones"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=200
        )
        
        mensaje_mejorado = response.choices[0].message.content.strip()
        # Limpiar comillas si las tiene
        if mensaje_mejorado.startswith('"') and mensaje_mejorado.endswith('"'):
            mensaje_mejorado = mensaje_mejorado[1:-1]
        
        return {"mensaje": mensaje_mejorado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error con OpenAI: {str(e)}")


@router.post("/enviar-prueba")
async def enviar_mensaje_prueba(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Enviar mensaje de prueba a uno o varios números.
    Body: { "mensaje": "texto", "telefonos": ["+521234567890"] }
    """
    from whatsapp_service import whatsapp_service
    
    mensaje = data.get("mensaje", "").strip()
    telefonos = data.get("telefonos", [])
    
    if not mensaje:
        raise HTTPException(status_code=400, detail="Mensaje es requerido")
    if not telefonos:
        raise HTTPException(status_code=400, detail="Al menos un teléfono es requerido")
    
    resultados = []
    
    for telefono in telefonos:
        # Buscar contacto para reemplazar variables
        contacto = db.query(Contacto).filter(Contacto.telefono == telefono).first()
        
        # Reemplazar variables
        mensaje_final = mensaje
        if contacto:
            mensaje_final = mensaje_final.replace("{nombre}", contacto.nombre or "Cliente")
            mensaje_final = mensaje_final.replace("{telefono}", contacto.telefono)
        else:
            mensaje_final = mensaje_final.replace("{nombre}", "Cliente")
            mensaje_final = mensaje_final.replace("{telefono}", telefono)
        
        # Enviar
        result = await whatsapp_service.send_message(telefono, mensaje_final)
        
        resultados.append({
            "telefono": telefono,
            "nombre": contacto.nombre if contacto else None,
            "enviado": result.get("success", False),
            "error": result.get("error") if not result.get("success") else None
        })
    
    exitosos = sum(1 for r in resultados if r["enviado"])
    
    return {
        "status": "ok",
        "total": len(telefonos),
        "exitosos": exitosos,
        "fallidos": len(telefonos) - exitosos,
        "resultados": resultados
    }


async def _calcular_destinatarios(campana: Campana, db: Session):
    """Calcular y crear destinatarios según el filtro"""
    # Limpiar destinatarios anteriores
    db.query(CampanaDestinatario).filter(CampanaDestinatario.campana_id == campana.id).delete()
    
    # Obtener contactos según filtro
    query = db.query(Contacto).filter(Contacto.estado != "bloqueado")
    
    filtro_tipo = campana.filtro_tipo
    filtro_valor = json.loads(campana.filtro_valor) if campana.filtro_valor else {}
    
    if filtro_tipo == "inactivos":
        dias = filtro_valor.get("dias", 30)
        fecha_limite = datetime.utcnow() - timedelta(days=dias)
        query = query.filter(
            or_(
                Contacto.ultimo_mensaje < fecha_limite,
                Contacto.ultimo_mensaje.is_(None)
            )
        )
    elif filtro_tipo == "tag":
        tag = filtro_valor.get("tag", "")
        if tag:
            query = query.filter(Contacto.tags.ilike(f'%"{tag}"%'))
    elif filtro_tipo == "manual":
        ids = filtro_valor.get("ids", [])
        if ids:
            query = query.filter(Contacto.id.in_(ids))
        else:
            query = query.filter(False)  # No hay IDs seleccionados
    # "todos" no necesita filtro adicional
    
    contactos = query.all()
    
    # Crear destinatarios
    for contacto in contactos:
        dest = CampanaDestinatario(
            campana_id=campana.id,
            contacto_id=contacto.id,
            estado="pendiente"
        )
        db.add(dest)
    
    campana.total_destinatarios = len(contactos)
    db.commit()


def reemplazar_variables(mensaje: str, contacto: Contacto) -> str:
    """Reemplazar variables en el mensaje"""
    resultado = mensaje
    resultado = resultado.replace("{nombre}", contacto.nombre or "")
    resultado = resultado.replace("{telefono}", contacto.telefono or "")
    return resultado
