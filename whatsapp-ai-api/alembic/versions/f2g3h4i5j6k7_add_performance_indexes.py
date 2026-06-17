"""add_performance_indexes

Revision ID: f2g3h4i5j6k7
Revises: e1f2g3h4i5j6
Create Date: 2026-04-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f2g3h4i5j6k7"
down_revision: Union[str, Sequence[str], None] = "e1f2g3h4i5j6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add performance indexes for production workloads."""

    # --- HIGH PRIORITY ---

    # campanas
    op.create_index("idx_campana_estado", "campanas", ["estado"])
    op.create_index("idx_campana_programada", "campanas", ["programada_para"])
    op.create_index("idx_campana_usuario_estado", "campanas", ["usuario_id", "estado"])

    # campana_destinatarios
    op.create_index(
        "idx_dest_campana_estado", "campana_destinatarios", ["campana_id", "estado"]
    )
    op.create_index(
        "idx_dest_contacto_estado", "campana_destinatarios", ["contacto_id", "estado"]
    )

    # disponibilidad
    op.create_index(
        "idx_disp_usuario_activo", "disponibilidad", ["usuario_id", "activo"]
    )

    # background_jobs
    op.create_index("idx_job_estado", "background_jobs", ["estado"])

    # --- MEDIUM PRIORITY ---

    # inventario
    op.create_index(
        "idx_inventario_usuario_producto", "inventario", ["usuario_id", "producto"]
    )

    # media_archivos
    op.create_index(
        "idx_media_usuario_activo", "media_archivos", ["usuario_id", "activo"]
    )
    op.create_index("idx_media_categoria", "media_archivos", ["categoria"])

    # documentos_conocimiento
    op.create_index(
        "idx_doc_usuario_activo", "documentos_conocimiento", ["usuario_id", "activo"]
    )


def downgrade() -> None:
    """Remove performance indexes."""

    # documentos_conocimiento
    op.drop_index("idx_doc_usuario_activo", table_name="documentos_conocimiento")

    # media_archivos
    op.drop_index("idx_media_categoria", table_name="media_archivos")
    op.drop_index("idx_media_usuario_activo", table_name="media_archivos")

    # inventario
    op.drop_index("idx_inventario_usuario_producto", table_name="inventario")

    # background_jobs
    op.drop_index("idx_job_estado", table_name="background_jobs")

    # disponibilidad
    op.drop_index("idx_disp_usuario_activo", table_name="disponibilidad")

    # campana_destinatarios
    op.drop_index("idx_dest_contacto_estado", table_name="campana_destinatarios")
    op.drop_index("idx_dest_campana_estado", table_name="campana_destinatarios")

    # campanas
    op.drop_index("idx_campana_usuario_estado", table_name="campanas")
    op.drop_index("idx_campana_programada", table_name="campanas")
    op.drop_index("idx_campana_estado", table_name="campanas")
