"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Create leagues table
    op.create_table('leagues',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(50), nullable=False),
        sa.Column('timezone', sa.String(50), nullable=False),
        sa.Column('visibility', sa.Enum('private', 'public', name='leaguevisibility'), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_leagues_slug', 'leagues', ['slug'], unique=True)

    # Create seasons table
    op.create_table('seasons',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('status', sa.Enum('active', 'archived', name='seasonstatus'), nullable=False),
        sa.Column('starts_at', sa.Date(), nullable=False),
        sa.Column('ends_at', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_seasons_league_id', 'seasons', ['league_id'])

    # Create players table
    op.create_table('players',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('nickname', sa.String(50), nullable=False),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('is_guest', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('league_id', 'nickname', name='uq_player_league_nickname')
    )
    op.create_index('ix_players_league_id', 'players', ['league_id'])

    # Create league_members table
    op.create_table('league_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('player_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role', sa.Enum('owner', 'admin', 'member', name='memberrole'), nullable=False),
        sa.Column('status', sa.Enum('active', 'invited', 'removed', name='memberstatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.ForeignKeyConstraint(['player_id'], ['players.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_league_members_league_id', 'league_members', ['league_id'])

    # Create matches table
    op.create_table('matches',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('season_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mode', sa.Enum('1v1', '2v2', name='matchmode'), nullable=False),
        sa.Column('team_a_score', sa.Integer(), nullable=False),
        sa.Column('team_b_score', sa.Integer(), nullable=False),
        sa.Column('played_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by_player_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.Enum('valid', 'void', name='matchstatus'), nullable=False),
        sa.Column('void_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_player_id'], ['players.id'], ),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_matches_league_id', 'matches', ['league_id'])
    op.create_index('ix_matches_season_id', 'matches', ['season_id'])

    # Create match_players table
    op.create_table('match_players',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('match_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('player_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('team', sa.Enum('A', 'B', name='team'), nullable=False),
        sa.Column('position', sa.Enum('attack', 'defense', name='playerposition'), nullable=False),
        sa.Column('is_captain', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ),
        sa.ForeignKeyConstraint(['player_id'], ['players.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_match_players_match_id', 'match_players', ['match_id'])
    op.create_index('ix_match_players_player_id', 'match_players', ['player_id'])

    # Create match_events table
    op.create_table('match_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('match_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.Enum('gamelle', name='eventtype'), nullable=False),
        sa.Column('against_player_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('by_player_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['against_player_id'], ['players.id'], ),
        sa.ForeignKeyConstraint(['by_player_id'], ['players.id'], ),
        sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_match_events_match_id', 'match_events', ['match_id'])

    # Create rating_snapshots table
    op.create_table('rating_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('season_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('player_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mode', sa.String(10), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('as_of_match_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('computed_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['as_of_match_id'], ['matches.id'], ),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.ForeignKeyConstraint(['player_id'], ['players.id'], ),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('player_id', 'as_of_match_id', 'mode', name='uq_rating_player_match_mode')
    )
    op.create_index('ix_rating_snapshots_league_id', 'rating_snapshots', ['league_id'])
    op.create_index('ix_rating_snapshots_player_id', 'rating_snapshots', ['player_id'])
    op.create_index('ix_rating_snapshots_season_id', 'rating_snapshots', ['season_id'])

    # Create stats_snapshots table
    op.create_table('stats_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('season_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('snapshot_type', sa.String(50), nullable=False),
        sa.Column('version', sa.String(20), nullable=False),
        sa.Column('data_json', postgresql.JSONB(), nullable=False),
        sa.Column('computed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('source_hash', sa.String(64), nullable=False),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_stats_snapshots_league_id', 'stats_snapshots', ['league_id'])
    op.create_index('ix_stats_snapshots_season_id', 'stats_snapshots', ['season_id'])

    # Create artifacts table
    op.create_table('artifacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('season_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('generator', sa.String(50), nullable=False),
        sa.Column('artifact_set_name', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('queued', 'running', 'done', 'failed', name='artifactstatus'), nullable=False),
        sa.Column('run_id', sa.String(50), nullable=False),
        sa.Column('output_path', sa.String(500), nullable=True),
        sa.Column('manifest_json', postgresql.JSONB(), nullable=True),
        sa.Column('source_hash', sa.String(64), nullable=True),
        sa.Column('created_by_player_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_player_id'], ['players.id'], ),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_artifacts_league_id', 'artifacts', ['league_id'])
    op.create_index('ix_artifacts_season_id', 'artifacts', ['season_id'])


def downgrade() -> None:
    op.drop_index('ix_artifacts_season_id', table_name='artifacts')
    op.drop_index('ix_artifacts_league_id', table_name='artifacts')
    op.drop_table('artifacts')
    op.drop_index('ix_stats_snapshots_season_id', table_name='stats_snapshots')
    op.drop_index('ix_stats_snapshots_league_id', table_name='stats_snapshots')
    op.drop_table('stats_snapshots')
    op.drop_index('ix_rating_snapshots_season_id', table_name='rating_snapshots')
    op.drop_index('ix_rating_snapshots_player_id', table_name='rating_snapshots')
    op.drop_index('ix_rating_snapshots_league_id', table_name='rating_snapshots')
    op.drop_table('rating_snapshots')
    op.drop_index('ix_match_events_match_id', table_name='match_events')
    op.drop_table('match_events')
    op.drop_index('ix_match_players_player_id', table_name='match_players')
    op.drop_index('ix_match_players_match_id', table_name='match_players')
    op.drop_table('match_players')
    op.drop_index('ix_matches_season_id', table_name='matches')
    op.drop_index('ix_matches_league_id', table_name='matches')
    op.drop_table('matches')
    op.drop_index('ix_league_members_league_id', table_name='league_members')
    op.drop_table('league_members')
    op.drop_index('ix_players_league_id', table_name='players')
    op.drop_table('players')
    op.drop_index('ix_seasons_league_id', table_name='seasons')
    op.drop_table('seasons')
    op.drop_index('ix_leagues_slug', table_name='leagues')
    op.drop_table('leagues')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS artifactstatus')
    op.execute('DROP TYPE IF EXISTS eventtype')
    op.execute('DROP TYPE IF EXISTS playerposition')
    op.execute('DROP TYPE IF EXISTS team')
    op.execute('DROP TYPE IF EXISTS matchstatus')
    op.execute('DROP TYPE IF EXISTS matchmode')
    op.execute('DROP TYPE IF EXISTS memberstatus')
    op.execute('DROP TYPE IF EXISTS memberrole')
    op.execute('DROP TYPE IF EXISTS seasonstatus')
    op.execute('DROP TYPE IF EXISTS leaguevisibility')
