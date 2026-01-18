"""
Jobs Router - Background task monitoring and management
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from models import get_db, BackgroundJob
from api.routers.auth import get_current_user
from models import Usuario

router = APIRouter(
    prefix="/jobs", 
    tags=["Background Jobs"],
    responses={401: {"description": "Not authenticated"}}
)


@router.get("", summary="List background jobs", description="Retrieve background jobs with optional filters by type and status.")
async def listar_jobs(
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = db.query(BackgroundJob)
    
    if tipo:
        query = query.filter(BackgroundJob.tipo == tipo)
    if estado:
        query = query.filter(BackgroundJob.estado == estado)
    
    jobs = query.order_by(BackgroundJob.created_at.desc()).limit(limit).all()
    
    return {
        "jobs": [job.to_dict() for job in jobs],
        "total": len(jobs)
    }


@router.get("/{job_id}", summary="Get job by ID", description="Retrieve status and progress of a specific background job.")
async def obtener_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    
    return {"job": job.to_dict()}


@router.get("/tipo/{tipo}/activo", summary="Get active job by type", description="Find the currently running or pending job of a specific type.")
async def obtener_job_activo(
    tipo: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    job = db.query(BackgroundJob).filter(
        BackgroundJob.tipo == tipo,
        BackgroundJob.estado.in_(["pendiente", "procesando"])
    ).first()
    
    if not job:
        return {"status": "sin_job", "message": f"No hay job activo de tipo {tipo}"}
    
    return {"status": "ok", "job": job.to_dict()}


@router.get("/tipo/{tipo}/ultimo", summary="Get last job by type", description="Retrieve the most recent job of a specific type regardless of status.")
async def obtener_ultimo_job(
    tipo: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    job = db.query(BackgroundJob).filter(
        BackgroundJob.tipo == tipo
    ).order_by(BackgroundJob.created_at.desc()).first()
    
    if not job:
        return {"status": "sin_job", "message": f"No hay jobs de tipo {tipo}"}
    
    return {"status": "ok", "job": job.to_dict()}


@router.delete("/{job_id}", summary="Cancel job", description="Cancel a pending background job. Only works for jobs not yet started.")
async def cancelar_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    
    if job.estado not in ["pendiente"]:
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar jobs pendientes")
    
    job.estado = "cancelado"
    job.mensaje = "Cancelado por el usuario"
    db.commit()
    
    return {"status": "ok", "message": "Job cancelado"}
