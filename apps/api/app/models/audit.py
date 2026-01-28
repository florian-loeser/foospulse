"""
Audit log model for tracking key actions.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.database import Base


class AuditAction(str, enum.Enum):
    """Types of auditable actions."""
    MATCH_CREATE = "match_create"
    MATCH_VOID = "match_void"
    ARTIFACT_START = "artifact_start"
    ARTIFACT_COMPLETE = "artifact_complete"
    ARTIFACT_FAIL = "artifact_fail"


class AuditLog(Base):
    """Audit log entry for traceability."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # When it happened
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        index=True
    )

    # What action
    action: Mapped[str] = mapped_column(String(50), index=True)

    # Who did it (user_id or player_id, depending on context)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )
    actor_player_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=True
    )

    # What entity was affected
    entity_type: Mapped[str] = mapped_column(String(50))  # "match", "artifact", etc.
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)

    # Context (league/season for scoping)
    league_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id"),
        nullable=True,
        index=True
    )

    # Additional details as JSON
    payload_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Optional description
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
