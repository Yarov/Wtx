"""
Inventory schemas
"""
from pydantic import BaseModel
from typing import List, Optional


class ProductModel(BaseModel):
    producto: str
    stock: int
    precio: float
    categoria: Optional[str] = ""
    descripcion: Optional[str] = ""


class ProductResponse(BaseModel):
    id: int
    producto: str
    stock: int
    precio: float
    categoria: Optional[str] = ""
    descripcion: Optional[str] = ""


class ImportProductsModel(BaseModel):
    products: List[dict]


class UploadResponse(BaseModel):
    preview: List[dict]
    mapping: Optional[dict] = None
    headers: Optional[List[str]] = None
