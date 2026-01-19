"""
Worker - Procesa jobs de la cola Redis
Se ejecuta como servicio separado del API
"""
import asyncio
import logging
import signal
import sys
from datetime import datetime

from redis_queue import obtener_siguiente_job_bloqueante, health_check, encolar_job
from job_engine import JOB_PROCESSORS
from models import SessionLocal, BackgroundJob

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

running = True


def signal_handler(signum, frame):
    """Maneja señales de terminación para graceful shutdown"""
    global running
    logger.info(f"Señal {signum} recibida, deteniendo worker...")
    running = False


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


async def procesar_job(job_data: dict):
    """Procesa un job de la cola"""
    job_id = job_data.get("job_id")
    tipo = job_data.get("tipo")
    
    if not job_id or not tipo:
        logger.error(f"Job inválido: {job_data}")
        return
    
    db = SessionLocal()
    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} no encontrado en DB")
            return
        
        if job.estado not in ["pendiente", "procesando"]:
            logger.warning(f"Job {job_id} ya no está pendiente (estado: {job.estado})")
            return
        
        processor = JOB_PROCESSORS.get(tipo)
        if not processor:
            job.estado = "error"
            job.mensaje = f"Tipo de job desconocido: {tipo}"
            job.completed_at = datetime.utcnow()
            db.commit()
            logger.error(f"Tipo de job desconocido: {tipo}")
            return
        
        job.estado = "procesando"
        job.started_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Procesando job {job_id} ({tipo})")
        
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
            job.mensaje = str(e)[:500]
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


async def worker_loop():
    """Loop principal del worker"""
    logger.info("Worker iniciado, esperando jobs...")
    
    while running:
        try:
            job_data = obtener_siguiente_job_bloqueante(timeout=5)
            
            if job_data:
                await procesar_job(job_data)
            
        except Exception as e:
            logger.error(f"Error en worker loop: {e}")
            await asyncio.sleep(1)
    
    logger.info("Worker detenido")


def recuperar_jobs_huerfanos():
    """Re-encola jobs que quedaron en 'procesando' (huérfanos por restart)"""
    db = SessionLocal()
    try:
        jobs_huerfanos = db.query(BackgroundJob).filter(
            BackgroundJob.estado == "procesando"
        ).all()
        
        for job in jobs_huerfanos:
            logger.warning(f"Recuperando job huérfano {job.id} ({job.tipo})")
            job.estado = "pendiente"
            job.mensaje = "Re-encolado por restart del worker"
            db.commit()
            encolar_job(job.id, job.tipo)
        
        if jobs_huerfanos:
            logger.info(f"Re-encolados {len(jobs_huerfanos)} jobs huérfanos")
    finally:
        db.close()


def main():
    """Punto de entrada del worker"""
    logger.info("Iniciando worker...")
    
    if not health_check():
        logger.error("No se puede conectar a Redis")
        sys.exit(1)
    
    logger.info("Conexión a Redis OK")
    
    recuperar_jobs_huerfanos()
    
    try:
        asyncio.run(worker_loop())
    except KeyboardInterrupt:
        logger.info("Worker interrumpido por usuario")
    
    logger.info("Worker finalizado")


if __name__ == "__main__":
    main()
