"""League request/response schemas."""
from datetime import datetime, date
from typing import Optional, List
from uuid import UUID
import re

from pydantic import BaseModel, Field, field_validator


class SeasonResponse(BaseModel):
    """Schema for season data."""
    id: UUID
    name: str
    status: str
    starts_at: date
    ends_at: Optional[date] = None

    class Config:
        from_attributes = True


class LeagueCreate(BaseModel):
    """Schema for league creation."""
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=3, max_length=30)
    timezone: str = Field(default="Europe/Paris", max_length=50)
    visibility: str = Field(default="private")

    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError('Slug must contain only lowercase letters, numbers, and hyphens')
        return v

    @field_validator('visibility')
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        if v not in ['private', 'public']:
            raise ValueError('Visibility must be private or public')
        return v


class LeagueResponse(BaseModel):
    """Schema for league data in responses."""
    id: UUID
    name: str
    slug: str
    timezone: str
    visibility: str
    created_at: datetime
    active_season: Optional[SeasonResponse] = None

    class Config:
        from_attributes = True


class LeagueListResponse(BaseModel):
    """Schema for list of leagues."""
    leagues: List[LeagueResponse]
