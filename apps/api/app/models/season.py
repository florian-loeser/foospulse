"""
Season model for time-bounded competition periods.
"""
import uuid
from datetime import datetime, date
from typing import Optional

from sqlalchemy import String, DateTime, Date, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class SeasonStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class Season(Base):
    """A time-bounded competition period within a league."""
    
    __tablename__ = "seasons"
    
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
    name: Mapped[str] = mapped_column(String(100), default="Season 1")
    status: Mapped[SeasonStatus] = mapped_column(
        Enum(SeasonStatus, values_callable=lambda e: [m.value for m in e]),
        default=SeasonStatus.ACTIVE
    )
    starts_at: Mapped[date] = mapped_column(Date, default=date.today)
    ends_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    
    # Relationships
    league = relationship("League", back_populates="seasons")
    matches = relationship("Match", back_populates="season")
