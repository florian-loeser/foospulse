"""Match management routes."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberRole, MemberStatus
from app.models.season import Season
from app.models.player import Player
from app.models.match import Match, MatchPlayer, MatchEvent, MatchMode, MatchStatus, Team, Position, EventType
from app.schemas.match import MatchCreate, MatchVoidRequest
from app.security import get_current_user
from app.services.queue import enqueue_rating_update, enqueue_stats_recompute
from app.services.audit import log_match_create, log_match_void
from app.middleware.rate_limit import write_limiter

router = APIRouter()


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


def validate_match_players(mode: str, players: list) -> dict:
    errors = {}

    team_a = [p for p in players if p.team == "A"]
    team_b = [p for p in players if p.team == "B"]

    if mode == "1v1":
        if len(players) != 2:
            errors["players"] = "1v1 requires exactly 2 players"
            return errors
        if len(team_a) != 1 or len(team_b) != 1:
            errors["teams"] = "Each team must have exactly 1 player"
            return errors
    elif mode == "2v2":
        if len(players) != 4:
            errors["players"] = "2v2 requires exactly 4 players"
            return errors
        if len(team_a) != 2 or len(team_b) != 2:
            errors["teams"] = "Each team must have exactly 2 players"
            return errors
        team_a_positions = {p.position for p in team_a}
        team_b_positions = {p.position for p in team_b}
        if team_a_positions != {"attack", "defense"}:
            errors["team_a_positions"] = "Blue team must have one attacker and one defender"
        if team_b_positions != {"attack", "defense"}:
            errors["team_b_positions"] = "Red team must have one attacker and one defender"
    elif mode == "2v1":
        if len(players) != 3:
            errors["players"] = "2v1 requires exactly 3 players"
            return errors
        # Team A (duo) has 2 players, Team B (solo) has 1 player
        if len(team_a) != 2 or len(team_b) != 1:
            errors["teams"] = "2v1 requires 2 players on Blue team and 1 player on Red team"
            return errors
        team_a_positions = {p.position for p in team_a}
        if team_a_positions != {"attack", "defense"}:
            errors["team_a_positions"] = "Blue team must have one attacker and one defender"

    return errors


@router.post("/{league_slug}/matches")
async def create_match(
    request: Request,
    league_slug: str,
    match_data: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Rate limiting for write operations
    await write_limiter.check_rate_limit(request, identifier=str(current_user.id))

    league, member = await get_league_and_check_membership(league_slug, current_user, db)
    
    result = await db.execute(
        select(Season).where(Season.id == match_data.season_id).where(Season.league_id == league.id)
    )
    season = result.scalar_one_or_none()
    if not season:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid season")))
    
    validation_errors = validate_match_players(match_data.mode, match_data.players)
    if validation_errors:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid match", validation_errors)))
    
    player_ids = [p.player_id for p in match_data.players]
    result = await db.execute(select(Player).where(Player.id.in_(player_ids)).where(Player.league_id == league.id))
    db_players = {p.id: p for p in result.scalars().all()}
    
    if len(db_players) != len(player_ids):
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Players not found")))
    
    result = await db.execute(select(Player).where(Player.league_id == league.id).where(Player.user_id == current_user.id))
    current_player = result.scalar_one_or_none()
    
    match = Match(
        league_id=league.id, season_id=season.id, mode=MatchMode(match_data.mode),
        team_a_score=match_data.team_a_score, team_b_score=match_data.team_b_score,
        played_at=match_data.played_at or datetime.utcnow(),
        created_by_player_id=current_player.id if current_player else None, status=MatchStatus.VALID
    )
    db.add(match)
    await db.flush()
    
    for p in match_data.players:
        mp = MatchPlayer(match_id=match.id, player_id=p.player_id, team=Team(p.team), position=Position(p.position), is_captain=False)
        db.add(mp)
    
    for g in match_data.gamelles:
        if g.against_player_id not in [p.player_id for p in match_data.players]:
            raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Gamelle against_player must be in match")))
        event = MatchEvent(match_id=match.id, event_type=EventType.GAMELLE, against_player_id=g.against_player_id, by_player_id=g.by_player_id, count=g.count)
        db.add(event)
    
    await db.flush()

    # Audit log
    await log_match_create(
        db=db,
        match_id=match.id,
        league_id=league.id,
        actor_user_id=current_user.id,
        actor_player_id=current_player.id if current_player else None,
        match_data={
            "mode": match_data.mode,
            "team_a_score": match_data.team_a_score,
            "team_b_score": match_data.team_b_score,
            "players": [{"player_id": str(p.player_id), "team": p.team} for p in match_data.players]
        }
    )

    await enqueue_rating_update(str(match.id))
    await enqueue_stats_recompute(str(league.id), str(season.id))

    return api_response(data={"match_id": str(match.id)})


@router.get("/{league_slug}/matches")
async def list_matches(
    league_slug: str,
    season_id: Optional[str] = Query(None),
    player_id: Optional[str] = Query(None, description="Filter by player"),
    mode: Optional[str] = Query(None, description="Filter by mode (1v1 or 2v2)"),
    date_from: Optional[str] = Query(None, description="Filter from date (ISO format)"),
    date_to: Optional[str] = Query(None, description="Filter to date (ISO format)"),
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, _ = await get_league_and_check_membership(league_slug, current_user, db)

    query = select(Match).where(Match.league_id == league.id).options(selectinload(Match.players), selectinload(Match.events)).order_by(Match.played_at.desc())

    if season_id:
        try:
            query = query.where(Match.season_id == uuid.UUID(season_id))
        except ValueError:
            pass

    # Filter by player
    if player_id:
        try:
            player_uuid = uuid.UUID(player_id)
            # Subquery to find matches with this player
            player_matches = select(MatchPlayer.match_id).where(MatchPlayer.player_id == player_uuid)
            query = query.where(Match.id.in_(player_matches))
        except ValueError:
            pass

    # Filter by mode
    if mode and mode in ['1v1', '2v2']:
        query = query.where(Match.mode == MatchMode(mode))

    # Filter by date range
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            query = query.where(Match.played_at >= from_date)
        except ValueError:
            pass

    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            query = query.where(Match.played_at <= to_date)
        except ValueError:
            pass

    if cursor:
        try:
            query = query.where(Match.played_at < datetime.fromisoformat(cursor))
        except ValueError:
            pass

    result = await db.execute(query.limit(limit + 1))
    matches = result.scalars().all()
    
    player_ids = {mp.player_id for m in matches for mp in m.players}
    result = await db.execute(select(Player).where(Player.id.in_(player_ids)))
    players = {p.id: p.nickname for p in result.scalars().all()}
    
    has_more = len(matches) > limit
    matches = matches[:limit]
    next_cursor = matches[-1].played_at.isoformat() if has_more and matches else None
    
    return api_response(data={
        "matches": [{
            "id": str(m.id), "mode": m.mode.value, "team_a_score": m.team_a_score, "team_b_score": m.team_b_score,
            "played_at": m.played_at.isoformat(), "status": m.status.value, "void_reason": m.void_reason,
            "players": [{"player_id": str(mp.player_id), "nickname": players.get(mp.player_id, "Unknown"), "team": mp.team.value, "position": mp.position.value} for mp in m.players],
            "events": [{"event_type": e.event_type.value, "against_player_id": str(e.against_player_id), "by_player_id": str(e.by_player_id) if e.by_player_id else None, "count": e.count} for e in m.events],
            "created_at": m.created_at.isoformat()
        } for m in matches],
        "cursor": next_cursor
    })


@router.get("/{league_slug}/matches/{match_id}")
async def get_match(league_slug: str, match_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    league, _ = await get_league_and_check_membership(league_slug, current_user, db)
    
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid match ID")))
    
    result = await db.execute(select(Match).where(Match.id == match_uuid).where(Match.league_id == league.id).options(selectinload(Match.players), selectinload(Match.events)))
    match = result.scalar_one_or_none()
    
    if not match:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Match not found")))
    
    player_ids = [mp.player_id for mp in match.players]
    result = await db.execute(select(Player).where(Player.id.in_(player_ids)))
    players = {p.id: p.nickname for p in result.scalars().all()}
    
    return api_response(data={"match": {
        "id": str(match.id), "mode": match.mode.value, "team_a_score": match.team_a_score, "team_b_score": match.team_b_score,
        "played_at": match.played_at.isoformat(), "status": match.status.value, "void_reason": match.void_reason,
        "players": [{"player_id": str(mp.player_id), "nickname": players.get(mp.player_id, "Unknown"), "team": mp.team.value, "position": mp.position.value} for mp in match.players],
        "events": [{"event_type": e.event_type.value, "against_player_id": str(e.against_player_id), "by_player_id": str(e.by_player_id) if e.by_player_id else None, "count": e.count} for e in match.events],
        "created_at": match.created_at.isoformat()
    }})


@router.post("/{league_slug}/matches/{match_id}/void")
async def void_match(league_slug: str, match_id: str, void_data: MatchVoidRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    league, _ = await get_league_and_check_membership(league_slug, current_user, db, require_admin=True)
    
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid match ID")))
    
    result = await db.execute(select(Match).where(Match.id == match_uuid).where(Match.league_id == league.id))
    match = result.scalar_one_or_none()
    
    if not match:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Match not found")))
    
    if match.status == MatchStatus.VOID:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Match already voided")))
    
    match.status = MatchStatus.VOID
    match.void_reason = void_data.reason

    # Audit log
    await log_match_void(
        db=db,
        match_id=match.id,
        league_id=league.id,
        actor_user_id=current_user.id,
        reason=void_data.reason
    )

    await enqueue_stats_recompute(str(league.id), str(match.season_id))

    return api_response(data={"match_id": str(match.id), "status": "void", "void_reason": match.void_reason})
