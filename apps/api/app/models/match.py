"""
Match and related models for game tracking.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class MatchMode(str, enum.Enum):
    ONE_V_ONE = "1v1"
    TWO_V_TWO = "2v2"


class MatchStatus(str, enum.Enum):
    VALID = "valid"
    VOID = "void"


class Team(str, enum.Enum):
    A = "A"
    B = "B"


class Position(str, enum.Enum):
    ATTACK = "attack"
    DEFENSE = "defense"


class EventType(str, enum.Enum):
    GAMELLE = "gamelle"
    LOB = "lob"  # Counts as 3x gamelle


class Match(Base):
    """A recorded foosball match."""
    
    __tablename__ = "matches"
    
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
    mode: Mapped[MatchMode] = mapped_column(Enum(MatchMode, values_callable=lambda e: [m.value for m in e]))
    team_a_score: Mapped[int] = mapped_column(Integer)
    team_b_score: Mapped[int] = mapped_column(Integer)
    played_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    created_by_player_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=True
    )
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, values_callable=lambda e: [m.value for m in e]),
        default=MatchStatus.VALID
    )
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    
    # Relationships
    season = relationship("Season", back_populates="matches")
    players = relationship("MatchPlayer", back_populates="match", cascade="all, delete-orphan")
    events = relationship("MatchEvent", back_populates="match", cascade="all, delete-orphan")


class MatchPlayer(Base):
    """A player's participation in a match with team and position."""
    
    __tablename__ = "match_players"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id"),
        index=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        index=True
    )
    team: Mapped[Team] = mapped_column(Enum(Team, values_callable=lambda e: [m.value for m in e]))
    position: Mapped[Position] = mapped_column(Enum(Position, name='playerposition', values_callable=lambda e: [m.value for m in e]))
    is_captain: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Relationships
    match = relationship("Match", back_populates="players")


class MatchEvent(Base):
    """Events during a match (gamelles)."""
    
    __tablename__ = "match_events"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id"),
        index=True
    )
    event_type: Mapped[EventType] = mapped_column(Enum(EventType, values_callable=lambda e: [m.value for m in e]))
    against_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id")
    )
    by_player_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=True
    )
    count: Mapped[int] = mapped_column(Integer, default=1)
    
    # Relationships
    match = relationship("Match", back_populates="events")
