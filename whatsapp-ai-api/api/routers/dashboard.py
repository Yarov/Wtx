"""
Dashboard Router - Enhanced metrics, activity feed, alerts and insights
"""
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, desc, and_
from sqlalchemy.orm import Session
from models import get_db, Cita, Inventario, Memoria, Contacto, Usuario
from auth import get_current_user

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
    responses={401: {"description": "Not authenticated"}}
)


@router.get("/stats", summary="Enhanced dashboard stats with comparisons")
async def get_enhanced_stats(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Get dashboard stats with today vs yesterday comparisons"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_ago = today_start - timedelta(days=7)
    
    # Total counts
    total_contacts = db.query(Contacto).count()
    total_appointments = db.query(Cita).count()
    total_products = db.query(Inventario).count()
    
    appointments_today = db.query(Cita).filter(
        Cita.fecha >= today_start.strftime("%Y-%m-%d"),
        Cita.fecha < (today_start + timedelta(days=1)).strftime("%Y-%m-%d")
    ).count()
    
    # This week new contacts
    new_contacts_week = db.query(Contacto).filter(
        Contacto.created_at >= week_ago
    ).count()
    
    # Calculate messages from memoria with timestamps
    total_messages = 0
    messages_today = 0
    messages_yesterday = 0
    
    memorias = db.query(Memoria).all()
    for m in memorias:
        if m.historial:
            try:
                historial = json.loads(m.historial)
                total_messages += len(historial)
                
                # Count messages by date based on memoria updated_at
                if m.updated_at:
                    if m.updated_at >= today_start:
                        # Estimate today's messages from this conversation
                        messages_today += min(len(historial), 5)  # Cap per conversation
                    elif m.updated_at >= yesterday_start:
                        messages_yesterday += min(len(historial), 5)
            except:
                pass
    
    # Response rate (contacts with responses / total contacts with messages)
    contacts_with_messages = db.query(Contacto).filter(
        Contacto.total_mensajes > 0
    ).count()
    
    response_rate = 89  # Default, can be calculated from actual response tracking
    
    return {
        "messages": {
            "total": total_messages,
            "today": messages_today,
            "yesterday": messages_yesterday,
            "trend": messages_today - messages_yesterday
        },
        "appointments": {
            "total": total_appointments,
            "today": appointments_today
        },
        "contacts": {
            "total": total_contacts,
            "new_this_week": new_contacts_week
        },
        "products": {
            "total": total_products
        },
        "response_rate": {
            "value": response_rate,
            "trend": 5  # Placeholder
        }
    }


@router.get("/activity", summary="Real-time activity feed")
async def get_activity_feed(
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Get recent activity feed for dashboard - conversations from today"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    conversations = []
    
    # Get conversations updated today (or recent if none today)
    memorias = db.query(Memoria).filter(
        Memoria.updated_at >= today_start
    ).order_by(desc(Memoria.updated_at)).limit(limit).all()
    
    # If no conversations today, get most recent ones
    if not memorias:
        memorias = db.query(Memoria).order_by(desc(Memoria.updated_at)).limit(10).all()
    
    for memoria in memorias:
        if not memoria.historial:
            continue
            
        try:
            historial = json.loads(memoria.historial)
            if not historial:
                continue
                
            # Get contact info
            contacto = db.query(Contacto).filter(
                Contacto.telefono == memoria.telefono
            ).first()
            
            contact_name = contacto.nombre if contacto and contacto.nombre else memoria.telefono
            
            # Get last messages as a conversation thread
            messages = []
            for msg in historial[-6:]:  # Last 6 messages max
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if role in ["user", "assistant"]:
                    messages.append({
                        "role": role,
                        "content": content[:200] if len(content) > 200 else content
                    })
            
            if messages:
                conversations.append({
                    "telefono": memoria.telefono,
                    "contact_name": contact_name,
                    "timestamp": memoria.updated_at.isoformat() if memoria.updated_at else None,
                    "messages": messages
                })
        except:
            continue
    
    return {"conversations": conversations[:limit]}


@router.get("/alerts", summary="Important alerts requiring attention")
async def get_alerts(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Get alerts for dashboard - angry customers, unconfirmed appointments, etc."""
    alerts = []
    now = datetime.utcnow()
    tomorrow = now + timedelta(days=1)
    
    # Check for potentially angry customers (contacts in human mode)
    angry_contacts = db.query(Contacto).filter(
        Contacto.modo_humano == True
    ).all()
    
    for contact in angry_contacts:
        alerts.append({
            "id": f"angry_{contact.id}",
            "type": "angry_customer",
            "severity": "high",
            "title": "Cliente requiere atención humana",
            "description": contact.modo_humano_razon or "Modo humano activado",
            "contact": {
                "id": contact.id,
                "nombre": contact.nombre or contact.telefono,
                "telefono": contact.telefono
            },
            "timestamp": contact.modo_humano_desde.isoformat() if contact.modo_humano_desde else now.isoformat(),
            "action": {
                "label": "Ver conversación",
                "link": f"/conversations?phone={contact.telefono}"
            }
        })
    
    # Check for unconfirmed appointments (tomorrow, status pending)
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    pending_citas = db.query(Cita).filter(
        Cita.fecha == tomorrow_str,
        Cita.estado == "pendiente"
    ).all()
    
    for cita in pending_citas:
        alerts.append({
            "id": f"cita_{cita.id}",
            "type": "unconfirmed_appointment",
            "severity": "medium",
            "title": "Cita sin confirmar",
            "description": f"{cita.servicio} - mañana {cita.hora}",
            "contact": {
                "nombre": cita.nombre_cliente,
                "telefono": cita.telefono
            },
            "timestamp": now.isoformat(),
            "action": {
                "label": "Enviar recordatorio",
                "link": f"/appointments?id={cita.id}"
            }
        })
    
    # Check for contacts without response in 24h
    day_ago = now - timedelta(hours=24)
    no_response = db.query(Contacto).filter(
        Contacto.ultimo_mensaje >= day_ago,
        Contacto.estado == "activo"
    ).limit(5).all()
    
    # Detect negative sentiment in recent messages
    recent_memorias = db.query(Memoria).order_by(desc(Memoria.updated_at)).limit(20).all()
    
    for memoria in recent_memorias:
        if not memoria.historial:
            continue
        try:
            historial = json.loads(memoria.historial)
            if not historial:
                continue
            
            last_msg = historial[-1] if historial else None
            if last_msg and last_msg.get("role") == "user":
                content = last_msg.get("content", "").lower()
                negative_indicators = ["molesto", "enojado", "espero", "hora", "queja", "mal servicio", "pésimo", "terrible"]
                
                if any(word in content for word in negative_indicators):
                    contacto = db.query(Contacto).filter(
                        Contacto.telefono == memoria.telefono
                    ).first()
                    
                    if contacto and not any(a.get("contact", {}).get("telefono") == memoria.telefono for a in alerts):
                        alerts.append({
                            "id": f"sentiment_{memoria.telefono}",
                            "type": "negative_sentiment",
                            "severity": "high",
                            "title": "Cliente posiblemente molesto",
                            "description": content[:80] + "...",
                            "contact": {
                                "nombre": contacto.nombre or memoria.telefono,
                                "telefono": memoria.telefono
                            },
                            "timestamp": memoria.updated_at.isoformat() if memoria.updated_at else now.isoformat(),
                            "action": {
                                "label": "Ver conversación",
                                "link": f"/conversations?phone={memoria.telefono}"
                            }
                        })
        except:
            continue
    
    # Sort by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda x: severity_order.get(x.get("severity"), 3))
    
    return {"alerts": alerts[:10]}


@router.get("/insights", summary="AI-powered insights")
async def get_insights(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Get AI insights - peak hours, common questions, trends"""
    insights = []
    
    # Analyze peak hours from contact last message times
    contacts = db.query(Contacto).filter(
        Contacto.ultimo_mensaje.isnot(None)
    ).all()
    
    hour_counts = {}
    for contact in contacts:
        if contact.ultimo_mensaje:
            hour = contact.ultimo_mensaje.hour
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
    
    if hour_counts:
        peak_hour = max(hour_counts, key=hour_counts.get)
        peak_range = f"{peak_hour}:00 - {(peak_hour + 2) % 24}:00"
        insights.append({
            "type": "peak_hours",
            "icon": "clock",
            "label": "Horario con más actividad",
            "value": peak_range,
            "detail": f"{hour_counts[peak_hour]} conversaciones"
        })
    
    # Analyze common questions/topics from messages
    word_counts = {}
    keywords = ["precio", "costo", "horario", "cita", "disponible", "reservar", "agendar", 
                "servicio", "promoción", "descuento", "ubicación", "dirección"]
    
    memorias = db.query(Memoria).all()
    for memoria in memorias:
        if not memoria.historial:
            continue
        try:
            historial = json.loads(memoria.historial)
            for msg in historial:
                if msg.get("role") == "user":
                    content = msg.get("content", "").lower()
                    for keyword in keywords:
                        if keyword in content:
                            word_counts[keyword] = word_counts.get(keyword, 0) + 1
        except:
            continue
    
    if word_counts:
        top_keyword = max(word_counts, key=word_counts.get)
        insights.append({
            "type": "top_question",
            "icon": "message-circle",
            "label": "Tema más consultado",
            "value": top_keyword.capitalize(),
            "detail": f"Mencionado {word_counts[top_keyword]} veces"
        })
    
    # Response metrics
    total_contacts = db.query(Contacto).count()
    active_contacts = db.query(Contacto).filter(Contacto.estado == "activo").count()
    
    if total_contacts > 0:
        active_rate = round((active_contacts / total_contacts) * 100)
        insights.append({
            "type": "engagement",
            "icon": "users",
            "label": "Tasa de contactos activos",
            "value": f"{active_rate}%",
            "detail": f"{active_contacts} de {total_contacts} contactos"
        })
    
    # Appointments trend
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    
    this_week_citas = db.query(Cita).filter(
        Cita.fecha >= week_ago.strftime("%Y-%m-%d")
    ).count()
    
    last_week_citas = db.query(Cita).filter(
        and_(
            Cita.fecha >= two_weeks_ago.strftime("%Y-%m-%d"),
            Cita.fecha < week_ago.strftime("%Y-%m-%d")
        )
    ).count()
    
    if last_week_citas > 0:
        trend = round(((this_week_citas - last_week_citas) / last_week_citas) * 100)
        trend_str = f"+{trend}%" if trend > 0 else f"{trend}%"
    else:
        trend_str = "+100%" if this_week_citas > 0 else "0%"
    
    insights.append({
        "type": "appointments_trend",
        "icon": "calendar",
        "label": "Citas esta semana vs anterior",
        "value": str(this_week_citas),
        "detail": trend_str
    })
    
    # Messages per contact average
    contacts_with_msgs = db.query(Contacto).filter(Contacto.total_mensajes > 0).all()
    if contacts_with_msgs:
        avg_msgs = sum(c.total_mensajes for c in contacts_with_msgs) / len(contacts_with_msgs)
        insights.append({
            "type": "avg_messages",
            "icon": "message-square",
            "label": "Promedio de mensajes por contacto",
            "value": f"{round(avg_msgs, 1)}",
            "detail": "mensajes por conversación"
        })
    
    return {"insights": insights}
