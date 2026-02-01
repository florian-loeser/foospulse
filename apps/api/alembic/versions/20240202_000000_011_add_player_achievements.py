"""Add player achievements table.

Revision ID: 011
Revises: 010
Create Date: 2024-02-02 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '011'
down_revision: Union[str, None] = '010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'player_achievements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('player_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('achievement_type', sa.String(50), nullable=False),
        sa.Column('unlocked_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('trigger_match_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('progress_value', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['players.id'], ),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.ForeignKeyConstraint(['trigger_match_id'], ['matches.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_player_achievements_player_id', 'player_achievements', ['player_id'])
    op.create_index('ix_player_achievements_league_id', 'player_achievements', ['league_id'])


def downgrade() -> None:
    op.drop_index('ix_player_achievements_league_id', 'player_achievements')
    op.drop_index('ix_player_achievements_player_id', 'player_achievements')
    op.drop_table('player_achievements')
