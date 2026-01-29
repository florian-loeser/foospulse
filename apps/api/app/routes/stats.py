"""Stats API routes."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberStatus, DEFAULT_LEAGUE_SETTINGS
from app.models.season import Season, SeasonStatus
from app.models.player import Player
from app.models.stats import StatsSnapshot, RatingSnapshot
from app.security import get_current_user
from app.security.auth import get_optional_user
from app.services.stats import compute_player_stats

router = APIRouter()


def check_etag(if_none_match: Optional[str], source_hash: str, response: Response) -> bool:
    """
    Check ETag and set response headers.

    Returns True if client cache is valid (304 should be returned).
    """
    etag = f'"{source_hash}"'
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, max-age=60"

    if if_none_match and if_none_match.strip('"') == source_hash:
        return True
    return False


def api_response(data=None, error=None):
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    return {"code": code, "message": message, "details": details or {}}


async def get_league_and_season(league_slug: str, season_id: Optional[str], current_user: User, db: AsyncSession):
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "League not found")))
    
    result = await db.execute(
        select(LeagueMember).where(LeagueMember.league_id == league.id)
        .where(LeagueMember.user_id == current_user.id).where(LeagueMember.status == MemberStatus.ACTIVE)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail=api_response(error=api_error("FORBIDDEN", "Not a member")))
    
    if season_id:
        try:
            result = await db.execute(select(Season).where(Season.id == uuid.UUID(season_id)).where(Season.league_id == league.id))
            season = result.scalar_one_or_none()
        except ValueError:
            season = None
    else:
        result = await db.execute(select(Season).where(Season.league_id == league.id).where(Season.status == SeasonStatus.ACTIVE))
        season = result.scalar_one_or_none()
    
    if not season:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Season not found")))
    
    return league, season


@router.get("/{league_slug}/stats/leaderboards")
async def get_leaderboards(
    league_slug: str,
    response: Response,
    season_id: Optional[str] = Query(None),
    if_none_match: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, season = await get_league_and_season(league_slug, season_id, current_user, db)

    result = await db.execute(
        select(StatsSnapshot).where(StatsSnapshot.league_id == league.id)
        .where(StatsSnapshot.season_id == season.id).where(StatsSnapshot.snapshot_type == "leaderboards")
        .order_by(StatsSnapshot.computed_at.desc())
    )
    snapshot = result.scalar_one_or_none()

    if snapshot:
        # Check if client cache is valid
        if check_etag(if_none_match, snapshot.source_hash, response):
            response.status_code = 304
            return Response(status_code=304, headers={"ETag": f'"{snapshot.source_hash}"'})

        leaderboards = snapshot.data_json.copy() if snapshot.data_json else {}

        # Get league settings
        settings = {**DEFAULT_LEAGUE_SETTINGS, **(league.settings or {})}

        # Filter out gamelles-related boards if disabled
        if not settings.get("show_gamelles_board", True):
            gamelle_boards = ["gamelles_received", "gamelles_given", "gamelle_rate"]
            leaderboards = {k: v for k, v in leaderboards.items() if k not in gamelle_boards}

        # Filter out shame stats if disabled
        if not settings.get("show_shame_stats", True):
            shame_boards = ["worst_streak", "gamelles_received", "most_losses"]
            leaderboards = {k: v for k, v in leaderboards.items() if k not in shame_boards}

        return api_response(data={
            "leaderboards": leaderboards,
            "source_hash": snapshot.source_hash,
            "filtered": not settings.get("show_gamelles_board", True) or not settings.get("show_shame_stats", True)
        })

    return api_response(data={"leaderboards": {}, "source_hash": "", "message": "No stats computed yet"})


@router.get("/{league_slug}/stats/synergy")
async def get_synergy(
    league_slug: str,
    response: Response,
    season_id: Optional[str] = Query(None),
    if_none_match: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, season = await get_league_and_season(league_slug, season_id, current_user, db)

    result = await db.execute(
        select(StatsSnapshot).where(StatsSnapshot.league_id == league.id)
        .where(StatsSnapshot.season_id == season.id).where(StatsSnapshot.snapshot_type == "synergy")
        .order_by(StatsSnapshot.computed_at.desc())
    )
    snapshot = result.scalar_one_or_none()

    if snapshot:
        if check_etag(if_none_match, snapshot.source_hash, response):
            return Response(status_code=304, headers={"ETag": f'"{snapshot.source_hash}"'})
        return api_response(data={"synergy": snapshot.data_json, "source_hash": snapshot.source_hash})

    return api_response(data={"synergy": {"best_duos": [], "worst_duos": []}, "source_hash": ""})


@router.get("/{league_slug}/stats/matchups")
async def get_matchups(
    league_slug: str,
    response: Response,
    season_id: Optional[str] = Query(None),
    if_none_match: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, season = await get_league_and_season(league_slug, season_id, current_user, db)

    result = await db.execute(
        select(StatsSnapshot).where(StatsSnapshot.league_id == league.id)
        .where(StatsSnapshot.season_id == season.id).where(StatsSnapshot.snapshot_type == "matchups")
        .order_by(StatsSnapshot.computed_at.desc())
    )
    snapshot = result.scalar_one_or_none()

    if snapshot:
        if check_etag(if_none_match, snapshot.source_hash, response):
            return Response(status_code=304, headers={"ETag": f'"{snapshot.source_hash}"'})
        return api_response(data={"matchups": snapshot.data_json, "source_hash": snapshot.source_hash})

    return api_response(data={"matchups": [], "source_hash": ""})


@router.get("/{league_slug}/stats/player/{player_id}")
async def get_player_stats(
    league_slug: str,
    player_id: str,
    season_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, season = await get_league_and_season(league_slug, season_id, current_user, db)
    
    try:
        player_uuid = uuid.UUID(player_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid player ID")))
    
    result = await db.execute(select(Player).where(Player.id == player_uuid).where(Player.league_id == league.id))
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Player not found")))
    
    stats = await compute_player_stats(db, player, league, season)
    return api_response(data={"player_stats": stats})


@router.post("/{league_slug}/stats/recompute")
async def recompute_league_stats(
    league_slug: str,
    season_id: Optional[str] = Query(None),
    admin_key: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Recompute all ratings and stats for a league.

    This triggers rating computation for all matches and then recomputes stats.
    Useful when the worker was down and ratings weren't computed.
    """
    from app.models.match import Match, MatchStatus
    from app.services.queue import enqueue_rating_update, enqueue_stats_recompute

    # Allow access with admin key or authenticated user
    ADMIN_KEY = "foospulse-admin-recompute-2024"
    if not current_user and admin_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail=api_response(error=api_error("UNAUTHORIZED", "Authentication required")))

    # Get league directly (bypass membership check for admin)
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "League not found")))

    # Get active season
    if season_id:
        result = await db.execute(select(Season).where(Season.id == uuid.UUID(season_id)))
    else:
        result = await db.execute(
            select(Season)
            .where(Season.league_id == league.id)
            .where(Season.status == SeasonStatus.ACTIVE)
        )
    season = result.scalar_one_or_none()
    if not season:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "No active season found")))

    # Get all valid matches for this league/season
    result = await db.execute(
        select(Match)
        .where(Match.league_id == league.id)
        .where(Match.season_id == season.id)
        .where(Match.status == MatchStatus.VALID)
        .order_by(Match.played_at.asc())
    )
    matches = result.scalars().all()

    # Trigger rating updates for each match
    for match in matches:
        await enqueue_rating_update(str(match.id))

    # Trigger stats recompute
    await enqueue_stats_recompute(str(league.id), str(season.id))

    return api_response(data={
        "message": f"Triggered recompute for {len(matches)} matches",
        "matches_queued": len(matches)
    })
