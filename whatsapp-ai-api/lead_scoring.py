"""
Lead Scoring Service - Calcula puntuacion automatica de leads
"""

import json
import logging
from sqlalchemy.orm import Session
from models import Contacto, MensajeConversacion

logger = logging.getLogger(__name__)


# Estados de lead en orden de avance
LEAD_STATES = [
    "nuevo",  # Acaba de llegar
    "contactado",  # Ha intercambiado mensajes
    "calificado",  # Se tienen datos basicos
    "interesado",  # Ha mostrado interes activo
    "negociacion",  # En proceso de cierre
    "cerrado",  # Deal cerrado
    "perdido",  # No convirtio
]


def calculate_lead_score(db: Session, telefono: str, usuario_id: int) -> int:
    """
    Calcular lead score (0-100) basado en:
    - Datos capturados: +10 por campo
    - Mensajes intercambiados: +2 por mensaje (max 20 pts)
    - Paso del funnel: +10 por paso avanzado
    - Estado del lead: +5 por cada nivel
    """
    contacto = db.query(Contacto).filter(
        Contacto.telefono == telefono,
        Contacto.usuario_id == usuario_id,
    ).first()
    if not contacto:
        return 0

    score = 0

    # 1. Datos capturados (+10 cada uno, max 40)
    try:
        datos = (
            json.loads(contacto.datos_capturados) if contacto.datos_capturados else {}
        )
    except (json.JSONDecodeError, TypeError):
        datos = {}

    campos_con_valor = sum(1 for v in datos.values() if v and str(v).strip())
    score += min(campos_con_valor * 10, 40)

    # 2. Mensajes intercambiados (+2 cada uno, max 20)
    msg_count = (
        db.query(MensajeConversacion)
        .filter(
            MensajeConversacion.telefono == telefono,
            MensajeConversacion.usuario_id == usuario_id,
            MensajeConversacion.rol == "user",
            MensajeConversacion.tipo_evento == None,
        )
        .count()
    )
    score += min(msg_count * 2, 20)

    # 3. Paso del funnel avanzado (+5 por paso, usa orden)
    if contacto.paso_funnel:
        from models import FunnelPaso

        paso = (
            db.query(FunnelPaso)
            .filter(
                FunnelPaso.nombre == contacto.paso_funnel,
                FunnelPaso.usuario_id == usuario_id,
            )
            .first()
        )
        if paso:
            score += min(paso.orden * 5, 20)

    return min(score, 100)


def update_lead_score(db: Session, telefono: str, usuario_id: int) -> int:
    """Recalcular y guardar el lead score"""
    score = calculate_lead_score(db, telefono, usuario_id)
    contacto = db.query(Contacto).filter(
        Contacto.telefono == telefono,
        Contacto.usuario_id == usuario_id,
    ).first()
    if contacto:
        contacto.lead_score = score
        db.commit()
    return score


def update_lead_state(db: Session, telefono: str, usuario_id: int) -> str:
    """Actualizar estado del lead basado en actividad automatica"""
    contacto = db.query(Contacto).filter(
        Contacto.telefono == telefono,
        Contacto.usuario_id == usuario_id,
    ).first()
    if not contacto:
        return "nuevo"

    current_state = contacto.estado_lead or "nuevo"
    if current_state in ("cerrado", "perdido"):
        return current_state  # No cambiar estados finales automaticamente

    # Determinar nuevo estado basado en score y actividad
    score = contacto.lead_score or 0
    try:
        datos = (
            json.loads(contacto.datos_capturados) if contacto.datos_capturados else {}
        )
    except (json.JSONDecodeError, TypeError):
        datos = {}

    new_state = current_state

    if score >= 60:
        new_state = "interesado"
    elif score >= 30 and len(datos) >= 2:
        new_state = "calificado"
    elif contacto.total_mensajes and contacto.total_mensajes > 0:
        new_state = "contactado"

    # Solo avanzar, nunca retroceder
    current_idx = (
        LEAD_STATES.index(current_state) if current_state in LEAD_STATES else 0
    )
    new_idx = LEAD_STATES.index(new_state) if new_state in LEAD_STATES else 0

    if new_idx > current_idx:
        contacto.estado_lead = new_state
        db.commit()
        return new_state

    return current_state
