"""
Router para gestión de contactos
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime, timedelta
from typing import Optional
import json
import csv
import io

from models import get_db, Contacto
from api.routers.auth import get_current_user
from models import Usuario

router = APIRouter(prefix="/contactos", tags=["contactos"])


def normalizar_telefono(telefono: str) -> str:
    """
    Normaliza números de teléfono usando la librería phonenumbers de Google.
    Soporta todos los países del mundo automáticamente.
    Retorna formato E.164: +[código país][número]
    """
    import phonenumbers
    
    if not telefono:
        return ""
    
    # Limpiar caracteres no numéricos excepto +
    limpio = ''.join(c for c in telefono if c.isdigit() or c == '+')
    
    # Asegurar que empiece con +
    if not limpio.startswith('+'):
        limpio = '+' + limpio
    
    try:
        # Parsear el número (None = detectar país automáticamente)
        parsed = phonenumbers.parse(limpio, None)
        
        # Validar que sea un número válido
        if phonenumbers.is_valid_number(parsed):
            # Retornar en formato E.164 (estándar internacional)
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        else:
            # Si no es válido, retornar limpio
            return limpio
    except Exception:
        # Si falla el parseo, retornar limpio
        return limpio


def buscar_contacto_por_telefono(db: Session, telefono: str):
    """Busca contacto por teléfono normalizado"""
    telefono_norm = normalizar_telefono(telefono)
    
    # Buscar por teléfono normalizado
    contacto = db.query(Contacto).filter(Contacto.telefono == telefono_norm).first()
    
    return contacto


@router.get("")
async def listar_contactos(
    estado: Optional[str] = None,
    buscar: Optional[str] = None,
    tag: Optional[str] = None,
    dias_inactivo: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Listar contactos con filtros y paginación"""
    query = db.query(Contacto)
    
    # Filtro por estado
    if estado:
        query = query.filter(Contacto.estado == estado)
    
    # Búsqueda por teléfono o nombre
    if buscar:
        query = query.filter(
            or_(
                Contacto.telefono.ilike(f"%{buscar}%"),
                Contacto.nombre.ilike(f"%{buscar}%")
            )
        )
    
    # Filtro por tag
    if tag:
        query = query.filter(Contacto.tags.ilike(f'%"{tag}"%'))
    
    # Filtro por días de inactividad
    if dias_inactivo:
        fecha_limite = datetime.utcnow() - timedelta(days=dias_inactivo)
        query = query.filter(
            or_(
                Contacto.ultimo_mensaje < fecha_limite,
                Contacto.ultimo_mensaje.is_(None)
            )
        )
    
    # Contar total
    total = query.count()
    
    # Paginación
    offset = (page - 1) * limit
    contactos = query.order_by(Contacto.ultimo_mensaje.desc().nullslast()).offset(offset).limit(limit).all()
    
    return {
        "contactos": [c.to_dict() for c in contactos],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/stats")
async def stats_contactos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Estadísticas de contactos"""
    total = db.query(Contacto).count()
    activos = db.query(Contacto).filter(Contacto.estado == "activo").count()
    inactivos = db.query(Contacto).filter(Contacto.estado == "inactivo").count()
    bloqueados = db.query(Contacto).filter(Contacto.estado == "bloqueado").count()
    
    # Inactivos últimos 30 días
    fecha_30_dias = datetime.utcnow() - timedelta(days=30)
    sin_actividad_30d = db.query(Contacto).filter(
        or_(
            Contacto.ultimo_mensaje < fecha_30_dias,
            Contacto.ultimo_mensaje.is_(None)
        )
    ).count()
    
    return {
        "total": total,
        "activos": activos,
        "inactivos": inactivos,
        "bloqueados": bloqueados,
        "sin_actividad_30d": sin_actividad_30d
    }


@router.get("/{contacto_id}")
async def obtener_contacto(
    contacto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtener un contacto por ID"""
    contacto = db.query(Contacto).filter(Contacto.id == contacto_id).first()
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    return contacto.to_dict()


@router.post("")
async def crear_contacto(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crear un contacto manualmente"""
    telefono = data.get("telefono", "").strip()
    if not telefono:
        raise HTTPException(status_code=400, detail="Teléfono es requerido")
    
    # Verificar si ya existe
    existente = db.query(Contacto).filter(Contacto.telefono == telefono).first()
    if existente:
        raise HTTPException(status_code=400, detail="El contacto ya existe")
    
    contacto = Contacto(
        telefono=telefono,
        nombre=data.get("nombre"),
        email=data.get("email"),
        estado="activo",
        tags=json.dumps(data.get("tags", [])),
        notas=data.get("notas"),
        origen="manual"
    )
    
    db.add(contacto)
    db.commit()
    db.refresh(contacto)
    
    return contacto.to_dict()


@router.put("/{contacto_id}")
async def actualizar_contacto(
    contacto_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualizar un contacto"""
    contacto = db.query(Contacto).filter(Contacto.id == contacto_id).first()
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    if "nombre" in data:
        contacto.nombre = data["nombre"]
    if "email" in data:
        contacto.email = data["email"]
    if "estado" in data:
        contacto.estado = data["estado"]
    if "tags" in data:
        contacto.tags = json.dumps(data["tags"])
    if "notas" in data:
        contacto.notas = data["notas"]
    
    db.commit()
    db.refresh(contacto)
    
    return contacto.to_dict()


@router.delete("/{contacto_id}")
async def eliminar_contacto(
    contacto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Eliminar un contacto"""
    contacto = db.query(Contacto).filter(Contacto.id == contacto_id).first()
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    db.delete(contacto)
    db.commit()
    
    return {"status": "ok"}


@router.post("/sync")
async def sincronizar_contactos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Sincronizar contactos desde WAHA/Evolution"""
    from whatsapp_service import whatsapp_service
    from database import set_config
    
    result = await whatsapp_service.get_contacts()
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Error de sincronización"))
    
    contacts = result["contacts"]
    nuevos = 0
    actualizados = 0
    
    for contact_data in contacts:
        telefono_raw = contact_data.get("telefono", "").strip()
        if not telefono_raw:
            continue
        
        # Normalizar teléfono
        telefono = normalizar_telefono(telefono_raw)
        nombre = contact_data.get("nombre", "").strip() or None
        foto_url = contact_data.get("foto_url")
        
        # Buscar existente (con normalización)
        existente = buscar_contacto_por_telefono(db, telefono)
        
        if existente:
            # Actualizar nombre si viene y el existente no tiene o tiene "Sin nombre"
            if nombre and (not existente.nombre or existente.nombre == "Sin nombre"):
                existente.nombre = nombre
            if foto_url:
                existente.foto_url = foto_url
            actualizados += 1
        else:
            # Crear nuevo
            nuevo = Contacto(
                telefono=telefono,
                nombre=nombre,
                foto_url=foto_url,
                estado="activo",
                origen="whatsapp_sync"
            )
            db.add(nuevo)
            nuevos += 1
    
    db.commit()
    
    # Guardar timestamp de última sincronización
    set_config("whatsapp_last_sync", datetime.utcnow().isoformat())
    
    return {
        "status": "ok",
        "total": len(contacts),
        "nuevos": nuevos,
        "actualizados": actualizados
    }


@router.post("/limpiar-duplicados")
async def limpiar_duplicados(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Fusionar contactos duplicados por teléfono normalizado"""
    contactos = db.query(Contacto).all()
    
    # Agrupar por teléfono normalizado
    grupos = {}
    
    for c in contactos:
        tel_norm = normalizar_telefono(c.telefono)
        if tel_norm not in grupos:
            grupos[tel_norm] = []
        grupos[tel_norm].append(c)
    
    fusionados = 0
    eliminados = 0
    
    for tel_norm, lista in grupos.items():
        if len(lista) <= 1:
            continue
        
        # Ordenar: priorizar el que tiene nombre, más mensajes, más antiguo
        lista.sort(key=lambda x: (
            x.nombre is not None and x.nombre != "Sin nombre",
            x.total_mensajes or 0,
            x.created_at or datetime.min
        ), reverse=True)
        
        # El primero es el principal
        principal = lista[0]
        principal.telefono = tel_norm  # Normalizar
        
        # Fusionar datos de los demás
        for duplicado in lista[1:]:
            # Tomar nombre si el principal no tiene
            if (not principal.nombre or principal.nombre == "Sin nombre") and duplicado.nombre:
                principal.nombre = duplicado.nombre
            # Sumar mensajes
            principal.total_mensajes = (principal.total_mensajes or 0) + (duplicado.total_mensajes or 0)
            # Tomar fecha más antigua
            if duplicado.primer_mensaje and (not principal.primer_mensaje or duplicado.primer_mensaje < principal.primer_mensaje):
                principal.primer_mensaje = duplicado.primer_mensaje
            # Tomar fecha más reciente
            if duplicado.ultimo_mensaje and (not principal.ultimo_mensaje or duplicado.ultimo_mensaje > principal.ultimo_mensaje):
                principal.ultimo_mensaje = duplicado.ultimo_mensaje
            
            db.delete(duplicado)
            eliminados += 1
        
        fusionados += 1
    
    db.commit()
    
    return {
        "status": "ok",
        "grupos_fusionados": fusionados,
        "contactos_eliminados": eliminados
    }


@router.post("/verificar-activos")
async def iniciar_verificacion_activos(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Iniciar verificación de contactos en background.
    Retorna el ID del job para consultar progreso.
    """
    from models import BackgroundJob
    from job_engine import procesar_job
    
    # Verificar si ya hay un job en proceso
    job_activo = db.query(BackgroundJob).filter(
        BackgroundJob.tipo == "verificar_contactos",
        BackgroundJob.estado.in_(["pendiente", "procesando"])
    ).first()
    
    if job_activo:
        return {
            "status": "en_proceso",
            "job_id": job_activo.id,
            "message": "Ya hay una verificación en proceso",
            "job": job_activo.to_dict()
        }
    
    # Contar contactos a verificar (todos los activos)
    total = db.query(Contacto).filter(Contacto.estado == "activo").count()
    
    if total == 0:
        return {"status": "ok", "message": "No hay contactos para verificar", "total": 0}
    
    # Crear job
    job = BackgroundJob(
        tipo="verificar_contactos",
        estado="pendiente",
        total=total,
        procesados=0,
        exitosos=0,
        fallidos=0,
        mensaje="Iniciando verificación..."
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Iniciar tarea en background usando el motor unificado
    background_tasks.add_task(procesar_job, job.id)
    
    return {
        "status": "iniciado",
        "job_id": job.id,
        "total": total,
        "message": f"Verificación iniciada para {total} contactos"
    }


@router.get("/verificar-activos/estado")
async def obtener_estado_verificacion(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtener estado del job de verificación activo o el último completado"""
    from models import BackgroundJob
    
    # Buscar job activo o el último
    job = db.query(BackgroundJob).filter(
        BackgroundJob.tipo == "verificar_contactos"
    ).order_by(BackgroundJob.created_at.desc()).first()
    
    if not job:
        return {"status": "sin_job", "message": "No hay verificaciones"}
    
    return {
        "status": "ok",
        "job": job.to_dict()
    }


@router.get("/export/csv")
async def exportar_contactos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Exportar contactos a CSV"""
    from fastapi.responses import StreamingResponse
    
    contactos = db.query(Contacto).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["telefono", "nombre", "email", "estado", "tags", "ultimo_mensaje", "total_mensajes"])
    
    # Data
    for c in contactos:
        writer.writerow([
            c.telefono,
            c.nombre or "",
            c.email or "",
            c.estado,
            c.tags or "[]",
            c.ultimo_mensaje.isoformat() if c.ultimo_mensaje else "",
            c.total_mensajes
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contactos.csv"}
    )


def guardar_contacto_mensaje(telefono: str, nombre: str = None, db: Session = None):
    """
    Guardar o actualizar contacto cuando llega un mensaje.
    Llamar desde el webhook.
    """
    if db is None:
        from models import SessionLocal
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        # Normalizar teléfono
        telefono_norm = normalizar_telefono(telefono)
        nombre_limpio = nombre.strip() if nombre else None
        
        # Buscar con normalización
        contacto = buscar_contacto_por_telefono(db, telefono_norm)
        
        if contacto:
            # Actualizar
            contacto.ultimo_mensaje = datetime.utcnow()
            contacto.total_mensajes = (contacto.total_mensajes or 0) + 1
            if nombre_limpio and (not contacto.nombre or contacto.nombre == "Sin nombre"):
                contacto.nombre = nombre_limpio
            # Reactivar si estaba inactivo
            if contacto.estado == "inactivo":
                contacto.estado = "activo"
        else:
            # Crear nuevo
            contacto = Contacto(
                telefono=telefono_norm,
                nombre=nombre_limpio,
                primer_mensaje=datetime.utcnow(),
                ultimo_mensaje=datetime.utcnow(),
                total_mensajes=1,
                estado="activo",
                origen="mensaje"
            )
            db.add(contacto)
        
        db.commit()
        return contacto
    finally:
        if should_close:
            db.close()
