"""Add live match session tables

Revision ID: 004
Revises: 003
Create Date: 2024-01-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create live_match_sessions table
    op.create_table(
        'live_match_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('leagues.id'), nullable=False, index=True),
        sa.Column('season_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('seasons.id'), nullable=False, index=True),
        sa.Column('share_token', sa.String(32), unique=True, nullable=False, index=True),
        sa.Column('scorer_secret', sa.String(32), nullable=True),
        sa.Column('mode', sa.String(10), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='waiting'),
        sa.Column('team_a_score', sa.Integer, nullable=False, server_default='0'),
        sa.Column('team_b_score', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finalized_match_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('matches.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create live_match_session_players table
    op.create_table(
        'live_match_session_players',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('live_match_sessions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('player_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('players.id'), nullable=False),
        sa.Column('team', sa.String(1), nullable=False),
        sa.Column('position', sa.String(10), nullable=False),
    )

    # Create live_match_session_events table
    op.create_table(
        'live_match_session_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('live_match_sessions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('event_type', sa.String(20), nullable=False),
        sa.Column('team', sa.String(1), nullable=True),
        sa.Column('by_player_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('players.id'), nullable=True),
        sa.Column('against_player_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('players.id'), nullable=True),
        sa.Column('custom_type', sa.String(50), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('recorded_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('undone_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('live_match_session_events')
    op.drop_table('live_match_session_players')
    op.drop_table('live_match_sessions')
