"""
Payments router
"""
from fastapi import APIRouter, Depends
from models import SessionLocal, Pago, Usuario
from auth import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/")
async def get_payments(current_user: Usuario = Depends(get_current_user)):
    """Get all payments"""
    db = SessionLocal()
    try:
        pagos = db.query(Pago).order_by(Pago.created_at.desc()).all()
        return [p.to_dict() for p in pagos]
    finally:
        db.close()


@router.patch("/{payment_id}/status")
async def update_payment_status(payment_id: int, data: dict, current_user: Usuario = Depends(get_current_user)):
    """Update payment status"""
    db = SessionLocal()
    try:
        pago = db.query(Pago).filter(Pago.id == payment_id).first()
        if pago:
            pago.estado = data.get("estado", "pendiente")
            db.commit()
        return {"status": "ok"}
    finally:
        db.close()
