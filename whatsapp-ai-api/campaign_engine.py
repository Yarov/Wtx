"""
Motor de campañas - Procesa envío de mensajes en background
"""
import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session

from models import SessionLocal, Campana, CampanaDestinatario, Contacto
from whatsapp_service import whatsapp_service
from api.routers.campanas import reemplazar_variables

logger = logging.getLogger(__name__)


async def procesar_campanas():
    """
    Procesa campañas activas y envía mensajes.
    Debe ser llamado periódicamente (cada 5-10 segundos).
    """
    db = SessionLocal()
    try:
        # Buscar campañas en estado "enviando"
        campanas = db.query(Campana).filter(Campana.estado == "enviando").all()
        
        for campana in campanas:
            await procesar_campana(campana, db)
            
    except Exception as e:
        logger.error(f"Error procesando campañas: {e}")
    finally:
        db.close()


async def procesar_campana(campana: Campana, db: Session):
    """Procesa una campaña individual"""
    try:
        # Verificar si es momento de enviar (respetando velocidad)
        if campana.ultimo_envio:
            segundos_desde_ultimo = (datetime.utcnow() - campana.ultimo_envio).total_seconds()
            if segundos_desde_ultimo < campana.velocidad:
                return  # Aún no es momento de enviar
        
        # Obtener siguiente destinatario pendiente
        destinatario = db.query(CampanaDestinatario).filter(
            CampanaDestinatario.campana_id == campana.id,
            CampanaDestinatario.estado == "pendiente"
        ).first()
        
        if not destinatario:
            # No hay más pendientes, marcar como completada
            campana.estado = "completada"
            campana.completada_at = datetime.utcnow()
            db.commit()
            logger.info(f"Campana '{campana.nombre}' completada")
            return
        
        # Obtener contacto
        contacto = db.query(Contacto).filter(Contacto.id == destinatario.contacto_id).first()
        if not contacto:
            destinatario.estado = "fallido"
            destinatario.error = "Contacto no encontrado"
            db.commit()
            return
        
        # Preparar mensaje con variables
        mensaje = reemplazar_variables(campana.mensaje, contacto)
        
        # Enviar mensaje
        logger.info(f"Enviando a {contacto.telefono}...")
        result = await whatsapp_service.send_message(contacto.telefono, mensaje)
        
        # Actualizar estado
        if result["success"]:
            destinatario.estado = "enviado"
            destinatario.enviado_at = datetime.utcnow()
            campana.enviados = (campana.enviados or 0) + 1
            logger.info(f"Enviado a {contacto.telefono}")
        else:
            destinatario.estado = "fallido"
            destinatario.error = result.get("error", "Error desconocido")
            campana.fallidos = (campana.fallidos or 0) + 1
            logger.warning(f"Fallo envio a {contacto.telefono}: {destinatario.error}")
        
        campana.ultimo_envio = datetime.utcnow()
        db.commit()
        
    except Exception as e:
        logger.error(f"Error procesando campaña {campana.id}: {e}")


async def marcar_respondido(telefono: str):
    """
    Marcar como respondido cuando un contacto responde.
    Llamar desde el webhook cuando llega un mensaje.
    """
    db = SessionLocal()
    try:
        # Buscar contacto
        contacto = db.query(Contacto).filter(Contacto.telefono == telefono).first()
        if not contacto:
            return
        
        # Buscar destinatarios de campañas activas que hayan sido enviados
        destinatarios = db.query(CampanaDestinatario).filter(
            CampanaDestinatario.contacto_id == contacto.id,
            CampanaDestinatario.estado == "enviado"
        ).all()
        
        for dest in destinatarios:
            dest.estado = "respondido"
            dest.respondido_at = datetime.utcnow()
            
            # Actualizar contador de la campaña
            campana = db.query(Campana).filter(Campana.id == dest.campana_id).first()
            if campana:
                campana.respondidos = (campana.respondidos or 0) + 1
        
        db.commit()
        
    except Exception as e:
        logger.error(f"Error marcando respondido: {e}")
    finally:
        db.close()


async def campaign_worker():
    """Worker que corre en background procesando campañas"""
    logger.info("Campaign worker iniciado")
    while True:
        try:
            await procesar_campanas()
        except Exception as e:
            logger.error(f"Error en campaign worker: {e}")
        await asyncio.sleep(5)  # Esperar 5 segundos entre ciclos
