"""add knowledge base, funnel, data capture, and per-message conversation tables

Revision ID: a1b2c3d4e5f6
Revises: ccec8734a636
Create Date: 2026-04-01 11:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "ccec8734a636"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """Check if a table exists in the database"""
    bind = op.get_bind()
    insp = inspect(bind)
    return table_name in insp.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table"""
    bind = op.get_bind()
    insp = inspect(bind)
    columns = [col["name"] for col in insp.get_columns(table_name)]
    return column_name in columns


def _index_exists(index_name: str) -> bool:
    """Check if an index exists"""
    bind = op.get_bind()
    result = bind.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :name"),
        {"name": index_name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # ─── Nuevas columnas en contactos (pipeline/funnel) ───
    if not _column_exists("contactos", "estado_lead"):
        op.add_column(
            "contactos",
            sa.Column("estado_lead", sa.String(30), server_default="nuevo"),
        )
    if not _column_exists("contactos", "paso_funnel"):
        op.add_column(
            "contactos", sa.Column("paso_funnel", sa.String(100), nullable=True)
        )
    if not _column_exists("contactos", "lead_score"):
        op.add_column(
            "contactos", sa.Column("lead_score", sa.Integer(), server_default="0")
        )
    if not _column_exists("contactos", "datos_capturados"):
        op.add_column(
            "contactos",
            sa.Column("datos_capturados", sa.Text(), server_default="{}"),
        )

    if not _index_exists("idx_contacto_estado_lead"):
        op.create_index("idx_contacto_estado_lead", "contactos", ["estado_lead"])
    if not _index_exists("idx_contacto_paso_funnel"):
        op.create_index("idx_contacto_paso_funnel", "contactos", ["paso_funnel"])

    # ─── Base de Conocimiento ───
    if not _table_exists("documentos_conocimiento"):
        op.create_table(
            "documentos_conocimiento",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("titulo", sa.String(200), nullable=False),
            sa.Column("contenido", sa.Text(), nullable=False),
            sa.Column("categoria", sa.String(100), server_default="general"),
            sa.Column("activo", sa.Boolean(), server_default="true"),
            sa.Column("sincronizado", sa.Boolean(), server_default="false"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        )
        op.create_index("idx_doc_categoria", "documentos_conocimiento", ["categoria"])
        op.create_index("idx_doc_activo", "documentos_conocimiento", ["activo"])

    # ─── Funnel / Pasos ───
    if not _table_exists("funnel_pasos"):
        op.create_table(
            "funnel_pasos",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("nombre", sa.String(100), nullable=False, unique=True),
            sa.Column("titulo", sa.String(200)),
            sa.Column("orden", sa.Integer(), server_default="0"),
            sa.Column("descripcion", sa.Text()),
            sa.Column("instrucciones_agente", sa.Text()),
            sa.Column("condiciones_avance", sa.Text(), server_default="[]"),
            sa.Column("activo", sa.Boolean(), server_default="true"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        )
        op.create_index("idx_funnel_orden", "funnel_pasos", ["orden"])

    # ─── Campos de Captura de Datos ───
    if not _table_exists("campos_captura"):
        op.create_table(
            "campos_captura",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("nombre", sa.String(50), nullable=False, unique=True),
            sa.Column("etiqueta", sa.String(100)),
            sa.Column("tipo", sa.String(20), server_default="texto"),
            sa.Column("obligatorio", sa.Boolean(), server_default="false"),
            sa.Column("orden", sa.Integer(), server_default="0"),
            sa.Column("activo", sa.Boolean(), server_default="true"),
        )

    # ─── Mensajes de Conversación (per-message) ───
    if not _table_exists("mensajes_conversacion"):
        op.create_table(
            "mensajes_conversacion",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("telefono", sa.String(20), nullable=False),
            sa.Column("rol", sa.String(20), nullable=False),
            sa.Column("contenido", sa.Text(), nullable=False),
            sa.Column("tipo_evento", sa.String(50), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        )
        op.create_index(
            "idx_msg_telefono_created",
            "mensajes_conversacion",
            ["telefono", "created_at"],
        )
        op.create_index("idx_msg_tipo_evento", "mensajes_conversacion", ["tipo_evento"])


def downgrade() -> None:
    if _table_exists("mensajes_conversacion"):
        op.drop_table("mensajes_conversacion")
    if _table_exists("campos_captura"):
        op.drop_table("campos_captura")
    if _table_exists("funnel_pasos"):
        op.drop_table("funnel_pasos")
    if _table_exists("documentos_conocimiento"):
        op.drop_table("documentos_conocimiento")

    if _index_exists("idx_contacto_paso_funnel"):
        op.drop_index("idx_contacto_paso_funnel", "contactos")
    if _index_exists("idx_contacto_estado_lead"):
        op.drop_index("idx_contacto_estado_lead", "contactos")
    if _column_exists("contactos", "datos_capturados"):
        op.drop_column("contactos", "datos_capturados")
    if _column_exists("contactos", "lead_score"):
        op.drop_column("contactos", "lead_score")
    if _column_exists("contactos", "paso_funnel"):
        op.drop_column("contactos", "paso_funnel")
    if _column_exists("contactos", "estado_lead"):
        op.drop_column("contactos", "estado_lead")
