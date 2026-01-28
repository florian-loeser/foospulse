"""
League and membership models.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


# Default league settings
DEFAULT_LEAGUE_SETTINGS = {
    "show_gamelles_board": True,  # Show "shame boards" for gamelles
    "show_shame_stats": True,     # Show embarrassing stats like worst streaks
}


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


class League(Base):
    """A foosball league."""
    
    __tablename__ = "leagues"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Paris")
    visibility: Mapped[LeagueVisibility] = mapped_column(
        Enum(LeagueVisibility, values_callable=lambda e: [m.value for m in e]),
        default=LeagueVisibility.PRIVATE
    )
    settings: Mapped[dict] = mapped_column(
        JSONB,
        default=DEFAULT_LEAGUE_SETTINGS,
        server_default='{"show_gamelles_board": true, "show_shame_stats": true}'
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id")
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
    members = relationship("LeagueMember", back_populates="league")
    seasons = relationship("Season", back_populates="league")
    players = relationship("Player", back_populates="league")


class LeagueMember(Base):
    """Membership linking users/players to leagues with roles."""
    
    __tablename__ = "league_members"
    
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
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    player_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=True
    )
    role: Mapped[MemberRole] = mapped_column(
        Enum(MemberRole, values_callable=lambda e: [m.value for m in e]),
        default=MemberRole.MEMBER
    )
    status: Mapped[MemberStatus] = mapped_column(
        Enum(MemberStatus, values_callable=lambda e: [m.value for m in e]),
        default=MemberStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    
    # Relationships
    league = relationship("League", back_populates="members")
