"""
Contacts Router - CRM contact management, sync and human mode control
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime, timedelta
from typing import Optional
import json
import csv
import io

from models import get_db, Contacto, Perfil
from api.routers.auth import get_current_user
from api.routers.perfiles import get_current_perfil
from auth import get_current_admin_user
from models import Usuario

router = APIRouter(
    prefix="/contactos", 
    tags=["Contacts"],
    responses={401: {"description": "Not authenticated"}}
)


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


def buscar_contacto_por_telefono(db: Session, telefono: str, usuario_id: int = None):
    """Busca contacto por teléfono normalizado. Tries with and without + prefix."""
    telefono_norm = normalizar_telefono(telefono)
    # Also try without + prefix (some contacts stored without it)
    telefono_sin_plus = telefono_norm.lstrip("+")

    from sqlalchemy import or_
    query = db.query(Contacto).filter(
        or_(Contacto.telefono == telefono_norm, Contacto.telefono == telefono_sin_plus)
    )
    if usuario_id is not None:
        query = query.filter(Contacto.usuario_id == usuario_id)

    return query.first()


@router.get("", summary="List contacts", description="Retrieve contacts with optional filters by status, search term, tag or inactivity days. Supports pagination.")
async def listar_contactos(
    estado: Optional[str] = None,
    buscar: Optional[str] = None,
    tag: Optional[str] = None,
    dias_inactivo: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    query = db.query(Contacto).filter(
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    )

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


@router.get("/stats", summary="Get contact statistics", description="Get contact metrics: total, active, inactive, blocked and 30-day inactive count.")
async def stats_contactos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    base = db.query(Contacto).filter(
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    )
    total = base.count()
    activos = base.filter(Contacto.estado == "activo").count()
    inactivos = base.filter(Contacto.estado == "inactivo").count()
    bloqueados = base.filter(Contacto.estado == "bloqueado").count()

    # Inactivos últimos 30 días
    fecha_30_dias = datetime.utcnow() - timedelta(days=30)
    sin_actividad_30d = base.filter(
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


@router.delete("/all", summary="Delete all contacts", description="Permanently delete ALL contacts. Requires admin privileges and explicit confirmation. Use with caution - this action cannot be undone.")
async def eliminar_todos_contactos(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    # Require explicit confirmation
    if not data.get("confirm"):
        raise HTTPException(
            status_code=400,
            detail="Debes confirmar la acción enviando confirm: true"
        )

    # Count before delete
    total = db.query(Contacto).filter(
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).count()

    if total == 0:
        return {"message": "No hay contactos para eliminar", "deleted": 0}

    # Delete all contacts for this user/profile
    db.query(Contacto).filter(
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).delete()
    db.commit()
    
    return {
        "message": f"Se eliminaron {total} contactos exitosamente",
        "deleted": total
    }


@router.get("/{contacto_id}", summary="Get contact by ID", description="Retrieve detailed information for a specific contact.")
async def obtener_contacto(
    contacto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    contacto = db.query(Contacto).filter(
        Contacto.id == contacto_id,
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).first()
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    return contacto.to_dict()


@router.post("", summary="Create contact", description="Manually create a new contact with phone, name, email, tags and notes.")
async def crear_contacto(
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    telefono = data.get("telefono", "").strip()
    if not telefono:
        raise HTTPException(status_code=400, detail="Teléfono es requerido")

    # Verificar si ya existe for this user/profile
    existente = db.query(Contacto).filter(
        Contacto.telefono == telefono,
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="El contacto ya existe")

    contacto = Contacto(
        telefono=telefono,
        nombre=data.get("nombre"),
        email=data.get("email"),
        estado="activo",
        tags=json.dumps(data.get("tags", [])),
        notas=data.get("notas"),
        origen="manual",
        usuario_id=current_user.id,
        perfil_id=perfil.id,
    )
    
    db.add(contacto)
    db.commit()
    db.refresh(contacto)
    
    return contacto.to_dict()


@router.put("/{contacto_id}", summary="Update contact", description="Update contact details like name, email, status, tags or notes.")
async def actualizar_contacto(
    contacto_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    contacto = db.query(Contacto).filter(
        Contacto.id == contacto_id,
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).first()
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


@router.delete("/{contacto_id}", summary="Delete contact", description="Permanently remove a contact from the database.")
async def eliminar_contacto(
    contacto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    contacto = db.query(Contacto).filter(
        Contacto.id == contacto_id,
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).first()
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    db.delete(contacto)
    db.commit()

    return {"status": "ok"}


@router.post("/sync", summary="Sync contacts from WhatsApp", description="Import and sync contacts from WAHA or Evolution API. Creates new contacts and updates existing ones.")
async def sincronizar_contactos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from whatsapp_service import whatsapp_service
    from database import set_config

    result = await whatsapp_service.get_contacts(session=f"perfil_{perfil.id}")
    
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
        
        # Buscar existente (con normalización, scoped to user/profile)
        existente = db.query(Contacto).filter(
            Contacto.telefono == normalizar_telefono(telefono),
            Contacto.usuario_id == current_user.id,
            Contacto.perfil_id == perfil.id,
        ).first()

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
                origen="whatsapp_sync",
                usuario_id=current_user.id,
                perfil_id=perfil.id,
            )
            db.add(nuevo)
            nuevos += 1
    
    db.commit()
    
    # Guardar timestamp de última sincronización
    set_config("whatsapp_last_sync", datetime.utcnow().isoformat(), usuario_id=current_user.id)
    
    return {
        "status": "ok",
        "total": len(contacts),
        "nuevos": nuevos,
        "actualizados": actualizados
    }


@router.post("/limpiar-duplicados", summary="Merge duplicates", description="Find and merge duplicate contacts by normalized phone number.")
async def limpiar_duplicados(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    # Process in batches of 1000 to avoid loading entire table at once
    batch_size = 1000
    offset = 0
    grupos = {}

    while True:
        batch = (
            db.query(Contacto)
            .filter(
                Contacto.usuario_id == current_user.id,
                Contacto.perfil_id == perfil.id,
            )
            .order_by(Contacto.id)
            .offset(offset)
            .limit(batch_size)
            .all()
        )
        if not batch:
            break
        for c in batch:
            tel_norm = normalizar_telefono(c.telefono)
            if tel_norm not in grupos:
                grupos[tel_norm] = []
            grupos[tel_norm].append(c)
        offset += batch_size

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


@router.post("/verificar-activos", summary="Start contact verification", description="Start a background job to verify which contacts are still active on WhatsApp.")
async def iniciar_verificacion_activos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from models import BackgroundJob
    from redis_queue import encolar_job

    # Verificar si ya hay un job en proceso (para este perfil)
    job_activo = db.query(BackgroundJob).filter(
        BackgroundJob.tipo == "verificar_contactos",
        BackgroundJob.usuario_id == current_user.id,
        BackgroundJob.perfil_id == perfil.id,
        BackgroundJob.estado.in_(["pendiente", "procesando"])
    ).first()

    if job_activo:
        return {
            "status": "en_proceso",
            "job_id": job_activo.id,
            "message": "Ya hay una verificación en proceso",
            "job": job_activo.to_dict()
        }

    # Contar contactos a verificar (todos los activos del usuario/perfil)
    total = db.query(Contacto).filter(
        Contacto.estado == "activo",
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).count()

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
        mensaje="En cola, esperando worker...",
        usuario_id=current_user.id,
        perfil_id=perfil.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Encolar en Redis para que el worker lo procese
    encolar_job(job.id, "verificar_contactos")
    
    return {
        "status": "iniciado",
        "job_id": job.id,
        "total": total,
        "message": f"Verificación encolada para {total} contactos"
    }


@router.get("/verificar-activos/estado", summary="Get verification status", description="Check the status of the active or last completed contact verification job.")
async def obtener_estado_verificacion(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from models import BackgroundJob

    # Buscar job activo o el último — del usuario y perfil actual
    job = db.query(BackgroundJob).filter(
        BackgroundJob.tipo == "verificar_contactos",
        BackgroundJob.usuario_id == current_user.id,
        BackgroundJob.perfil_id == perfil.id,
    ).order_by(BackgroundJob.created_at.desc()).first()
    
    if not job:
        return {"status": "sin_job", "message": "No hay verificaciones"}
    
    return {
        "status": "ok",
        "job": job.to_dict()
    }


@router.get("/export/csv", summary="Export contacts to CSV", description="Download all contacts as a CSV file.")
async def exportar_contactos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from fastapi.responses import StreamingResponse

    def generate_csv():
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(["telefono", "nombre", "email", "estado", "tags", "ultimo_mensaje", "total_mensajes"])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        # Stream data in batches
        batch_size = 500
        offset = 0
        while True:
            batch = (
                db.query(Contacto)
                .filter(
                    Contacto.usuario_id == current_user.id,
                    Contacto.perfil_id == perfil.id,
                )
                .order_by(Contacto.id)
                .offset(offset)
                .limit(batch_size)
                .all()
            )
            if not batch:
                break
            for c in batch:
                writer.writerow([
                    c.telefono,
                    c.nombre or "",
                    c.email or "",
                    c.estado,
                    c.tags or "[]",
                    c.ultimo_mensaje.isoformat() if c.ultimo_mensaje else "",
                    c.total_mensajes
                ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            offset += batch_size

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contactos.csv"}
    )


def guardar_contacto_mensaje(telefono: str, nombre: str = None, db: Session = None, usuario_id: int = 1, perfil_id: int = None):
    """
    Guardar o actualizar contacto cuando llega un mensaje.
    Llamar desde el webhook.
    """
    # Ignorar grupos (defensa adicional)
    if "@g.us" in telefono or not telefono:
        return None

    if db is None:
        from models import SessionLocal
        db = SessionLocal()
        should_close = True
    else:
        should_close = False

    try:
        # Resolver perfil activo si no se proveyó (background sin header HTTP)
        if perfil_id is None:
            from api.routers.perfiles import get_perfil_activo_id
            perfil_id = get_perfil_activo_id(db, usuario_id)

        # Normalizar teléfono
        telefono_norm = normalizar_telefono(telefono)
        nombre_limpio = nombre.strip() if nombre else None

        # Buscar con normalización, scoped to usuario
        contacto = db.query(Contacto).filter(
            Contacto.telefono == telefono_norm,
            Contacto.usuario_id == usuario_id
        ).first()

        if contacto:
            # Actualizar
            contacto.ultimo_mensaje = datetime.utcnow()
            contacto.total_mensajes = (contacto.total_mensajes or 0) + 1
            if nombre_limpio and (not contacto.nombre or contacto.nombre == "Sin nombre"):
                contacto.nombre = nombre_limpio
            # Reactivar si estaba inactivo
            if contacto.estado == "inactivo":
                contacto.estado = "activo"
            # Backfill perfil_id si el contacto aún no lo tiene
            if contacto.perfil_id is None and perfil_id is not None:
                contacto.perfil_id = perfil_id
        else:
            # Crear nuevo
            contacto = Contacto(
                telefono=telefono_norm,
                nombre=nombre_limpio,
                primer_mensaje=datetime.utcnow(),
                ultimo_mensaje=datetime.utcnow(),
                total_mensajes=1,
                estado="activo",
                origen="mensaje",
                usuario_id=usuario_id,
                perfil_id=perfil_id,
            )
            db.add(contacto)
        
        db.commit()
        return contacto
    finally:
        if should_close:
            db.close()


# ==================== MODO HUMANO ====================

@router.get("/modo-humano", summary="List human mode contacts", description="Get all contacts currently in human takeover mode where AI is paused.")
async def listar_contactos_modo_humano(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    contactos = db.query(Contacto).filter(
        Contacto.modo_humano == True,
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).limit(200).all()
    return [c.to_dict() for c in contactos]


@router.post("/{contacto_id}/modo-humano", summary="Enable human mode", description="Pause AI responses for a contact so a human can take over the conversation.")
async def activar_modo_humano(
    contacto_id: int,
    data: dict = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    contacto = db.query(Contacto).filter(
        Contacto.id == contacto_id,
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).first()
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    razon = data.get("razon", "Activado manualmente") if data else "Activado manualmente"
    
    contacto.modo_humano = True
    contacto.modo_humano_desde = datetime.utcnow()
    contacto.modo_humano_razon = razon
    db.commit()
    
    return {"status": "ok", "contacto": contacto.to_dict()}


@router.delete("/{contacto_id}/modo-humano", summary="Disable human mode", description="Re-enable AI responses for a contact after human takeover.")
async def desactivar_modo_humano(
    contacto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    contacto = db.query(Contacto).filter(
        Contacto.id == contacto_id,
        Contacto.usuario_id == current_user.id,
        Contacto.perfil_id == perfil.id,
    ).first()
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    contacto.modo_humano = False
    contacto.modo_humano_desde = None
    contacto.modo_humano_razon = None
    db.commit()
    
    return {"status": "ok", "contacto": contacto.to_dict()}


def activar_modo_humano_por_telefono(telefono: str, razon: str, db: Session = None, usuario_id: int = None):
    """Función auxiliar para activar modo humano por teléfono (usado por el tool de IA)"""
    from models import SessionLocal

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        telefono_norm = normalizar_telefono(telefono)
        contacto = buscar_contacto_por_telefono(db, telefono_norm, usuario_id=usuario_id)

        # Fallback: try exact match if normalization didn't find it (e.g. test numbers)
        if not contacto:
            contacto = db.query(Contacto).filter(
                Contacto.telefono == telefono,
                Contacto.usuario_id == usuario_id,
            ).first()

        if contacto:
            contacto.modo_humano = True
            contacto.modo_humano_desde = datetime.utcnow()
            contacto.modo_humano_razon = razon
            db.commit()
            return True
        return False
    finally:
        if should_close:
            db.close()


def verificar_modo_humano(telefono: str, db: Session = None, usuario_id: int = None) -> bool:
    """Verificar si un contacto está en modo humano"""
    from models import SessionLocal
    from database import get_config

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        telefono_norm = normalizar_telefono(telefono)
        contacto = buscar_contacto_por_telefono(db, telefono_norm, usuario_id=usuario_id)
        
        if not contacto or not contacto.modo_humano:
            return False
        
        # Verificar si expiró por tiempo
        auto_expire_hours = int(get_config("human_mode_expire_hours", "0"))
        if auto_expire_hours > 0 and contacto.modo_humano_desde:
            tiempo_limite = contacto.modo_humano_desde + timedelta(hours=auto_expire_hours)
            if datetime.utcnow() > tiempo_limite:
                # Expiró, desactivar
                contacto.modo_humano = False
                contacto.modo_humano_desde = None
                contacto.modo_humano_razon = None
                db.commit()
                return False
        
        return True
    finally:
        if should_close:
            db.close()


def desactivar_modo_humano_por_telefono(telefono: str, db: Session = None, usuario_id: int = None) -> bool:
    """Desactivar modo humano por teléfono (usado por comando #reactivar)"""
    from models import SessionLocal

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        telefono_norm = normalizar_telefono(telefono)
        contacto = buscar_contacto_por_telefono(db, telefono_norm, usuario_id=usuario_id)
        
        if contacto and contacto.modo_humano:
            contacto.modo_humano = False
            contacto.modo_humano_desde = None
            contacto.modo_humano_razon = None
            db.commit()
            return True
        return False
    finally:
        if should_close:
            db.close()
