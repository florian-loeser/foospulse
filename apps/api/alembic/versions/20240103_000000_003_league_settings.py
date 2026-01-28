"""Add league settings column

Revision ID: 003
Revises: 002
Create Date: 2024-01-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'leagues',
        sa.Column(
            'settings',
            postgresql.JSONB(),
            server_default='{"show_gamelles_board": true, "show_shame_stats": true}',
            nullable=False
        )
    )


def downgrade() -> None:
    op.drop_column('leagues', 'settings')
