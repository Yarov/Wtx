"""drop appointment, inventory and media modules

Removes the agenda (citas), inventario and galería (media) modules:
drops their tables and the has_* module flags from business_config.

Idempotent (IF EXISTS) so it is safe on fresh DBs and partial states.

Revision ID: d4e5f6a7b8c9
Revises: f2g3h4i5j6k7
Create Date: 2026-06-16
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "f2g3h4i5j6k7"
branch_labels = None
depends_on = None


def upgrade():
    # Drop module tables (CASCADE removes dependent FKs/indexes).
    op.execute("DROP TABLE IF EXISTS citas CASCADE")
    op.execute("DROP TABLE IF EXISTS inventario CASCADE")
    op.execute("DROP TABLE IF EXISTS disponibilidad CASCADE")
    op.execute("DROP TABLE IF EXISTS horarios_bloqueados CASCADE")
    op.execute("DROP TABLE IF EXISTS media_archivos CASCADE")

    # Drop module flags from business_config.
    op.execute("ALTER TABLE business_config DROP COLUMN IF EXISTS has_inventory")
    op.execute("ALTER TABLE business_config DROP COLUMN IF EXISTS has_appointments")
    op.execute("ALTER TABLE business_config DROP COLUMN IF EXISTS has_schedule")


def downgrade():
    # One-way migration: the modules were removed from the product.
    # Recreating empty tables/columns is intentionally not supported.
    pass
