"""Add 2v1 match mode

Revision ID: 013
Revises: 012
Create Date: 2024-02-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '013'
down_revision: Union[str, None] = '012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add '2v1' to matchmode enum
    op.execute("ALTER TYPE matchmode ADD VALUE IF NOT EXISTS '2v1'")
    # Add '2v1' to livematchmode enum
    op.execute("ALTER TYPE livematchmode ADD VALUE IF NOT EXISTS '2v1'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    # This would require recreating the enum and all columns using it
    pass
