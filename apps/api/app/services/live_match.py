"""Live match session service for business logic."""
import secrets
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.live_match import (
    LiveMatchSession,
    LiveMatchSessionPlayer,
    LiveMatchSessionEvent,
    LiveMatchStatus,
    LiveEventType,
)
from app.models.match import Match, MatchPlayer, MatchEvent, MatchMode, MatchStatus, Team, Position, EventType
from app.models.player import Player
from app.schemas.live_match import (
    LiveMatchCreate,
    LiveMatchEventInput,
    LiveMatchPlayerInput,
)


def generate_share_token() -> str:
    """Generate a URL-safe 22-character share token."""
    return secrets.token_urlsafe(16)[:22]


def generate_scorer_secret() -> str:
    """Generate a secret token for non-authenticated scorers."""
    return secrets.token_urlsafe(24)[:32]


async def create_live_match_session(
    db: AsyncSession,
    league_id: uuid.UUID,
    season_id: uuid.UUID,
    user_id: uuid.UUID,
    data: LiveMatchCreate,
) -> LiveMatchSession:
    """Create a new live match session."""
    session = LiveMatchSession(
        league_id=league_id,
        season_id=season_id,
        share_token=generate_share_token(),
        scorer_secret=generate_scorer_secret() if data.generate_scorer_secret else None,
        mode=data.mode,
        status=LiveMatchStatus.WAITING.value,
        team_a_score=0,
        team_b_score=0,
        created_by_user_id=user_id,
    )
    db.add(session)
    await db.flush()

    for p in data.players:
        player = LiveMatchSessionPlayer(
            session_id=session.id,
            player_id=p.player_id,
            team=p.team,
            position=p.position,
        )
        db.add(player)

    await db.flush()
    return session


async def get_session_by_share_token(
    db: AsyncSession,
    share_token: str,
) -> Optional[LiveMatchSession]:
    """Get a live match session by its share token."""
    result = await db.execute(
        select(LiveMatchSession)
        .where(LiveMatchSession.share_token == share_token)
        .options(
            selectinload(LiveMatchSession.players),
            selectinload(LiveMatchSession.events),
        )
    )
    return result.scalar_one_or_none()


async def get_session_by_id(
    db: AsyncSession,
    session_id: uuid.UUID,
) -> Optional[LiveMatchSession]:
    """Get a live match session by ID."""
    result = await db.execute(
        select(LiveMatchSession)
        .where(LiveMatchSession.id == session_id)
        .options(
            selectinload(LiveMatchSession.players),
            selectinload(LiveMatchSession.events),
        )
    )
    return result.scalar_one_or_none()


async def get_active_sessions_for_league(
    db: AsyncSession,
    league_id: uuid.UUID,
) -> List[LiveMatchSession]:
    """Get all active live match sessions for a league."""
    result = await db.execute(
        select(LiveMatchSession)
        .where(LiveMatchSession.league_id == league_id)
        .where(LiveMatchSession.status.in_([
            LiveMatchStatus.WAITING.value,
            LiveMatchStatus.ACTIVE.value,
            LiveMatchStatus.PAUSED.value,
        ]))
        .options(
            selectinload(LiveMatchSession.players),
            selectinload(LiveMatchSession.events),
        )
        .order_by(LiveMatchSession.created_at.desc())
    )
    return list(result.scalars().all())


async def update_session_status(
    db: AsyncSession,
    session: LiveMatchSession,
    new_status: str,
) -> LiveMatchSession:
    """Update the status of a live match session."""
    session.status = new_status
    session.updated_at = datetime.utcnow()

    if new_status == LiveMatchStatus.ACTIVE.value and session.started_at is None:
        session.started_at = datetime.utcnow()
    elif new_status in [LiveMatchStatus.COMPLETED.value, LiveMatchStatus.ABANDONED.value]:
        session.ended_at = datetime.utcnow()

    await db.flush()
    return session


async def update_session_score(
    db: AsyncSession,
    session: LiveMatchSession,
    team_a_score: int,
    team_b_score: int,
) -> LiveMatchSession:
    """Update the scores of a live match session."""
    session.team_a_score = team_a_score
    session.team_b_score = team_b_score
    session.updated_at = datetime.utcnow()
    await db.flush()
    return session


async def record_event(
    db: AsyncSession,
    session: LiveMatchSession,
    data: LiveMatchEventInput,
    user_id: Optional[uuid.UUID] = None,
) -> LiveMatchSessionEvent:
    """Record an event in a live match session.

    Scoring rules:
    - goal: +1 for scoring team
    - gamellized: -1 for the team (can go negative)
    - lobbed: -3 for the team (can go negative)
    """
    event = LiveMatchSessionEvent(
        session_id=session.id,
        event_type=data.event_type,
        team=data.team,
        by_player_id=data.by_player_id,
        against_player_id=data.against_player_id,
        custom_type=data.custom_type,
        metadata_json=data.metadata,
        elapsed_seconds=data.elapsed_seconds,
        recorded_at=datetime.utcnow(),
        recorded_by_user_id=user_id,
    )
    db.add(event)

    # Auto-update score based on event type
    if data.team:
        if data.event_type == LiveEventType.GOAL.value:
            # +1 for scoring team
            if data.team == "A":
                session.team_a_score += 1
            else:
                session.team_b_score += 1
            session.updated_at = datetime.utcnow()

        elif data.event_type == LiveEventType.GAMELLIZED.value:
            # -1 for the team (can go negative)
            if data.team == "A":
                session.team_a_score -= 1
            else:
                session.team_b_score -= 1
            session.updated_at = datetime.utcnow()

        elif data.event_type == LiveEventType.LOBBED.value:
            # -3 for the team (can go negative)
            if data.team == "A":
                session.team_a_score -= 3
            else:
                session.team_b_score -= 3
            session.updated_at = datetime.utcnow()

    await db.flush()
    return event


async def undo_event(
    db: AsyncSession,
    event: LiveMatchSessionEvent,
    session: LiveMatchSession,
) -> LiveMatchSessionEvent:
    """Soft-delete (undo) an event and reverse score changes."""
    event.undone_at = datetime.utcnow()

    if event.team:
        if event.event_type == LiveEventType.GOAL.value:
            # Reverse +1: subtract 1 from scoring team
            if event.team == "A":
                session.team_a_score -= 1
            else:
                session.team_b_score -= 1
            session.updated_at = datetime.utcnow()

        elif event.event_type == LiveEventType.GAMELLIZED.value:
            # Reverse -1: add 1 back to the team that was penalized
            if event.team == "A":
                session.team_a_score += 1
            else:
                session.team_b_score += 1
            session.updated_at = datetime.utcnow()

        elif event.event_type == LiveEventType.LOBBED.value:
            # Reverse -3: add 3 back to the team that was penalized
            if event.team == "A":
                session.team_a_score += 3
            else:
                session.team_b_score += 3
            session.updated_at = datetime.utcnow()

    await db.flush()
    return event


async def finalize_session(
    db: AsyncSession,
    session: LiveMatchSession,
) -> Match:
    """Convert a completed live match session to a permanent Match record."""
    # Create the match record
    match = Match(
        league_id=session.league_id,
        season_id=session.season_id,
        mode=MatchMode(session.mode),
        team_a_score=session.team_a_score,
        team_b_score=session.team_b_score,
        played_at=session.started_at or session.created_at,
        created_by_player_id=None,
        status=MatchStatus.VALID,
    )
    db.add(match)
    await db.flush()

    # Create match players
    for lp in session.players:
        mp = MatchPlayer(
            match_id=match.id,
            player_id=lp.player_id,
            team=Team(lp.team),
            position=Position(lp.position),
            is_captain=False,
        )
        db.add(mp)

    # Create match events (gamellized only, not undone, with valid against_player_id)
    for le in session.events:
        if (
            le.undone_at is None
            and le.event_type == LiveEventType.GAMELLIZED.value
            and le.against_player_id is not None
        ):
            me = MatchEvent(
                match_id=match.id,
                event_type=EventType.GAMELLE,
                against_player_id=le.against_player_id,
                by_player_id=le.by_player_id,
                count=1,
            )
            db.add(me)

    # Update session with finalized match reference
    session.finalized_match_id = match.id
    session.status = LiveMatchStatus.COMPLETED.value
    session.ended_at = datetime.utcnow()
    session.updated_at = datetime.utcnow()

    await db.flush()
    return match


def validate_live_match_players(mode: str, players: List[LiveMatchPlayerInput]) -> dict:
    """Validate player configuration for a live match."""
    errors = {}
    expected_count = 2 if mode == "1v1" else 4

    if len(players) != expected_count:
        errors["players"] = f"{mode} requires exactly {expected_count} players"
        return errors

    team_a = [p for p in players if p.team == "A"]
    team_b = [p for p in players if p.team == "B"]
    expected_per_team = 1 if mode == "1v1" else 2

    if len(team_a) != expected_per_team or len(team_b) != expected_per_team:
        errors["teams"] = f"Each team must have exactly {expected_per_team} player(s)"
        return errors

    if mode == "2v2":
        team_a_positions = {p.position for p in team_a}
        team_b_positions = {p.position for p in team_b}
        if team_a_positions != {"attack", "defense"}:
            errors["team_a_positions"] = "Blue team must have one attacker and one defender"
        if team_b_positions != {"attack", "defense"}:
            errors["team_b_positions"] = "Red team must have one attacker and one defender"

    # Check for duplicate players
    player_ids = [p.player_id for p in players]
    if len(player_ids) != len(set(player_ids)):
        errors["duplicate_players"] = "Each player can only be in the match once"

    return errors
