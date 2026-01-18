"""
Appointments Router - Scheduling, availability and calendar management
"""
from fastapi import APIRouter, Depends
from models import SessionLocal, Cita, Disponibilidad, HorarioBloqueado, Usuario
from api.schemas.appointments import AppointmentUpdateModel, AvailabilityModel, BlockedSlotModel
from auth import get_current_user

router = APIRouter(
    prefix="/appointments", 
    tags=["Appointments"],
    responses={401: {"description": "Not authenticated"}}
)


@router.get("/", summary="List all appointments", description="Retrieve all scheduled appointments sorted by date descending.")
async def get_appointments(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        citas = db.query(Cita).order_by(Cita.fecha.desc(), Cita.hora.desc()).all()
        return [c.to_dict() for c in citas]
    finally:
        db.close()


@router.patch("/{appointment_id}/status", summary="Update appointment status", description="Change the status of an appointment (e.g., pending, confirmed, completed, cancelled).")
async def update_appointment_status(appointment_id: int, data: AppointmentUpdateModel, current_user: Usuario = Depends(get_current_user)):
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


@router.delete("/{appointment_id}", summary="Delete appointment", description="Permanently remove an appointment from the calendar.")
async def delete_appointment(appointment_id: int, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        db.query(Cita).filter(Cita.id == appointment_id).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.get("/availability", summary="Get weekly availability", description="Retrieve the business hours configuration for each day of the week.")
async def get_availability(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        disponibilidad = db.query(Disponibilidad).order_by(Disponibilidad.dia_semana).all()
        return [d.to_dict() for d in disponibilidad]
    finally:
        db.close()


@router.put("/availability/{dia_id}", summary="Update day availability", description="Modify business hours for a specific day of the week.")
async def update_availability(dia_id: int, data: AvailabilityModel, current_user: Usuario = Depends(get_current_user)):
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


@router.get("/blocked-slots", summary="List blocked slots", description="Get all time slots that have been blocked and are unavailable for booking.")
async def get_blocked_slots(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        slots = db.query(HorarioBloqueado).order_by(HorarioBloqueado.fecha, HorarioBloqueado.hora).all()
        return [s.to_dict() for s in slots]
    finally:
        db.close()


@router.post("/blocked-slots", summary="Block time slot", description="Mark a specific date and time as unavailable for appointments.")
async def add_blocked_slot(data: BlockedSlotModel, current_user: Usuario = Depends(get_current_user)):
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


@router.delete("/blocked-slots/{slot_id}", summary="Unblock time slot", description="Remove a blocked slot to make it available for booking again.")
async def delete_blocked_slot(slot_id: int, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        db.query(HorarioBloqueado).filter(HorarioBloqueado.id == slot_id).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.get("/available-slots/{fecha}", summary="Get available slots", description="List all available time slots for a specific date, considering business hours and existing bookings.")
async def get_available_slots(fecha: str, current_user: Usuario = Depends(get_current_user)):
    from services import CitasService, get_db
    db = get_db()
    try:
        horarios = CitasService.obtener_horarios_disponibles(db, fecha)
        return {"fecha": fecha, "horarios": horarios}
    finally:
        db.close()
