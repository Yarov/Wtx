"""
Funnel Service - Gestiona pasos del funnel y progresion de contactos
"""

import json
import logging
from sqlalchemy.orm import Session
from models import FunnelPaso, Contacto, MensajeConversacion

logger = logging.getLogger(__name__)


class FunnelService:
    """Servicio para gestionar el funnel de ventas"""

    @staticmethod
    def get_all_steps(db: Session, usuario_id: int, activo_only: bool = False) -> list:
        query = db.query(FunnelPaso).filter(FunnelPaso.usuario_id == usuario_id)
        if activo_only:
            query = query.filter(FunnelPaso.activo == True)
        return [p.to_dict() for p in query.order_by(FunnelPaso.orden).all()]

    @staticmethod
    def get_step(db: Session, usuario_id: int, nombre: str) -> dict | None:
        paso = db.query(FunnelPaso).filter(
            FunnelPaso.usuario_id == usuario_id,
            FunnelPaso.nombre == nombre,
        ).first()
        return paso.to_dict() if paso else None

    @staticmethod
    def get_step_by_id(db: Session, step_id: int, usuario_id: int) -> dict | None:
        paso = db.query(FunnelPaso).filter(
            FunnelPaso.id == step_id,
            FunnelPaso.usuario_id == usuario_id,
        ).first()
        return paso.to_dict() if paso else None

    @staticmethod
    def create_step(
        db: Session,
        usuario_id: int,
        nombre: str,
        titulo: str,
        orden: int = 0,
        descripcion: str = "",
        instrucciones_agente: str = "",
        condiciones_avance: list = None,
    ) -> dict:
        paso = FunnelPaso(
            usuario_id=usuario_id,
            nombre=nombre,
            titulo=titulo,
            orden=orden,
            descripcion=descripcion,
            instrucciones_agente=instrucciones_agente,
            condiciones_avance=json.dumps(condiciones_avance or []),
        )
        db.add(paso)
        db.commit()
        db.refresh(paso)
        return paso.to_dict()

    @staticmethod
    def update_step(db: Session, step_id: int, usuario_id: int, **kwargs) -> dict | None:
        paso = db.query(FunnelPaso).filter(
            FunnelPaso.id == step_id,
            FunnelPaso.usuario_id == usuario_id,
        ).first()
        if not paso:
            return None
        for key, value in kwargs.items():
            if key == "condiciones_avance" and isinstance(value, list):
                setattr(paso, key, json.dumps(value))
            elif hasattr(paso, key):
                setattr(paso, key, value)
        db.commit()
        db.refresh(paso)
        return paso.to_dict()

    @staticmethod
    def delete_step(db: Session, step_id: int, usuario_id: int) -> bool:
        paso = db.query(FunnelPaso).filter(
            FunnelPaso.id == step_id,
            FunnelPaso.usuario_id == usuario_id,
        ).first()
        if not paso:
            return False
        db.delete(paso)
        db.commit()
        return True

    @staticmethod
    def get_first_step(db: Session, usuario_id: int) -> dict | None:
        """Obtener el primer paso del funnel"""
        paso = (
            db.query(FunnelPaso)
            .filter(FunnelPaso.usuario_id == usuario_id, FunnelPaso.activo == True)
            .order_by(FunnelPaso.orden)
            .first()
        )
        return paso.to_dict() if paso else None

    @staticmethod
    def get_next_step(db: Session, usuario_id: int, current_step_name: str) -> dict | None:
        """Obtener el siguiente paso despues del actual"""
        current = (
            db.query(FunnelPaso).filter(
                FunnelPaso.usuario_id == usuario_id,
                FunnelPaso.nombre == current_step_name,
            ).first()
        )
        if not current:
            return None
        next_step = (
            db.query(FunnelPaso)
            .filter(
                FunnelPaso.usuario_id == usuario_id,
                FunnelPaso.activo == True,
                FunnelPaso.orden > current.orden,
            )
            .order_by(FunnelPaso.orden)
            .first()
        )
        return next_step.to_dict() if next_step else None

    @staticmethod
    def assign_contact_to_step(db: Session, usuario_id: int, telefono: str, step_name: str) -> bool:
        """Asignar un contacto a un paso del funnel"""
        contacto = db.query(Contacto).filter(
            Contacto.usuario_id == usuario_id,
            Contacto.telefono == telefono,
        ).first()
        if not contacto:
            return False
        contacto.paso_funnel = step_name
        db.commit()
        return True

    @staticmethod
    def advance_contact(db: Session, usuario_id: int, telefono: str, razon: str = "") -> dict | None:
        """Avanzar un contacto al siguiente paso del funnel.
        Retorna info del nuevo paso o None si no se puede avanzar."""
        contacto = db.query(Contacto).filter(
            Contacto.usuario_id == usuario_id,
            Contacto.telefono == telefono,
        ).first()
        if not contacto:
            return None

        current_name = contacto.paso_funnel
        if not current_name:
            # Si no tiene paso, asignar el primero
            first = FunnelService.get_first_step(db, usuario_id)
            if first:
                contacto.paso_funnel = first["nombre"]
                db.commit()
                return {"paso_anterior": None, "paso_nuevo": first, "razon": razon}
            return None

        next_step = FunnelService.get_next_step(db, usuario_id, current_name)
        if not next_step:
            return None

        paso_anterior = current_name
        contacto.paso_funnel = next_step["nombre"]
        db.commit()

        # Execute action on entering new step
        accion = next_step.get("accion_al_entrar", "ninguna")
        if accion == "modo_humano":
            try:
                from api.routers.contactos import activar_modo_humano_por_telefono
                activar_modo_humano_por_telefono(
                    telefono, f"Funnel: paso '{next_step['nombre']}' activa modo humano",
                    db=db, usuario_id=usuario_id
                )
                logger.info(f"Funnel action: human mode activated for {telefono} at step '{next_step['nombre']}'")
            except Exception as e:
                logger.error(f"Error executing funnel action modo_humano: {e}")

        return {
            "paso_anterior": paso_anterior,
            "paso_nuevo": next_step,
            "razon": razon,
        }

    @staticmethod
    def get_contact_step_info(db: Session, usuario_id: int, telefono: str) -> dict:
        """Obtener info del paso actual del contacto para el agente"""
        contacto = db.query(Contacto).filter(
            Contacto.usuario_id == usuario_id,
            Contacto.telefono == telefono,
        ).first()
        if not contacto or not contacto.paso_funnel:
            return {"paso": None, "instrucciones": None}

        paso = (
            db.query(FunnelPaso)
            .filter(
                FunnelPaso.usuario_id == usuario_id,
                FunnelPaso.nombre == contacto.paso_funnel,
            )
            .first()
        )
        if not paso:
            return {"paso": None, "instrucciones": None}

        return {
            "paso": paso.to_dict(),
            "instrucciones": paso.instrucciones_agente,
        }

    @staticmethod
    def check_advance_conditions(
        db: Session, usuario_id: int, telefono: str, datos_capturados: dict, cita_agendada: bool = False
    ) -> bool:
        """Verificar si las condiciones de avance se cumplen para el contacto"""
        contacto = db.query(Contacto).filter(
            Contacto.usuario_id == usuario_id,
            Contacto.telefono == telefono,
        ).first()
        if not contacto or not contacto.paso_funnel:
            return False

        paso = (
            db.query(FunnelPaso)
            .filter(
                FunnelPaso.usuario_id == usuario_id,
                FunnelPaso.nombre == contacto.paso_funnel,
            )
            .first()
        )
        if not paso:
            return False

        try:
            condiciones = (
                json.loads(paso.condiciones_avance) if paso.condiciones_avance else []
            )
        except (json.JSONDecodeError, TypeError):
            condiciones = []

        if not condiciones:
            return False

        for cond in condiciones:
            tipo = cond.get("tipo", "")
            if tipo == "datos_capturados":
                campos_requeridos = cond.get("campos", [])
                for campo in campos_requeridos:
                    if campo not in datos_capturados or not datos_capturados[campo]:
                        return False
            elif tipo == "cita_agendada":
                if not cita_agendada:
                    return False
            elif tipo == "media_enviada":
                # Check if at least one photo was sent in this conversation
                media_count = db.query(MensajeConversacion).filter(
                    MensajeConversacion.telefono == telefono,
                    MensajeConversacion.usuario_id == usuario_id,
                    MensajeConversacion.tipo_evento == "media_enviada",
                ).count()
                min_required = cond.get("cantidad", 1)
                if media_count < min_required:
                    return False
            elif tipo == "mensaje_contiene":
                # Se evalua en el momento del mensaje, no aqui
                pass

        return True

    @staticmethod
    def init_default_funnel(db: Session):
        """Inicializar funnel por defecto si no existe"""
        existing = db.query(FunnelPaso).first()
        if existing:
            return

        default_steps = [
            {
                "nombre": "inicio",
                "titulo": "Inicio",
                "orden": 0,
                "descripcion": "Primer contacto - capturar datos basicos",
                "instrucciones_agente": "Saluda al cliente, presentate y captura su nombre y correo electronico de forma natural durante la conversacion.",
                "condiciones_avance": json.dumps(
                    [{"tipo": "datos_capturados", "campos": ["nombre", "email"]}]
                ),
            },
            {
                "nombre": "calificacion",
                "titulo": "Calificacion",
                "orden": 1,
                "descripcion": "Entender necesidades del cliente",
                "instrucciones_agente": "Ya tienes los datos del cliente. Ahora identifica que necesita, que tipo de negocio tiene, y como puedes ayudarle. Ofrece informacion relevante sobre los servicios y guialo hacia agendar una cita o demo.",
                "condiciones_avance": json.dumps([]),
            },
            {
                "nombre": "presentacion",
                "titulo": "Presentacion",
                "orden": 2,
                "descripcion": "Presentar solucion y agendar demo/cita",
                "instrucciones_agente": "Presenta la solucion adecuada al cliente basandote en sus necesidades. Ofrece agendar una cita o demo personalizada.",
                "condiciones_avance": json.dumps([{"tipo": "cita_agendada"}]),
            },
            {
                "nombre": "seguimiento",
                "titulo": "Seguimiento",
                "orden": 3,
                "descripcion": "Post-demo, seguimiento y cierre",
                "instrucciones_agente": "El cliente ya tuvo su presentacion/demo. Responde dudas, ofrece mas informacion y guialo hacia la decision de compra.",
                "condiciones_avance": json.dumps([]),
            },
        ]

        for step_data in default_steps:
            paso = FunnelPaso(**step_data)
            db.add(paso)

        db.commit()
        logger.info("Funnel por defecto inicializado con 4 pasos")
