"""Live match session request/response schemas."""
from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID

from pydantic import BaseModel, Field


class LiveMatchPlayerInput(BaseModel):
    """Schema for player assignment in a live match."""
    player_id: UUID
    team: str = Field(..., pattern='^[AB]$')
    position: str = Field(..., pattern='^(attack|defense)$')


class LiveMatchCreate(BaseModel):
    """Schema for creating a live match session."""
    season_id: UUID
    mode: str = Field(..., pattern='^(1v1|2v2)$')
    players: List[LiveMatchPlayerInput]
    generate_scorer_secret: bool = Field(
        default=False,
        description="Generate a secret token for non-authenticated scorers"
    )


class LiveMatchEventInput(BaseModel):
    """Schema for recording an event in a live match."""
    event_type: str = Field(..., pattern='^(goal|gamellized|lobbed|timeout|custom)$')
    team: Optional[str] = Field(None, pattern='^[AB]$')
    by_player_id: Optional[UUID] = None
    against_player_id: Optional[UUID] = None
    custom_type: Optional[str] = Field(None, max_length=50)
    metadata: Optional[dict] = None
    elapsed_seconds: Optional[int] = Field(None, ge=0, description="Seconds since match start")


class LiveMatchScoreUpdate(BaseModel):
    """Schema for updating scores directly."""
    team_a_score: int = Field(..., ge=-20, le=20)
    team_b_score: int = Field(..., ge=-20, le=20)


class LiveMatchStatusUpdate(BaseModel):
    """Schema for changing match status."""
    status: str = Field(..., pattern='^(active|paused|completed|abandoned)$')


class LiveMatchPlayerResponse(BaseModel):
    """Schema for player data in live match responses."""
    player_id: UUID
    nickname: str
    team: str
    position: str

    class Config:
        from_attributes = True


class LiveMatchEventResponse(BaseModel):
    """Schema for event data in live match responses."""
    id: UUID
    event_type: str
    team: Optional[str] = None
    by_player_id: Optional[UUID] = None
    by_player_nickname: Optional[str] = None
    against_player_id: Optional[UUID] = None
    against_player_nickname: Optional[str] = None
    custom_type: Optional[str] = None
    metadata: Optional[dict] = None
    recorded_at: datetime
    elapsed_seconds: Optional[int] = None
    undone: bool = False

    class Config:
        from_attributes = True


class LiveMatchSessionResponse(BaseModel):
    """Schema for live match session data."""
    id: UUID
    share_token: str
    scorer_secret: Optional[str] = None
    mode: str
    status: str
    team_a_score: int
    team_b_score: int
    players: List[LiveMatchPlayerResponse]
    events: List[LiveMatchEventResponse] = []
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LiveMatchPublicResponse(BaseModel):
    """Schema for public (unauthenticated) view of live match."""
    share_token: str
    mode: str
    status: str
    team_a_score: int
    team_b_score: int
    players: List[LiveMatchPlayerResponse]
    events: List[LiveMatchEventResponse] = []
    started_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LiveMatchListResponse(BaseModel):
    """Schema for list of active live matches."""
    sessions: List[LiveMatchSessionResponse]


class LiveMatchFinalizeRequest(BaseModel):
    """Schema for finalizing a live match."""
    confirm: bool = Field(
        ...,
        description="Must be true to confirm finalization"
    )


class SSEEvent(BaseModel):
    """Schema for SSE event payload."""
    event: str
    data: Any
    timestamp: datetime = Field(default_factory=datetime.utcnow)
