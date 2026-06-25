"""add cart_locations table

Revision ID: e3f7a2b91c04
Revises: 97d7ad714e2a
Create Date: 2026-06-25 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e3f7a2b91c04"
down_revision: str | None = "97d7ad714e2a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cart_locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cart_id", sa.Integer(), nullable=False),
        sa.Column("station_id", sa.Integer(), nullable=True),
        sa.Column("lending_address", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["cart_id"], ["carts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["station_id"], ["stations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cart_locations_cart_id", "cart_locations", ["cart_id"])

    # 既存の cart の station_id/lending_address を cart_locations に移行
    op.execute("""
        INSERT INTO cart_locations (cart_id, station_id, lending_address, sort_order)
        SELECT id, station_id, lending_address, 0
        FROM carts
        WHERE station_id IS NOT NULL OR lending_address IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_index("ix_cart_locations_cart_id", "cart_locations")
    op.drop_table("cart_locations")
