from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://whatsapp:whatsapp_secret@localhost:5432/whatsapp_agent")

engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Cita(Base):
    __tablename__ = "citas"
    
    id = Column(Integer, primary_key=True, index=True)
    telefono = Column(String, index=True)
    fecha = Column(String, index=True)
    hora = Column(String)
    servicio = Column(String)
    estado = Column(String, default="pendiente")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "telefono": self.telefono,
            "fecha": self.fecha,
            "hora": self.hora,
            "servicio": self.servicio,
            "estado": self.estado
        }


class Inventario(Base):
    __tablename__ = "inventario"
    
    id = Column(Integer, primary_key=True, index=True)
    producto = Column(String)
    stock = Column(Integer, default=0)
    precio = Column(Float, default=0.0)
    
    def to_dict(self):
        return {
            "id": self.id,
            "producto": self.producto,
            "stock": self.stock,
            "precio": self.precio
        }


class Memoria(Base):
    __tablename__ = "memoria"
    
    telefono = Column(String, primary_key=True, index=True)
    historial = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Disponibilidad(Base):
    __tablename__ = "disponibilidad"
    
    id = Column(Integer, primary_key=True, index=True)
    dia_semana = Column(Integer)  # 0=Lunes, 6=Domingo
    hora_inicio = Column(String)
    hora_fin = Column(String)
    activo = Column(Boolean, default=True)
    
    def to_dict(self):
        dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
        return {
            "id": self.id,
            "dia_semana": self.dia_semana,
            "dia_nombre": dias[self.dia_semana] if self.dia_semana < 7 else "",
            "hora_inicio": self.hora_inicio,
            "hora_fin": self.hora_fin,
            "activo": self.activo
        }


class HorarioBloqueado(Base):
    __tablename__ = "horarios_bloqueados"
    
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(String, index=True)
    hora = Column(String)
    motivo = Column(String)
    
    def to_dict(self):
        return {
            "id": self.id,
            "fecha": self.fecha,
            "hora": self.hora,
            "motivo": self.motivo
        }


class Pago(Base):
    __tablename__ = "pagos"
    
    id = Column(Integer, primary_key=True, index=True)
    telefono = Column(String, index=True)
    servicio = Column(String)
    monto = Column(Float)
    moneda = Column(String, default="MXN")
    estado = Column(String, default="pendiente")
    proveedor = Column(String)
    payment_id = Column(String)
    payment_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "telefono": self.telefono,
            "servicio": self.servicio,
            "monto": self.monto,
            "moneda": self.moneda,
            "estado": self.estado,
            "proveedor": self.proveedor,
            "payment_url": self.payment_url,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Configuracion(Base):
    __tablename__ = "configuracion"
    
    clave = Column(String, primary_key=True)
    valor = Column(Text)


class ToolsConfig(Base):
    __tablename__ = "tools_config"
    
    nombre = Column(String, primary_key=True)
    habilitado = Column(Boolean, default=True)
    descripcion = Column(String)
