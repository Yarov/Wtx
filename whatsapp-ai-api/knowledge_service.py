"""
Knowledge Base Service - Gestiona documentos de conocimiento para el agente IA
"""

import json
import logging
from sqlalchemy.orm import Session
from models import DocumentoConocimiento

logger = logging.getLogger(__name__)


class KnowledgeService:
    """Servicio para gestionar la base de conocimiento"""

    @staticmethod
    def get_all(db: Session, usuario_id: int, activo_only: bool = False) -> list:
        query = db.query(DocumentoConocimiento).filter(
            DocumentoConocimiento.usuario_id == usuario_id
        )
        if activo_only:
            query = query.filter(DocumentoConocimiento.activo == True)
        return [
            d.to_dict() for d in query.order_by(DocumentoConocimiento.categoria).all()
        ]

    @staticmethod
    def get_by_id(db: Session, doc_id: int, usuario_id: int) -> dict | None:
        doc = (
            db.query(DocumentoConocimiento)
            .filter(
                DocumentoConocimiento.id == doc_id,
                DocumentoConocimiento.usuario_id == usuario_id,
            )
            .first()
        )
        return doc.to_dict() if doc else None

    @staticmethod
    def create(
        db: Session,
        usuario_id: int,
        titulo: str,
        contenido: str,
        categoria: str = "general",
    ) -> dict:
        doc = DocumentoConocimiento(
            usuario_id=usuario_id,
            titulo=titulo,
            contenido=contenido,
            categoria=categoria,
            activo=True,
            sincronizado=False,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc.to_dict()

    @staticmethod
    def update(db: Session, doc_id: int, usuario_id: int, **kwargs) -> dict | None:
        doc = (
            db.query(DocumentoConocimiento)
            .filter(
                DocumentoConocimiento.id == doc_id,
                DocumentoConocimiento.usuario_id == usuario_id,
            )
            .first()
        )
        if not doc:
            return None
        for key, value in kwargs.items():
            if hasattr(doc, key) and key != "usuario_id":
                setattr(doc, key, value)
        doc.sincronizado = False
        db.commit()
        db.refresh(doc)
        return doc.to_dict()

    @staticmethod
    def delete(db: Session, doc_id: int, usuario_id: int) -> bool:
        doc = (
            db.query(DocumentoConocimiento)
            .filter(
                DocumentoConocimiento.id == doc_id,
                DocumentoConocimiento.usuario_id == usuario_id,
            )
            .first()
        )
        if not doc:
            return False
        db.delete(doc)
        db.commit()
        return True

    @staticmethod
    def sync_all(db: Session, usuario_id: int):
        """Marcar todos los documentos como sincronizados"""
        db.query(DocumentoConocimiento).filter(
            DocumentoConocimiento.activo == True,
            DocumentoConocimiento.usuario_id == usuario_id,
        ).update({"sincronizado": True})
        db.commit()

    @staticmethod
    def get_categories(db: Session, usuario_id: int) -> list:
        """Obtener lista de categorias unicas"""
        cats = (
            db.query(DocumentoConocimiento.categoria)
            .filter(DocumentoConocimiento.usuario_id == usuario_id)
            .distinct()
            .all()
        )
        return [c[0] for c in cats if c[0]]

    @staticmethod
    def get_stats(db: Session, usuario_id: int) -> dict:
        base = db.query(DocumentoConocimiento).filter(
            DocumentoConocimiento.usuario_id == usuario_id
        )
        total = base.count()
        sincronizados = base.filter(
            DocumentoConocimiento.sincronizado == True
        ).count()
        pendientes = total - sincronizados
        categorias = len(KnowledgeService.get_categories(db, usuario_id))
        return {
            "total": total,
            "sincronizados": sincronizados,
            "pendientes": pendientes,
            "categorias": categorias,
        }

    @staticmethod
    def search(db: Session, usuario_id: int, query: str) -> list:
        """Busqueda simple por titulo o contenido (case-insensitive)"""
        pattern = f"%{query}%"
        docs = (
            db.query(DocumentoConocimiento)
            .filter(
                DocumentoConocimiento.usuario_id == usuario_id,
                DocumentoConocimiento.activo == True,
                (
                    DocumentoConocimiento.titulo.ilike(pattern)
                    | DocumentoConocimiento.contenido.ilike(pattern)
                ),
            )
            .all()
        )
        return [d.to_dict() for d in docs]

    @staticmethod
    def get_context_for_agent(db: Session, usuario_id: int) -> str:
        """Obtener todo el conocimiento activo como contexto para el agente"""
        docs = (
            db.query(DocumentoConocimiento)
            .filter(
                DocumentoConocimiento.usuario_id == usuario_id,
                DocumentoConocimiento.activo == True,
            )
            .order_by(DocumentoConocimiento.categoria)
            .all()
        )

        if not docs:
            return ""

        sections = []
        current_cat = None
        for doc in docs:
            if doc.categoria != current_cat:
                current_cat = doc.categoria
                sections.append(f"\n--- {current_cat.upper()} ---")
            sections.append(f"{doc.titulo}:\n{doc.contenido}")

        return "\n\n".join(sections)
