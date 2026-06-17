"""add media_archivos table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01 21:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "media_archivos" not in insp.get_table_names():
        op.create_table(
            "media_archivos",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("nombre", sa.String(200), nullable=False),
            sa.Column("descripcion", sa.Text(), nullable=True),
            sa.Column("categoria", sa.String(100), server_default="general"),
            sa.Column("archivo_url", sa.Text(), nullable=False),
            sa.Column("tipo", sa.String(20), server_default="imagen"),
            sa.Column("activo", sa.Boolean(), server_default="true"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "media_archivos" in insp.get_table_names():
        op.drop_table("media_archivos")
