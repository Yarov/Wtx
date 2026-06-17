"""
Database module - PostgreSQL con SQLAlchemy
"""
import os
import sys
import time as _time
from sqlalchemy import text
from models import Base, get_engine, SessionLocal
from models import (
    Configuracion,
    ToolsConfig,
    BusinessConfig,
    FunnelPaso,
    CampoCaptura,
    Perfil,
)

_initialized = False

# ─── Simple config cache (TTL 60s) ─────────────────────────────────────
_config_cache: dict = {}  # key: (clave, usuario_id) -> {"value": str, "ts": float}
_CONFIG_CACHE_TTL = 60  # seconds


def _cache_key(clave: str, usuario_id) -> tuple:
    return (clave, usuario_id)


def _cache_get(clave: str, usuario_id):
    """Return cached value or None if missing/expired."""
    key = _cache_key(clave, usuario_id)
    entry = _config_cache.get(key)
    if entry is None:
        return None
    if _time.time() - entry["ts"] > _CONFIG_CACHE_TTL:
        _config_cache.pop(key, None)
        return None
    return entry["value"]


def _cache_set(clave: str, usuario_id, value: str):
    key = _cache_key(clave, usuario_id)
    _config_cache[key] = {"value": value, "ts": _time.time()}


def invalidate_config_cache(clave: str = None, usuario_id=None):
    """Invalidate config cache. Call after set_config()."""
    if clave is None:
        _config_cache.clear()
    else:
        _config_cache.pop(_cache_key(clave, usuario_id), None)
        # Also invalidate the composite lookup (user + global fallback)
        _config_cache.pop(_cache_key(clave, 0), None)


def init_database():
    """Inicializar base de datos (verificar conexión)"""
    global _initialized
    if _initialized:
        return

    # Solo verificar conexión - las tablas las crea Alembic
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("Database connection verified", file=sys.stderr)
    _initialized = True


def get_session():
    return SessionLocal()


# ─── Config: user-aware ──────────────────────────────────────────────────


def get_config(clave: str, default: str = "", usuario_id: int = None) -> str:
    """Obtener valor de configuración (cached, TTL 60s).
    Si usuario_id se provee, busca user-scoped primero, fallback a global (0).
    Si no se provee, busca global directamente.
    """
    # Check cache first
    cache_uid = usuario_id if usuario_id is not None else 0
    cached = _cache_get(clave, cache_uid)
    if cached is not None:
        return cached

    db = SessionLocal()
    try:
        result = default
        if usuario_id is not None:
            # User-scoped first
            config = (
                db.query(Configuracion)
                .filter(
                    Configuracion.clave == clave,
                    Configuracion.usuario_id == usuario_id,
                )
                .first()
            )
            if config:
                result = config.valor
                _cache_set(clave, cache_uid, result)
                return result
        # Fall back to global (usuario_id=0)
        config = (
            db.query(Configuracion)
            .filter(
                Configuracion.clave == clave,
                Configuracion.usuario_id == 0,
            )
            .first()
        )
        result = config.valor if config else default
        _cache_set(clave, cache_uid, result)
        return result
    finally:
        db.close()


def set_config(clave: str, valor: str, usuario_id: int = 0):
    """Guardar valor de configuración para un usuario (0 = global)."""
    db = SessionLocal()
    try:
        config = (
            db.query(Configuracion)
            .filter(
                Configuracion.clave == clave,
                Configuracion.usuario_id == usuario_id,
            )
            .first()
        )
        if config:
            config.valor = valor
        else:
            db.add(
                Configuracion(clave=clave, usuario_id=usuario_id, valor=valor)
            )
        db.commit()
        invalidate_config_cache(clave, usuario_id)
    finally:
        db.close()


def get_all_config(usuario_id: int = None) -> dict:
    """Obtener toda la configuración. Si usuario_id, mergea global + user."""
    db = SessionLocal()
    try:
        # Global first
        configs = (
            db.query(Configuracion)
            .filter(Configuracion.usuario_id == 0)
            .all()
        )
        result = {c.clave: c.valor for c in configs}

        if usuario_id is not None:
            # Override with user-scoped
            user_configs = (
                db.query(Configuracion)
                .filter(Configuracion.usuario_id == usuario_id)
                .all()
            )
            for c in user_configs:
                result[c.clave] = c.valor

        return result
    finally:
        db.close()


def is_tool_enabled(nombre: str, usuario_id: int = None) -> bool:
    """Verificar si un tool está habilitado."""
    db = SessionLocal()
    try:
        if usuario_id is not None:
            tool = (
                db.query(ToolsConfig)
                .filter(
                    ToolsConfig.nombre == nombre,
                    ToolsConfig.usuario_id == usuario_id,
                )
                .first()
            )
            if tool:
                return tool.habilitado
        # Fallback to global
        tool = (
            db.query(ToolsConfig)
            .filter(
                ToolsConfig.nombre == nombre,
                ToolsConfig.usuario_id == 0,
            )
            .first()
        )
        return tool.habilitado if tool else True
    finally:
        db.close()


def set_tool_enabled(nombre: str, habilitado: bool, usuario_id: int = 0):
    """Habilitar/deshabilitar un tool."""
    db = SessionLocal()
    try:
        tool = (
            db.query(ToolsConfig)
            .filter(
                ToolsConfig.nombre == nombre,
                ToolsConfig.usuario_id == usuario_id,
            )
            .first()
        )
        if tool:
            tool.habilitado = habilitado
        else:
            db.add(
                ToolsConfig(
                    nombre=nombre, usuario_id=usuario_id, habilitado=habilitado
                )
            )
        db.commit()
    finally:
        db.close()


def get_all_tools_config(usuario_id: int = None) -> list:
    """Obtener configuración de todos los tools."""
    db = SessionLocal()
    try:
        # Global first
        tools = (
            db.query(ToolsConfig)
            .filter(ToolsConfig.usuario_id == 0)
            .all()
        )
        result = {
            t.nombre: {
                "nombre": t.nombre,
                "habilitado": t.habilitado,
                "descripcion": t.descripcion,
            }
            for t in tools
        }

        if usuario_id is not None:
            user_tools = (
                db.query(ToolsConfig)
                .filter(ToolsConfig.usuario_id == usuario_id)
                .all()
            )
            for t in user_tools:
                result[t.nombre] = {
                    "nombre": t.nombre,
                    "habilitado": t.habilitado,
                    "descripcion": t.descripcion,
                }

        return list(result.values())
    finally:
        db.close()


# ─── User defaults ──────────────────────────────────────────────────────


def create_user_defaults(db, usuario_id: int):
    """Crear datos por defecto para un usuario nuevo."""
    env_api_key = os.getenv("OPENAI_API_KEY", "")

    # Default profile (one active WhatsApp profile per new user).
    # Created first so per-profile data (funnel steps, capture fields) can be
    # scoped to it from the start.
    perfil = (
        db.query(Perfil)
        .filter(Perfil.usuario_id == usuario_id)
        .order_by(Perfil.created_at)
        .first()
    )
    if not perfil:
        perfil = Perfil(
            usuario_id=usuario_id,
            nombre="Mi WhatsApp",
            emoji="📱",
            es_activo=True,
        )
        db.add(perfil)
        db.flush()  # assign perfil.id without committing yet
    perfil_id = perfil.id

    # Config
    default_config = [
        ("system_prompt", """Eres un asistente de WhatsApp.
Responde claro, corto y amable.
Siempre saluda al cliente y ofrece ayuda."""),
        ("model", "gpt-4o-mini"),
        ("temperature", "0.7"),
        ("max_tokens", "500"),
        ("business_name", "Mi Negocio"),
        ("business_type", "general"),
    ]
    if env_api_key:
        default_config.append(("openai_api_key", env_api_key))

    for clave, valor in default_config:
        existing = (
            db.query(Configuracion)
            .filter(
                Configuracion.clave == clave,
                Configuracion.usuario_id == usuario_id,
            )
            .first()
        )
        if not existing:
            db.add(
                Configuracion(clave=clave, usuario_id=usuario_id, valor=valor)
            )

    # Tools
    default_tools = [
        ("transferir_a_humano", True, "Transferir conversación a atención humana"),
    ]
    for nombre, habilitado, descripcion in default_tools:
        existing = (
            db.query(ToolsConfig)
            .filter(
                ToolsConfig.nombre == nombre,
                ToolsConfig.usuario_id == usuario_id,
            )
            .first()
        )
        if not existing:
            db.add(
                ToolsConfig(
                    nombre=nombre,
                    usuario_id=usuario_id,
                    habilitado=habilitado,
                    descripcion=descripcion,
                )
            )

    # Funnel
    existing_funnel = (
        db.query(FunnelPaso)
        .filter(FunnelPaso.usuario_id == usuario_id)
        .first()
    )
    if not existing_funnel:
        default_steps = [
            ("inicio", "Inicio", 0, "Primer contacto"),
            ("calificacion", "Calificación", 1, "Recopilar datos"),
            ("presentacion", "Presentación", 2, "Presentar oferta"),
            ("seguimiento", "Seguimiento", 3, "Dar seguimiento"),
        ]
        for nombre, titulo, orden, desc in default_steps:
            db.add(
                FunnelPaso(
                    usuario_id=usuario_id,
                    perfil_id=perfil_id,
                    nombre=nombre,
                    titulo=titulo,
                    orden=orden,
                    descripcion=desc,
                    activo=True,
                )
            )

    # Campos captura
    existing_campos = (
        db.query(CampoCaptura)
        .filter(CampoCaptura.usuario_id == usuario_id)
        .first()
    )
    if not existing_campos:
        db.add(
            CampoCaptura(
                usuario_id=usuario_id,
                perfil_id=perfil_id,
                nombre="nombre",
                etiqueta="Nombre completo",
                tipo="texto",
                obligatorio=True,
                orden=0,
                activo=True,
            )
        )
        db.add(
            CampoCaptura(
                usuario_id=usuario_id,
                perfil_id=perfil_id,
                nombre="email",
                etiqueta="Correo electrónico",
                tipo="email",
                obligatorio=True,
                orden=1,
                activo=True,
            )
        )

    # BusinessConfig
    existing_bc = (
        db.query(BusinessConfig)
        .filter(BusinessConfig.usuario_id == usuario_id)
        .first()
    )
    if not existing_bc:
        db.add(BusinessConfig(usuario_id=usuario_id))

    db.commit()


# ─── Legacy init (global defaults, usuario_id=0) ────────────────────────


def init_default_data():
    """Inicializar datos por defecto globales si no existen"""
    db = SessionLocal()
    try:
        if db.query(Configuracion).first():
            return

        env_api_key = os.getenv("OPENAI_API_KEY", "")

        default_config = [
            (
                "system_prompt",
                """Eres un asistente de WhatsApp para una barbería/salón.
Ofreces servicios, agendas citas y consultas inventario.
Responde claro, corto y amable.
Siempre saluda al cliente y ofrece ayuda.""",
            ),
            ("model", "gpt-4o-mini"),
            ("temperature", "0.7"),
            ("max_tokens", "500"),
            ("business_name", "Mi Negocio"),
            ("business_type", "barbería"),
        ]
        if env_api_key:
            default_config.append(("openai_api_key", env_api_key))

        for clave, valor in default_config:
            db.add(Configuracion(clave=clave, usuario_id=0, valor=valor))

        default_tools = [
            ("transferir_a_humano", True, "Transferir conversación a atención humana"),
        ]
        for nombre, habilitado, descripcion in default_tools:
            db.add(
                ToolsConfig(
                    nombre=nombre,
                    usuario_id=0,
                    habilitado=habilitado,
                    descripcion=descripcion,
                )
            )

        db.commit()
        print("Datos por defecto globales inicializados")

    except Exception as e:
        print(f"Error inicializando datos: {e}")
        db.rollback()
    finally:
        db.close()
