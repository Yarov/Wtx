"""
WhatsApp Service - Integración con WAHA API
"""
import os
import httpx
import logging

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Servicio para enviar mensajes via WAHA"""
    
    def __init__(self):
        self.reload_config()
    
    def reload_config(self):
        """Cargar configuración desde variables de entorno"""
        self.api_url = os.getenv("WHATSAPP_API_URL", "").rstrip("/")
        self.api_key = os.getenv("WHATSAPP_API_KEY", "")
        self.session = "default"  # WAHA Core solo soporta 'default'
    
    def is_configured(self) -> bool:
        """Verificar si el servicio está configurado"""
        self.reload_config()
        return bool(self.api_url and self.api_key)
    
    def _get_headers(self) -> dict:
        """Headers para WAHA API"""
        return {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json"
        }
    
    async def send_message(self, phone: str, message: str) -> dict:
        """Enviar mensaje de texto via WAHA"""
        self.reload_config()
        
        if not self.is_configured():
            return {"success": False, "error": "WhatsApp no configurado"}
        
        # Normalizar teléfono (quitar + y espacios)
        phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        
        # Agregar sufijo @c.us si no lo tiene
        if not phone.endswith("@c.us") and not phone.endswith("@s.whatsapp.net"):
            phone = f"{phone}@c.us"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.api_url}/api/sendText"
                payload = {
                    "chatId": phone,
                    "text": message,
                    "session": self.session
                }
                
                response = await client.post(url, json=payload, headers=self._get_headers())
                
                if response.status_code in [200, 201]:
                    return {"success": True, "data": response.json()}
                else:
                    logger.error(f"Error enviando mensaje: {response.text}")
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.error(f"Error enviando mensaje: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_contacts(self) -> dict:
        """Obtener contactos desde WAHA"""
        self.reload_config()
        
        if not self.is_configured():
            return {"success": False, "error": "WhatsApp no configurado", "contacts": []}
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                url = f"{self.api_url}/api/contacts/all?session={self.session}"
                response = await client.get(url, headers=self._get_headers())
                
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
        seen_phones = set()
        
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("contacts", data.get("data", []))
        else:
            return []
        
        logger.info(f"📥 Procesando {len(items)} contactos raw")
        
        for item in items:
            if item.get("isGroup", False):
                continue
            
            item_id = str(item.get("id", item.get("jid", "")))
            
            if "@g.us" in item_id:
                continue
            
            if not item_id.endswith("@c.us"):
                continue
            
            phone_clean = item_id.replace("@c.us", "")
            
            if not phone_clean or not phone_clean.isdigit():
                continue
            
            if len(phone_clean) < 7 or len(phone_clean) > 15:
                continue
            
            phone_with_plus = f"+{phone_clean}"
            
            try:
                parsed = phonenumbers.parse(phone_with_plus, None)
                if phonenumbers.is_valid_number(parsed):
                    phone_normalized = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
                else:
                    phone_normalized = phone_with_plus
            except Exception:
                phone_normalized = phone_with_plus
            
            if phone_normalized in seen_phones:
                continue
            seen_phones.add(phone_normalized)
            
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
        
        logger.info(f"✅ {len(contacts)} contactos normalizados")
        return contacts

    async def check_number_exists(self, phone: str) -> dict:
        """Verificar si un número está registrado en WhatsApp"""
        if not self.is_configured():
            return {"exists": False, "error": "WhatsApp no configurado"}
        
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
        """Verificar múltiples números"""
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
    Parsear mensaje entrante de WAHA
    Retorna dict con: phone, message, name o None si no es mensaje válido
    """
    # Formato WAHA
    if "payload" in data:
        payload = data.get("payload", {})
        event = data.get("event", "")
        
        # Solo procesar mensajes de texto entrantes (no message.any para evitar duplicados)
        if event != "message":
            return None
        
        # Ignorar mensajes salientes
        if payload.get("fromMe", False):
            return None
        
        phone = payload.get("from", "")
        message = payload.get("body", "")
        name = payload.get("pushName", payload.get("notifyName", ""))
        
        if phone and message:
            # Ignorar grupos
            if "@g.us" in phone:
                return None
            
            # Limpiar teléfono
            phone_clean = phone.replace("@c.us", "").replace("@s.whatsapp.net", "")
            return {
                "phone": f"+{phone_clean}" if not phone_clean.startswith("+") else phone_clean,
                "message": message,
                "name": name
            }
    
    return None
