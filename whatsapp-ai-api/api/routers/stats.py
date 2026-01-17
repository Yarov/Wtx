"""
Stats router
"""
import json
from fastapi import APIRouter, Depends
from models import SessionLocal, Cita, Inventario, Memoria, Usuario
from auth import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/")
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
