"""
Stats Router - Dashboard metrics and analytics
"""
import json
from fastapi import APIRouter, Depends
from models import SessionLocal, Cita, Inventario, Memoria, Usuario
from auth import get_current_user

router = APIRouter(
    prefix="/stats", 
    tags=["Statistics"],
    responses={401: {"description": "Not authenticated"}}
)


@router.get("/", summary="Get dashboard stats", description="Retrieve key metrics including total conversations, appointments, products and messages.")
async def get_stats(current_user: Usuario = Depends(get_current_user)):
    """Get system statistics"""
    db = SessionLocal()
    try:
        conversations = db.query(Memoria).count()
        appointments = db.query(Cita).count()
        products = db.query(Inventario).count()
        
        memorias = db.query(Memoria).all()
        total_messages = 0
        for m in memorias:
            if m.historial:
                try:
                    historial = json.loads(m.historial)
                    total_messages += len(historial)
                except:
                    pass
        
        return {
            "totalConversations": conversations,
            "totalAppointments": appointments,
            "totalProducts": products,
            "totalMessages": total_messages,
        }
    finally:
        db.close()


@router.get("/jobs", summary="Get jobs queue status", description="Get status of background jobs queue and recent jobs.")
async def get_jobs_status(current_user: Usuario = Depends(get_current_user)):
    """Get jobs queue status"""
    from models import BackgroundJob
    from redis_queue import contar_jobs_pendientes, health_check
    
    db = SessionLocal()
    try:
        # Estado de Redis
        redis_ok = health_check()
        jobs_en_cola = contar_jobs_pendientes() if redis_ok else 0
        
        # Jobs activos
        jobs_activos = db.query(BackgroundJob).filter(
            BackgroundJob.estado.in_(["pendiente", "procesando"])
        ).all()
        
        # Últimos 10 jobs
        ultimos_jobs = db.query(BackgroundJob).order_by(
            BackgroundJob.created_at.desc()
        ).limit(10).all()
        
        return {
            "redis_status": "ok" if redis_ok else "error",
            "jobs_en_cola": jobs_en_cola,
            "jobs_activos": [j.to_dict() for j in jobs_activos],
            "ultimos_jobs": [j.to_dict() for j in ultimos_jobs],
        }
    finally:
        db.close()
