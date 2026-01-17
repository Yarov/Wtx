"""
Appointments schemas
"""
from pydantic import BaseModel
from typing import Optional


class AppointmentModel(BaseModel):
    telefono: str
    fecha: str
    hora: str
    servicio: str
    estado: str = "pendiente"


class AppointmentUpdateModel(BaseModel):
    estado: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    servicio: Optional[str] = None


class AvailabilityModel(BaseModel):
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    activo: Optional[bool] = None


class BlockedSlotModel(BaseModel):
    fecha: str
    hora: str
    motivo: Optional[str] = "Bloqueado"
