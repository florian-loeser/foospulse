"""Add unique constraint to stats_snapshots

Revision ID: 009
Revises: 008
Create Date: 2024-01-31 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, clean up duplicate snapshots keeping only the most recent one for each type
    op.execute("""
        DELETE FROM stats_snapshots
        WHERE id NOT IN (
            SELECT DISTINCT ON (league_id, season_id, snapshot_type) id
            FROM stats_snapshots
            ORDER BY league_id, season_id, snapshot_type, computed_at DESC
        )
    """)

    # Add unique constraint to prevent future duplicates
    op.create_unique_constraint(
        'uq_stats_snapshot_league_season_type',
        'stats_snapshots',
        ['league_id', 'season_id', 'snapshot_type']
    )


def downgrade() -> None:
    op.drop_constraint('uq_stats_snapshot_league_season_type', 'stats_snapshots', type_='unique')
