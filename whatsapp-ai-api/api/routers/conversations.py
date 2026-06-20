"""Conversations Router - Chat history with per-message storage and system events"""

import json
import logging
import os
import uuid
import mimetypes
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from models import SessionLocal, Memoria, Contacto, Usuario, MensajeConversacion, Perfil
from auth import get_current_user
from api.routers.perfiles import get_current_perfil
from message_service import MessageService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
    responses={401: {"description": "Not authenticated"}},
)


class SendMessageRequest(BaseModel):
    message: str
    quoted_wa_id: Optional[str] = None
    quoted_body: Optional[str] = None
    quoted_from_me: Optional[bool] = None


MEDIA_DIR = "/app/uploads/media"


@router.post("/{phone}/read", summary="Mark conversation as read")
async def mark_as_read(
    phone: str,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    db = SessionLocal()
    try:
        from datetime import datetime

        contacto = db.query(Contacto).filter(
            Contacto.telefono == phone,
            Contacto.usuario_id == current_user.id,
            Contacto.perfil_id == perfil.id,
        ).first()
        if contacto:
            # Guardar en notas (no contaminar datos_capturados)
            contacto.notas = f"last_read:{datetime.utcnow().isoformat()}"
            db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.get("", summary="List all conversations")
async def get_conversations(
    limit: int = 50,
    offset: int = 0,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    db = SessionLocal()
    try:
        # Obtener de nueva tabla (paginated)
        result = MessageService.get_conversations_list(
            db, usuario_id=current_user.id, limit=limit, offset=offset, perfil_id=perfil.id
        )
        new_convs = result["conversations"]
        total = result["total"]
        new_phones = {c["telefono"] for c in new_convs}

        # Tambien buscar en tabla legacy Memoria (contactos no migrados) - limited
        memorias = (
            db.query(Memoria)
            .filter(
                Memoria.usuario_id == current_user.id,
                Memoria.perfil_id == perfil.id,
                ~Memoria.telefono.like("test%"),  # Excluir prueba (test-chat)
            )
            .order_by(Memoria.updated_at.desc())
            .limit(limit)
            .all()
        )
        for m in memorias:
            if m.telefono in new_phones:
                continue  # Ya esta en la nueva tabla
            try:
                historial = json.loads(m.historial) if m.historial else []
            except (json.JSONDecodeError, TypeError):
                historial = []
            if not historial:
                continue

            ultimo = historial[-1].get("content", "") if historial else ""
            ultimo_role = historial[-1].get("role", "") if historial else ""
            unread = 0
            for msg in reversed(historial):
                if msg.get("role") == "user":
                    unread += 1
                else:
                    break

            contacto = (
                db.query(Contacto).filter(
                    Contacto.telefono == m.telefono,
                    Contacto.usuario_id == current_user.id,
                    Contacto.perfil_id == perfil.id,
                ).first()
            )
            new_convs.append(
                {
                    "telefono": m.telefono,
                    "nombre": contacto.nombre if contacto else None,
                    "ultimo_mensaje": ultimo[:100] + "..."
                    if len(ultimo) > 100
                    else ultimo,
                    "ultimo_role": ultimo_role,
                    "fecha": m.updated_at.isoformat() if m.updated_at else "",
                    "mensajes_count": len(historial),
                    "unread": unread,
                    "estado_lead": contacto.estado_lead if contacto else "nuevo",
                    "paso_funnel": contacto.paso_funnel if contacto else None,
                    "lead_score": contacto.lead_score if contacto else 0,
                    "modo_humano": contacto.modo_humano if contacto else False,
                }
            )

        # Ordenar por fecha desc
        new_convs.sort(key=lambda c: c.get("fecha", ""), reverse=True)
        return {
            "conversations": new_convs,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.error(f"Error listing conversations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error loading conversations")
    finally:
        db.close()


@router.get("/{phone}", summary="Get conversation history with system events")
async def get_conversation(
    phone: str,
    before_id: int = None,
    limit: int = 30,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    db = SessionLocal()
    try:
        MessageService.migrate_from_memoria(db, phone, usuario_id=current_user.id, perfil_id=perfil.id)

        # Paginacion: ultimos N mensajes, o N mensajes antes de before_id
        query = db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == phone,
            MensajeConversacion.usuario_id == current_user.id,
            MensajeConversacion.perfil_id == perfil.id,
        )
        if before_id:
            query = query.filter(MensajeConversacion.id < before_id)

        total = (
            db.query(MensajeConversacion)
            .filter(
                MensajeConversacion.telefono == phone,
                MensajeConversacion.usuario_id == current_user.id,
                MensajeConversacion.perfil_id == perfil.id,
            )
            .count()
        )

        msgs = query.order_by(MensajeConversacion.created_at.desc()).limit(limit).all()
        msgs.reverse()  # Orden cronologico

        contacto = db.query(Contacto).filter(
            Contacto.telefono == phone,
            Contacto.usuario_id == current_user.id,
            Contacto.perfil_id == perfil.id,
        ).first()
        contact_data = contacto.to_dict() if contacto else None

        has_more = False
        if msgs:
            oldest_id = msgs[0]["id"] if isinstance(msgs[0], dict) else msgs[0].id
            older_count = (
                db.query(MensajeConversacion)
                .filter(
                    MensajeConversacion.telefono == phone,
                    MensajeConversacion.usuario_id == current_user.id,
                    MensajeConversacion.perfil_id == perfil.id,
                    MensajeConversacion.id < oldest_id,
                )
                .count()
            )
            has_more = older_count > 0

        return {
            "messages": [m.to_dict() for m in msgs],
            "telefono": phone,
            "contacto": contact_data,
            "has_more": has_more,
            "total": total,
        }
    except Exception as e:
        logger.error(f"Error getting conversation for {phone}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error loading conversation")
    finally:
        db.close()


@router.delete("/{phone}", summary="Delete conversation")
async def delete_conversation(
    phone: str,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    db = SessionLocal()
    try:
        deleted = MessageService.delete_conversation(db, phone, usuario_id=current_user.id, perfil_id=perfil.id)
        if deleted == 0:
            # Intentar legacy
            deleted = db.query(Memoria).filter(
                Memoria.telefono == phone,
                Memoria.usuario_id == current_user.id,
                Memoria.perfil_id == perfil.id,
            ).delete()
            db.commit()
        if deleted == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"status": "ok", "deleted": deleted}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail="Error deleting conversation")
    finally:
        db.close()


@router.post("/{phone}/send", summary="Send message manually")
async def send_message(
    phone: str,
    data: SendMessageRequest,
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from whatsapp_service import whatsapp_service

    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if not whatsapp_service.is_configured():
        raise HTTPException(status_code=503, detail="WhatsApp service not configured")

    result = await whatsapp_service.send_message(
        phone, data.message, session=f"perfil_{perfil.id}", quoted_message_id=data.quoted_wa_id
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502, detail=result.get("error", "Failed to send message")
        )

    # Capturar el id del mensaje enviado (wa_id) que devuelve el bridge
    sent_wa_id = (result.get("data") or {}).get("id")

    # Metadata del mensaje saliente
    msg_metadata = {"source": "dashboard"}
    if sent_wa_id:
        msg_metadata["wa_id"] = sent_wa_id
    if data.quoted_wa_id:
        msg_metadata["quoted"] = {
            "body": data.quoted_body,
            "fromMe": data.quoted_from_me,
        }

    # Notificar via WebSocket
    from ws_manager import ws_manager

    await ws_manager.broadcast_to_perfil(
        current_user.id,
        perfil.id,
        "new_message",
        {
            "telefono": phone,
            "mensaje": data.message,
            "rol": "assistant",
        },
    )

    # Guardar en nueva tabla de mensajes
    db = SessionLocal()
    try:
        MessageService.add_message(
            db, phone, "assistant", data.message, usuario_id=current_user.id, metadata=msg_metadata, perfil_id=perfil.id
        )

        # Tambien legacy
        memoria = db.query(Memoria).filter(
            Memoria.telefono == phone,
            Memoria.usuario_id == current_user.id,
            Memoria.perfil_id == perfil.id,
        ).first()
        if memoria:
            try:
                historial = json.loads(memoria.historial) if memoria.historial else []
            except (json.JSONDecodeError, TypeError):
                historial = []
        else:
            historial = []
            memoria = Memoria(telefono=phone, historial="[]", usuario_id=current_user.id, perfil_id=perfil.id)
            db.add(memoria)

        historial.append({"role": "assistant", "content": data.message})
        memoria.historial = json.dumps(historial)
        memoria.updated_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving sent message: {e}")
    finally:
        db.close()

    return {"status": "ok", "sent": True}


@router.post("/{phone}/send-image", summary="Send image manually")
async def send_image(
    phone: str,
    file: UploadFile = File(...),
    caption: str = Form(""),
    view_once: bool = Form(False),
    quoted_wa_id: str = Form(None),
    quoted_body: str = Form(None),
    quoted_from_me: bool = Form(False),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from whatsapp_service import whatsapp_service

    if not whatsapp_service.is_configured():
        raise HTTPException(status_code=503, detail="WhatsApp service not configured")

    # Determinar mimetype y extensión
    media_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "image/jpeg"
    ext = os.path.splitext(file.filename or "")[1].lstrip(".").lower()
    if not ext:
        ext = (mimetypes.guess_extension(media_type) or ".jpg").lstrip(".")

    # Guardar archivo en el volumen compartido con el bridge
    os.makedirs(MEDIA_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    disk_path = os.path.join(MEDIA_DIR, filename)
    try:
        content = await file.read()
        with open(disk_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Error saving uploaded image: {e}")
        raise HTTPException(status_code=500, detail="Failed to store image")

    # Ruta compartida (la ve el bridge) y URL pública (la sirve la API)
    bridge_path = f"{MEDIA_DIR}/{filename}"
    media_url = f"/uploads/media/{filename}"

    result = await whatsapp_service.send_image(
        phone,
        bridge_path,
        caption=caption,
        session=f"perfil_{perfil.id}",
        view_once=view_once,
        quoted_message_id=quoted_wa_id,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502, detail=result.get("error", "Failed to send image")
        )

    # Capturar el id del mensaje enviado (wa_id) que devuelve el bridge
    sent_wa_id = (result.get("data") or {}).get("id")

    # Metadata del mensaje saliente
    msg_metadata = {
        "source": "dashboard",
        "media_url": media_url,
        "media_type": media_type,
        "view_once": view_once,
    }
    if sent_wa_id:
        msg_metadata["wa_id"] = sent_wa_id
    if quoted_wa_id:
        msg_metadata["quoted"] = {
            "body": quoted_body,
            "fromMe": quoted_from_me,
        }

    contenido = caption or "[Imagen]"

    # Notificar via WebSocket
    from ws_manager import ws_manager

    await ws_manager.broadcast_to_perfil(
        current_user.id,
        perfil.id,
        "new_message",
        {
            "telefono": phone,
            "mensaje": contenido,
            "rol": "assistant",
            "media_url": media_url,
        },
    )

    # Guardar en nueva tabla de mensajes
    db = SessionLocal()
    try:
        MessageService.add_message(
            db, phone, "assistant", contenido, usuario_id=current_user.id, metadata=msg_metadata, perfil_id=perfil.id
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving sent image: {e}")
    finally:
        db.close()

    return {"success": True, "media_url": media_url}
