"""Add invite_code to leagues table.

Revision ID: 006
Revises: 005
Create Date: 2024-01-06
"""
from alembic import op
import sqlalchemy as sa
import secrets


# revision identifiers
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def generate_invite_code() -> str:
    """Generate a random 8-character invite code."""
    return secrets.token_urlsafe(6)


def upgrade() -> None:
    # Add invite_code column
    op.add_column(
        'leagues',
        sa.Column('invite_code', sa.String(20), nullable=True)
    )

    # Create unique index
    op.create_index('ix_leagues_invite_code', 'leagues', ['invite_code'], unique=True)

    # Generate invite codes for existing leagues
    connection = op.get_bind()
    leagues = connection.execute(sa.text("SELECT id FROM leagues")).fetchall()
    for league in leagues:
        invite_code = generate_invite_code()
        connection.execute(
            sa.text("UPDATE leagues SET invite_code = :code WHERE id = :id"),
            {"code": invite_code, "id": league[0]}
        )


def downgrade() -> None:
    op.drop_index('ix_leagues_invite_code', table_name='leagues')
    op.drop_column('leagues', 'invite_code')
