"""
Live match session models for real-time game tracking.
"""
import uuid
from datetime import datetime
from typing import Optional, List
import enum

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LiveMatchStatus(str, enum.Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class LiveMatchMode(str, enum.Enum):
    ONE_V_ONE = "1v1"
    TWO_V_TWO = "2v2"
    TWO_V_ONE = "2v1"


class LiveEventType(str, enum.Enum):
    GOAL = "goal"
    GAMELLIZED = "gamellized"  # -1 goal for the team
    LOBBED = "lobbed"  # Ball above bar, -3 goals for the team
    TIMEOUT = "timeout"
    CUSTOM = "custom"


class LiveMatchSession(Base):
    """A live match session for real-time scoring."""

    __tablename__ = "live_match_sessions"

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
    share_token: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        index=True
    )
    scorer_secret: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True
    )
    mode: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(
        String(20),
        default=LiveMatchStatus.WAITING.value
    )
    team_a_score: Mapped[int] = mapped_column(Integer, default=0)
    team_b_score: Mapped[int] = mapped_column(Integer, default=0)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id")
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    finalized_match_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    players: Mapped[List["LiveMatchSessionPlayer"]] = relationship(
        "LiveMatchSessionPlayer",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    events: Mapped[List["LiveMatchSessionEvent"]] = relationship(
        "LiveMatchSessionEvent",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    league = relationship("League")
    season = relationship("Season")
    created_by = relationship("User")
    finalized_match = relationship("Match")


class LiveMatchSessionPlayer(Base):
    """A player in a live match session."""

    __tablename__ = "live_match_session_players"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("live_match_sessions.id", ondelete="CASCADE"),
        index=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id")
    )
    team: Mapped[str] = mapped_column(String(1))
    position: Mapped[str] = mapped_column(String(10))

    # Relationships
    session: Mapped["LiveMatchSession"] = relationship(
        "LiveMatchSession",
        back_populates="players"
    )
    player = relationship("Player")


class LiveMatchSessionEvent(Base):
    """An event during a live match session."""

    __tablename__ = "live_match_session_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("live_match_sessions.id", ondelete="CASCADE"),
        index=True
    )
    event_type: Mapped[str] = mapped_column(String(20))
    team: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    elapsed_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Seconds since match start
    by_player_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=True
    )
    against_player_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=True
    )
    custom_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    recorded_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    undone_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    session: Mapped["LiveMatchSession"] = relationship(
        "LiveMatchSession",
        back_populates="events"
    )
    by_player = relationship("Player", foreign_keys=[by_player_id])
    against_player = relationship("Player", foreign_keys=[against_player_id])
