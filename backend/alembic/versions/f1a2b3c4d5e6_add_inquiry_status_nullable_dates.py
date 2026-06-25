"""add inquiry status and nullable dates

Revision ID: f1a2b3c4d5e6
Revises: e3f7a2b91c04
Create Date: 2026-06-25 12:00:00.000000
"""
from collections.abc import Sequence

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "e3f7a2b91c04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # PostgreSQL enum に inquiry を追加
    op.execute("ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'inquiry'")

    # start_date / end_date を nullable に変更
    op.alter_column("rental_requests", "start_date", nullable=True)
    op.alter_column("rental_requests", "end_date", nullable=True)


def downgrade() -> None:
    op.alter_column("rental_requests", "start_date", nullable=False)
    op.alter_column("rental_requests", "end_date", nullable=False)
    # PostgreSQL enum の値削除は複雑なため省略
