"""Add unique constraint to player_achievements.

Revision ID: 012
Revises: 011
Create Date: 2024-02-02 00:00:01.000000
"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '012'
down_revision: Union[str, None] = '011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # First remove any duplicate achievements (keep earliest)
    op.execute("""
        DELETE FROM player_achievements a USING player_achievements b
        WHERE a.id > b.id
        AND a.player_id = b.player_id
        AND a.league_id = b.league_id
        AND a.achievement_type = b.achievement_type
    """)

    # Add unique constraint if it doesn't exist
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_player_achievement'
            ) THEN
                ALTER TABLE player_achievements
                ADD CONSTRAINT uq_player_achievement
                UNIQUE (player_id, league_id, achievement_type);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_constraint('uq_player_achievement', 'player_achievements', type_='unique')
