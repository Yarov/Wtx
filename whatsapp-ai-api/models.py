from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Index,
    UniqueConstraint,
    text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
import time
import sys

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL env var is required (no hardcoded credentials). "
        "Example: postgresql://user:password@host:5432/dbname"
    )

# Crear Base primero (no requiere conexión)
Base = declarative_base()

# Engine y Session se crean lazy
_engine = None
_SessionLocal = None


def get_engine():
    """Obtener engine con reintentos de conexión"""
    global _engine
    if _engine is not None:
        return _engine

    max_retries = 30
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            _engine = create_engine(
                DATABASE_URL,
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
                pool_recycle=300,
            )
            # Probar conexión
            with _engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"Database connected successfully", file=sys.stderr)
            return _engine
        except Exception as e:
            if attempt < max_retries - 1:
                print(
                    f"Waiting for database... attempt {attempt + 1}/{max_retries}",
                    file=sys.stderr,
                )
                time.sleep(retry_delay)
            else:
                print(
                    f"Failed to connect after {max_retries} attempts: {e}",
                    file=sys.stderr,
                )
                raise


def get_session_local():
    """Obtener SessionLocal (lazy)"""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=get_engine()
        )
    return _SessionLocal


# Propiedades para compatibilidad con código existente
@property
def engine():
    return get_engine()


def SessionLocal():
    return get_session_local()()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Memoria(Base):
    __tablename__ = "memoria"

    telefono = Column(String, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, default=1, index=True)
    historial = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Configuracion(Base):
    __tablename__ = "configuracion"

    clave = Column(String, primary_key=True)
    usuario_id = Column(Integer, primary_key=True, default=0)  # 0 = global
    valor = Column(Text)


class ToolsConfig(Base):
    __tablename__ = "tools_config"

    nombre = Column(String, primary_key=True)
    usuario_id = Column(Integer, primary_key=True, default=0)  # 0 = global
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
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Perfil(Base):
    """A WhatsApp profile owned by a user. Each profile = one WhatsApp number
    with its own contacts, conversations and agent config (SaaS multi-tenant)."""
    __tablename__ = "perfiles"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre = Column(String(100), nullable=False, default="Mi Perfil")
    numero_whatsapp = Column(String(20), nullable=True)  # set when WhatsApp connects
    descripcion = Column(Text, nullable=True)
    emoji = Column(String(10), default="📱")
    es_activo = Column(Boolean, default=False)  # default profile for the user
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_perfil_usuario_activo", "usuario_id", "es_activo"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "usuario_id": self.usuario_id,
            "nombre": self.nombre,
            "numero_whatsapp": self.numero_whatsapp,
            "descripcion": self.descripcion,
            "emoji": self.emoji,
            "es_activo": self.es_activo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Contacto(Base):
    __tablename__ = "contactos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    telefono = Column(String(20), nullable=False, index=True)
    nombre = Column(String(100))
    email = Column(String(100))
    foto_url = Column(String(500))

    primer_mensaje = Column(DateTime)
    ultimo_mensaje = Column(DateTime)
    total_mensajes = Column(Integer, default=0)

    estado = Column(String(20), default="activo")  # activo, inactivo, bloqueado
    tags = Column(Text)  # JSON array
    notas = Column(Text)

    # Modo Humano - cuando está activo, la IA no responde
    modo_humano = Column(Boolean, default=False)
    modo_humano_desde = Column(DateTime, nullable=True)
    modo_humano_razon = Column(String(200), nullable=True)

    # Pipeline de ventas / Funnel
    estado_lead = Column(
        String(30), default="nuevo"
    )  # nuevo, contactado, calificado, interesado, negociacion, cerrado, perdido
    paso_funnel = Column(
        String(100), nullable=True
    )  # Nombre del paso actual del funnel
    lead_score = Column(Integer, default=0)  # 0-100 puntuación del lead
    datos_capturados = Column(
        Text, default="{}"
    )  # JSON: {"nombre": "Erik", "email": "erik@gmail.com"}

    origen = Column(String(50))  # whatsapp_sync, importado, manual, mensaje
    ultima_verificacion = Column(DateTime, nullable=True)
    ultima_campana = Column(DateTime, nullable=True)  # Última vez que recibió campaña
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("telefono", "usuario_id", name="uq_contacto_telefono_usuario"),
        Index("idx_contacto_usuario", "usuario_id"),
        Index("idx_contacto_usuario_telefono", "usuario_id", "telefono"),
        Index("idx_contacto_estado", "estado"),
        Index("idx_contacto_ultimo_mensaje", "ultimo_mensaje"),
        Index("idx_contacto_modo_humano", "modo_humano"),
        Index("idx_contacto_estado_lead", "estado_lead"),
        Index("idx_contacto_paso_funnel", "paso_funnel"),
    )

    def to_dict(self):
        import json

        datos = {}
        try:
            datos = json.loads(self.datos_capturados) if self.datos_capturados else {}
        except (json.JSONDecodeError, TypeError):
            datos = {}
        return {
            "id": self.id,
            "telefono": self.telefono,
            "nombre": self.nombre,
            "email": self.email,
            "foto_url": self.foto_url,
            "primer_mensaje": self.primer_mensaje.isoformat()
            if self.primer_mensaje
            else None,
            "ultimo_mensaje": self.ultimo_mensaje.isoformat()
            if self.ultimo_mensaje
            else None,
            "total_mensajes": self.total_mensajes,
            "estado": self.estado,
            "tags": json.loads(self.tags) if self.tags else [],
            "notas": self.notas,
            "modo_humano": self.modo_humano or False,
            "modo_humano_desde": self.modo_humano_desde.isoformat()
            if self.modo_humano_desde
            else None,
            "modo_humano_razon": self.modo_humano_razon,
            "estado_lead": self.estado_lead or "nuevo",
            "paso_funnel": self.paso_funnel,
            "lead_score": self.lead_score or 0,
            "datos_capturados": datos,
            "origen": self.origen,
            "ultima_verificacion": self.ultima_verificacion.isoformat()
            if self.ultima_verificacion
            else None,
            "ultima_campana": self.ultima_campana.isoformat()
            if self.ultima_campana
            else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    mensaje = Column(Text, nullable=False)

    tipo = Column(String(20), default="unica")  # unica, automatica
    estado = Column(
        String(20), default="borrador"
    )  # borrador, programada, enviando, pausada, completada, cancelada

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

    __table_args__ = (
        Index("idx_campana_estado", "estado"),
        Index("idx_campana_programada", "programada_para"),
        Index("idx_campana_usuario_estado", "usuario_id", "estado"),
    )

    def to_dict(self):
        import json

        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "mensaje": self.mensaje,
            "tipo": self.tipo,
            "estado": self.estado,
            "programada_para": self.programada_para.isoformat()
            if self.programada_para
            else None,
            "velocidad": self.velocidad,
            "filtro_tipo": self.filtro_tipo,
            "filtro_valor": json.loads(self.filtro_valor)
            if self.filtro_valor
            else None,
            "total_destinatarios": self.total_destinatarios,
            "enviados": self.enviados,
            "fallidos": self.fallidos,
            "respondidos": self.respondidos,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "iniciada_at": self.iniciada_at.isoformat() if self.iniciada_at else None,
            "completada_at": self.completada_at.isoformat()
            if self.completada_at
            else None,
        }


class CampanaDestinatario(Base):
    __tablename__ = "campana_destinatarios"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    campana_id = Column(Integer, ForeignKey('campanas.id', ondelete='CASCADE'), index=True)
    contacto_id = Column(Integer, ForeignKey('contactos.id', ondelete='CASCADE'), index=True)

    estado = Column(
        String(20), default="pendiente"
    )  # pendiente, enviado, fallido, respondido
    error = Column(Text)

    enviado_at = Column(DateTime)
    respondido_at = Column(DateTime)

    __table_args__ = (
        Index("idx_campana_dest_campana", "campana_id"),
        Index("idx_campana_dest_estado", "estado"),
        Index("idx_dest_campana_estado", "campana_id", "estado"),
        Index("idx_dest_contacto_estado", "contacto_id", "estado"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "campana_id": self.campana_id,
            "contacto_id": self.contacto_id,
            "estado": self.estado,
            "error": self.error,
            "enviado_at": self.enviado_at.isoformat() if self.enviado_at else None,
            "respondido_at": self.respondido_at.isoformat()
            if self.respondido_at
            else None,
        }


class BackgroundJob(Base):
    """Jobs que corren en background (verificación de contactos, etc.)"""

    __tablename__ = "background_jobs"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    tipo = Column(String, index=True)  # verificar_contactos, sync_contactos, etc.
    estado = Column(
        String, default="pendiente"
    )  # pendiente, procesando, completado, error
    total = Column(Integer, default=0)
    procesados = Column(Integer, default=0)
    exitosos = Column(Integer, default=0)
    fallidos = Column(Integer, default=0)
    mensaje = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    __table_args__ = (
        Index("idx_job_estado", "estado"),
    )

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
            "progreso": round(
                (self.procesados / self.total * 100) if self.total > 0 else 0, 1
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat()
            if self.completed_at
            else None,
        }


class BusinessConfig(Base):
    """Configuración del negocio - determina módulos activos y contexto"""

    __tablename__ = "business_config"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    business_name = Column(String, default="Mi Negocio")
    business_type = Column(
        String, default="general"
    )  # barberia, restaurante, tienda, servicios, otro
    business_description = Column(Text, default="")

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
            "onboarding_completed": self.onboarding_completed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ─── Base de Conocimiento ───────────────────────────────────────────────


class DocumentoConocimiento(Base):
    """Documentos de la base de conocimiento que el agente usa para responder"""

    __tablename__ = "documentos_conocimiento"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    titulo = Column(String(200), nullable=False)
    contenido = Column(Text, nullable=False)
    categoria = Column(String(100), default="general")
    activo = Column(Boolean, default=True)
    sincronizado = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_doc_categoria", "categoria"),
        Index("idx_doc_activo", "activo"),
        Index("idx_doc_usuario_activo", "usuario_id", "activo"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "contenido": self.contenido,
            "categoria": self.categoria,
            "activo": self.activo,
            "sincronizado": self.sincronizado,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ─── Funnel / Pasos ─────────────────────────────────────────────────────


class FunnelPaso(Base):
    """Pasos del funnel de ventas - define las etapas por las que pasa un contacto"""

    __tablename__ = "funnel_pasos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    nombre = Column(
        String(100), nullable=False
    )  # ID interno: inicio, calificacion, presentacion
    titulo = Column(String(200))  # Display: "Inicio", "Calificación", "Presentación"
    orden = Column(Integer, default=0)
    descripcion = Column(Text)
    instrucciones_agente = Column(Text)  # Qué debe hacer el agente en este paso
    condiciones_avance = Column(
        Text, default="[]"
    )  # JSON: condiciones para avanzar al siguiente paso
    accion_al_entrar = Column(
        String(50), default="ninguna"
    )  # ninguna, modo_humano, notificar
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("nombre", "usuario_id", name="uq_funnel_nombre_usuario"),
        Index("idx_funnel_orden", "orden"),
    )

    def to_dict(self):
        import json

        condiciones = []
        try:
            condiciones = (
                json.loads(self.condiciones_avance) if self.condiciones_avance else []
            )
        except (json.JSONDecodeError, TypeError):
            condiciones = []
        return {
            "id": self.id,
            "nombre": self.nombre,
            "titulo": self.titulo,
            "orden": self.orden,
            "descripcion": self.descripcion,
            "instrucciones_agente": self.instrucciones_agente,
            "condiciones_avance": condiciones,
            "accion_al_entrar": self.accion_al_entrar or "ninguna",
            "activo": self.activo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ─── Campos de Captura de Datos ──────────────────────────────────────────


class CampoCaptura(Base):
    """Campos que el agente debe capturar durante la conversación"""

    __tablename__ = "campos_captura"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    nombre = Column(
        String(50), nullable=False
    )  # nombre, email, empresa, etc.
    etiqueta = Column(String(100))  # "Nombre completo", "Correo electrónico"
    tipo = Column(String(20), default="texto")  # texto, email, telefono, numero, fecha
    obligatorio = Column(Boolean, default=False)
    orden = Column(Integer, default=0)
    activo = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("nombre", "usuario_id", name="uq_campo_nombre_usuario"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "etiqueta": self.etiqueta,
            "tipo": self.tipo,
            "obligatorio": self.obligatorio,
            "orden": self.orden,
            "activo": self.activo,
        }


# ─── Mensajes de Conversación (por mensaje, no JSON blob) ───────────────


class MensajeConversacion(Base):
    """Almacena cada mensaje individualmente, incluyendo eventos del sistema"""

    __tablename__ = "mensajes_conversacion"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    telefono = Column(String(20), nullable=False, index=True)
    rol = Column(String(20), nullable=False)  # user, assistant, system
    contenido = Column(Text, nullable=False)
    tipo_evento = Column(
        String(50), nullable=True
    )  # NULL=mensaje normal, datos_guardados, cita_agendada, paso_avanzado, intervencion_humana
    metadata_json = Column(Text, nullable=True)  # JSON con datos extra del evento
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_msg_telefono_created", "telefono", "created_at"),
        Index("idx_msg_tipo_evento", "tipo_evento"),
        Index("idx_msg_usuario_telefono", "usuario_id", "telefono", "created_at"),
    )

    def to_dict(self):
        import json

        meta = None
        try:
            meta = json.loads(self.metadata_json) if self.metadata_json else None
        except (json.JSONDecodeError, TypeError):
            meta = None
        return {
            "id": self.id,
            "telefono": self.telefono,
            "rol": self.rol,
            "contenido": self.contenido,
            "tipo_evento": self.tipo_evento,
            "metadata": meta,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
