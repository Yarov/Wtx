"""
Data Capture Service - Gestiona campos de captura y extraccion de datos del contacto
"""

import json
import logging
from sqlalchemy.orm import Session
from models import CampoCaptura, Contacto

logger = logging.getLogger(__name__)


class CaptureService:
    """Servicio para captura de datos durante conversaciones"""

    @staticmethod
    def get_fields(db: Session, usuario_id: int, activo_only: bool = True) -> list:
        query = db.query(CampoCaptura).filter(CampoCaptura.usuario_id == usuario_id)
        if activo_only:
            query = query.filter(CampoCaptura.activo == True)
        return [c.to_dict() for c in query.order_by(CampoCaptura.orden).all()]

    @staticmethod
    def create_field(
        db: Session,
        usuario_id: int,
        nombre: str,
        etiqueta: str,
        tipo: str = "texto",
        obligatorio: bool = False,
        orden: int = 0,
    ) -> dict:
        campo = CampoCaptura(
            usuario_id=usuario_id,
            nombre=nombre,
            etiqueta=etiqueta,
            tipo=tipo,
            obligatorio=obligatorio,
            orden=orden,
            activo=True,
        )
        db.add(campo)
        db.commit()
        db.refresh(campo)
        return campo.to_dict()

    @staticmethod
    def update_field(db: Session, field_id: int, usuario_id: int, **kwargs) -> dict | None:
        campo = db.query(CampoCaptura).filter(
            CampoCaptura.id == field_id,
            CampoCaptura.usuario_id == usuario_id,
        ).first()
        if not campo:
            return None
        for key, value in kwargs.items():
            if hasattr(campo, key):
                setattr(campo, key, value)
        db.commit()
        db.refresh(campo)
        return campo.to_dict()

    @staticmethod
    def delete_field(db: Session, field_id: int, usuario_id: int) -> bool:
        campo = db.query(CampoCaptura).filter(
            CampoCaptura.id == field_id,
            CampoCaptura.usuario_id == usuario_id,
        ).first()
        if not campo:
            return False
        db.delete(campo)
        db.commit()
        return True

    @staticmethod
    def save_captured_data(db: Session, usuario_id: int, telefono: str, datos: dict) -> dict:
        """Guardar datos capturados en el contacto. Merge con datos existentes."""
        contacto = db.query(Contacto).filter(
            Contacto.usuario_id == usuario_id,
            Contacto.telefono == telefono,
        ).first()
        if not contacto:
            # Crear contacto si no existe
            contacto = Contacto(
                usuario_id=usuario_id,
                telefono=telefono,
                estado="activo",
                estado_lead="nuevo",
                datos_capturados="{}",
            )
            db.add(contacto)
            db.flush()

        # Merge con datos existentes
        existing = {}
        try:
            existing = (
                json.loads(contacto.datos_capturados)
                if contacto.datos_capturados
                else {}
            )
        except (json.JSONDecodeError, TypeError):
            existing = {}

        # Actualizar solo campos con valor
        for key, value in datos.items():
            if value and str(value).strip():
                existing[key] = str(value).strip()

        # Tambien actualizar campos nativos del contacto si corresponde
        if "nombre" in datos and datos["nombre"]:
            contacto.nombre = datos["nombre"]
        if "email" in datos and datos["email"]:
            contacto.email = datos["email"]

        contacto.datos_capturados = json.dumps(existing, ensure_ascii=False)
        db.commit()

        return existing

    @staticmethod
    def get_captured_data(db: Session, usuario_id: int, telefono: str) -> dict:
        """Obtener datos capturados del contacto"""
        contacto = db.query(Contacto).filter(
            Contacto.usuario_id == usuario_id,
            Contacto.telefono == telefono,
        ).first()
        if not contacto:
            return {}
        try:
            return (
                json.loads(contacto.datos_capturados)
                if contacto.datos_capturados
                else {}
            )
        except (json.JSONDecodeError, TypeError):
            return {}

    @staticmethod
    def get_missing_fields(db: Session, usuario_id: int, telefono: str) -> list:
        """Obtener campos obligatorios que aun no se han capturado"""
        fields = CaptureService.get_fields(db, usuario_id, activo_only=True)
        captured = CaptureService.get_captured_data(db, usuario_id, telefono)

        missing = []
        for field in fields:
            if field["obligatorio"] and field["nombre"] not in captured:
                missing.append(field)

        return missing

    @staticmethod
    def get_capture_instructions(db: Session, usuario_id: int, telefono: str) -> str:
        """Generar instrucciones para el agente sobre que datos capturar"""
        fields = CaptureService.get_fields(db, usuario_id, activo_only=True)
        if not fields:
            return ""

        captured = CaptureService.get_captured_data(db, usuario_id, telefono)

        pending = []
        captured_list = []
        for field in fields:
            if field["nombre"] in captured:
                captured_list.append(
                    f"- {field['etiqueta']}: {captured[field['nombre']]}"
                )
            else:
                pending.append(field["etiqueta"])

        parts = []
        if captured_list:
            parts.append("Ya conoces del cliente:\n" + "\n".join(captured_list))
        if pending:
            parts.append(
                "Durante la conversacion, busca obtener de forma natural: "
                + ", ".join(pending)
                + ". "
                "No los pidas todos de golpe, intégralos en la platica."
            )
        else:
            parts.append("Ya tienes todos los datos necesarios del cliente.")

        return "\n".join(parts)

    @staticmethod
    def get_field_names(db: Session, usuario_id: int) -> list:
        """Obtener nombres de campos activos para la tool definition"""
        fields = CaptureService.get_fields(db, usuario_id, activo_only=True)
        return [f["nombre"] for f in fields]

    @staticmethod
    def init_default_fields(db: Session):
        """Inicializar campos de captura por defecto"""
        existing = db.query(CampoCaptura).first()
        if existing:
            return

        defaults = [
            ("nombre", "Nombre completo", "texto", True, 0),
            ("email", "Correo electronico", "email", True, 1),
        ]

        for nombre, etiqueta, tipo, obligatorio, orden in defaults:
            db.add(
                CampoCaptura(
                    nombre=nombre,
                    etiqueta=etiqueta,
                    tipo=tipo,
                    obligatorio=obligatorio,
                    orden=orden,
                    activo=True,
                )
            )

        db.commit()
        logger.info("Campos de captura por defecto inicializados")
