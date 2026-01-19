"""
Redis Queue - Sistema de cola para jobs en background
"""
import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QUEUE_NAME = "jobs_queue"

_redis_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    """Obtiene conexión a Redis (singleton)"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


def encolar_job(job_id: int, tipo: str, datos: Dict[str, Any] = None) -> bool:
    """Encola un job para ser procesado por el worker"""
    try:
        r = get_redis()
        job_data = {
            "job_id": job_id,
            "tipo": tipo,
            "datos": datos or {},
            "encolado_at": datetime.utcnow().isoformat()
        }
        r.rpush(QUEUE_NAME, json.dumps(job_data))
        logger.info(f"Job {job_id} ({tipo}) encolado")
        return True
    except Exception as e:
        logger.error(f"Error encolando job {job_id}: {e}")
        return False


def obtener_siguiente_job() -> Optional[Dict[str, Any]]:
    """Obtiene el siguiente job de la cola (FIFO)"""
    try:
        r = get_redis()
        job_json = r.lpop(QUEUE_NAME)
        if job_json:
            return json.loads(job_json)
        return None
    except Exception as e:
        logger.error(f"Error obteniendo job de cola: {e}")
        return None


def obtener_siguiente_job_bloqueante(timeout: int = 5) -> Optional[Dict[str, Any]]:
    """Obtiene el siguiente job, esperando hasta timeout segundos si no hay"""
    try:
        r = get_redis()
        result = r.blpop(QUEUE_NAME, timeout=timeout)
        if result:
            _, job_json = result
            return json.loads(job_json)
        return None
    except Exception as e:
        logger.error(f"Error obteniendo job de cola: {e}")
        return None


def contar_jobs_pendientes() -> int:
    """Cuenta cuántos jobs hay en la cola"""
    try:
        r = get_redis()
        return r.llen(QUEUE_NAME)
    except Exception as e:
        logger.error(f"Error contando jobs: {e}")
        return 0


def limpiar_cola() -> int:
    """Limpia toda la cola (usar con cuidado)"""
    try:
        r = get_redis()
        count = r.llen(QUEUE_NAME)
        r.delete(QUEUE_NAME)
        logger.warning(f"Cola limpiada: {count} jobs eliminados")
        return count
    except Exception as e:
        logger.error(f"Error limpiando cola: {e}")
        return 0


def health_check() -> bool:
    """Verifica que Redis esté funcionando"""
    try:
        r = get_redis()
        return r.ping()
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return False
