"""
Message Service - Gestiona mensajes de conversacion individuales y eventos del sistema
"""

import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models import MensajeConversacion, Memoria

logger = logging.getLogger(__name__)


class MessageService:
    """Servicio para mensajes de conversacion per-message"""

    @staticmethod
    def add_message(
        db: Session,
        telefono: str,
        rol: str,
        contenido: str,
        usuario_id: int = None,
        tipo_evento: str = None,
        metadata: dict = None,
    ) -> dict:
        """Agregar un mensaje a la conversacion"""
        msg = MensajeConversacion(
            telefono=telefono,
            rol=rol,
            contenido=contenido,
            usuario_id=usuario_id,
            tipo_evento=tipo_evento,
            metadata_json=json.dumps(metadata, ensure_ascii=False)
            if metadata
            else None,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg.to_dict()

    @staticmethod
    def add_system_event(
        db: Session,
        telefono: str,
        tipo_evento: str,
        contenido: str,
        usuario_id: int = None,
        metadata: dict = None,
    ) -> dict:
        """Agregar un evento del sistema (datos guardados, cita agendada, etc.)"""
        return MessageService.add_message(
            db,
            telefono,
            "system",
            contenido,
            usuario_id=usuario_id,
            tipo_evento=tipo_evento,
            metadata=metadata,
        )

    @staticmethod
    def get_messages(db: Session, telefono: str, usuario_id: int = None, limit: int = 100) -> list:
        """Obtener todos los mensajes de una conversacion (incluyendo eventos)"""
        query = db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == telefono
        )
        if usuario_id is not None:
            query = query.filter(MensajeConversacion.usuario_id == usuario_id)
        msgs = (
            query
            .order_by(MensajeConversacion.created_at.asc())
            .limit(limit)
            .all()
        )
        return [m.to_dict() for m in msgs]

    @staticmethod
    def get_messages_for_ai(db: Session, telefono: str, usuario_id: int = None, limit: int = 20) -> list:
        """Obtener mensajes para contexto de OpenAI (solo user/assistant, sin system events)"""
        query = db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == telefono,
            MensajeConversacion.rol.in_(["user", "assistant"]),
            MensajeConversacion.tipo_evento == None,
        )
        if usuario_id is not None:
            query = query.filter(MensajeConversacion.usuario_id == usuario_id)
        msgs = (
            query
            .order_by(MensajeConversacion.created_at.desc())
            .limit(limit)
            .all()
        )

        # Revertir para orden cronologico
        msgs.reverse()
        return [{"role": m.rol, "content": m.contenido} for m in msgs]

    @staticmethod
    def get_conversations_list(db: Session, usuario_id: int = None, limit: int = 50, offset: int = 0) -> dict:
        """Obtener lista de conversaciones con ultimo mensaje, paginada"""
        from sqlalchemy import func, case, distinct
        from models import Contacto

        # Subquery: ultimo mensaje por telefono
        msg_query = db.query(
            MensajeConversacion.telefono,
            func.max(MensajeConversacion.created_at).label("last_at"),
            func.count(MensajeConversacion.id).label("msg_count"),
        )
        if usuario_id is not None:
            msg_query = msg_query.filter(MensajeConversacion.usuario_id == usuario_id)
        subq = msg_query.group_by(MensajeConversacion.telefono).subquery()

        # Join con contacto (include notas for last_read parsing)
        contact_query = db.query(
            subq.c.telefono,
            subq.c.last_at,
            subq.c.msg_count,
            Contacto.nombre,
            Contacto.estado_lead,
            Contacto.paso_funnel,
            Contacto.lead_score,
            Contacto.modo_humano,
            Contacto.notas,
        ).outerjoin(Contacto, Contacto.telefono == subq.c.telefono)
        if usuario_id is not None:
            contact_query = contact_query.filter(Contacto.usuario_id == usuario_id)

        # Total count before pagination
        total = contact_query.count()

        results = contact_query.order_by(subq.c.last_at.desc()).offset(offset).limit(limit).all()

        if not results:
            return {
                "conversations": [],
                "total": total,
                "limit": limit,
                "offset": offset,
            }

        telefonos = [row.telefono for row in results]

        # --- Batch: last non-event message per conversation ---
        last_msg_id_subq = db.query(
            MensajeConversacion.telefono,
            func.max(MensajeConversacion.id).label("max_id"),
        ).filter(
            MensajeConversacion.telefono.in_(telefonos),
            MensajeConversacion.tipo_evento == None,
        )
        if usuario_id is not None:
            last_msg_id_subq = last_msg_id_subq.filter(MensajeConversacion.usuario_id == usuario_id)
        last_msg_id_subq = last_msg_id_subq.group_by(MensajeConversacion.telefono).subquery()

        last_msgs_rows = (
            db.query(MensajeConversacion)
            .join(last_msg_id_subq, MensajeConversacion.id == last_msg_id_subq.c.max_id)
            .all()
        )
        last_msg_map = {m.telefono: m for m in last_msgs_rows}

        # --- Parse last_read timestamps from contact notas (already loaded, no extra query) ---
        last_read_map = {}
        for row in results:
            notas = row.notas
            if notas and "last_read:" in notas:
                try:
                    from datetime import datetime as _dt
                    lr_str = notas.split("last_read:")[1].split()[0]
                    last_read_map[row.telefono] = _dt.fromisoformat(lr_str)
                except Exception:
                    pass

        # --- Batch: unread counts for contacts WITH last_read ---
        unread_map = {}
        telefonos_with_lr = [t for t in telefonos if t in last_read_map]

        if telefonos_with_lr:
            min_lr = min(last_read_map[t] for t in telefonos_with_lr)
            unread_raw = db.query(
                MensajeConversacion.telefono,
                MensajeConversacion.created_at,
            ).filter(
                MensajeConversacion.telefono.in_(telefonos_with_lr),
                MensajeConversacion.rol == "user",
                MensajeConversacion.tipo_evento == None,
                MensajeConversacion.created_at > min_lr,
            )
            if usuario_id is not None:
                unread_raw = unread_raw.filter(MensajeConversacion.usuario_id == usuario_id)
            for tel, created_at in unread_raw.all():
                if created_at > last_read_map[tel]:
                    unread_map[tel] = unread_map.get(tel, 0) + 1

        # --- Batch: recent messages for contacts WITHOUT last_read (consecutive unread) ---
        telefonos_no_lr = [t for t in telefonos if t not in last_read_map]
        if telefonos_no_lr:
            recent_query = db.query(
                MensajeConversacion.telefono,
                MensajeConversacion.rol,
            ).filter(
                MensajeConversacion.telefono.in_(telefonos_no_lr),
                MensajeConversacion.tipo_evento == None,
            )
            if usuario_id is not None:
                recent_query = recent_query.filter(MensajeConversacion.usuario_id == usuario_id)
            recent_msgs = (
                recent_query
                .order_by(MensajeConversacion.telefono, MensajeConversacion.created_at.desc())
                .all()
            )
            # Count consecutive "user" messages from the top per conversation
            current_tel = None
            counting = True
            for tel, rol in recent_msgs:
                if tel != current_tel:
                    current_tel = tel
                    counting = True
                    unread_map[tel] = 0
                if counting:
                    if rol == "user":
                        unread_map[tel] = unread_map.get(tel, 0) + 1
                    else:
                        counting = False

        # --- Build response ---
        conversations = []
        for row in results:
            last_msg = last_msg_map.get(row.telefono)
            unread = unread_map.get(row.telefono, 0)

            conversations.append(
                {
                    "telefono": row.telefono,
                    "nombre": row.nombre,
                    "ultimo_mensaje": last_msg.contenido[:100] if last_msg else "",
                    "ultimo_role": last_msg.rol if last_msg else "",
                    "fecha": row.last_at.isoformat() if row.last_at else "",
                    "mensajes_count": row.msg_count,
                    "unread": unread,
                    "estado_lead": row.estado_lead or "nuevo",
                    "paso_funnel": row.paso_funnel,
                    "lead_score": row.lead_score or 0,
                    "modo_humano": row.modo_humano or False,
                }
            )

        return {
            "conversations": conversations,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def delete_conversation(db: Session, telefono: str, usuario_id: int = None) -> int:
        """Eliminar todos los mensajes de una conversacion"""
        query = db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == telefono
        )
        if usuario_id is not None:
            query = query.filter(MensajeConversacion.usuario_id == usuario_id)
        deleted = query.delete()
        # Tambien eliminar de la tabla de memoria legacy
        mem_query = db.query(Memoria).filter(Memoria.telefono == telefono)
        if usuario_id is not None:
            mem_query = mem_query.filter(Memoria.usuario_id == usuario_id)
        mem_query.delete()
        db.commit()
        return deleted

    @staticmethod
    def migrate_from_memoria(db: Session, telefono: str, usuario_id: int = None):
        """Migrar mensajes de la tabla Memoria (JSON blob) a mensajes individuales.
        Se ejecuta la primera vez que se accede a una conversacion."""
        # Verificar si ya hay mensajes en la nueva tabla
        existing_query = db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == telefono
        )
        if usuario_id is not None:
            existing_query = existing_query.filter(MensajeConversacion.usuario_id == usuario_id)
        existing = existing_query.first()
        if existing:
            return  # Ya migrado

        # Obtener de Memoria
        mem_query = db.query(Memoria).filter(Memoria.telefono == telefono)
        if usuario_id is not None:
            mem_query = mem_query.filter(Memoria.usuario_id == usuario_id)
        memoria = mem_query.first()
        if not memoria or not memoria.historial:
            return

        try:
            historial = json.loads(memoria.historial)
        except (json.JSONDecodeError, TypeError):
            return

        for msg in historial:
            rol = msg.get("role", "user")
            contenido = msg.get("content", "")
            if contenido:
                db.add(
                    MensajeConversacion(
                        telefono=telefono,
                        rol=rol,
                        contenido=contenido,
                        usuario_id=usuario_id,
                    )
                )

        db.commit()
        logger.info(
            f"Migrados {len(historial)} mensajes de Memoria a MensajeConversacion para {telefono}"
        )
