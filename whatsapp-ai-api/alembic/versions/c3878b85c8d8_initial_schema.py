"""initial_schema

Revision ID: c3878b85c8d8
Revises: 
Create Date: 2026-01-19 01:52:19.169560

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c3878b85c8d8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Eliminar tabla legacy 'pagos' que ya no se usa
    op.execute("DROP TABLE IF EXISTS pagos CASCADE")


def downgrade() -> None:
    """Downgrade schema."""
    # No recreamos pagos - tabla legacy eliminada
    pass
