"""
Player achievements model.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AchievementType(str, Enum):
    """Achievement types."""
    # Milestones
    FIRST_WIN = "first_win"
    FIRST_GAMELLE = "first_gamelle"
    MATCHES_10 = "matches_10"
    MATCHES_50 = "matches_50"
    MATCHES_100 = "matches_100"
    WINS_10 = "wins_10"
    WINS_50 = "wins_50"
    WINS_100 = "wins_100"

    # Streaks
    WIN_STREAK_3 = "win_streak_3"
    WIN_STREAK_5 = "win_streak_5"
    WIN_STREAK_10 = "win_streak_10"

    # Gamelles
    GAMELLES_5 = "gamelles_5"
    GAMELLES_10 = "gamelles_10"
    GAMELLE_MASTER = "gamelle_master"  # 25 gamelles delivered

    # Special
    COMEBACK_KING = "comeback_king"  # Win after being down 0-5
    FLAWLESS = "flawless"  # Win 10-0
    GIANT_SLAYER = "giant_slayer"  # Beat someone 100+ Elo higher
    UNDERDOG = "underdog"  # Win with 20%+ predicted loss


# Achievement metadata
ACHIEVEMENT_INFO = {
    AchievementType.FIRST_WIN: {
        "name": "First Victory",
        "description": "Win your first match",
        "icon": "trophy",
        "color": "yellow",
    },
    AchievementType.FIRST_GAMELLE: {
        "name": "First Gamelle",
        "description": "Score your first gamelle",
        "icon": "goal",
        "color": "green",
    },
    AchievementType.MATCHES_10: {
        "name": "Getting Started",
        "description": "Play 10 matches",
        "icon": "play",
        "color": "blue",
    },
    AchievementType.MATCHES_50: {
        "name": "Regular",
        "description": "Play 50 matches",
        "icon": "play",
        "color": "indigo",
    },
    AchievementType.MATCHES_100: {
        "name": "Veteran",
        "description": "Play 100 matches",
        "icon": "star",
        "color": "purple",
    },
    AchievementType.WINS_10: {
        "name": "Winner",
        "description": "Win 10 matches",
        "icon": "trophy",
        "color": "green",
    },
    AchievementType.WINS_50: {
        "name": "Champion",
        "description": "Win 50 matches",
        "icon": "trophy",
        "color": "blue",
    },
    AchievementType.WINS_100: {
        "name": "Legend",
        "description": "Win 100 matches",
        "icon": "crown",
        "color": "gold",
    },
    AchievementType.WIN_STREAK_3: {
        "name": "Hot Streak",
        "description": "Win 3 matches in a row",
        "icon": "fire",
        "color": "orange",
    },
    AchievementType.WIN_STREAK_5: {
        "name": "On Fire",
        "description": "Win 5 matches in a row",
        "icon": "fire",
        "color": "red",
    },
    AchievementType.WIN_STREAK_10: {
        "name": "Unstoppable",
        "description": "Win 10 matches in a row",
        "icon": "fire",
        "color": "purple",
    },
    AchievementType.GAMELLES_5: {
        "name": "Gamelle Hunter",
        "description": "Deliver 5 gamelles",
        "icon": "goal",
        "color": "green",
    },
    AchievementType.GAMELLES_10: {
        "name": "Gamelle Expert",
        "description": "Deliver 10 gamelles",
        "icon": "goal",
        "color": "blue",
    },
    AchievementType.GAMELLE_MASTER: {
        "name": "Gamelle Master",
        "description": "Deliver 25 gamelles",
        "icon": "goal",
        "color": "purple",
    },
    AchievementType.COMEBACK_KING: {
        "name": "Comeback King",
        "description": "Win after being down 0-5",
        "icon": "arrow-up",
        "color": "green",
    },
    AchievementType.FLAWLESS: {
        "name": "Flawless Victory",
        "description": "Win a match 10-0",
        "icon": "shield",
        "color": "gold",
    },
    AchievementType.GIANT_SLAYER: {
        "name": "Giant Slayer",
        "description": "Beat someone 100+ Elo higher",
        "icon": "sword",
        "color": "red",
    },
    AchievementType.UNDERDOG: {
        "name": "Underdog",
        "description": "Win with less than 20% predicted chance",
        "icon": "dog",
        "color": "orange",
    },
}


class PlayerAchievement(Base):
    """Player achievement record."""

    __tablename__ = "player_achievements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        index=True
    )
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id"),
        index=True
    )
    achievement_type: Mapped[str] = mapped_column(String(50))
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    # Optional: which match triggered the achievement
    trigger_match_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id"),
        nullable=True
    )
    # For achievements with progress (e.g., "10 wins" - store the count)
    progress_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
