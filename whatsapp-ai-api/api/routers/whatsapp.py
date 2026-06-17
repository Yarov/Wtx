"""
WhatsApp Router - Gestión de conexión WhatsApp (multi-perfil).
La configuración del bridge viene de variables de entorno.
Cada perfil usa su propia sesión: perfil_<id>.
"""

import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from models import Perfil, get_db
from database import get_config
from waha_manager import waha_manager, perfil_session
from api.routers.perfiles import get_current_perfil

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.post("/connect", summary="Conectar WhatsApp")
async def connect_whatsapp(
    request: Request,
    perfil: Perfil = Depends(get_current_perfil),
):
    """
    Endpoint principal para conectar WhatsApp del perfil actual.
    Crea la sesión perfil_<id> automáticamente y devuelve el QR.
    """
    # Verificar que el bridge está configurado
    if not waha_manager.is_configured():
        return {
            "success": False,
            "status": "ERROR",
            "message": "Sistema no configurado. Contacta al administrador.",
        }

    session_name = perfil_session(perfil.id)

    # Construir webhook URL - usar URL interna de Docker para comunicacion entre containers
    import os

    internal_url = os.getenv("WEBHOOK_INTERNAL_URL", "")
    base_url = get_config("app_base_url", "")

    if internal_url:
        webhook_url = internal_url
    elif base_url:
        webhook_url = f"{base_url}/api/webhook/whatsapp"
    else:
        # Fallback: usar nombre del container Docker (api:3000)
        webhook_url = "http://api:3000/api/webhook/whatsapp"

    logger.info(f"Conectando WhatsApp para sesión {session_name}")

    # Usar start_and_get_qr que crea, inicia y obtiene QR en un solo paso
    result = await waha_manager.start_and_get_qr(webhook_url, session_name)

    # Agregar mensaje amigable
    result["message"] = _get_status_message(result.get("status", "UNKNOWN"))
    result["perfil_id"] = perfil.id

    return result


def _get_status_message(status: str) -> str:
    """Mensaje amigable para cada estado"""
    messages = {
        "WORKING": "WhatsApp conectado correctamente",
        "SCAN_QR_CODE": "Escanea el código QR con tu WhatsApp",
        "STARTING": "Iniciando conexión...",
        "STOPPED": "Sesión detenida",
        "FAILED": "Error en la conexión",
        "NOT_FOUND": "Iniciando sesión...",
    }
    return messages.get(status, "Estado desconocido")


@router.get("/status", summary="Estado de conexión")
async def get_connection_status(
    perfil: Perfil = Depends(get_current_perfil),
    db: Session = Depends(get_db),
):
    """Obtener estado actual de la conexión WhatsApp del perfil actual"""
    if not waha_manager.is_configured():
        return {"success": False, "status": "ERROR", "connected": False}

    session_name = perfil_session(perfil.id)

    status_result = await waha_manager.get_session_status(session_name)
    current_status = status_result.get("status", "UNKNOWN")

    # Si necesita QR, obtenerlo
    qr_data = None
    if current_status == "SCAN_QR_CODE":
        qr_result = await waha_manager.get_qr_code(session_name)
        if qr_result.get("success"):
            qr_data = qr_result.get("qr_base64")

    # Si está conectado (WORKING), intentar guardar el número conectado en el perfil.
    if current_status == "WORKING":
        try:
            numero = _extract_connected_number(status_result.get("data", {}))
            if numero and perfil.numero_whatsapp != numero:
                perfil.numero_whatsapp = numero
                db.commit()
                logger.info(f"Número {numero} guardado para {session_name}")
            # TODO: si el bridge no expone el número en el status, consultarlo via
            #       un endpoint dedicado del bridge cuando esté disponible.
        except Exception as e:
            logger.warning(f"No se pudo guardar número de {session_name}: {e}")

    return {
        "success": True,
        "status": current_status,
        "connected": current_status == "WORKING",
        "qr": qr_data,
        "message": _get_status_message(current_status),
        "perfil_id": perfil.id,
        "numero_whatsapp": perfil.numero_whatsapp,
    }


def _extract_connected_number(data: dict) -> str | None:
    """
    Intentar extraer el número de WhatsApp conectado del payload de status.
    El bridge (estilo WAHA) suele exponerlo en `me.id` (ej. "5215512345678@c.us").
    Si no está presente, devuelve None (no bloquea).
    """
    if not isinstance(data, dict):
        return None
    me = data.get("me") or {}
    raw = ""
    if isinstance(me, dict):
        raw = me.get("id") or me.get("user") or ""
    if not raw:
        raw = data.get("phone") or data.get("number") or ""
    if not raw:
        return None
    numero = (
        str(raw)
        .replace("@c.us", "")
        .replace("@s.whatsapp.net", "")
        .replace("@lid", "")
        .replace("+", "")
        .strip()
    )
    return numero or None


@router.post("/disconnect", summary="Desconectar WhatsApp")
async def disconnect_whatsapp(
    perfil: Perfil = Depends(get_current_perfil),
):
    """Desconectar WhatsApp del perfil actual (requiere escanear QR de nuevo)"""
    session_name = perfil_session(perfil.id)
    result = await waha_manager.logout_session(session_name)
    return {
        "success": result.get("success", False),
        "message": "WhatsApp desconectado"
        if result.get("success")
        else result.get("error"),
    }
