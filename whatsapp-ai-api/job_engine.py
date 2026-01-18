"""
Motor de Jobs - Sistema unificado para procesar tareas en background
Soporta: verificación de contactos, campañas, sincronización, etc.
"""
import asyncio
import logging
from datetime import datetime
from typing import Callable, Dict, Any

from models import SessionLocal, BackgroundJob, Campana, CampanaDestinatario, Contacto
from whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)


# ============================================
# PROCESADORES DE JOBS
# ============================================

async def procesar_verificacion_contactos(job: BackgroundJob, db):
    """Verifica qué contactos siguen activos en WhatsApp"""
    contactos = db.query(Contacto).filter(Contacto.estado == "activo").all()
    job.total = len(contactos)
    job.mensaje = "Verificando contactos..."
    db.commit()
    
    for i, contacto in enumerate(contactos):
        try:
            result = await whatsapp_service.check_number_exists(contacto.telefono)
            
            if result.get("exists"):
                job.exitosos += 1
            else:
                contacto.estado = "inactivo"
                job.fallidos += 1
            
            job.procesados = i + 1
            job.mensaje = f"Verificando {i + 1} de {job.total}..."
            db.commit()
            
            await asyncio.sleep(0.5)
            
        except Exception as e:
            logger.error(f"Error verificando {contacto.telefono}: {e}")
            job.fallidos += 1
            job.procesados = i + 1
            db.commit()
    
    job.mensaje = f"Completado: {job.exitosos} activos, {job.fallidos} inactivos"


async def procesar_sync_contactos(job: BackgroundJob, db):
    """Sincroniza contactos desde WhatsApp"""
    job.mensaje = "Obteniendo contactos de WhatsApp..."
    db.commit()
    
    try:
        contactos_wa = await whatsapp_service.get_contacts()
        job.total = len(contactos_wa)
        
        nuevos = 0
        actualizados = 0
        
        for i, contacto_data in enumerate(contactos_wa):
            telefono = contacto_data.get("telefono")
            nombre = contacto_data.get("nombre", "")
            
            existente = db.query(Contacto).filter(Contacto.telefono == telefono).first()
            
            if existente:
                if nombre and not existente.nombre:
                    existente.nombre = nombre
                    actualizados += 1
            else:
                nuevo = Contacto(telefono=telefono, nombre=nombre, estado="activo")
                db.add(nuevo)
                nuevos += 1
            
            job.procesados = i + 1
            job.exitosos = nuevos
            job.mensaje = f"Procesando {i + 1} de {job.total}..."
            db.commit()
        
        job.mensaje = f"Completado: {nuevos} nuevos, {actualizados} actualizados"
        
    except Exception as e:
        raise Exception(f"Error sincronizando: {str(e)}")


async def procesar_campana_masiva(job: BackgroundJob, db):
    """Procesa envío de una campaña (alternativa al worker de campañas)"""
    campana_id = int(job.mensaje.split(":")[1]) if ":" in (job.mensaje or "") else None
    
    if not campana_id:
        raise Exception("ID de campaña no especificado")
    
    campana = db.query(Campana).filter(Campana.id == campana_id).first()
    if not campana:
        raise Exception("Campaña no encontrada")
    
    destinatarios = db.query(CampanaDestinatario).filter(
        CampanaDestinatario.campana_id == campana_id,
        CampanaDestinatario.estado == "pendiente"
    ).all()
    
    job.total = len(destinatarios)
    
    for i, dest in enumerate(destinatarios):
        contacto = db.query(Contacto).filter(Contacto.id == dest.contacto_id).first()
        if not contacto:
            dest.estado = "fallido"
            dest.error = "Contacto no encontrado"
            job.fallidos += 1
            continue
        
        # Reemplazar variables
        mensaje = campana.mensaje
        mensaje = mensaje.replace("{nombre}", contacto.nombre or "Cliente")
        mensaje = mensaje.replace("{telefono}", contacto.telefono)
        
        result = await whatsapp_service.send_message(contacto.telefono, mensaje)
        
        if result.get("success"):
            dest.estado = "enviado"
            dest.enviado_at = datetime.utcnow()
            job.exitosos += 1
            campana.enviados = (campana.enviados or 0) + 1
        else:
            dest.estado = "fallido"
            dest.error = result.get("error", "Error desconocido")
            job.fallidos += 1
            campana.fallidos = (campana.fallidos or 0) + 1
        
        job.procesados = i + 1
        job.mensaje = f"Enviando {i + 1} de {job.total}..."
        campana.ultimo_envio = datetime.utcnow()
        db.commit()
        
        await asyncio.sleep(campana.velocidad)
    
    campana.estado = "completada"
    campana.completada_at = datetime.utcnow()
    job.mensaje = f"Campaña completada: {job.exitosos} enviados, {job.fallidos} fallidos"


# ============================================
# REGISTRO DE PROCESADORES
# ============================================

JOB_PROCESSORS: Dict[str, Callable] = {
    "verificar_contactos": procesar_verificacion_contactos,
    "sync_contactos": procesar_sync_contactos,
    "campana_masiva": procesar_campana_masiva,
}


# ============================================
# MOTOR PRINCIPAL
# ============================================

async def procesar_job(job_id: int):
    """Procesa un job específico"""
    db = SessionLocal()
    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} no encontrado")
            return
        
        processor = JOB_PROCESSORS.get(job.tipo)
        if not processor:
            job.estado = "error"
            job.mensaje = f"Tipo de job desconocido: {job.tipo}"
            db.commit()
            return
        
        job.estado = "procesando"
        job.started_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Iniciando job {job_id} ({job.tipo})")
        
        await processor(job, db)
        
        job.estado = "completado"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Job {job_id} completado: {job.mensaje}")
        
    except Exception as e:
        logger.error(f"Error en job {job_id}: {e}")
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if job:
            job.estado = "error"
            job.mensaje = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


async def procesar_jobs_pendientes():
    """Procesa todos los jobs pendientes (para worker en loop)"""
    db = SessionLocal()
    try:
        jobs = db.query(BackgroundJob).filter(
            BackgroundJob.estado == "pendiente"
        ).order_by(BackgroundJob.created_at).all()
        
        for job in jobs:
            await procesar_job(job.id)
            
    except Exception as e:
        logger.error(f"Error procesando jobs pendientes: {e}")
    finally:
        db.close()


async def job_worker():
    """Worker principal que procesa jobs en background"""
    logger.info("Job worker iniciado")
    while True:
        try:
            await procesar_jobs_pendientes()
        except Exception as e:
            logger.error(f"Error en job worker: {e}")
        await asyncio.sleep(5)


# ============================================
# HELPERS PARA CREAR JOBS
# ============================================

def crear_job(tipo: str, total: int = 0, mensaje: str = "") -> BackgroundJob:
    """Crea un nuevo job y lo retorna"""
    db = SessionLocal()
    try:
        job = BackgroundJob(
            tipo=tipo,
            estado="pendiente",
            total=total,
            procesados=0,
            exitosos=0,
            fallidos=0,
            mensaje=mensaje or f"Iniciando {tipo}..."
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job
    finally:
        db.close()


def obtener_job_activo(tipo: str) -> BackgroundJob:
    """Obtiene el job activo de un tipo específico"""
    db = SessionLocal()
    try:
        return db.query(BackgroundJob).filter(
            BackgroundJob.tipo == tipo,
            BackgroundJob.estado.in_(["pendiente", "procesando"])
        ).first()
    finally:
        db.close()


def obtener_ultimo_job(tipo: str) -> BackgroundJob:
    """Obtiene el último job de un tipo específico"""
    db = SessionLocal()
    try:
        return db.query(BackgroundJob).filter(
            BackgroundJob.tipo == tipo
        ).order_by(BackgroundJob.created_at.desc()).first()
    finally:
        db.close()
