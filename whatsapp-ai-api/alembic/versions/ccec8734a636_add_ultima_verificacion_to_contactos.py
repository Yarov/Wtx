"""add_ultima_verificacion_to_contactos

Revision ID: ccec8734a636
Revises: 7e97e6c59f5f
Create Date: 2026-01-19 06:32:47.430140

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ccec8734a636'
down_revision: Union[str, Sequence[str], None] = '7e97e6c59f5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('contactos', sa.Column('ultima_verificacion', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('contactos', 'ultima_verificacion')
