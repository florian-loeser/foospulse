"""Player request/response schemas."""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr


class PlayerCreate(BaseModel):
    """Schema for player creation."""
    nickname: str = Field(..., min_length=1, max_length=50)
    user_email: Optional[EmailStr] = None
    is_guest: bool = False


class PlayerResponse(BaseModel):
    """Schema for player data in responses."""
    id: UUID
    nickname: str
    avatar_url: Optional[str] = None
    is_guest: bool
    user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PlayerListResponse(BaseModel):
    """Schema for list of players."""
    players: List[PlayerResponse]
