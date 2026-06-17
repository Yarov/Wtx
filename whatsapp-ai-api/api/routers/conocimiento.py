"""Conocimiento Router - Knowledge Base CRUD"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from models import SessionLocal, Usuario
from auth import get_current_user
from knowledge_service import KnowledgeService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/conocimiento",
    tags=["Conocimiento"],
    responses={401: {"description": "Not authenticated"}},
)


class DocumentoCreate(BaseModel):
    titulo: str
    contenido: str
    categoria: str = "general"


class DocumentoUpdate(BaseModel):
    titulo: Optional[str] = None
    contenido: Optional[str] = None
    categoria: Optional[str] = None
    activo: Optional[bool] = None


@router.get("", summary="List knowledge documents")
async def list_documents(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        return KnowledgeService.get_all(db, current_user.id)
    finally:
        db.close()


@router.get("/stats", summary="Knowledge base stats")
async def get_stats(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        return KnowledgeService.get_stats(db, current_user.id)
    finally:
        db.close()


@router.get("/categories", summary="List categories")
async def get_categories(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        return KnowledgeService.get_categories(db, current_user.id)
    finally:
        db.close()


@router.get("/search", summary="Search knowledge base")
async def search_knowledge(q: str, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        return KnowledgeService.search(db, current_user.id, q)
    finally:
        db.close()


@router.get("/{doc_id}", summary="Get document by ID")
async def get_document(doc_id: int, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        doc = KnowledgeService.get_by_id(db, doc_id, current_user.id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc
    finally:
        db.close()


@router.post("", summary="Create document")
async def create_document(
    data: DocumentoCreate, current_user: Usuario = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        return KnowledgeService.create(db, current_user.id, data.titulo, data.contenido, data.categoria)
    finally:
        db.close()


@router.put("/{doc_id}", summary="Update document")
async def update_document(
    doc_id: int,
    data: DocumentoUpdate,
    current_user: Usuario = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        result = KnowledgeService.update(db, doc_id, current_user.id, **update_data)
        if not result:
            raise HTTPException(status_code=404, detail="Document not found")
        return result
    finally:
        db.close()


@router.delete("/{doc_id}", summary="Delete document")
async def delete_document(
    doc_id: int, current_user: Usuario = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        if not KnowledgeService.delete(db, doc_id, current_user.id):
            raise HTTPException(status_code=404, detail="Document not found")
        return {"status": "ok"}
    finally:
        db.close()


@router.post("/sync", summary="Sync all documents")
async def sync_documents(current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        KnowledgeService.sync_all(db, current_user.id)
        return {"status": "ok"}
    finally:
        db.close()
