"""Add feedback table

Revision ID: 008
Revises: 007
Create Date: 2024-01-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('category', sa.String(50), nullable=False, server_default='suggestion'),
        sa.Column('page', sa.String(255), nullable=True),
        sa.Column('user_email', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('feedback')
