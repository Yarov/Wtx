"""Add foreign key constraints with CASCADE delete

Revision ID: d5e6f7g8h9i0
Revises: c4d5e6f7g8h9
Create Date: 2026-04-02
"""
from alembic import op

revision = "e1f2g3h4i5j6"
down_revision = "c4d5e6f7g8h9"
branch_labels = None
depends_on = None

# All tables with usuario_id -> usuarios(id) ON DELETE CASCADE
USUARIO_FK_TABLES = [
    "contactos",
    "campanas",
    "campana_destinatarios",
    "citas",
    "inventario",
    "memoria",
    "disponibilidad",
    "horarios_bloqueados",
    "background_jobs",
    "business_config",
    "media_archivos",
    "documentos_conocimiento",
    "funnel_pasos",
    "campos_captura",
    "mensajes_conversacion",
]


def upgrade():
    # FK: usuario_id -> usuarios(id) for all tables
    for table in USUARIO_FK_TABLES:
        op.create_foreign_key(
            f"fk_{table}_usuario_id",
            table,
            "usuarios",
            ["usuario_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # FK: campana_destinatarios.campana_id -> campanas(id)
    op.create_foreign_key(
        "fk_campana_destinatarios_campana_id",
        "campana_destinatarios",
        "campanas",
        ["campana_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # FK: campana_destinatarios.contacto_id -> contactos(id)
    op.create_foreign_key(
        "fk_campana_destinatarios_contacto_id",
        "campana_destinatarios",
        "contactos",
        ["contacto_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade():
    # Drop campana_destinatarios extra FKs
    op.drop_constraint(
        "fk_campana_destinatarios_contacto_id",
        "campana_destinatarios",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_campana_destinatarios_campana_id",
        "campana_destinatarios",
        type_="foreignkey",
    )

    # Drop usuario_id FKs (reverse order)
    for table in reversed(USUARIO_FK_TABLES):
        op.drop_constraint(
            f"fk_{table}_usuario_id",
            table,
            type_="foreignkey",
        )
