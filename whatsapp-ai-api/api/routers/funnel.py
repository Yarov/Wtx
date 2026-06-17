"""Funnel Router - Funnel steps CRUD and contact progression"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from models import SessionLocal, Usuario, Contacto
from auth import get_current_user
from funnel_service import FunnelService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/funnel",
    tags=["Funnel"],
    responses={401: {"description": "Not authenticated"}},
)


class StepCreate(BaseModel):
    nombre: str
    titulo: str
    orden: int = 0
    descripcion: str = ""
    instrucciones_agente: str = ""
    condiciones_avance: list = []


class StepUpdate(BaseModel):
    titulo: Optional[str] = None
    orden: Optional[int] = None
    descripcion: Optional[str] = None
    instrucciones_agente: Optional[str] = None
    condiciones_avance: Optional[list] = None
    activo: Optional[bool] = None


@router.get("/steps", summary="List all funnel steps")
async def list_steps(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        return FunnelService.get_all_steps(db, current_user.id)
    finally:
        db.close()


@router.get("/steps/{step_id}", summary="Get step by ID")
async def get_step(step_id: int, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        step = FunnelService.get_step_by_id(db, step_id, current_user.id)
        if not step:
            raise HTTPException(status_code=404, detail="Step not found")
        return step
    finally:
        db.close()


@router.post("/steps", summary="Create funnel step")
async def create_step(
    data: StepCreate, current_user: Usuario = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        return FunnelService.create_step(
            db,
            current_user.id,
            data.nombre,
            data.titulo,
            data.orden,
            data.descripcion,
            data.instrucciones_agente,
            data.condiciones_avance,
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(
                status_code=400, detail="Ya existe un paso con ese nombre"
            )
        raise
    finally:
        db.close()


@router.put("/steps/{step_id}", summary="Update funnel step")
async def update_step(
    step_id: int, data: StepUpdate, current_user: Usuario = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        result = FunnelService.update_step(db, step_id, current_user.id, **update_data)
        if not result:
            raise HTTPException(status_code=404, detail="Step not found")
        return result
    finally:
        db.close()


@router.delete("/steps/{step_id}", summary="Delete funnel step")
async def delete_step(step_id: int, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if not FunnelService.delete_step(db, step_id, current_user.id):
            raise HTTPException(status_code=404, detail="Step not found")
        return {"status": "ok"}
    finally:
        db.close()


@router.post("/contacts/{telefono}/advance", summary="Manually advance contact")
async def advance_contact(
    telefono: str, current_user: Usuario = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        result = FunnelService.advance_contact(
            db, current_user.id, telefono, "Avance manual por administrador"
        )
        if not result:
            raise HTTPException(status_code=400, detail="No se puede avanzar")
        return result
    finally:
        db.close()


@router.put("/contacts/{telefono}/step", summary="Set contact step manually")
async def set_contact_step(
    telefono: str, step_name: str, current_user: Usuario = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        if not FunnelService.assign_contact_to_step(db, current_user.id, telefono, step_name):
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"status": "ok", "paso": step_name}
    finally:
        db.close()


@router.get("/stats", summary="Funnel statistics")
async def funnel_stats(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        steps = FunnelService.get_all_steps(db, current_user.id, activo_only=True)
        stats = []
        for step in steps:
            count = (
                db.query(Contacto)
                .filter(
                    Contacto.usuario_id == current_user.id,
                    Contacto.paso_funnel == step["nombre"],
                )
                .count()
            )
            stats.append(
                {
                    "paso": step["nombre"],
                    "titulo": step["titulo"],
                    "orden": step["orden"],
                    "contactos": count,
                }
            )
        # Sin paso asignado
        sin_paso = db.query(Contacto).filter(
            Contacto.usuario_id == current_user.id,
            Contacto.paso_funnel == None,
        ).count()
        return {"steps": stats, "sin_paso": sin_paso}
    finally:
        db.close()
