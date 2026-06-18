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
# key: (clave, usuario_id, perfil_id) -> {"value": str, "ts": float}
_config_cache: dict = {}
_CONFIG_CACHE_TTL = 60  # seconds


def _cache_key(clave: str, usuario_id, perfil_id=0) -> tuple:
    return (clave, usuario_id, perfil_id)


def _cache_get(clave: str, usuario_id, perfil_id=0):
    """Return cached value or None if missing/expired."""
    key = _cache_key(clave, usuario_id, perfil_id)
    entry = _config_cache.get(key)
    if entry is None:
        return None
    if _time.time() - entry["ts"] > _CONFIG_CACHE_TTL:
        _config_cache.pop(key, None)
        return None
    return entry["value"]


def _cache_set(clave: str, usuario_id, value: str, perfil_id=0):
    key = _cache_key(clave, usuario_id, perfil_id)
    _config_cache[key] = {"value": value, "ts": _time.time()}


def invalidate_config_cache(clave: str = None, usuario_id=None, perfil_id=None):
    """Invalidate config cache. Call after set_config().

    A write at a given level may change the resolved value of caches at deeper
    levels too (cascade), so when a clave is given we drop every cached entry
    for that clave to stay correct (cheap, since the cache is small).
    """
    if clave is None:
        _config_cache.clear()
    else:
        for key in list(_config_cache.keys()):
            if key[0] == clave:
                _config_cache.pop(key, None)


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


def get_config(clave: str, default: str = "", usuario_id: int = None,
               perfil_id: int = None) -> str:
    """Obtener valor de configuración (cached, TTL 60s).

    Cascada de 3 niveles (la más específica gana):
      1. (clave, usuario_id, perfil_id)  — config del perfil
      2. (clave, usuario_id, 0)          — config del usuario (compartida)
      3. (clave, 0, 0)                   — config global
      4. default
    """
    cache_uid = usuario_id if usuario_id is not None else 0
    cache_pid = perfil_id if perfil_id is not None else 0
    cached = _cache_get(clave, cache_uid, cache_pid)
    if cached is not None:
        return cached

    db = SessionLocal()
    try:
        # Build the lookup tuples in priority order.
        levels = []
        if usuario_id is not None and perfil_id is not None:
            levels.append((usuario_id, perfil_id))
        if usuario_id is not None:
            levels.append((usuario_id, 0))
        levels.append((0, 0))

        result = default
        for uid, pid in levels:
            config = (
                db.query(Configuracion)
                .filter(
                    Configuracion.clave == clave,
                    Configuracion.usuario_id == uid,
                    Configuracion.perfil_id == pid,
                )
                .first()
            )
            if config:
                result = config.valor
                break

        _cache_set(clave, cache_uid, result, cache_pid)
        return result
    finally:
        db.close()


def set_config(clave: str, valor: str, usuario_id: int = 0, perfil_id: int = 0):
    """Guardar config en el nivel (usuario_id, perfil_id).

    usuario_id=0 -> global ; perfil_id=0 -> nivel usuario (compartido).
    """
    db = SessionLocal()
    try:
        config = (
            db.query(Configuracion)
            .filter(
                Configuracion.clave == clave,
                Configuracion.usuario_id == usuario_id,
                Configuracion.perfil_id == perfil_id,
            )
            .first()
        )
        if config:
            config.valor = valor
        else:
            db.add(
                Configuracion(
                    clave=clave, usuario_id=usuario_id,
                    perfil_id=perfil_id, valor=valor,
                )
            )
        db.commit()
        invalidate_config_cache(clave, usuario_id, perfil_id)
    finally:
        db.close()


def get_all_config(usuario_id: int = None, perfil_id: int = None) -> dict:
    """Obtener toda la config mergeada: global(0,0) -> usuario(uid,0) -> perfil(uid,pid)."""
    db = SessionLocal()
    try:
        result = {}
        # Global
        for c in db.query(Configuracion).filter(
            Configuracion.usuario_id == 0,
            Configuracion.perfil_id == 0,
        ).all():
            result[c.clave] = c.valor

        if usuario_id is not None:
            # Usuario level (perfil_id=0)
            for c in db.query(Configuracion).filter(
                Configuracion.usuario_id == usuario_id,
                Configuracion.perfil_id == 0,
            ).all():
                result[c.clave] = c.valor

            # Perfil level
            if perfil_id is not None:
                for c in db.query(Configuracion).filter(
                    Configuracion.usuario_id == usuario_id,
                    Configuracion.perfil_id == perfil_id,
                ).all():
                    result[c.clave] = c.valor

        return result
    finally:
        db.close()


def is_tool_enabled(nombre: str, usuario_id: int = None,
                    perfil_id: int = None) -> bool:
    """Verificar si un tool está habilitado (cascada perfil -> usuario -> global)."""
    db = SessionLocal()
    try:
        levels = []
        if usuario_id is not None and perfil_id is not None:
            levels.append((usuario_id, perfil_id))
        if usuario_id is not None:
            levels.append((usuario_id, 0))
        levels.append((0, 0))

        for uid, pid in levels:
            tool = (
                db.query(ToolsConfig)
                .filter(
                    ToolsConfig.nombre == nombre,
                    ToolsConfig.usuario_id == uid,
                    ToolsConfig.perfil_id == pid,
                )
                .first()
            )
            if tool:
                return tool.habilitado
        return True
    finally:
        db.close()


def set_tool_enabled(nombre: str, habilitado: bool, usuario_id: int = 0,
                     perfil_id: int = 0):
    """Habilitar/deshabilitar un tool en el nivel (usuario_id, perfil_id)."""
    db = SessionLocal()
    try:
        tool = (
            db.query(ToolsConfig)
            .filter(
                ToolsConfig.nombre == nombre,
                ToolsConfig.usuario_id == usuario_id,
                ToolsConfig.perfil_id == perfil_id,
            )
            .first()
        )
        if tool:
            tool.habilitado = habilitado
        else:
            db.add(
                ToolsConfig(
                    nombre=nombre, usuario_id=usuario_id,
                    perfil_id=perfil_id, habilitado=habilitado,
                )
            )
        db.commit()
    finally:
        db.close()


def get_all_tools_config(usuario_id: int = None, perfil_id: int = None) -> list:
    """Obtener config de todos los tools mergeada: global -> usuario -> perfil."""
    db = SessionLocal()
    try:
        def _merge(into, rows):
            for t in rows:
                into[t.nombre] = {
                    "nombre": t.nombre,
                    "habilitado": t.habilitado,
                    "descripcion": t.descripcion,
                }

        result = {}
        _merge(result, db.query(ToolsConfig).filter(
            ToolsConfig.usuario_id == 0, ToolsConfig.perfil_id == 0
        ).all())

        if usuario_id is not None:
            _merge(result, db.query(ToolsConfig).filter(
                ToolsConfig.usuario_id == usuario_id, ToolsConfig.perfil_id == 0
            ).all())
            if perfil_id is not None:
                _merge(result, db.query(ToolsConfig).filter(
                    ToolsConfig.usuario_id == usuario_id,
                    ToolsConfig.perfil_id == perfil_id,
                ).all())

        return list(result.values())
    finally:
        db.close()


# ─── User defaults ──────────────────────────────────────────────────────


def create_user_defaults(db, usuario_id: int):
    """Crear datos por defecto para un usuario nuevo."""
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
    # openai_api_key NO se siembra en la BD: se lee siempre del env
    # (OPENAI_API_KEY) en get_openai_client, así cambiar la env basta y no
    # queda una key "congelada" en la base.

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

        default_config = [
            (
                "system_prompt",
                """Eres un asistente de WhatsApp profesional.
Atiendes a los clientes del negocio, respondes sus dudas y das información.
Responde claro, corto y amable.
Siempre saluda al cliente y ofrece ayuda.""",
            ),
            ("model", "gpt-4o-mini"),
            ("temperature", "0.7"),
            ("max_tokens", "500"),
            ("business_name", "Mi Negocio"),
            ("business_type", "barbería"),
        ]
        # openai_api_key NO se siembra; se lee del env (ver get_openai_client)

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
