from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import SessionLocal, Memoria
import json


def get_db():
    return SessionLocal()


class MemoriaService:
    @staticmethod
    def obtener(db: Session, telefono: str) -> list:
        """Obtener historial de conversacion"""
        memoria = db.query(Memoria).filter(Memoria.telefono == telefono).first()
        if memoria and memoria.historial:
            return json.loads(memoria.historial)
        return []

    @staticmethod
    def guardar(db: Session, telefono: str, historial: str) -> str:
        """Guardar historial de conversacion"""
        memoria = db.query(Memoria).filter(Memoria.telefono == telefono).first()
        if memoria:
            memoria.historial = historial
            memoria.updated_at = datetime.utcnow()
        else:
            memoria = Memoria(telefono=telefono, historial=historial)
            db.add(memoria)
        db.commit()
        return "ok"
