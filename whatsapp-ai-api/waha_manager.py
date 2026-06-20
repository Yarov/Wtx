"""
WAHA Session Manager - Gestión de sesiones WhatsApp via el bridge multi-sesión.

Cada perfil (tabla `perfiles`) tiene su propia sesión en el bridge, identificada
por un session name `perfil_<id>`. Todos los métodos se parametrizan por
`session_name` para soportar multi-perfil SaaS.
"""
import os
import asyncio
import httpx
import logging

logger = logging.getLogger(__name__)


def perfil_session(perfil_id) -> str:
    """Construye el session name del bridge para un perfil dado."""
    return f"perfil_{perfil_id}"


class WAHAManager:
    """Gestiona sesiones de WhatsApp a través del bridge (multi-sesión)."""

    def __init__(self):
        self.api_url = os.getenv("WHATSAPP_API_URL", "").rstrip("/")
        self.api_key = os.getenv("WHATSAPP_API_KEY", "")

    def is_configured(self) -> bool:
        """Verificar si el bridge está configurado via env vars"""
        return bool(self.api_url and self.api_key)

    def _get_headers(self) -> dict:
        """Headers para el bridge"""
        return {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    async def start_and_get_qr(self, webhook_url: str, session_name: str) -> dict:
        """
        Iniciar la sesión `session_name` y obtener QR.

        Args:
            webhook_url: URL donde el bridge enviará los eventos
            session_name: nombre de la sesión (ej. "perfil_5")

        Returns:
            dict con success, status, qr (si aplica)
        """
        if not self.is_configured():
            return {"success": False, "status": "ERROR", "error": "Bridge no configurado"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Intentar iniciar sesión
                url = f"{self.api_url}/api/sessions/start"
                payload = {
                    "name": session_name,
                    "config": {
                        "webhooks": [
                            {
                                "url": webhook_url,
                                "events": ["message", "session.status"]
                            }
                        ]
                    }
                }

                logger.info(f"Iniciando sesión '{session_name}' con webhook: {webhook_url}")
                response = await client.post(url, json=payload, headers=self._get_headers())

                # Si 422, la sesión ya está iniciada - actualizar webhook y obtener estado
                if response.status_code == 422:
                    logger.info(f"Sesión '{session_name}' ya iniciada, actualizando webhook...")
                    # Actualizar webhook en sesión existente
                    await self.update_webhook(webhook_url, session_name)

                    status_result = await self.get_session_status(session_name)
                    if status_result.get("success"):
                        status = status_result.get("status", "UNKNOWN")
                        data = status_result.get("data", {})
                    else:
                        return status_result
                elif response.status_code in [200, 201]:
                    data = response.json()
                    status = data.get("status", "UNKNOWN")
                else:
                    error_msg = response.text
                    logger.error(f"Error: {response.status_code} - {error_msg}")
                    return {"success": False, "status": "ERROR", "error": error_msg}

                logger.info(f"Sesión '{session_name}', Estado: {status}")

                # Si necesita QR, obtenerlo
                qr_data = None
                if status == "SCAN_QR_CODE":
                    qr_result = await self.get_qr_code(session_name)
                    if qr_result.get("success"):
                        qr_data = qr_result.get("qr_base64")

                return {
                    "success": True,
                    "status": status,
                    "connected": status == "WORKING",
                    "qr": qr_data,
                    "data": data
                }

        except Exception as e:
            logger.error(f"Error en start_and_get_qr ({session_name}): {e}")
            return {"success": False, "status": "ERROR", "error": str(e)}

    async def start_and_get_code(self, phone: str, webhook_url: str, session_name: str) -> dict:
        """
        Iniciar la sesión `session_name` y obtener un código de emparejamiento
        (pairing code) en lugar de QR.

        Args:
            phone: número en formato E.164 SIN '+' (ej. "5215512345678")
            webhook_url: URL donde el bridge enviará los eventos
            session_name: nombre de la sesión (ej. "perfil_5")

        Returns:
            dict con success, status, code (si aplica)
        """
        if not self.is_configured():
            return {"success": False, "status": "ERROR", "error": "Bridge no configurado"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Intentar iniciar sesión con phoneNumber para pairing code
                url = f"{self.api_url}/api/sessions/start"
                payload = {
                    "name": session_name,
                    "phoneNumber": phone,
                    "config": {
                        "webhooks": [
                            {
                                "url": webhook_url,
                                "events": ["message", "session.status"]
                            }
                        ]
                    }
                }

                logger.info(f"Iniciando sesión '{session_name}' (pairing code) con webhook: {webhook_url}")
                response = await client.post(url, json=payload, headers=self._get_headers())

                code = None
                # Si 422, la sesión ya está iniciada - actualizar webhook y obtener estado
                if response.status_code == 422:
                    logger.info(f"Sesión '{session_name}' ya iniciada, actualizando webhook...")
                    await self.update_webhook(webhook_url, session_name)

                    status_result = await self.get_session_status(session_name)
                    if status_result.get("success"):
                        status = status_result.get("status", "UNKNOWN")
                        data = status_result.get("data", {})
                        code = status_result.get("pairingCode")
                    else:
                        return status_result
                elif response.status_code in [200, 201]:
                    data = response.json()
                    status = data.get("status", "UNKNOWN")
                    code = data.get("pairingCode") or data.get("code")
                else:
                    error_msg = response.text
                    logger.error(f"Error: {response.status_code} - {error_msg}")
                    return {"success": False, "status": "ERROR", "error": error_msg}

                logger.info(f"Sesión '{session_name}', Estado: {status}")

                # Si el código no vino en la respuesta inicial, hacer polling.
                # El bridge genera el pairing code en el evento 'qr' (asíncrono,
                # tarda 1-5s tras initialize), así que esperamos entre intentos.
                if not code and status in ("SCAN_QR_CODE", "STARTING", "UNKNOWN"):
                    for _ in range(5):
                        await asyncio.sleep(1.5)
                        code_result = await self.get_pairing_code(session_name)
                        if code_result.get("success") and code_result.get("code"):
                            code = code_result.get("code")
                            break

                return {
                    "success": True,
                    "status": status,
                    "connected": status == "WORKING",
                    "code": code,
                    "data": data
                }

        except Exception as e:
            logger.error(f"Error en start_and_get_code ({session_name}): {e}")
            return {"success": False, "status": "ERROR", "error": str(e)}

    async def get_pairing_code(self, session_name: str) -> dict:
        """
        Obtener código de emparejamiento (pairing code) para vincular sin QR.

        Returns:
            dict con success y code/error
        """
        if not self.is_configured():
            return {"success": False, "error": "Bridge no configurado"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.api_url}/api/{session_name}/auth/code"
                headers = self._get_headers()
                headers["Accept"] = "application/json"

                response = await client.get(url, headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    code = data.get("code") or data.get("pairingCode")
                    if code:
                        return {"success": True, "code": code}
                    else:
                        return {"success": False, "error": "Código no disponible"}
                elif response.status_code == 404:
                    return {"success": False, "error": "Código no disponible aún"}
                else:
                    return {"success": False, "error": response.text}

        except Exception as e:
            logger.error(f"Error obteniendo código ({session_name}): {e}")
            return {"success": False, "error": str(e)}

    async def logout_session(self, session_name: str) -> dict:
        """Cerrar sesión de WhatsApp (desvincula el dispositivo)"""
        if not self.is_configured():
            return {"success": False, "error": "Bridge no configurado"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.api_url}/api/sessions/{session_name}/logout"
                response = await client.post(url, headers=self._get_headers())

                if response.status_code in [200, 201]:
                    return {"success": True, "data": response.json()}
                else:
                    return {"success": False, "error": response.text}

        except Exception as e:
            logger.error(f"Error cerrando sesión ({session_name}): {e}")
            return {"success": False, "error": str(e)}

    async def get_qr_code(self, session_name: str) -> dict:
        """
        Obtener código QR para escanear.

        Returns:
            dict con success y qr_base64/error
        """
        if not self.is_configured():
            return {"success": False, "error": "Bridge no configurado"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.api_url}/api/{session_name}/auth/qr"
                headers = self._get_headers()
                headers["Accept"] = "application/json"

                response = await client.get(url, headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    # El bridge puede retornar en diferentes formatos
                    qr_data = data.get("data") or data.get("qrCode") or data.get("value")
                    mimetype = data.get("mimetype", "image/png")

                    if qr_data:
                        # Si no tiene el prefijo data:, agregarlo
                        if not qr_data.startswith("data:"):
                            qr_data = f"data:{mimetype};base64,{qr_data}"
                        return {"success": True, "qr_base64": qr_data}
                    else:
                        return {"success": False, "error": "QR no disponible"}
                elif response.status_code == 404:
                    return {"success": False, "error": "Sesión no existe. Créala primero."}
                else:
                    return {"success": False, "error": response.text}

        except Exception as e:
            logger.error(f"Error obteniendo QR ({session_name}): {e}")
            return {"success": False, "error": str(e)}

    async def get_session_status(self, session_name: str) -> dict:
        """
        Obtener estado de la sesión.

        Estados posibles:
        - STOPPED: Sesión detenida
        - STARTING: Iniciando
        - SCAN_QR_CODE: Esperando escaneo de QR
        - WORKING: Conectado y funcionando
        - FAILED: Error
        """
        if not self.is_configured():
            return {"success": False, "status": "NOT_CONFIGURED", "error": "Bridge no configurado"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{self.api_url}/api/sessions/{session_name}"
                response = await client.get(url, headers=self._get_headers())

                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "UNKNOWN")
                    return {
                        "success": True,
                        "status": status,
                        "pairingCode": data.get("pairingCode") or data.get("code"),
                        "data": data
                    }
                elif response.status_code == 404:
                    return {"success": True, "status": "NOT_FOUND", "error": "Sesión no existe"}
                else:
                    return {"success": False, "status": "ERROR", "error": response.text}

        except Exception as e:
            logger.error(f"Error obteniendo estado ({session_name}): {e}")
            return {"success": False, "status": "ERROR", "error": str(e)}

    async def update_webhook(self, webhook_url: str, session_name: str) -> dict:
        """
        Actualizar webhook en sesión existente.
        Usa PUT /api/sessions/{session} para actualizar la configuración.
        """
        if not self.is_configured():
            return {"success": False, "error": "Bridge no configurado"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.api_url}/api/sessions/{session_name}"
                payload = {
                    "config": {
                        "webhooks": [
                            {
                                "url": webhook_url,
                                "events": ["message", "session.status"]
                            }
                        ]
                    }
                }

                logger.info(f"Actualizando webhook ({session_name}) a: {webhook_url}")
                response = await client.put(url, json=payload, headers=self._get_headers())

                if response.status_code in [200, 201]:
                    logger.info("Webhook actualizado correctamente")
                    return {"success": True, "data": response.json()}
                else:
                    logger.warning(f"No se pudo actualizar webhook: {response.status_code} - {response.text}")
                    return {"success": False, "error": response.text}

        except Exception as e:
            logger.error(f"Error actualizando webhook ({session_name}): {e}")
            return {"success": False, "error": str(e)}


# Instancia global
waha_manager = WAHAManager()
