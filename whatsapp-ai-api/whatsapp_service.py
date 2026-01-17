"""
WhatsApp Service - Integración con WAHA y Evolution API
"""
import httpx
from database import get_config
import logging

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Servicio para enviar mensajes via WAHA o Evolution API"""
    
    def __init__(self):
        self.provider = get_config("whatsapp_provider", "waha")
        self.api_url = get_config("whatsapp_api_url", "")
        self.api_key = get_config("whatsapp_api_key", "")
        self.session = get_config("whatsapp_session", "default")
    
    def reload_config(self):
        """Recargar configuración desde la base de datos"""
        self.provider = get_config("whatsapp_provider", "waha")
        self.api_url = get_config("whatsapp_api_url", "").rstrip("/")
        self.api_key = get_config("whatsapp_api_key", "")
        self.session = get_config("whatsapp_session", "default")
    
    def is_configured(self) -> bool:
        """Verificar si el servicio está configurado"""
        self.reload_config()
        return bool(self.api_url and self.api_key)
    
    def _get_headers(self) -> dict:
        """Obtener headers según el proveedor"""
        if self.provider == "waha":
            return {"X-Api-Key": self.api_key}
        elif self.provider == "evolution":
            return {"apikey": self.api_key}
        else:
            return {"Authorization": f"Bearer {self.api_key}"}
    
    async def send_message(self, phone: str, message: str) -> dict:
        """Enviar mensaje de texto"""
        self.reload_config()
        
        if not self.is_configured():
            return {"success": False, "error": "WhatsApp no configurado"}
        
        # Normalizar teléfono (quitar + y espacios)
        phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        
        # Agregar sufijo si no lo tiene
        if not phone.endswith("@c.us") and not phone.endswith("@s.whatsapp.net"):
            phone = f"{phone}@c.us"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if self.provider == "waha":
                    response = await self._send_waha(client, phone, message)
                elif self.provider == "evolution":
                    response = await self._send_evolution(client, phone, message)
                else:
                    response = await self._send_custom(client, phone, message)
                
                return response
        except Exception as e:
            logger.error(f"Error enviando mensaje: {e}")
            return {"success": False, "error": str(e)}
    
    async def _send_waha(self, client: httpx.AsyncClient, phone: str, message: str) -> dict:
        """Enviar via WAHA"""
        url = f"{self.api_url}/api/sendText"
        payload = {
            "chatId": phone,
            "text": message,
            "session": self.session
        }
        
        response = await client.post(url, json=payload, headers=self._get_headers())
        
        if response.status_code == 200 or response.status_code == 201:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": response.text}
    
    async def _send_evolution(self, client: httpx.AsyncClient, phone: str, message: str) -> dict:
        """Enviar via Evolution API"""
        # Evolution usa formato diferente para el teléfono
        phone_clean = phone.replace("@c.us", "").replace("@s.whatsapp.net", "")
        
        url = f"{self.api_url}/message/sendText/{self.session}"
        payload = {
            "number": phone_clean,
            "text": message
        }
        
        response = await client.post(url, json=payload, headers=self._get_headers())
        
        if response.status_code == 200 or response.status_code == 201:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": response.text}
    
    async def _send_custom(self, client: httpx.AsyncClient, phone: str, message: str) -> dict:
        """Enviar via proveedor personalizado (formato genérico)"""
        url = f"{self.api_url}/send"
        payload = {
            "phone": phone,
            "message": message
        }
        
        response = await client.post(url, json=payload, headers=self._get_headers())
        
        if response.status_code == 200 or response.status_code == 201:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": response.text}
    
    async def test_connection(self) -> dict:
        """Probar conexión con el servicio"""
        self.reload_config()
        
        if not self.api_url:
            return {"success": False, "error": "URL no configurada"}
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                if self.provider == "waha":
                    url = f"{self.api_url}/api/sessions"
                elif self.provider == "evolution":
                    url = f"{self.api_url}/instance/fetchInstances"
                else:
                    url = f"{self.api_url}/status"
                
                response = await client.get(url, headers=self._get_headers())
                
                if response.status_code == 200:
                    return {"success": True, "message": "Conexión exitosa"}
                else:
                    return {"success": False, "error": f"Error {response.status_code}: {response.text}"}
        except httpx.TimeoutException:
            return {"success": False, "error": "Timeout - el servidor no responde"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_contacts(self) -> dict:
        """Obtener contactos desde WAHA/Evolution"""
        self.reload_config()
        
        if not self.is_configured():
            return {"success": False, "error": "WhatsApp no configurado", "contacts": []}
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                if self.provider == "waha":
                    url = f"{self.api_url}/api/contacts/all?session={self.session}"
                    response = await client.get(url, headers=self._get_headers())
                elif self.provider == "evolution":
                    url = f"{self.api_url}/chat/findContacts/{self.session}"
                    response = await client.post(url, json={}, headers=self._get_headers())
                else:
                    return {"success": False, "error": "Proveedor no soporta sync de contactos", "contacts": []}
                
                if response.status_code == 200:
                    data = response.json()
                    contacts = self._normalize_contacts(data)
                    return {"success": True, "contacts": contacts}
                else:
                    return {"success": False, "error": response.text, "contacts": []}
        except Exception as e:
            logger.error(f"Error obteniendo contactos: {e}")
            return {"success": False, "error": str(e), "contacts": []}
    
    def _normalize_contacts(self, data: list | dict) -> list:
        """Normalizar contactos al formato interno"""
        import phonenumbers
        contacts = []
        seen_phones = set()  # Para evitar duplicados
        
        # WAHA retorna lista directa
        if isinstance(data, list):
            items = data
        # Evolution puede retornar dict con key
        elif isinstance(data, dict):
            items = data.get("contacts", data.get("data", []))
        else:
            return []
        
        logger.info(f"📥 Procesando {len(items)} contactos raw")
        
        for item in items:
            # Ignorar grupos
            if item.get("isGroup", False):
                continue
            
            item_id = str(item.get("id", item.get("jid", "")))
            
            # Ignorar grupos
            if "@g.us" in item_id:
                continue
            
            # Solo procesar contactos de WhatsApp reales (terminan en @c.us)
            # Los LIDs de Facebook/Instagram NO terminan en @c.us
            if not item_id.endswith("@c.us"):
                continue
            
            # Extraer número del ID (formato: 5215548706985@c.us)
            phone_clean = item_id.replace("@c.us", "")
            
            if not phone_clean:
                continue
            
            # Validar que sea solo dígitos
            if not phone_clean.isdigit():
                logger.debug(f"Teléfono inválido ignorado: {phone_clean}")
                continue
            
            # Validar longitud razonable (7-15 dígitos para teléfonos reales)
            if len(phone_clean) < 7 or len(phone_clean) > 15:
                logger.debug(f"Teléfono con longitud inválida ignorado: {phone_clean}")
                continue
            
            # Agregar + si no lo tiene
            phone_with_plus = f"+{phone_clean}" if not phone_clean.startswith("+") else phone_clean
            
            # Normalizar con phonenumbers
            try:
                parsed = phonenumbers.parse(phone_with_plus, None)
                if phonenumbers.is_valid_number(parsed):
                    phone_normalized = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
                else:
                    phone_normalized = phone_with_plus
            except Exception:
                phone_normalized = phone_with_plus
            
            # Evitar duplicados
            if phone_normalized in seen_phones:
                continue
            seen_phones.add(phone_normalized)
            
            # Obtener nombre: prioridad a name (guardado en contactos), luego pushname (del perfil WhatsApp)
            # Nota: WAHA puede devolver None explícito, así que verificamos que no sea None ni vacío
            nombre = None
            for field in ["name", "pushname", "pushName", "notify"]:
                val = item.get(field)
                if val is not None and str(val).strip():
                    nombre = str(val).strip()
                    break
            nombre = nombre or ""
            
            contact = {
                "telefono": phone_normalized,
                "nombre": nombre,
                "foto_url": item.get("profilePicUrl", item.get("imgUrl", ""))
            }
            contacts.append(contact)
        
        logger.info(f"✅ {len(contacts)} contactos normalizados (de {len(items)} raw)")
        return contacts


    async def check_number_exists(self, phone: str) -> dict:
        """
        Verificar si un número está registrado en WhatsApp.
        Retorna: {"exists": bool, "chatId": str|None}
        """
        if not self.is_configured():
            return {"exists": False, "error": "WhatsApp no configurado"}
        
        # Limpiar número (quitar + y espacios)
        phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "")
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{self.api_url}/api/contacts/check-exists"
                params = {"phone": phone_clean, "session": self.session}
                response = await client.get(url, headers=self._get_headers(), params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "exists": data.get("numberExists", False),
                        "chatId": data.get("chatId")
                    }
                else:
                    return {"exists": False, "error": response.text}
        except Exception as e:
            logger.error(f"Error verificando número {phone}: {e}")
            return {"exists": False, "error": str(e)}

    async def check_numbers_batch(self, phones: list, delay: float = 0.5) -> dict:
        """
        Verificar múltiples números. Retorna dict con resultados.
        delay: segundos entre cada verificación para no saturar la API
        """
        import asyncio
        results = {}
        
        for phone in phones:
            result = await self.check_number_exists(phone)
            results[phone] = result
            await asyncio.sleep(delay)
        
        return results


# Instancia global
whatsapp_service = WhatsAppService()


def parse_webhook_message(data: dict) -> dict | None:
    """
    Parsear mensaje entrante de WAHA o Evolution
    Retorna dict con: phone, message, name o None si no es mensaje válido
    """
    # Detectar formato WAHA
    if "payload" in data:
        payload = data.get("payload", {})
        event = data.get("event", "")
        
        # Solo procesar mensajes de texto entrantes
        if event not in ["message", "message.any"]:
            return None
        
        # Ignorar mensajes salientes
        if payload.get("fromMe", False):
            return None
        
        phone = payload.get("from", "")
        message = payload.get("body", "")
        name = payload.get("pushName", payload.get("notifyName", ""))
        
        if phone and message:
            # Limpiar teléfono
            phone_clean = phone.replace("@c.us", "").replace("@s.whatsapp.net", "")
            return {
                "phone": f"+{phone_clean}" if not phone_clean.startswith("+") else phone_clean,
                "message": message,
                "name": name
            }
    
    # Detectar formato Evolution
    if "data" in data:
        event = data.get("event", "")
        
        # Solo procesar mensajes
        if event not in ["messages.upsert", "message"]:
            return None
        
        msg_data = data.get("data", {})
        
        # Puede ser lista o dict
        if isinstance(msg_data, list) and len(msg_data) > 0:
            msg_data = msg_data[0]
        
        # Ignorar mensajes salientes
        key = msg_data.get("key", {})
        if key.get("fromMe", False):
            return None
        
        phone = key.get("remoteJid", "")
        
        # Obtener texto del mensaje
        message_obj = msg_data.get("message", {})
        message = (
            message_obj.get("conversation") or
            message_obj.get("extendedTextMessage", {}).get("text") or
            ""
        )
        
        name = msg_data.get("pushName", "")
        
        if phone and message:
            # Ignorar grupos
            if "@g.us" in phone:
                return None
            
            phone_clean = phone.replace("@c.us", "").replace("@s.whatsapp.net", "")
            return {
                "phone": f"+{phone_clean}" if not phone_clean.startswith("+") else phone_clean,
                "message": message,
                "name": name
            }
    
    # Formato Twilio (legacy, por compatibilidad)
    if "Body" in data and "From" in data:
        return {
            "phone": data.get("From", "").replace("whatsapp:", ""),
            "message": data.get("Body", ""),
            "name": ""
        }
    
    return None
