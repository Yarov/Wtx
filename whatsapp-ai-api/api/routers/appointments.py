"""
Appointments router
"""
from fastapi import APIRouter, Depends
from models import SessionLocal, Cita, Disponibilidad, HorarioBloqueado, Usuario
from api.schemas.appointments import AppointmentUpdateModel, AvailabilityModel, BlockedSlotModel
from auth import get_current_user

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("/")
async def get_appointments(current_user: Usuario = Depends(get_current_user)):
    """Get all appointments"""
    db = SessionLocal()
    try:
        citas = db.query(Cita).order_by(Cita.fecha.desc(), Cita.hora.desc()).all()
        return [c.to_dict() for c in citas]
    finally:
        db.close()


@router.patch("/{appointment_id}/status")
async def update_appointment_status(appointment_id: int, data: AppointmentUpdateModel, current_user: Usuario = Depends(get_current_user)):
    """Update appointment status"""
    db = SessionLocal()
    try:
        cita = db.query(Cita).filter(Cita.id == appointment_id).first()
        if cita:
            if data.estado:
                cita.estado = data.estado
            db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.delete("/{appointment_id}")
async def delete_appointment(appointment_id: int, current_user: Usuario = Depends(get_current_user)):
    """Delete appointment"""
    db = SessionLocal()
    try:
        db.query(Cita).filter(Cita.id == appointment_id).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.get("/availability")
async def get_availability(current_user: Usuario = Depends(get_current_user)):
    """Get weekly availability"""
    db = SessionLocal()
    try:
        disponibilidad = db.query(Disponibilidad).order_by(Disponibilidad.dia_semana).all()
        return [d.to_dict() for d in disponibilidad]
    finally:
        db.close()


@router.put("/availability/{dia_id}")
async def update_availability(dia_id: int, data: AvailabilityModel, current_user: Usuario = Depends(get_current_user)):
    """Update availability for a day"""
    db = SessionLocal()
    try:
        disp = db.query(Disponibilidad).filter(Disponibilidad.id == dia_id).first()
        if disp:
            if data.hora_inicio is not None:
                disp.hora_inicio = data.hora_inicio
            if data.hora_fin is not None:
                disp.hora_fin = data.hora_fin
            if data.activo is not None:
                disp.activo = data.activo
            db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.get("/blocked-slots")
async def get_blocked_slots(current_user: Usuario = Depends(get_current_user)):
    """Get all blocked slots"""
    db = SessionLocal()
    try:
        slots = db.query(HorarioBloqueado).order_by(HorarioBloqueado.fecha, HorarioBloqueado.hora).all()
        return [s.to_dict() for s in slots]
    finally:
        db.close()


@router.post("/blocked-slots")
async def add_blocked_slot(data: BlockedSlotModel, current_user: Usuario = Depends(get_current_user)):
    """Add blocked slot"""
    db = SessionLocal()
    try:
        slot = HorarioBloqueado(
            fecha=data.fecha,
            hora=data.hora,
            motivo=data.motivo
        )
        db.add(slot)
        db.commit()
        db.refresh(slot)
        return {"status": "ok", "id": slot.id}
    finally:
        db.close()


@router.delete("/blocked-slots/{slot_id}")
async def delete_blocked_slot(slot_id: int, current_user: Usuario = Depends(get_current_user)):
    """Delete blocked slot"""
    db = SessionLocal()
    try:
        db.query(HorarioBloqueado).filter(HorarioBloqueado.id == slot_id).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.get("/available-slots/{fecha}")
async def get_available_slots(fecha: str, current_user: Usuario = Depends(get_current_user)):
    """Get available slots for date"""
    from services import CitasService, get_db
    db = get_db()
    try:
        horarios = CitasService.obtener_horarios_disponibles(db, fecha)
        return {"fecha": fecha, "horarios": horarios}
    finally:
        db.close()
