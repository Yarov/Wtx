"""
Tenant utilities for multi-tenancy support.
Resolves which user owns a phone contact and provides user-scoped helpers.
"""
import logging
from sqlalchemy.orm import Session
from models import Contacto, MensajeConversacion, Perfil

logger = logging.getLogger(__name__)


def resolver_perfil_por_session(session_name: str, db: Session):
    """Resolve (usuario_id, perfil_id) from the bridge session name "perfil_<id>".

    This is the authoritative routing: an incoming message arrived on the
    WhatsApp session of a specific profile, so it belongs to that profile and
    its owner. Returns (None, None) if the session name is not a valid profile.
    """
    if not session_name or not session_name.startswith("perfil_"):
        return None, None
    try:
        perfil_id = int(session_name.split("_", 1)[1])
    except (ValueError, IndexError):
        return None, None
    perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    if not perfil:
        return None, None
    return perfil.usuario_id, perfil.id


def resolver_usuario_por_telefono(telefono: str, db: Session) -> int:
    """Determinar qué usuario es dueño de este contacto por teléfono.

    Rules:
    1. If exactly one user has this contact: return that user
    2. If multiple users have this contact: return the one with most recent message
    3. If no user has this contact: return default user (1)
    """
    contactos = (
        db.query(Contacto)
        .filter(Contacto.telefono == telefono)
        .all()
    )

    if len(contactos) == 1:
        return contactos[0].usuario_id

    if len(contactos) > 1:
        # Multiple users have this contact - pick most recently active
        best = max(contactos, key=lambda c: c.ultimo_mensaje or c.created_at)
        return best.usuario_id

    # No contact found - check messages
    msg = (
        db.query(MensajeConversacion)
        .filter(MensajeConversacion.telefono == telefono)
        .order_by(MensajeConversacion.created_at.desc())
        .first()
    )
    if msg:
        return msg.usuario_id

    # Default to user 1
    return 1
