"""Add usuario_id to all models for multi-tenancy

Revision ID: c4d5e6f7g8h9
Revises: b2c3d4e5f6a7
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7g8h9"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


# Tables that get a simple usuario_id column (already have integer PK)
SIMPLE_TABLES = [
    "citas",
    "inventario",
    "disponibilidad",
    "horarios_bloqueados",
    "media_archivos",
    "contactos",
    "campanas",
    "campana_destinatarios",
    "background_jobs",
    "business_config",
    "documentos_conocimiento",
    "funnel_pasos",
    "campos_captura",
    "mensajes_conversacion",
    "memoria",
]


def upgrade():
    # 1. Add usuario_id to all simple tables (nullable first)
    for table in SIMPLE_TABLES:
        op.add_column(table, sa.Column("usuario_id", sa.Integer(), nullable=True))

    # 2. Backfill existing data to usuario_id = 1
    for table in SIMPLE_TABLES:
        op.execute(f"UPDATE {table} SET usuario_id = 1 WHERE usuario_id IS NULL")

    # 3. Make NOT NULL
    for table in SIMPLE_TABLES:
        op.alter_column(table, "usuario_id", nullable=False)

    # 4. Add indexes
    for table in SIMPLE_TABLES:
        op.create_index(f"idx_{table}_usuario_id", table, ["usuario_id"])

    # 5. Fix Contacto: remove old unique index on telefono, add composite unique
    op.drop_index("ix_contactos_telefono", table_name="contactos")
    op.create_unique_constraint(
        "uq_contacto_telefono_usuario", "contactos", ["telefono", "usuario_id"]
    )
    op.create_index(
        "idx_contacto_usuario_telefono", "contactos", ["usuario_id", "telefono"]
    )

    # 6. Fix FunnelPaso: remove old unique on nombre, add composite
    try:
        op.drop_constraint("funnel_pasos_nombre_key", "funnel_pasos", type_="unique")
    except Exception:
        pass
    op.create_unique_constraint(
        "uq_funnel_nombre_usuario", "funnel_pasos", ["nombre", "usuario_id"]
    )

    # 7. Fix CampoCaptura: remove old unique on nombre, add composite
    try:
        op.drop_constraint("campos_captura_nombre_key", "campos_captura", type_="unique")
    except Exception:
        pass
    op.create_unique_constraint(
        "uq_campo_nombre_usuario", "campos_captura", ["nombre", "usuario_id"]
    )

    # 8. Rebuild Configuracion with composite PK
    # Create new table, copy data, swap
    op.create_table(
        "configuracion_new",
        sa.Column("clave", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valor", sa.Text()),
        sa.PrimaryKeyConstraint("clave", "usuario_id"),
    )
    op.execute(
        "INSERT INTO configuracion_new (clave, usuario_id, valor) "
        "SELECT clave, 0, valor FROM configuracion"
    )
    op.drop_table("configuracion")
    op.rename_table("configuracion_new", "configuracion")

    # 9. Rebuild ToolsConfig with composite PK
    op.create_table(
        "tools_config_new",
        sa.Column("nombre", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("habilitado", sa.Boolean(), default=True),
        sa.Column("descripcion", sa.String()),
        sa.PrimaryKeyConstraint("nombre", "usuario_id"),
    )
    op.execute(
        "INSERT INTO tools_config_new (nombre, usuario_id, habilitado, descripcion) "
        "SELECT nombre, 0, habilitado, descripcion FROM tools_config"
    )
    op.drop_table("tools_config")
    op.rename_table("tools_config_new", "tools_config")

    # 10. Composite index on mensajes_conversacion
    op.create_index(
        "idx_msg_usuario_telefono",
        "mensajes_conversacion",
        ["usuario_id", "telefono", "created_at"],
    )


def downgrade():
    # Remove composite index
    op.drop_index("idx_msg_usuario_telefono", "mensajes_conversacion")

    # Rebuild Configuracion back to single PK
    op.create_table(
        "configuracion_old",
        sa.Column("clave", sa.String(), primary_key=True),
        sa.Column("valor", sa.Text()),
    )
    op.execute(
        "INSERT INTO configuracion_old (clave, valor) "
        "SELECT DISTINCT ON (clave) clave, valor FROM configuracion ORDER BY clave, usuario_id"
    )
    op.drop_table("configuracion")
    op.rename_table("configuracion_old", "configuracion")

    # Rebuild ToolsConfig back to single PK
    op.create_table(
        "tools_config_old",
        sa.Column("nombre", sa.String(), primary_key=True),
        sa.Column("habilitado", sa.Boolean(), default=True),
        sa.Column("descripcion", sa.String()),
    )
    op.execute(
        "INSERT INTO tools_config_old (nombre, habilitado, descripcion) "
        "SELECT DISTINCT ON (nombre) nombre, habilitado, descripcion FROM tools_config ORDER BY nombre, usuario_id"
    )
    op.drop_table("tools_config")
    op.rename_table("tools_config_old", "tools_config")

    # Remove composite uniques, restore old uniques
    op.drop_constraint("uq_campo_nombre_usuario", "campos_captura", type_="unique")
    op.create_unique_constraint("campos_captura_nombre_key", "campos_captura", ["nombre"])

    op.drop_constraint("uq_funnel_nombre_usuario", "funnel_pasos", type_="unique")
    op.create_unique_constraint("funnel_pasos_nombre_key", "funnel_pasos", ["nombre"])

    op.drop_constraint("uq_contacto_telefono_usuario", "contactos", type_="unique")
    op.drop_index("idx_contacto_usuario_telefono", "contactos")
    op.create_index("ix_contactos_telefono", "contactos", ["telefono"], unique=True)

    # Remove usuario_id column and indexes
    for table in SIMPLE_TABLES:
        op.drop_index(f"idx_{table}_usuario_id", table)
        op.drop_column(table, "usuario_id")
