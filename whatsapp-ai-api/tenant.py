"""
Tenant utilities for multi-tenancy support.
Resolves which user owns a phone contact and provides user-scoped helpers.
"""
import logging
from sqlalchemy.orm import Session
from models import Contacto, MensajeConversacion

logger = logging.getLogger(__name__)


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
