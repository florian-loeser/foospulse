"""
Stats snapshot models for deterministic computed statistics.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RatingSnapshot(Base):
    """Elo rating snapshot after each match."""
    
    __tablename__ = "rating_snapshots"
    __table_args__ = (
        UniqueConstraint("player_id", "as_of_match_id", "mode", name="uq_rating_player_match_mode"),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id"),
        index=True
    )
    season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seasons.id"),
        index=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        index=True
    )
    mode: Mapped[str] = mapped_column(String(10))  # "1v1" or "2v2"
    rating: Mapped[int] = mapped_column(Integer, default=1200)
    as_of_match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id")
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )


class StatsSnapshot(Base):
    """Computed league statistics snapshot."""
    
    __tablename__ = "stats_snapshots"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id"),
        index=True
    )
    season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seasons.id"),
        index=True
    )
    snapshot_type: Mapped[str] = mapped_column(
        String(50)
    )  # leaderboards, synergy, matchups, player_cards
    version: Mapped[str] = mapped_column(String(20), default="v1")
    data_json: Mapped[dict] = mapped_column(JSONB)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    source_hash: Mapped[str] = mapped_column(
        String(64)
    )  # SHA256 of sorted match ids + timestamps
