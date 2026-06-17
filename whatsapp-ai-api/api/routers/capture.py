"""Capture Router - Data capture field configuration"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from models import SessionLocal, Usuario, Perfil
from auth import get_current_user
from api.routers.perfiles import get_current_perfil
from capture_service import CaptureService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/capture",
    tags=["Capture"],
    responses={401: {"description": "Not authenticated"}},
)


class FieldCreate(BaseModel):
    nombre: str
    etiqueta: str
    tipo: str = "texto"
    obligatorio: bool = False
    orden: int = 0


class FieldUpdate(BaseModel):
    etiqueta: Optional[str] = None
    tipo: Optional[str] = None
    obligatorio: Optional[bool] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


@router.get("/fields", summary="List capture fields")
async def list_fields(
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    db = SessionLocal()
    try:
        return CaptureService.get_fields(db, current_user.id, activo_only=False, perfil_id=perfil.id)
    finally:
        db.close()


@router.post("/fields", summary="Create capture field")
async def create_field(
    data: FieldCreate,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    db = SessionLocal()
    try:
        return CaptureService.create_field(
            db, current_user.id, data.nombre, data.etiqueta, data.tipo, data.obligatorio, data.orden, perfil_id=perfil.id
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(
                status_code=400, detail="Ya existe un campo con ese nombre"
            )
        raise
    finally:
        db.close()


@router.put("/fields/{field_id}", summary="Update capture field")
async def update_field(
    field_id: int,
    data: FieldUpdate,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    db = SessionLocal()
    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        result = CaptureService.update_field(db, field_id, current_user.id, perfil_id=perfil.id, **update_data)
        if not result:
            raise HTTPException(status_code=404, detail="Field not found")
        return result
    finally:
        db.close()


@router.delete("/fields/{field_id}", summary="Delete capture field")
async def delete_field(
    field_id: int,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    db = SessionLocal()
    try:
        if not CaptureService.delete_field(db, field_id, current_user.id, perfil_id=perfil.id):
            raise HTTPException(status_code=404, detail="Field not found")
        return {"status": "ok"}
    finally:
        db.close()
