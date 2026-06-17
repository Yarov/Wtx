"""
Dashboard Router - Metricas de negocio enfocadas en resultados del bot
"""

import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func, desc, distinct
from sqlalchemy.orm import Session
from models import (
    get_db,
    Contacto,
    Usuario,
    Perfil,
    MensajeConversacion,
    FunnelPaso,
    Campana,
    CampanaDestinatario,
)
from database import get_config
from auth import get_current_user
from api.routers.perfiles import get_current_perfil

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
    responses={401: {"description": "Not authenticated"}},
)


@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    week_ago = today - timedelta(days=7)
    uid = current_user.id
    pid = perfil.id

    # Mensajes
    msgs_today = (
        db.query(MensajeConversacion)
        .filter(
            MensajeConversacion.usuario_id == uid,
            MensajeConversacion.perfil_id == pid,
            MensajeConversacion.created_at >= today,
            MensajeConversacion.tipo_evento == None,
            ~MensajeConversacion.telefono.like("test%"),  # Excluir prueba (test-chat)
        )
        .count()
    )
    msgs_yesterday = (
        db.query(MensajeConversacion)
        .filter(
            MensajeConversacion.usuario_id == uid,
            MensajeConversacion.perfil_id == pid,
            MensajeConversacion.created_at >= yesterday,
            MensajeConversacion.created_at < today,
            MensajeConversacion.tipo_evento == None,
            ~MensajeConversacion.telefono.like("test%"),  # Excluir prueba (test-chat)
        )
        .count()
    )

    # AI responses vs total
    ai_responses = (
        db.query(MensajeConversacion)
        .filter(
            MensajeConversacion.usuario_id == uid,
            MensajeConversacion.perfil_id == pid,
            MensajeConversacion.created_at >= week_ago,
            MensajeConversacion.rol == "assistant",
            MensajeConversacion.tipo_evento == None,
            ~MensajeConversacion.telefono.like("test%"),  # Excluir prueba (test-chat)
        )
        .count()
    )
    user_msgs = (
        db.query(MensajeConversacion)
        .filter(
            MensajeConversacion.usuario_id == uid,
            MensajeConversacion.perfil_id == pid,
            MensajeConversacion.created_at >= week_ago,
            MensajeConversacion.rol == "user",
            MensajeConversacion.tipo_evento == None,
            ~MensajeConversacion.telefono.like("test%"),  # Excluir prueba (test-chat)
        )
        .count()
    )

    # Tool events (datos guardados, citas agendadas, pasos avanzados, fotos)
    events = (
        db.query(MensajeConversacion.tipo_evento, func.count(MensajeConversacion.id))
        .filter(
            MensajeConversacion.usuario_id == uid,
            MensajeConversacion.perfil_id == pid,
            MensajeConversacion.tipo_evento != None,
            MensajeConversacion.created_at >= week_ago,
            ~MensajeConversacion.telefono.like("test%"),  # Excluir prueba (test-chat)
        )
        .group_by(MensajeConversacion.tipo_evento)
        .all()
    )
    ai_actions = {ev: cnt for ev, cnt in events}

    # Contactos (excluir contactos de prueba test-chat)
    not_test = ~Contacto.telefono.like("test%")
    total_contacts = db.query(Contacto).filter(Contacto.usuario_id == uid, Contacto.perfil_id == pid, not_test).count()
    new_today = db.query(Contacto).filter(Contacto.usuario_id == uid, Contacto.perfil_id == pid, not_test, Contacto.created_at >= today).count()
    new_week = db.query(Contacto).filter(Contacto.usuario_id == uid, Contacto.perfil_id == pid, not_test, Contacto.created_at >= week_ago).count()
    human_mode = db.query(Contacto).filter(Contacto.usuario_id == uid, Contacto.perfil_id == pid, not_test, Contacto.modo_humano == True).count()

    # Datos capturados
    con_datos = (
        db.query(Contacto)
        .filter(
            Contacto.usuario_id == uid,
            Contacto.perfil_id == pid,
            not_test,
            Contacto.datos_capturados != "{}",
            Contacto.datos_capturados != None,
            Contacto.datos_capturados != "",
        )
        .count()
    )

    # Funnel distribution - single query with GROUP BY instead of N+1
    funnel_dist = {}
    pasos = (
        db.query(FunnelPaso)
        .filter(FunnelPaso.usuario_id == uid, FunnelPaso.perfil_id == pid, FunnelPaso.activo == True)
        .order_by(FunnelPaso.orden)
        .all()
    )
    if pasos:
        paso_nombres = [p.nombre for p in pasos]
        funnel_counts = (
            db.query(Contacto.paso_funnel, func.count(Contacto.id))
            .filter(
                Contacto.usuario_id == uid,
                Contacto.perfil_id == pid,
                not_test,
                Contacto.paso_funnel.in_(paso_nombres),
            )
            .group_by(Contacto.paso_funnel)
            .all()
        )
        count_map = {nombre: cnt for nombre, cnt in funnel_counts}
        for p in pasos:
            funnel_dist[p.nombre] = {"titulo": p.titulo, "count": count_map.get(p.nombre, 0), "orden": p.orden}

    # Campanas
    camp_activas = db.query(Campana).filter(Campana.usuario_id == uid, Campana.perfil_id == pid, Campana.estado == "enviando").count()
    camp_completadas = db.query(Campana).filter(Campana.usuario_id == uid, Campana.perfil_id == pid, Campana.estado == "completada").count()
    camp_total = db.query(Campana).filter(Campana.usuario_id == uid, Campana.perfil_id == pid).count()

    return {
        "messages": {"today": msgs_today, "yesterday": msgs_yesterday},
        "ai": {
            "responses_week": ai_responses,
            "user_msgs_week": user_msgs,
            "datos_guardados": ai_actions.get("datos_guardados", 0),
            "pasos_avanzados": ai_actions.get("paso_avanzado", 0),
            "transferencias": ai_actions.get("intervencion_humana", 0),
        },
        "contacts": {
            "total": total_contacts,
            "new_today": new_today,
            "new_week": new_week,
            "human_mode": human_mode,
            "con_datos": con_datos,
        },
        "funnel": funnel_dist,
        "campaigns": {
            "total": camp_total,
            "activas": camp_activas,
            "completadas": camp_completadas,
        },
    }


@router.get("/hot-leads")
async def get_hot_leads(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    leads = (
        db.query(Contacto)
        .filter(
            Contacto.usuario_id == current_user.id,
            Contacto.perfil_id == perfil.id,
            Contacto.lead_score >= 20,
            Contacto.estado_lead.notin_(["cerrado", "perdido"]),
            ~Contacto.telefono.like("test%"),  # Excluir prueba (test-chat)
        )
        .order_by(desc(Contacto.lead_score))
        .limit(7)
        .all()
    )
    return [
        {
            "telefono": c.telefono,
            "nombre": c.nombre or c.telefono,
            "lead_score": c.lead_score,
            "paso_funnel": c.paso_funnel,
            "estado_lead": c.estado_lead,
        }
        for c in leads
    ]


@router.get("/campaigns-summary")
async def get_campaigns_summary(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from sqlalchemy import case

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    uid = current_user.id
    pid = perfil.id

    # --- Active campaigns: batch load counts with single query ---
    campanas_activas = db.query(Campana).filter(Campana.usuario_id == uid, Campana.perfil_id == pid, Campana.estado == "enviando").all()
    activas = []
    if campanas_activas:
        activas_ids = [c.id for c in campanas_activas]
        activas_stats = (
            db.query(
                CampanaDestinatario.campana_id,
                func.count(CampanaDestinatario.id).label("total"),
                func.count(case((CampanaDestinatario.estado == "enviado", 1))).label("enviados"),
                func.count(case((CampanaDestinatario.estado == "respondido", 1))).label("respondidos"),
            )
            .filter(CampanaDestinatario.campana_id.in_(activas_ids))
            .group_by(CampanaDestinatario.campana_id)
            .all()
        )
        stats_map = {row.campana_id: row for row in activas_stats}
        for c in campanas_activas:
            row = stats_map.get(c.id)
            activas.append({
                "nombre": c.nombre,
                "total": row.total if row else 0,
                "enviados": row.enviados if row else 0,
                "respondidos": row.respondidos if row else 0,
            })

    # --- Recent completed campaigns: batch load counts with single query ---
    campanas_recientes = (
        db.query(Campana)
        .filter(Campana.usuario_id == uid, Campana.perfil_id == pid, Campana.estado == "completada", Campana.updated_at >= week_ago)
        .order_by(desc(Campana.updated_at))
        .limit(3)
        .all()
    )
    recientes = []
    if campanas_recientes:
        recientes_ids = [c.id for c in campanas_recientes]
        recientes_stats = (
            db.query(
                CampanaDestinatario.campana_id,
                func.count(CampanaDestinatario.id).label("total"),
                func.count(case((CampanaDestinatario.estado == "respondido", 1))).label("respondidos"),
            )
            .filter(CampanaDestinatario.campana_id.in_(recientes_ids))
            .group_by(CampanaDestinatario.campana_id)
            .all()
        )
        stats_map = {row.campana_id: row for row in recientes_stats}
        for c in campanas_recientes:
            row = stats_map.get(c.id)
            recientes.append({
                "nombre": c.nombre,
                "total": row.total if row else 0,
                "respondidos": row.respondidos if row else 0,
            })

    return {"activas": activas, "recientes": recientes}


@router.get("/trend")
async def get_trend(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    from sqlalchemy import cast, Date

    now = datetime.utcnow()
    uid = current_user.id
    pid = perfil.id
    start_date = (now - timedelta(days=13)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Batch: conversations per day (2 queries instead of 28)
    conv_rows = (
        db.query(
            func.date(MensajeConversacion.created_at).label("day"),
            func.count(distinct(MensajeConversacion.telefono)),
        )
        .filter(
            MensajeConversacion.usuario_id == uid,
            MensajeConversacion.perfil_id == pid,
            MensajeConversacion.created_at >= start_date,
            ~MensajeConversacion.telefono.like("test%"),  # Excluir prueba (test-chat)
        )
        .group_by(func.date(MensajeConversacion.created_at))
        .all()
    )
    conv_map = {str(row[0]): row[1] for row in conv_rows}

    contact_rows = (
        db.query(
            func.date(Contacto.created_at).label("day"),
            func.count(Contacto.id),
        )
        .filter(
            Contacto.usuario_id == uid,
            Contacto.perfil_id == pid,
            Contacto.created_at >= start_date,
            ~Contacto.telefono.like("test%"),  # Excluir prueba (test-chat)
        )
        .group_by(func.date(Contacto.created_at))
        .all()
    )
    contact_map = {str(row[0]): row[1] for row in contact_rows}

    days = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_str = day.strftime("%Y-%m-%d")
        days.append(
            {
                "date": day_str,
                "day": day.strftime("%a"),
                "conversations": conv_map.get(day_str, 0),
                "new_contacts": contact_map.get(day_str, 0),
            }
        )
    return days


@router.get("/alerts")
async def get_alerts(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    perfil: Perfil = Depends(get_current_perfil),
):
    # Select only needed columns instead of loading full ORM objects
    now = datetime.utcnow()
    rows = (
        db.query(
            Contacto.id,
            Contacto.nombre,
            Contacto.telefono,
            Contacto.modo_humano_razon,
            Contacto.modo_humano_desde,
        )
        .filter(
            Contacto.usuario_id == current_user.id,
            Contacto.perfil_id == perfil.id,
            Contacto.modo_humano == True,
        )
        .all()
    )
    alerts = []
    for row in rows:
        since = ""
        if row.modo_humano_desde:
            diff = now - row.modo_humano_desde
            h, m = (
                int(diff.total_seconds() / 3600),
                int((diff.total_seconds() % 3600) / 60),
            )
            since = f"{h}h {m}m" if h > 0 else f"{m}m"
        alerts.append(
            {
                "id": row.id,
                "nombre": row.nombre or row.telefono,
                "telefono": row.telefono,
                "razon": row.modo_humano_razon or "Activado manualmente",
                "esperando": since,
            }
        )
    return alerts


# Legacy
@router.get("/activity")
async def get_activity_feed(
    db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)
):
    return {"conversations": []}


@router.get("/insights")
async def get_insights(
    db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)
):
    return {"insights": []}
