"""
Perfiles Router - WhatsApp profiles (SaaS multi-tenant).
Each profile = one WhatsApp number with its own contacts, chats and agent config.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from models import get_db, Perfil, Usuario
from api.routers.auth import get_current_user

router = APIRouter(
    prefix="/perfiles",
    tags=["Perfiles"],
    responses={401: {"description": "Not authenticated"}},
)


class PerfilCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    emoji: Optional[str] = "📱"


class PerfilUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    emoji: Optional[str] = None


def _get_owned_perfil(db: Session, perfil_id: int, usuario_id: int) -> Perfil:
    perfil = db.query(Perfil).filter(
        Perfil.id == perfil_id,
        Perfil.usuario_id == usuario_id,
    ).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="Profile not found")
    return perfil


def _ensure_default_perfil(db: Session, usuario_id: int) -> Perfil:
    """Create a default active profile for a user that has none and return it."""
    perfil = Perfil(
        usuario_id=usuario_id,
        nombre="Mi WhatsApp",
        emoji="📱",
        es_activo=True,
    )
    db.add(perfil)
    db.commit()
    db.refresh(perfil)
    return perfil


def get_current_perfil(
    x_perfil_id: Optional[int] = Header(None, alias="X-Perfil-ID"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> Perfil:
    """Resolve the active profile for the current request.

    - If X-Perfil-ID header is present: load that profile owned by the user
      (403 if not found / not owned).
    - Else: use the user's active profile (es_activo == True).
    - Else: use the first profile (ordered by created_at).
    - If the user has no profile at all: create a default one.
    """
    # 1. Explicit profile via header
    if x_perfil_id is not None:
        perfil = db.query(Perfil).filter(
            Perfil.id == x_perfil_id,
            Perfil.usuario_id == current_user.id,
        ).first()
        if not perfil:
            raise HTTPException(status_code=403, detail="Profile not found or not owned")
        return perfil

    # 2. Active profile
    perfil = db.query(Perfil).filter(
        Perfil.usuario_id == current_user.id,
        Perfil.es_activo == True,  # noqa: E712
    ).first()
    if perfil:
        return perfil

    # 3. First profile by created_at
    perfil = db.query(Perfil).filter(
        Perfil.usuario_id == current_user.id,
    ).order_by(Perfil.created_at).first()
    if perfil:
        return perfil

    # 4. No profile at all -> create a default one
    return _ensure_default_perfil(db, current_user.id)


def get_perfil_activo_id(db, usuario_id) -> Optional[int]:
    """Plain helper for background (no HTTP request).

    Returns the id of the user's active profile (or first profile, or None).
    Does NOT create a profile if none exists.
    """
    if usuario_id is None:
        return None
    perfil = db.query(Perfil).filter(
        Perfil.usuario_id == usuario_id,
        Perfil.es_activo == True,  # noqa: E712
    ).first()
    if perfil:
        return perfil.id
    perfil = db.query(Perfil).filter(
        Perfil.usuario_id == usuario_id,
    ).order_by(Perfil.created_at).first()
    return perfil.id if perfil else None


@router.get("/", summary="List profiles", description="List all WhatsApp profiles owned by the current user.")
async def list_perfiles(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    perfiles = db.query(Perfil).filter(
        Perfil.usuario_id == current_user.id
    ).order_by(Perfil.created_at).all()
    return [p.to_dict() for p in perfiles]


@router.post("/", summary="Create profile", description="Create a new WhatsApp profile. The first profile is marked active.")
async def create_perfil(
    data: PerfilCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    is_first = db.query(Perfil).filter(Perfil.usuario_id == current_user.id).count() == 0
    perfil = Perfil(
        usuario_id=current_user.id,
        nombre=data.nombre,
        descripcion=data.descripcion,
        emoji=data.emoji or "📱",
        es_activo=is_first,  # first profile becomes the active one
    )
    db.add(perfil)
    db.commit()
    db.refresh(perfil)
    return perfil.to_dict()


@router.get("/{perfil_id}", summary="Get profile")
async def get_perfil(
    perfil_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return _get_owned_perfil(db, perfil_id, current_user.id).to_dict()


@router.patch("/{perfil_id}", summary="Update profile")
async def update_perfil(
    perfil_id: int,
    data: PerfilUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    perfil = _get_owned_perfil(db, perfil_id, current_user.id)
    for field, value in data.dict(exclude_unset=True).items():
        if value is not None:
            setattr(perfil, field, value)
    perfil.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(perfil)
    return perfil.to_dict()


@router.delete("/{perfil_id}", summary="Delete profile")
async def delete_perfil(
    perfil_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    perfil = _get_owned_perfil(db, perfil_id, current_user.id)
    was_active = perfil.es_activo
    db.delete(perfil)
    db.commit()

    # If we deleted the active profile, promote another one.
    if was_active:
        next_perfil = db.query(Perfil).filter(
            Perfil.usuario_id == current_user.id
        ).order_by(Perfil.created_at).first()
        if next_perfil:
            next_perfil.es_activo = True
            db.commit()
    return {"status": "ok"}


@router.post("/{perfil_id}/activar", summary="Set active profile", description="Mark a profile as the active one (deactivates the others).")
async def activar_perfil(
    perfil_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    perfil = _get_owned_perfil(db, perfil_id, current_user.id)
    db.query(Perfil).filter(
        Perfil.usuario_id == current_user.id,
        Perfil.es_activo == True,  # noqa: E712
    ).update({Perfil.es_activo: False})
    perfil.es_activo = True
    perfil.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(perfil)
    return perfil.to_dict()
