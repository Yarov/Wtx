"""
Conversations router
"""
import json
from fastapi import APIRouter, Depends
from models import SessionLocal, Memoria, Usuario
from auth import get_current_user

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/")
async def get_conversations(current_user: Usuario = Depends(get_current_user)):
    """Get all conversations"""
    db = SessionLocal()
    try:
        memorias = db.query(Memoria).order_by(Memoria.updated_at.desc()).all()
        result = []
        for m in memorias:
            historial = json.loads(m.historial) if m.historial else []
            ultimo = historial[-1]["content"] if historial else ""
            result.append({
                "telefono": m.telefono,
                "ultimo_mensaje": ultimo[:50] + "..." if len(ultimo) > 50 else ultimo,
                "fecha": m.updated_at.isoformat() if m.updated_at else "",
                "mensajes_count": len(historial),
            })
        return result
    finally:
        db.close()


@router.get("/{phone}")
async def get_conversation(phone: str, current_user: Usuario = Depends(get_current_user)):
    """Get conversation history for phone"""
    db = SessionLocal()
    try:
        memoria = db.query(Memoria).filter(Memoria.telefono == phone).first()
        if memoria and memoria.historial:
            return {"messages": json.loads(memoria.historial)}
        return {"messages": []}
    finally:
        db.close()


@router.delete("/{phone}")
async def delete_conversation(phone: str, current_user: Usuario = Depends(get_current_user)):
    """Delete conversation for phone"""
    db = SessionLocal()
    try:
        db.query(Memoria).filter(Memoria.telefono == phone).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()
