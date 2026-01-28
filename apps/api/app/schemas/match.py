"""Match request/response schemas."""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MatchPlayerInput(BaseModel):
    """Schema for player participation in a match."""
    player_id: UUID
    team: str = Field(..., pattern='^[AB]$')
    position: str = Field(..., pattern='^(attack|defense)$')


class GamelleInput(BaseModel):
    """Schema for gamelle event input."""
    against_player_id: UUID
    by_player_id: Optional[UUID] = None
    count: int = Field(default=1, ge=1, le=20)


class MatchCreate(BaseModel):
    """Schema for match creation."""
    season_id: UUID
    mode: str = Field(..., pattern='^(1v1|2v2)$')
    played_at: Optional[datetime] = None
    team_a_score: int = Field(..., ge=0, le=10)
    team_b_score: int = Field(..., ge=0, le=10)
    players: List[MatchPlayerInput]
    gamelles: List[GamelleInput] = []

    @field_validator('players')
    @classmethod
    def validate_players(cls, v: List[MatchPlayerInput], info) -> List[MatchPlayerInput]:
        # Validation will happen in the service layer with access to mode
        return v


class MatchPlayerResponse(BaseModel):
    """Schema for match player data in responses."""
    player_id: UUID
    nickname: str
    team: str
    position: str

    class Config:
        from_attributes = True


class MatchEventResponse(BaseModel):
    """Schema for match event data in responses."""
    event_type: str
    against_player_id: UUID
    by_player_id: Optional[UUID] = None
    count: int

    class Config:
        from_attributes = True


class MatchResponse(BaseModel):
    """Schema for match data in responses."""
    id: UUID
    mode: str
    team_a_score: int
    team_b_score: int
    played_at: datetime
    status: str
    void_reason: Optional[str] = None
    players: List[MatchPlayerResponse] = []
    events: List[MatchEventResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class MatchListResponse(BaseModel):
    """Schema for list of matches."""
    matches: List[MatchResponse]
    cursor: Optional[str] = None


class MatchVoidRequest(BaseModel):
    """Schema for voiding a match."""
    reason: str = Field(..., min_length=1, max_length=500)
