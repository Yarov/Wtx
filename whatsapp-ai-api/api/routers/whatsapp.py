"""
WhatsApp Router - Gestión de conexión WhatsApp
La configuración de WAHA viene de variables de entorno.
"""
import logging
from fastapi import APIRouter, Depends, Request

from auth import get_current_user
from models import Usuario
from database import get_config
from waha_manager import waha_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.post("/connect", summary="Conectar WhatsApp")
async def connect_whatsapp(
    request: Request,
    current_user: Usuario = Depends(get_current_user)
):
    """
    Endpoint principal para conectar WhatsApp.
    Crea la sesión automáticamente y devuelve el QR.
    Todo es transparente para el usuario.
    """
    # Verificar que WAHA está configurado
    if not waha_manager.is_configured():
        return {
            "success": False,
            "status": "ERROR",
            "message": "Sistema no configurado. Contacta al administrador."
        }
    
    # Construir webhook URL
    base_url = get_config("app_base_url", "")
    if not base_url:
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
        if host:
            base_url = f"{scheme}://{host}"
    
    if not base_url:
        return {
            "success": False,
            "status": "ERROR", 
            "message": "No se pudo determinar la URL del servidor"
        }
    
    webhook_url = f"{base_url}/api/webhook/whatsapp"
    
    # Usar start_and_get_qr que crea, inicia y obtiene QR en un solo paso
    result = await waha_manager.start_and_get_qr(webhook_url)
    
    # Agregar mensaje amigable
    result["message"] = _get_status_message(result.get("status", "UNKNOWN"))
    
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
async def get_connection_status(current_user: Usuario = Depends(get_current_user)):
    """Obtener estado actual de la conexión WhatsApp"""
    if not waha_manager.is_configured():
        return {"success": False, "status": "ERROR", "connected": False}
    
    status_result = await waha_manager.get_session_status()
    current_status = status_result.get("status", "UNKNOWN")
    
    # Si necesita QR, obtenerlo
    qr_data = None
    if current_status == "SCAN_QR_CODE":
        qr_result = await waha_manager.get_qr_code()
        if qr_result.get("success"):
            qr_data = qr_result.get("qr_base64")
    
    return {
        "success": True,
        "status": current_status,
        "connected": current_status == "WORKING",
        "qr": qr_data,
        "message": _get_status_message(current_status)
    }


@router.post("/disconnect", summary="Desconectar WhatsApp")
async def disconnect_whatsapp(current_user: Usuario = Depends(get_current_user)):
    """Desconectar WhatsApp (requiere escanear QR de nuevo)"""
    result = await waha_manager.logout_session()
    return {
        "success": result.get("success", False),
        "message": "WhatsApp desconectado" if result.get("success") else result.get("error")
    }


