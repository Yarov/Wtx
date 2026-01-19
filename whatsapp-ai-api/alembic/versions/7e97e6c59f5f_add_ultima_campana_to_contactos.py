"""add_ultima_campana_to_contactos

Revision ID: 7e97e6c59f5f
Revises: c3878b85c8d8
Create Date: 2026-01-19 02:32:15.181005

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e97e6c59f5f'
down_revision: Union[str, Sequence[str], None] = 'c3878b85c8d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('contactos', sa.Column('ultima_campana', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('contactos', 'ultima_campana')
