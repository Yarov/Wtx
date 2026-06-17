"""add perfil_id to data tables (SaaS multi-profile data isolation)

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


# (table, index_name) for the 9 data tables that get isolated per profile.
DATA_TABLES = [
    ("memoria", "ix_memoria_perfil_id"),
    ("contactos", "ix_contactos_perfil_id"),
    ("campanas", "ix_campanas_perfil_id"),
    ("campana_destinatarios", "ix_campana_destinatarios_perfil_id"),
    ("background_jobs", "ix_background_jobs_perfil_id"),
    ("documentos_conocimiento", "ix_documentos_conocimiento_perfil_id"),
    ("funnel_pasos", "ix_funnel_pasos_perfil_id"),
    ("campos_captura", "ix_campos_captura_perfil_id"),
    ("mensajes_conversacion", "ix_mensajes_conversacion_perfil_id"),
]


def _has_column(inspector, table: str, column: str) -> bool:
    try:
        cols = [c["name"] for c in inspector.get_columns(table)]
    except Exception:
        return False
    return column in cols


def _has_index(inspector, table: str, index: str) -> bool:
    try:
        idxs = [i["name"] for i in inspector.get_indexes(table)]
    except Exception:
        return False
    return index in idxs


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # 1. Add perfil_id column + index to each data table (idempotent).
    for table, index_name in DATA_TABLES:
        if table not in existing_tables:
            continue
        if not _has_column(inspector, table, "perfil_id"):
            op.add_column(
                table,
                sa.Column("perfil_id", sa.Integer(), nullable=True),
            )
        if not _has_index(inspector, table, index_name):
            op.create_index(index_name, table, ["perfil_id"])

    # 2. Backfill: ensure every user has an active profile, then assign
    #    perfil_id = active profile of that row's usuario_id where NULL.
    #
    # 2a. Create a default active profile for users that have none.
    op.execute(
        """
        INSERT INTO perfiles (usuario_id, nombre, emoji, es_activo, created_at, updated_at)
        SELECT u.id, 'Mi WhatsApp', '📱', TRUE, NOW(), NOW()
        FROM usuarios u
        WHERE NOT EXISTS (
            SELECT 1 FROM perfiles p WHERE p.usuario_id = u.id
        )
        """
    )

    # 2b. For users that have profiles but none active, promote the oldest.
    op.execute(
        """
        UPDATE perfiles
        SET es_activo = TRUE
        WHERE id IN (
            SELECT DISTINCT ON (p.usuario_id) p.id
            FROM perfiles p
            WHERE p.usuario_id NOT IN (
                SELECT usuario_id FROM perfiles WHERE es_activo = TRUE
            )
            ORDER BY p.usuario_id, p.created_at ASC, p.id ASC
        )
        """
    )

    # 2c. Backfill perfil_id for each data table using the user's active profile.
    for table, _ in DATA_TABLES:
        if table not in existing_tables:
            continue
        op.execute(
            f"""
            UPDATE {table} AS t
            SET perfil_id = p.id
            FROM perfiles p
            WHERE p.usuario_id = t.usuario_id
              AND p.es_activo = TRUE
              AND t.perfil_id IS NULL
            """
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    for table, index_name in DATA_TABLES:
        if table not in existing_tables:
            continue
        if _has_index(inspector, table, index_name):
            op.drop_index(index_name, table_name=table)
        if _has_column(inspector, table, "perfil_id"):
            op.drop_column(table, "perfil_id")
