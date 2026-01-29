"""Live match session routes for real-time game tracking."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberRole, MemberStatus
from app.models.season import Season
from app.models.player import Player
from app.models.live_match import (
    LiveMatchSession,
    LiveMatchSessionEvent,
    LiveMatchStatus,
    LiveEventType,
)
from app.schemas.live_match import (
    LiveMatchCreate,
    LiveMatchEventInput,
    LiveMatchScoreUpdate,
    LiveMatchStatusUpdate,
    LiveMatchFinalizeRequest,
    LiveMatchPlayerResponse,
    LiveMatchEventResponse,
    LiveMatchSessionResponse,
    LiveMatchPublicResponse,
    LiveMatchListResponse,
)
from app.security import get_current_user
from app.security.auth import get_optional_user
from app.services.live_match import (
    create_live_match_session,
    get_session_by_share_token,
    get_session_by_id,
    get_active_sessions_for_league,
    update_session_status,
    update_session_score,
    record_event,
    undo_event,
    finalize_session,
    validate_live_match_players,
)
from app.services.queue import enqueue_rating_update, enqueue_stats_recompute
from app.realtime.sse import event_generator
from app.realtime.pubsub import (
    publish_goal,
    publish_gamellized,
    publish_lobbed,
    publish_timeout,
    publish_custom_event,
    publish_score_update,
    publish_status_change,
    publish_undo,
)

router = APIRouter()
public_router = APIRouter()


def api_response(data=None, error=None):
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    return {"code": code, "message": message, "details": details or {}}


async def get_league_and_check_membership(
    league_slug: str, current_user: User, db: AsyncSession, require_admin: bool = False
) -> tuple[League, LeagueMember]:
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "League not found")))

    result = await db.execute(
        select(LeagueMember)
        .where(LeagueMember.league_id == league.id)
        .where(LeagueMember.user_id == current_user.id)
        .where(LeagueMember.status == MemberStatus.ACTIVE)
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=403, detail=api_response(error=api_error("FORBIDDEN", "Not a member")))

    if require_admin and member.role not in [MemberRole.OWNER, MemberRole.ADMIN]:
        raise HTTPException(status_code=403, detail=api_response(error=api_error("FORBIDDEN", "Admin role required")))

    return league, member


async def get_players_dict(db: AsyncSession, player_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Get player nicknames by IDs."""
    if not player_ids:
        return {}
    result = await db.execute(select(Player).where(Player.id.in_(player_ids)))
    return {p.id: p.nickname for p in result.scalars().all()}


def format_session_response(
    session: LiveMatchSession,
    players_dict: dict[uuid.UUID, str],
    include_secret: bool = False,
) -> dict:
    """Format a session for API response."""
    players = [
        LiveMatchPlayerResponse(
            player_id=p.player_id,
            nickname=players_dict.get(p.player_id, "Unknown"),
            team=p.team,
            position=p.position,
        ).model_dump()
        for p in session.players
    ]

    events = [
        LiveMatchEventResponse(
            id=e.id,
            event_type=e.event_type,
            team=e.team,
            by_player_id=e.by_player_id,
            by_player_nickname=players_dict.get(e.by_player_id) if e.by_player_id else None,
            against_player_id=e.against_player_id,
            against_player_nickname=players_dict.get(e.against_player_id) if e.against_player_id else None,
            custom_type=e.custom_type,
            metadata=e.metadata_json,
            recorded_at=e.recorded_at,
            elapsed_seconds=e.elapsed_seconds,
            undone=e.undone_at is not None,
        ).model_dump()
        for e in session.events
    ]

    response = {
        "id": str(session.id),
        "share_token": session.share_token,
        "mode": session.mode,
        "status": session.status,
        "team_a_score": session.team_a_score,
        "team_b_score": session.team_b_score,
        "players": players,
        "events": events,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "created_at": session.created_at.isoformat(),
    }

    if include_secret and session.scorer_secret:
        response["scorer_secret"] = session.scorer_secret

    return response


def format_public_response(session: LiveMatchSession, players_dict: dict[uuid.UUID, str]) -> dict:
    """Format a session for public (unauthenticated) response."""
    players = [
        LiveMatchPlayerResponse(
            player_id=p.player_id,
            nickname=players_dict.get(p.player_id, "Unknown"),
            team=p.team,
            position=p.position,
        ).model_dump()
        for p in session.players
    ]

    # Only include non-undone events
    events = [
        LiveMatchEventResponse(
            id=e.id,
            event_type=e.event_type,
            team=e.team,
            by_player_id=e.by_player_id,
            by_player_nickname=players_dict.get(e.by_player_id) if e.by_player_id else None,
            against_player_id=e.against_player_id,
            against_player_nickname=players_dict.get(e.against_player_id) if e.against_player_id else None,
            custom_type=e.custom_type,
            metadata=e.metadata_json,
            recorded_at=e.recorded_at,
            elapsed_seconds=e.elapsed_seconds,
            undone=False,
        ).model_dump()
        for e in session.events
        if e.undone_at is None
    ]

    return {
        "share_token": session.share_token,
        "mode": session.mode,
        "status": session.status,
        "team_a_score": session.team_a_score,
        "team_b_score": session.team_b_score,
        "players": players,
        "events": events,
        "started_at": session.started_at.isoformat() if session.started_at else None,
    }


# ============================================================================
# Authenticated endpoints (league-scoped)
# ============================================================================

@router.post("/{league_slug}/live-matches")
async def create_live_match(
    league_slug: str,
    data: LiveMatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new live match session."""
    league, _ = await get_league_and_check_membership(league_slug, current_user, db)

    # Validate season
    result = await db.execute(
        select(Season).where(Season.id == data.season_id).where(Season.league_id == league.id)
    )
    season = result.scalar_one_or_none()
    if not season:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid season"))
        )

    # Validate players
    validation_errors = validate_live_match_players(data.mode, data.players)
    if validation_errors:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid players", validation_errors))
        )

    # Verify players exist in league
    player_ids = [p.player_id for p in data.players]
    result = await db.execute(
        select(Player).where(Player.id.in_(player_ids)).where(Player.league_id == league.id)
    )
    db_players = {p.id: p for p in result.scalars().all()}

    if len(db_players) != len(player_ids):
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "One or more players not found in league"))
        )

    session = await create_live_match_session(
        db=db,
        league_id=league.id,
        season_id=season.id,
        user_id=current_user.id,
        data=data,
    )

    # Reload with relationships
    session = await get_session_by_id(db, session.id)
    players_dict = {p.id: p.nickname for p in db_players.values()}

    return api_response(data=format_session_response(session, players_dict, include_secret=True))


@router.get("/{league_slug}/live-matches")
async def list_live_matches(
    league_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active live match sessions for a league."""
    league, _ = await get_league_and_check_membership(league_slug, current_user, db)

    sessions = await get_active_sessions_for_league(db, league.id)

    # Get all player nicknames
    all_player_ids = set()
    for session in sessions:
        for p in session.players:
            all_player_ids.add(p.player_id)
        for e in session.events:
            if e.by_player_id:
                all_player_ids.add(e.by_player_id)
            if e.against_player_id:
                all_player_ids.add(e.against_player_id)

    players_dict = await get_players_dict(db, list(all_player_ids))

    return api_response(data={
        "sessions": [format_session_response(s, players_dict) for s in sessions]
    })


@router.get("/{league_slug}/live-matches/{session_id}")
async def get_live_match(
    league_slug: str,
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific live match session by ID."""
    league, _ = await get_league_and_check_membership(league_slug, current_user, db)

    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid session ID"))
        )

    session = await get_session_by_id(db, session_uuid)
    if not session or session.league_id != league.id:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match session not found"))
        )

    # Get player nicknames
    all_player_ids = [p.player_id for p in session.players]
    for e in session.events:
        if e.by_player_id:
            all_player_ids.append(e.by_player_id)
        if e.against_player_id:
            all_player_ids.append(e.against_player_id)

    players_dict = await get_players_dict(db, all_player_ids)

    return api_response(data=format_session_response(session, players_dict, include_secret=True))


# ============================================================================
# Public endpoints (share token access)
# ============================================================================

@public_router.get("/live/{share_token}")
async def get_live_match_public(
    share_token: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Get live match session state by share token (public access)."""
    session = await get_session_by_share_token(db, share_token)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match not found"))
        )

    # Get player nicknames
    all_player_ids = [p.player_id for p in session.players]
    for e in session.events:
        if e.by_player_id:
            all_player_ids.append(e.by_player_id)
        if e.against_player_id:
            all_player_ids.append(e.against_player_id)

    players_dict = await get_players_dict(db, all_player_ids)

    response = format_public_response(session, players_dict)

    # Check if current user can score (is a player in the match or has league access)
    can_score = await verify_scorer_access(session, None, current_user, db)
    response["can_score"] = can_score

    return api_response(data=response)


@public_router.get("/live/{share_token}/stream")
async def stream_live_match(
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    """SSE stream for live match updates."""
    session = await get_session_by_share_token(db, share_token)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match not found"))
        )

    return StreamingResponse(
        event_generator(share_token),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def verify_scorer_access(
    session: LiveMatchSession,
    scorer_secret: Optional[str],
    current_user: Optional[User],
    db: AsyncSession,
) -> bool:
    """Verify that the caller has permission to score.

    Allowed scorers:
    1. The creator of the match
    2. Any league member
    3. Anyone with the scorer secret
    4. Any user whose player is participating in the match
    """
    if current_user:
        # Creator always has access
        if session.created_by_user_id == current_user.id:
            return True

        # Check if user's player is in the match
        from app.models.player import Player
        result = await db.execute(
            select(Player.id).where(Player.user_id == current_user.id)
        )
        user_player_ids = [p for p in result.scalars().all()]

        if user_player_ids:
            session_player_ids = [p.player_id for p in session.players]
            if any(pid in session_player_ids for pid in user_player_ids):
                return True

        # Check league membership
        result = await db.execute(
            select(LeagueMember)
            .where(LeagueMember.league_id == session.league_id)
            .where(LeagueMember.user_id == current_user.id)
            .where(LeagueMember.status == MemberStatus.ACTIVE)
        )
        if result.scalar_one_or_none():
            return True

    # If scorer secret is provided and matches, allow
    if scorer_secret and session.scorer_secret and scorer_secret == session.scorer_secret:
        return True

    return False


@public_router.post("/live/{share_token}/events")
async def record_live_match_event(
    share_token: str,
    data: LiveMatchEventInput,
    x_scorer_secret: Optional[str] = Header(None, alias="X-Scorer-Secret"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Record an event in a live match (goal, gamelle, timeout, custom)."""
    session = await get_session_by_share_token(db, share_token)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match not found"))
        )

    # Verify scorer access
    if not await verify_scorer_access(session, x_scorer_secret, current_user, db):
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Not authorized to record events"))
        )

    # Check session is active
    if session.status not in [LiveMatchStatus.WAITING.value, LiveMatchStatus.ACTIVE.value]:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Match is not active"))
        )

    # Auto-start if waiting
    if session.status == LiveMatchStatus.WAITING.value:
        await update_session_status(db, session, LiveMatchStatus.ACTIVE.value)
        await publish_status_change(share_token, LiveMatchStatus.ACTIVE.value)

    # Record the event
    event = await record_event(
        db=db,
        session=session,
        data=data,
        user_id=current_user.id if current_user else None,
    )

    # Get player nicknames for broadcasting
    all_player_ids = [p.player_id for p in session.players]
    players_dict = await get_players_dict(db, all_player_ids)

    # Broadcast event
    if data.event_type == LiveEventType.GOAL.value:
        await publish_goal(
            share_token,
            data.team,
            str(data.by_player_id) if data.by_player_id else None,
            players_dict.get(data.by_player_id) if data.by_player_id else None,
            session.team_a_score,
            session.team_b_score,
        )
    elif data.event_type == LiveEventType.GAMELLIZED.value:
        # Gamellized: -1 for the team
        await publish_gamellized(
            share_token,
            data.team or "",
            session.team_a_score,
            session.team_b_score,
        )
    elif data.event_type == LiveEventType.LOBBED.value:
        # Lobbed: ball above bar, -3 for the team
        await publish_lobbed(
            share_token,
            data.team or "",
            session.team_a_score,
            session.team_b_score,
        )
    elif data.event_type == LiveEventType.TIMEOUT.value:
        await publish_timeout(share_token, data.team or "")
    elif data.event_type == LiveEventType.CUSTOM.value:
        await publish_custom_event(share_token, data.custom_type or "", data.metadata)

    return api_response(data={
        "event_id": str(event.id),
        "team_a_score": session.team_a_score,
        "team_b_score": session.team_b_score,
    })


@public_router.post("/live/{share_token}/events/{event_id}/undo")
async def undo_live_match_event(
    share_token: str,
    event_id: str,
    x_scorer_secret: Optional[str] = Header(None, alias="X-Scorer-Secret"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Undo (soft-delete) an event."""
    session = await get_session_by_share_token(db, share_token)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match not found"))
        )

    if not await verify_scorer_access(session, x_scorer_secret, current_user, db):
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Not authorized"))
        )

    try:
        event_uuid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid event ID"))
        )

    # Find the event
    result = await db.execute(
        select(LiveMatchSessionEvent)
        .where(LiveMatchSessionEvent.id == event_uuid)
        .where(LiveMatchSessionEvent.session_id == session.id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Event not found"))
        )

    if event.undone_at is not None:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Event already undone"))
        )

    await undo_event(db, event, session)

    await publish_undo(
        share_token,
        str(event.id),
        session.team_a_score,
        session.team_b_score,
    )

    return api_response(data={
        "event_id": str(event.id),
        "team_a_score": session.team_a_score,
        "team_b_score": session.team_b_score,
    })


@public_router.post("/live/{share_token}/score")
async def update_live_match_score(
    share_token: str,
    data: LiveMatchScoreUpdate,
    x_scorer_secret: Optional[str] = Header(None, alias="X-Scorer-Secret"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Directly update the score (manual correction)."""
    session = await get_session_by_share_token(db, share_token)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match not found"))
        )

    if not await verify_scorer_access(session, x_scorer_secret, current_user, db):
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Not authorized"))
        )

    await update_session_score(db, session, data.team_a_score, data.team_b_score)
    await publish_score_update(share_token, data.team_a_score, data.team_b_score)

    return api_response(data={
        "team_a_score": session.team_a_score,
        "team_b_score": session.team_b_score,
    })


@public_router.post("/live/{share_token}/status")
async def update_live_match_status(
    share_token: str,
    data: LiveMatchStatusUpdate,
    x_scorer_secret: Optional[str] = Header(None, alias="X-Scorer-Secret"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the match status (start, pause, complete, abandon)."""
    session = await get_session_by_share_token(db, share_token)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match not found"))
        )

    if not await verify_scorer_access(session, x_scorer_secret, current_user, db):
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Not authorized"))
        )

    # Validate status transitions
    current = session.status
    new = data.status

    valid_transitions = {
        LiveMatchStatus.WAITING.value: [LiveMatchStatus.ACTIVE.value, LiveMatchStatus.ABANDONED.value],
        LiveMatchStatus.ACTIVE.value: [LiveMatchStatus.PAUSED.value, LiveMatchStatus.COMPLETED.value, LiveMatchStatus.ABANDONED.value],
        LiveMatchStatus.PAUSED.value: [LiveMatchStatus.ACTIVE.value, LiveMatchStatus.COMPLETED.value, LiveMatchStatus.ABANDONED.value],
    }

    if current not in valid_transitions or new not in valid_transitions.get(current, []):
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", f"Invalid status transition from {current} to {new}"))
        )

    await update_session_status(db, session, new)
    await publish_status_change(share_token, new)

    return api_response(data={"status": session.status})


@public_router.post("/live/{share_token}/finalize")
async def finalize_live_match(
    share_token: str,
    data: LiveMatchFinalizeRequest,
    x_scorer_secret: Optional[str] = Header(None, alias="X-Scorer-Secret"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Finalize the live match and create a permanent Match record."""
    session = await get_session_by_share_token(db, share_token)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match not found"))
        )

    if not await verify_scorer_access(session, x_scorer_secret, current_user, db):
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Not authorized"))
        )

    if not data.confirm:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Must confirm finalization"))
        )

    if session.status == LiveMatchStatus.COMPLETED.value and session.finalized_match_id:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("CONFLICT", "Match already finalized"))
        )

    if session.status == LiveMatchStatus.ABANDONED.value:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Cannot finalize abandoned match"))
        )

    match = await finalize_session(db, session)

    # Trigger rating and stats updates
    await enqueue_rating_update(str(match.id))
    await enqueue_stats_recompute(str(session.league_id), str(session.season_id))

    await publish_status_change(share_token, LiveMatchStatus.COMPLETED.value)

    return api_response(data={
        "match_id": str(match.id),
        "status": session.status,
    })


@public_router.delete("/live/{share_token}")
async def abandon_live_match(
    share_token: str,
    x_scorer_secret: Optional[str] = Header(None, alias="X-Scorer-Secret"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Abandon the live match without creating a Match record."""
    session = await get_session_by_share_token(db, share_token)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Live match not found"))
        )

    if not await verify_scorer_access(session, x_scorer_secret, current_user, db):
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Not authorized"))
        )

    if session.status in [LiveMatchStatus.COMPLETED.value, LiveMatchStatus.ABANDONED.value]:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Match already ended"))
        )

    await update_session_status(db, session, LiveMatchStatus.ABANDONED.value)
    await publish_status_change(share_token, LiveMatchStatus.ABANDONED.value)

    return api_response(data={"status": session.status})


@public_router.get("/match/{match_id}/events")
async def get_live_events_for_match(
    match_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get live session events for a finalized match (for charts)."""
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid match ID"))
        )

    result = await db.execute(
        select(LiveMatchSession)
        .where(LiveMatchSession.finalized_match_id == match_uuid)
        .options(
            selectinload(LiveMatchSession.players),
            selectinload(LiveMatchSession.events),
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        return api_response(data={"events": [], "has_live_data": False})

    # Get player nicknames
    player_ids = [p.player_id for p in session.players]
    result = await db.execute(select(Player).where(Player.id.in_(player_ids)))
    player_map = {p.id: p.nickname for p in result.scalars().all()}

    events = []
    for e in session.events:
        if e.undone_at is None:
            events.append({
                "id": str(e.id),
                "event_type": e.event_type,
                "team": e.team,
                "by_player_id": str(e.by_player_id) if e.by_player_id else None,
                "by_player_nickname": player_map.get(e.by_player_id) if e.by_player_id else None,
                "against_player_id": str(e.against_player_id) if e.against_player_id else None,
                "against_player_nickname": player_map.get(e.against_player_id) if e.against_player_id else None,
                "elapsed_seconds": e.elapsed_seconds,
                "recorded_at": e.recorded_at.isoformat() if e.recorded_at else None,
            })

    # Sort by elapsed_seconds
    events.sort(key=lambda x: x["elapsed_seconds"] or 0)

    return api_response(data={
        "events": events,
        "has_live_data": True,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "duration_seconds": int((session.ended_at - session.started_at).total_seconds()) if session.ended_at and session.started_at else None,
    })
