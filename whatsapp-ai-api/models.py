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


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "is_active": self.is_active,
            "is_admin": self.is_admin,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Contacto(Base):
    __tablename__ = "contactos"

    id = Column(Integer, primary_key=True, index=True)
    telefono = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100))
    email = Column(String(100))
    foto_url = Column(String(500))
    
    primer_mensaje = Column(DateTime)
    ultimo_mensaje = Column(DateTime)
    total_mensajes = Column(Integer, default=0)
    
    estado = Column(String(20), default="activo")  # activo, inactivo, bloqueado
    tags = Column(Text)  # JSON array
    notas = Column(Text)
    
    origen = Column(String(50))  # whatsapp_sync, importado, manual, mensaje
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_contacto_estado', 'estado'),
        Index('idx_contacto_ultimo_mensaje', 'ultimo_mensaje'),
    )

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "telefono": self.telefono,
            "nombre": self.nombre,
            "email": self.email,
            "foto_url": self.foto_url,
            "primer_mensaje": self.primer_mensaje.isoformat() if self.primer_mensaje else None,
            "ultimo_mensaje": self.ultimo_mensaje.isoformat() if self.ultimo_mensaje else None,
            "total_mensajes": self.total_mensajes,
            "estado": self.estado,
            "tags": json.loads(self.tags) if self.tags else [],
            "notas": self.notas,
            "origen": self.origen,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    mensaje = Column(Text, nullable=False)
    
    tipo = Column(String(20), default="unica")  # unica, automatica
    estado = Column(String(20), default="borrador")  # borrador, programada, enviando, pausada, completada, cancelada
    
    programada_para = Column(DateTime)
    velocidad = Column(Integer, default=30)  # segundos entre mensajes
    
    filtro_tipo = Column(String(20))  # todos, inactivos, tag, manual
    filtro_valor = Column(Text)  # JSON
    
    total_destinatarios = Column(Integer, default=0)
    enviados = Column(Integer, default=0)
    fallidos = Column(Integer, default=0)
    respondidos = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    iniciada_at = Column(DateTime)
    completada_at = Column(DateTime)
    ultimo_envio = Column(DateTime)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "mensaje": self.mensaje,
            "tipo": self.tipo,
            "estado": self.estado,
            "programada_para": self.programada_para.isoformat() if self.programada_para else None,
            "velocidad": self.velocidad,
            "filtro_tipo": self.filtro_tipo,
            "filtro_valor": json.loads(self.filtro_valor) if self.filtro_valor else None,
            "total_destinatarios": self.total_destinatarios,
            "enviados": self.enviados,
            "fallidos": self.fallidos,
            "respondidos": self.respondidos,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "iniciada_at": self.iniciada_at.isoformat() if self.iniciada_at else None,
            "completada_at": self.completada_at.isoformat() if self.completada_at else None,
        }


class CampanaDestinatario(Base):
    __tablename__ = "campana_destinatarios"

    id = Column(Integer, primary_key=True, index=True)
    campana_id = Column(Integer, index=True)
    contacto_id = Column(Integer, index=True)
    
    estado = Column(String(20), default="pendiente")  # pendiente, enviado, fallido, respondido
    error = Column(Text)
    
    enviado_at = Column(DateTime)
    respondido_at = Column(DateTime)

    __table_args__ = (
        Index('idx_campana_dest_campana', 'campana_id'),
        Index('idx_campana_dest_estado', 'estado'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "campana_id": self.campana_id,
            "contacto_id": self.contacto_id,
            "estado": self.estado,
            "error": self.error,
            "enviado_at": self.enviado_at.isoformat() if self.enviado_at else None,
            "respondido_at": self.respondido_at.isoformat() if self.respondido_at else None,
        }


class BackgroundJob(Base):
    """Jobs que corren en background (verificación de contactos, etc.)"""
    __tablename__ = "background_jobs"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, index=True)  # verificar_contactos, sync_contactos, etc.
    estado = Column(String, default="pendiente")  # pendiente, procesando, completado, error
    total = Column(Integer, default=0)
    procesados = Column(Integer, default=0)
    exitosos = Column(Integer, default=0)
    fallidos = Column(Integer, default=0)
    mensaje = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "estado": self.estado,
            "total": self.total,
            "procesados": self.procesados,
            "exitosos": self.exitosos,
            "fallidos": self.fallidos,
            "mensaje": self.mensaje,
            "progreso": round((self.procesados / self.total * 100) if self.total > 0 else 0, 1),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class BusinessConfig(Base):
    """Configuración del negocio - determina módulos activos y contexto"""
    __tablename__ = "business_config"

    id = Column(Integer, primary_key=True, index=True)
    business_name = Column(String, default="Mi Negocio")
    business_type = Column(String, default="general")  # barberia, restaurante, tienda, servicios, otro
    business_description = Column(Text, default="")
    
    # Módulos activos
    has_inventory = Column(Boolean, default=True)
    has_appointments = Column(Boolean, default=True)
    has_schedule = Column(Boolean, default=True)
    
    # Estado del onboarding
    onboarding_completed = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "business_name": self.business_name,
            "business_type": self.business_type,
            "business_description": self.business_description,
            "has_inventory": self.has_inventory,
            "has_appointments": self.has_appointments,
            "has_schedule": self.has_schedule,
            "onboarding_completed": self.onboarding_completed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
