import os
from database import get_config, cursor, conn


def create_stripe_payment(telefono: str, servicio: str, monto: float, moneda: str = "MXN") -> dict:
    """Crear link de pago con Stripe"""
    try:
        import stripe
        stripe.api_key = get_config("stripe_secret_key") or os.getenv("STRIPE_SECRET_KEY")
        
        if not stripe.api_key:
            return {"error": "Stripe no configurado"}
        
        # Crear sesión de checkout
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": moneda.lower(),
                    "product_data": {
                        "name": servicio,
                    },
                    "unit_amount": int(monto * 100),  # Stripe usa centavos
                },
                "quantity": 1,
            }],
            mode="payment",
            metadata={
                "telefono": telefono,
                "servicio": servicio,
            },
            success_url=get_config("payment_success_url", "https://ejemplo.com/gracias"),
            cancel_url=get_config("payment_cancel_url", "https://ejemplo.com/cancelado"),
        )
        
        return {
            "payment_id": session.id,
            "payment_url": session.url,
            "proveedor": "stripe",
        }
    except ImportError:
        return {"error": "Stripe SDK no instalado. Ejecuta: pip install stripe"}
    except Exception as e:
        return {"error": str(e)}


def create_mercadopago_payment(telefono: str, servicio: str, monto: float, moneda: str = "MXN") -> dict:
    """Crear link de pago con MercadoPago"""
    try:
        import mercadopago
        access_token = get_config("mercadopago_access_token") or os.getenv("MERCADOPAGO_ACCESS_TOKEN")
        
        if not access_token:
            return {"error": "MercadoPago no configurado"}
        
        sdk = mercadopago.SDK(access_token)
        
        preference_data = {
            "items": [{
                "title": servicio,
                "quantity": 1,
                "unit_price": float(monto),
                "currency_id": moneda,
            }],
            "external_reference": telefono,
            "back_urls": {
                "success": get_config("payment_success_url", "https://ejemplo.com/gracias"),
                "failure": get_config("payment_cancel_url", "https://ejemplo.com/cancelado"),
                "pending": get_config("payment_pending_url", "https://ejemplo.com/pendiente"),
            },
            "auto_return": "approved",
        }
        
        result = sdk.preference().create(preference_data)
        preference = result["response"]
        
        return {
            "payment_id": preference["id"],
            "payment_url": preference["init_point"],
            "proveedor": "mercadopago",
        }
    except ImportError:
        return {"error": "MercadoPago SDK no instalado. Ejecuta: pip install mercadopago"}
    except Exception as e:
        return {"error": str(e)}


def crear_pago(telefono: str, servicio: str, monto: float) -> dict:
    """Crear pago usando el proveedor configurado"""
    provider = get_config("payment_provider", "none")
    moneda = get_config("payment_currency", "MXN")
    
    if provider == "none":
        # Modo simulación - sin proveedor real
        payment_id = f"sim_{telefono}_{int(monto)}"
        cursor.execute(
            """INSERT INTO pagos (telefono, servicio, monto, moneda, estado, proveedor, payment_id, payment_url)
               VALUES (?, ?, ?, ?, 'pendiente', 'simulado', ?, ?)""",
            (telefono, servicio, monto, moneda, payment_id, f"https://pago-simulado.com/{payment_id}")
        )
        conn.commit()
        return {
            "success": True,
            "mensaje": f"💳 Pago por ${monto} {moneda} para '{servicio}'",
            "nota": "Modo simulación - configura un proveedor de pagos real",
            "payment_id": payment_id,
        }
    
    elif provider == "stripe":
        result = create_stripe_payment(telefono, servicio, monto, moneda)
        
    elif provider == "mercadopago":
        result = create_mercadopago_payment(telefono, servicio, monto, moneda)
        
    else:
        return {"error": f"Proveedor '{provider}' no soportado"}
    
    if "error" in result:
        return result
    
    # Guardar en DB
    cursor.execute(
        """INSERT INTO pagos (telefono, servicio, monto, moneda, estado, proveedor, payment_id, payment_url)
           VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)""",
        (telefono, servicio, monto, moneda, result["proveedor"], result["payment_id"], result["payment_url"])
    )
    conn.commit()
    
    return {
        "success": True,
        "mensaje": f"💳 Link de pago generado para '{servicio}'",
        "monto": f"${monto} {moneda}",
        "url": result["payment_url"],
        "payment_id": result["payment_id"],
    }


def obtener_pagos(telefono: str = None) -> list:
    """Obtener historial de pagos"""
    if telefono:
        cursor.execute(
            "SELECT id, servicio, monto, moneda, estado, payment_url, created_at FROM pagos WHERE telefono = ? ORDER BY created_at DESC",
            (telefono,)
        )
    else:
        cursor.execute(
            "SELECT id, telefono, servicio, monto, moneda, estado, payment_url, created_at FROM pagos ORDER BY created_at DESC"
        )
    
    rows = cursor.fetchall()
    
    if telefono:
        return [{"id": r[0], "servicio": r[1], "monto": r[2], "moneda": r[3], "estado": r[4], "url": r[5], "fecha": r[6]} for r in rows]
    else:
        return [{"id": r[0], "telefono": r[1], "servicio": r[2], "monto": r[3], "moneda": r[4], "estado": r[5], "url": r[6], "fecha": r[7]} for r in rows]


def actualizar_estado_pago(payment_id: str, estado: str):
    """Actualizar estado de un pago (llamado por webhooks)"""
    cursor.execute(
        "UPDATE pagos SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?",
        (estado, payment_id)
    )
    conn.commit()
