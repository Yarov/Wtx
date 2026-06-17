"""add perfiles table (WhatsApp profiles, SaaS multi-tenant)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "perfiles" in inspector.get_table_names():
        return  # already created by create_all on fresh DBs

    op.create_table(
        "perfiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False, server_default="Mi Perfil"),
        sa.Column("numero_whatsapp", sa.String(length=20), nullable=True),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("emoji", sa.String(length=10), server_default="📱"),
        sa.Column("es_activo", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_perfiles_usuario_id", "perfiles", ["usuario_id"])
    op.create_index("idx_perfil_usuario_activo", "perfiles", ["usuario_id", "es_activo"])


def downgrade():
    op.drop_table("perfiles")
