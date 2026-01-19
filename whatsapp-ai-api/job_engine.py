"""
Procesadores de Jobs - Lógica de procesamiento para cada tipo de job
El worker.py usa estos procesadores via JOB_PROCESSORS
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Callable, Dict

from sqlalchemy import or_
from models import BackgroundJob, Campana, CampanaDestinatario, Contacto
from whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)

# Días antes de re-verificar un contacto
DIAS_REVERIFICACION = 7


async def procesar_verificacion_contactos(job: BackgroundJob, db):
    """Verifica qué contactos siguen activos en WhatsApp"""
    fecha_limite = datetime.utcnow() - timedelta(days=DIAS_REVERIFICACION)
    
    # Solo verificar activos que nunca fueron verificados o hace más de X días
    contactos = db.query(Contacto).filter(
        Contacto.estado == "activo",
        or_(
            Contacto.ultima_verificacion.is_(None),
            Contacto.ultima_verificacion < fecha_limite
        )
    ).all()
    
    job.total = len(contactos)
    job.mensaje = "Verificando contactos..."
    db.commit()
    
    for i, contacto in enumerate(contactos):
        try:
            result = await whatsapp_service.check_number_exists(contacto.telefono)
            
            contacto.ultima_verificacion = datetime.utcnow()
            
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
    """Procesa envío de una campaña masiva"""
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


# Registro de procesadores - usado por worker.py
JOB_PROCESSORS: Dict[str, Callable] = {
    "verificar_contactos": procesar_verificacion_contactos,
    "sync_contactos": procesar_sync_contactos,
    "campana_masiva": procesar_campana_masiva,
}
