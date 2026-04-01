"""Conversations Router - Chat history and memory management"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from models import SessionLocal, Memoria, Contacto, Usuario
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
    responses={401: {"description": "Not authenticated"}}
)


class SendMessageRequest(BaseModel):
    message: str


@router.get("", summary="List all conversations", description="Get a summary of all WhatsApp conversations with last message preview, unread count and timestamp.")
async def get_conversations(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        memorias = db.query(Memoria).order_by(Memoria.updated_at.desc()).all()
        result = []
        for m in memorias:
            try:
                historial = json.loads(m.historial) if m.historial else []
            except (json.JSONDecodeError, TypeError):
                historial = []

            # Get last message preview (from either role)
            ultimo = ""
            ultimo_role = ""
            if historial:
                ultimo = historial[-1].get("content", "")
                ultimo_role = historial[-1].get("role", "")

            # Count unread (user messages after last assistant message)
            unread = 0
            for msg in reversed(historial):
                if msg.get("role") == "user":
                    unread += 1
                else:
                    break

            # Try to get contact name
            contacto = db.query(Contacto).filter(Contacto.telefono == m.telefono).first()
            nombre = contacto.nombre if contacto else None

            result.append({
                "telefono": m.telefono,
                "nombre": nombre,
                "ultimo_mensaje": ultimo[:100] + "..." if len(ultimo) > 100 else ultimo,
                "ultimo_role": ultimo_role,
                "fecha": m.updated_at.isoformat() if m.updated_at else "",
                "mensajes_count": len(historial),
                "unread": unread,
            })
        return result
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail="Error loading conversations")
    finally:
        db.close()


@router.get("/{phone}", summary="Get conversation history", description="Retrieve the complete message history for a specific phone number.")
async def get_conversation(phone: str, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        memoria = db.query(Memoria).filter(Memoria.telefono == phone).first()
        if not memoria:
            return {"messages": [], "telefono": phone}
        try:
            messages = json.loads(memoria.historial) if memoria.historial else []
        except (json.JSONDecodeError, TypeError):
            messages = []
        return {
            "messages": messages,
            "telefono": phone,
            "updated_at": memoria.updated_at.isoformat() if memoria.updated_at else None,
        }
    except Exception as e:
        logger.error(f"Error getting conversation for {phone}: {e}")
        raise HTTPException(status_code=500, detail="Error loading conversation")
    finally:
        db.close()


@router.delete("/{phone}", summary="Delete conversation", description="Permanently delete all chat history and memory for a phone number.")
async def delete_conversation(phone: str, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        deleted = db.query(Memoria).filter(Memoria.telefono == phone).delete()
        db.commit()
        if deleted == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"status": "ok", "deleted": deleted}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting conversation for {phone}: {e}")
        raise HTTPException(status_code=500, detail="Error deleting conversation")
    finally:
        db.close()


@router.post("/{phone}/send", summary="Send message", description="Send a WhatsApp message to a contact and save it to conversation history.")
async def send_message(phone: str, data: SendMessageRequest, current_user: Usuario = Depends(get_current_user)):
    from whatsapp_service import whatsapp_service

    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if not whatsapp_service.is_configured():
        raise HTTPException(status_code=503, detail="WhatsApp service not configured")

    # Send message via WhatsApp
    result = await whatsapp_service.send_message(phone, data.message)

    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Failed to send message")
        )

    # Save to conversation memory
    db = SessionLocal()
    try:
        memoria = db.query(Memoria).filter(Memoria.telefono == phone).first()
        if memoria:
            try:
                historial = json.loads(memoria.historial) if memoria.historial else []
            except (json.JSONDecodeError, TypeError):
                historial = []
        else:
            historial = []
            memoria = Memoria(telefono=phone, historial="[]")
            db.add(memoria)

        historial.append({
            "role": "assistant",
            "content": data.message,
        })
        memoria.historial = json.dumps(historial)
        memoria.updated_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving sent message to memory: {e}")
        # Message was sent successfully, just failed to save locally
    finally:
        db.close()

    return {"status": "ok", "sent": True}
