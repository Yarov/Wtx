"""add perfil_id to config tables (per-profile agent config cascade)

Adds a ``perfil_id`` column to ``configuracion`` and ``tools_config`` and
rebuilds their composite PRIMARY KEY to include it. This enables the 3-level
config cascade:
    (clave, usuario_id, perfil_id)  -> perfil level
    (clave, usuario_id, 0)          -> usuario level (shared by all profiles)
    (clave, 0, 0)                   -> global level

Existing rows keep perfil_id = 0 (usuario level) via the column default, so all
profiles inherit current config unless overridden per profile.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


# (table, new-pk-column-list) — pk columns AFTER adding perfil_id.
CONFIG_TABLES = [
    ("configuracion", ["clave", "usuario_id", "perfil_id"]),
    ("tools_config", ["nombre", "usuario_id", "perfil_id"]),
]


def _has_column(inspector, table: str, column: str) -> bool:
    try:
        cols = [c["name"] for c in inspector.get_columns(table)]
    except Exception:
        return False
    return column in cols


def _pk_name(inspector, table: str):
    try:
        pk = inspector.get_pk_constraint(table)
    except Exception:
        return None, []
    return pk.get("name"), pk.get("constrained_columns", []) or []


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table, new_pk_cols in CONFIG_TABLES:
        if table not in existing_tables:
            continue

        # 1. Add perfil_id column (NOT NULL, default 0) — idempotent.
        if not _has_column(inspector, table, "perfil_id"):
            op.add_column(
                table,
                sa.Column(
                    "perfil_id",
                    sa.Integer(),
                    nullable=False,
                    server_default="0",
                ),
            )

        # 2. Rebuild the composite primary key to include perfil_id.
        pk_name, pk_cols = _pk_name(inspector, table)
        if "perfil_id" not in pk_cols:
            if pk_name:
                op.drop_constraint(pk_name, table, type_="primary")
            op.create_primary_key(f"{table}_pkey", table, new_pk_cols)

    # Existing rows already have perfil_id = 0 via server_default — no backfill
    # needed; they live at the "usuario" level and cascade down to all profiles.


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # Revert PK to (key, usuario_id) and drop perfil_id.
    old_pk = {
        "configuracion": ["clave", "usuario_id"],
        "tools_config": ["nombre", "usuario_id"],
    }
    for table, _ in CONFIG_TABLES:
        if table not in existing_tables:
            continue
        pk_name, pk_cols = _pk_name(inspector, table)
        if "perfil_id" in pk_cols:
            if pk_name:
                op.drop_constraint(pk_name, table, type_="primary")
            op.create_primary_key(f"{table}_pkey", table, old_pk[table])
        if _has_column(inspector, table, "perfil_id"):
            op.drop_column(table, "perfil_id")
