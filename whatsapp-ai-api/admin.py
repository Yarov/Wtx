"""
Admin API endpoints - PostgreSQL con SQLAlchemy
"""
import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from database import get_config, set_config, get_all_config, is_tool_enabled, set_tool_enabled, get_all_tools_config
from models import SessionLocal, Cita, Inventario, Memoria, Disponibilidad, HorarioBloqueado, Pago

router = APIRouter(prefix="/api", tags=["admin"])

DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


# Pydantic Models
class ApiKeysModel(BaseModel):
    openai_api_key: Optional[str] = ""
    twilio_account_sid: Optional[str] = ""
    twilio_auth_token: Optional[str] = ""
    twilio_phone_number: Optional[str] = ""


class PromptModel(BaseModel):
    system_prompt: Optional[str] = ""
    model: Optional[str] = "gpt-4o-mini"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 500
    business_name: Optional[str] = ""
    business_type: Optional[str] = ""


class ToolToggle(BaseModel):
    enabled: bool


class ProductModel(BaseModel):
    producto: str
    stock: int
    precio: float


class PaymentConfigModel(BaseModel):
    payment_provider: Optional[str] = "none"
    stripe_secret_key: Optional[str] = ""
    mercadopago_access_token: Optional[str] = ""
    payment_currency: Optional[str] = "MXN"


# Stats
@router.get("/stats")
async def get_stats():
    db = SessionLocal()
    try:
        conversations = db.query(Memoria).count()
        appointments = db.query(Cita).count()
        products = db.query(Inventario).count()
        
        memorias = db.query(Memoria).all()
        total_messages = 0
        for m in memorias:
            if m.historial:
                try:
                    historial = json.loads(m.historial)
                    total_messages += len(historial)
                except:
                    pass
        
        return {
            "totalConversations": conversations,
            "totalAppointments": appointments,
            "totalProducts": products,
            "totalMessages": total_messages,
        }
    finally:
        db.close()


# API Keys
@router.get("/config/api-keys")
async def get_api_keys():
    openai_key = get_config("openai_api_key", "")
    twilio_token = get_config("twilio_auth_token", "")
    return {
        "openai_api_key": openai_key[:8] + "..." if openai_key else "",
        "twilio_account_sid": get_config("twilio_account_sid", ""),
        "twilio_auth_token": twilio_token[:8] + "..." if twilio_token else "",
        "twilio_phone_number": get_config("twilio_phone_number", ""),
    }


@router.put("/config/api-keys")
async def update_api_keys(keys: ApiKeysModel):
    data = keys.dict(exclude_unset=True)
    for key, value in data.items():
        if value and not value.endswith("..."):
            set_config(key, value)
    return {"status": "ok"}


# Prompt
@router.get("/prompt")
async def get_prompt():
    return {
        "system_prompt": get_config("system_prompt", ""),
        "model": get_config("model", "gpt-4o-mini"),
        "temperature": float(get_config("temperature", "0.7")),
        "max_tokens": int(get_config("max_tokens", "500")),
        "business_name": get_config("business_name", ""),
        "business_type": get_config("business_type", ""),
    }


@router.put("/prompt")
async def update_prompt(prompt: PromptModel):
    data = prompt.dict()
    for key, value in data.items():
        if value is not None:
            set_config(key, str(value))
    return {"status": "ok"}


# Tools
@router.get("/tools")
async def get_tools():
    tools = get_all_tools_config()
    return [
        {"id": t["nombre"], "enabled": t["habilitado"], "description": t["descripcion"]}
        for t in tools
    ]


@router.patch("/tools/{name}")
async def toggle_tool(name: str, data: ToolToggle):
    set_tool_enabled(name, data.enabled)
    return {"status": "ok"}


# Inventory
@router.get("/inventory")
async def get_inventory():
    db = SessionLocal()
    try:
        products = db.query(Inventario).all()
        return [p.to_dict() for p in products]
    finally:
        db.close()


@router.post("/inventory")
async def create_product(product: ProductModel):
    db = SessionLocal()
    try:
        new_product = Inventario(
            producto=product.producto,
            stock=product.stock,
            precio=product.precio
        )
        db.add(new_product)
        db.commit()
        db.refresh(new_product)
        return new_product.to_dict()
    finally:
        db.close()


@router.put("/inventory/{product_id}")
async def update_product(product_id: int, product: ProductModel):
    db = SessionLocal()
    try:
        p = db.query(Inventario).filter(Inventario.id == product_id).first()
        if p:
            p.producto = product.producto
            p.stock = product.stock
            p.precio = product.precio
            db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.delete("/inventory/{product_id}")
async def delete_product(product_id: int):
    db = SessionLocal()
    try:
        db.query(Inventario).filter(Inventario.id == product_id).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


# Appointments
@router.get("/appointments")
async def get_appointments():
    db = SessionLocal()
    try:
        citas = db.query(Cita).order_by(Cita.fecha.desc(), Cita.hora.desc()).all()
        return [c.to_dict() for c in citas]
    finally:
        db.close()


@router.patch("/appointments/{appointment_id}/status")
async def update_appointment_status(appointment_id: int, data: dict):
    db = SessionLocal()
    try:
        cita = db.query(Cita).filter(Cita.id == appointment_id).first()
        if cita:
            cita.estado = data.get("estado", "pendiente")
            db.commit()
        return {"status": "ok"}
    finally:
        db.close()


@router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: int):
    db = SessionLocal()
    try:
        db.query(Cita).filter(Cita.id == appointment_id).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


# Availability
@router.get("/availability")
async def get_availability():
    db = SessionLocal()
    try:
        disponibilidad = db.query(Disponibilidad).order_by(Disponibilidad.dia_semana).all()
        return [d.to_dict() for d in disponibilidad]
    finally:
        db.close()


@router.put("/availability/{dia_id}")
async def update_availability(dia_id: int, data: dict):
    db = SessionLocal()
    try:
        disp = db.query(Disponibilidad).filter(Disponibilidad.id == dia_id).first()
        if disp:
            disp.hora_inicio = data.get("hora_inicio", disp.hora_inicio)
            disp.hora_fin = data.get("hora_fin", disp.hora_fin)
            disp.activo = data.get("activo", disp.activo)
            db.commit()
        return {"status": "ok"}
    finally:
        db.close()


# Blocked Slots
@router.get("/blocked-slots")
async def get_blocked_slots():
    db = SessionLocal()
    try:
        slots = db.query(HorarioBloqueado).order_by(HorarioBloqueado.fecha, HorarioBloqueado.hora).all()
        return [s.to_dict() for s in slots]
    finally:
        db.close()


@router.post("/blocked-slots")
async def add_blocked_slot(data: dict):
    db = SessionLocal()
    try:
        slot = HorarioBloqueado(
            fecha=data.get("fecha"),
            hora=data.get("hora"),
            motivo=data.get("motivo", "Bloqueado")
        )
        db.add(slot)
        db.commit()
        db.refresh(slot)
        return {"status": "ok", "id": slot.id}
    finally:
        db.close()


@router.delete("/blocked-slots/{slot_id}")
async def delete_blocked_slot(slot_id: int):
    db = SessionLocal()
    try:
        db.query(HorarioBloqueado).filter(HorarioBloqueado.id == slot_id).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


# Available slots for date
@router.get("/available-slots/{fecha}")
async def get_available_slots(fecha: str):
    from tools import obtener_horarios_disponibles
    return {"fecha": fecha, "horarios": obtener_horarios_disponibles(fecha)}


# Conversations
@router.get("/conversations")
async def get_conversations():
    db = SessionLocal()
    try:
        memorias = db.query(Memoria).order_by(Memoria.updated_at.desc()).all()
        result = []
        for m in memorias:
            historial = json.loads(m.historial) if m.historial else []
            ultimo = historial[-1]["content"] if historial else ""
            result.append({
                "telefono": m.telefono,
                "ultimo_mensaje": ultimo[:50] + "..." if len(ultimo) > 50 else ultimo,
                "fecha": m.updated_at.isoformat() if m.updated_at else "",
                "mensajes_count": len(historial),
            })
        return result
    finally:
        db.close()


@router.get("/conversations/{phone}")
async def get_conversation(phone: str):
    db = SessionLocal()
    try:
        memoria = db.query(Memoria).filter(Memoria.telefono == phone).first()
        if memoria and memoria.historial:
            return {"messages": json.loads(memoria.historial)}
        return {"messages": []}
    finally:
        db.close()


@router.delete("/conversations/{phone}")
async def delete_conversation(phone: str):
    db = SessionLocal()
    try:
        db.query(Memoria).filter(Memoria.telefono == phone).delete()
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()


# Payments Config
@router.get("/config/payments")
async def get_payment_config():
    stripe_key = get_config("stripe_secret_key", "")
    mp_token = get_config("mercadopago_access_token", "")
    return {
        "payment_provider": get_config("payment_provider", "none"),
        "stripe_secret_key": stripe_key[:12] + "..." if stripe_key else "",
        "mercadopago_access_token": mp_token[:12] + "..." if mp_token else "",
        "payment_currency": get_config("payment_currency", "MXN"),
    }


@router.put("/config/payments")
async def update_payment_config(config: PaymentConfigModel):
    data = config.dict()
    for key, value in data.items():
        if value and not value.endswith("..."):
            set_config(key, value)
    return {"status": "ok"}


# Payments List
@router.get("/payments")
async def get_payments():
    db = SessionLocal()
    try:
        pagos = db.query(Pago).order_by(Pago.created_at.desc()).all()
        return [p.to_dict() for p in pagos]
    finally:
        db.close()


@router.patch("/payments/{payment_id}/status")
async def update_payment_status(payment_id: int, data: dict):
    db = SessionLocal()
    try:
        pago = db.query(Pago).filter(Pago.id == payment_id).first()
        if pago:
            pago.estado = data.get("estado", "pendiente")
            db.commit()
        return {"status": "ok"}
    finally:
        db.close()
