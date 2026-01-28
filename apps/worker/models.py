"""SQLAlchemy models for worker (mirrors API models)."""
import uuid
from datetime import datetime, date
from typing import Optional
import enum

from sqlalchemy import String, Integer, Boolean, DateTime, Date, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# Enums
class LeagueVisibility(str, enum.Enum):
    PRIVATE = "private"
    PUBLIC = "public"


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class MemberStatus(str, enum.Enum):
    ACTIVE = "active"
    INVITED = "invited"
    REMOVED = "removed"


class SeasonStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


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
    LOB = "lob"


class ArtifactStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class AuditAction(str, enum.Enum):
    MATCH_CREATE = "match_create"
    MATCH_VOID = "match_void"
    ARTIFACT_START = "artifact_start"
    ARTIFACT_COMPLETE = "artifact_complete"
    ARTIFACT_FAIL = "artifact_fail"


# Models
class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100))


class League(Base):
    __tablename__ = "leagues"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(50))


class Season(Base):
    __tablename__ = "seasons"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    league_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leagues.id"))
    name: Mapped[str] = mapped_column(String(100))
    status: Mapped[SeasonStatus] = mapped_column(Enum(SeasonStatus, values_callable=lambda e: [m.value for m in e]))


class Player(Base):
    __tablename__ = "players"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    league_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leagues.id"))
    nickname: Mapped[str] = mapped_column(String(50))


class Match(Base):
    __tablename__ = "matches"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    league_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    season_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    mode: Mapped[MatchMode] = mapped_column(Enum(MatchMode, values_callable=lambda e: [m.value for m in e]))
    team_a_score: Mapped[int] = mapped_column(Integer)
    team_b_score: Mapped[int] = mapped_column(Integer)
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[MatchStatus] = mapped_column(Enum(MatchStatus, values_callable=lambda e: [m.value for m in e]))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MatchPlayer(Base):
    __tablename__ = "match_players"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    match_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("matches.id"))
    player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("players.id"))
    team: Mapped[Team] = mapped_column(Enum(Team, values_callable=lambda e: [m.value for m in e]))
    position: Mapped[Position] = mapped_column(Enum(Position, values_callable=lambda e: [m.value for m in e]))


class MatchEvent(Base):
    __tablename__ = "match_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    match_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    event_type: Mapped[EventType] = mapped_column(Enum(EventType, values_callable=lambda e: [m.value for m in e]))
    against_player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    by_player_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    count: Mapped[int] = mapped_column(Integer)


class RatingSnapshot(Base):
    __tablename__ = "rating_snapshots"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    league_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    season_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    player_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    mode: Mapped[str] = mapped_column(String(10))
    rating: Mapped[int] = mapped_column(Integer)
    as_of_match_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class StatsSnapshot(Base):
    __tablename__ = "stats_snapshots"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    league_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    season_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    snapshot_type: Mapped[str] = mapped_column(String(50))
    version: Mapped[str] = mapped_column(String(20), default="v1")
    data_json: Mapped[dict] = mapped_column(JSONB)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    source_hash: Mapped[str] = mapped_column(String(64))


class Artifact(Base):
    __tablename__ = "artifacts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    league_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    season_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    generator: Mapped[str] = mapped_column(String(50))
    artifact_set_name: Mapped[str] = mapped_column(String(50))
    status: Mapped[ArtifactStatus] = mapped_column(Enum(ArtifactStatus, values_callable=lambda e: [m.value for m in e]))
    run_id: Mapped[str] = mapped_column(String(50))
    output_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    manifest_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    source_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    action: Mapped[str] = mapped_column(String(50))
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_player_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    league_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    payload_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
