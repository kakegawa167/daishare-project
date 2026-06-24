"""enable realtime for messages table

Revision ID: b13932421727
Revises: 97d7ad714e2a
Create Date: 2026-06-24 06:06:13.132948

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b13932421727'
down_revision: Union[str, None] = '97d7ad714e2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # UPDATE イベントで変更前後の全カラムを Realtime に流すために FULL に設定
    op.execute("ALTER TABLE messages REPLICA IDENTITY FULL")
    # Supabase Realtime の publication に追加（既に含まれている場合はエラーにならない）
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                ALTER PUBLICATION supabase_realtime ADD TABLE messages;
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE messages REPLICA IDENTITY DEFAULT")
