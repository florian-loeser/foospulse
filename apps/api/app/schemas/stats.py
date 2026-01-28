"""Stats request/response schemas."""
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    """Schema for a single leaderboard entry."""
    rank: int
    player_id: UUID
    nickname: str
    value: float
    n_matches: int


class LeaderboardData(BaseModel):
    """Schema for a leaderboard."""
    name: str
    entries: List[LeaderboardEntry]


class LeaderboardResponse(BaseModel):
    """Schema for leaderboards response."""
    leaderboards: Dict[str, LeaderboardData]
    source_hash: str


class SynergyPair(BaseModel):
    """Schema for synergy pair data."""
    player1_id: UUID
    player1_nickname: str
    player2_id: UUID
    player2_nickname: str
    wins: int
    losses: int
    win_rate: float
    n_matches: int


class SynergyResponse(BaseModel):
    """Schema for synergy matrix response."""
    best_duos: List[SynergyPair]
    worst_duos: List[SynergyPair]
    source_hash: str


class MatchupRecord(BaseModel):
    """Schema for head-to-head matchup record."""
    player1_id: UUID
    player1_nickname: str
    player2_id: UUID
    player2_nickname: str
    player1_wins: int
    player2_wins: int
    n_matches: int


class MatchupResponse(BaseModel):
    """Schema for matchups response."""
    matchups: List[MatchupRecord]
    source_hash: str


class PlayerStatsResponse(BaseModel):
    """Schema for individual player stats."""
    player_id: UUID
    nickname: str
    rating: int
    rating_trend: str  # "up", "down", "stable"
    n_matches: int
    wins: int
    losses: int
    win_rate: float
    attack_matches: int
    defense_matches: int
    attack_win_rate: float
    defense_win_rate: float
    gamelles_received: int
    gamelles_delivered: int
    best_partner_id: Optional[UUID] = None
    best_partner_nickname: Optional[str] = None
    worst_matchup_id: Optional[UUID] = None
    worst_matchup_nickname: Optional[str] = None
    current_streak: int
    streak_type: str  # "win", "loss", "none"
