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
from app.services.stats import compute_player_stats, compute_head_to_head
from app.services.achievements import get_player_achievements, get_match_prediction

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
        .order_by(StatsSnapshot.computed_at.desc()).limit(1)
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
        .order_by(StatsSnapshot.computed_at.desc()).limit(1)
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
        .order_by(StatsSnapshot.computed_at.desc()).limit(1)
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


@router.get("/{league_slug}/stats/player/{player_id}/rating-history")
async def get_player_rating_history(
    league_slug: str,
    player_id: str,
    season_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get player's rating history over time."""
    league, season = await get_league_and_season(league_slug, season_id, current_user, db)

    try:
        player_uuid = uuid.UUID(player_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid player ID")))

    result = await db.execute(select(Player).where(Player.id == player_uuid).where(Player.league_id == league.id))
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Player not found")))

    # Get rating snapshots ordered by time
    from app.models.match import Match
    result = await db.execute(
        select(RatingSnapshot, Match.played_at)
        .join(Match, RatingSnapshot.as_of_match_id == Match.id)
        .where(RatingSnapshot.player_id == player_uuid)
        .where(RatingSnapshot.league_id == league.id)
        .where(RatingSnapshot.season_id == season.id)
        .order_by(Match.played_at.asc())
    )
    snapshots = result.all()

    history = [
        {
            "rating": snap.rating,
            "date": played_at.isoformat(),
            "match_id": str(snap.as_of_match_id)
        }
        for snap, played_at in snapshots
    ]

    # Add starting point at 1200 if we have history
    if history:
        first_date = history[0]["date"]
        history.insert(0, {"rating": 1200, "date": first_date, "match_id": None})

    return api_response(data={
        "player_id": player_id,
        "nickname": player.nickname,
        "history": history
    })


@router.get("/{league_slug}/stats/head-to-head")
async def get_head_to_head(
    league_slug: str,
    player1_id: str = Query(...),
    player2_id: str = Query(...),
    season_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get head-to-head stats between two players."""
    league, season = await get_league_and_season(league_slug, season_id, current_user, db)

    try:
        player1_uuid = uuid.UUID(player1_id)
        player2_uuid = uuid.UUID(player2_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid player ID")))

    result = await db.execute(select(Player).where(Player.id == player1_uuid).where(Player.league_id == league.id))
    player1 = result.scalar_one_or_none()
    if not player1:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Player 1 not found")))

    result = await db.execute(select(Player).where(Player.id == player2_uuid).where(Player.league_id == league.id))
    player2 = result.scalar_one_or_none()
    if not player2:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Player 2 not found")))

    stats = await compute_head_to_head(db, player1, player2, league, season)
    return api_response(data={"head_to_head": stats})


@router.get("/{league_slug}/stats/player/{player_id}/achievements")
async def get_achievements(
    league_slug: str,
    player_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get player achievements."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "League not found")))

    try:
        player_uuid = uuid.UUID(player_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid player ID")))

    achievements = await get_player_achievements(db, player_uuid, league.id)
    return api_response(data={"achievements": achievements})


@router.post("/{league_slug}/stats/predict")
async def predict_match(
    league_slug: str,
    team_a: list[str] = Query(...),
    team_b: list[str] = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Predict match outcome based on team Elo ratings."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "League not found")))

    # Validate player IDs
    try:
        team_a_uuids = [uuid.UUID(pid) for pid in team_a]
        team_b_uuids = [uuid.UUID(pid) for pid in team_b]
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid player ID")))

    prediction = await get_match_prediction(db, league.id, team_a_uuids, team_b_uuids)
    return api_response(data={"prediction": prediction})


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


@router.post("/{league_slug}/stats/recalculate-ratings")
async def recalculate_all_ratings(
    league_slug: str,
    admin_key: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Recalculate all Elo ratings for a league from scratch.

    Deletes existing rating snapshots and recomputes using the current formula.
    This is useful after formula changes (e.g., adding margin sensitivity).
    """
    from sqlalchemy import delete
    from datetime import datetime
    from app.models.match import Match, MatchPlayer, MatchStatus

    # Elo constants
    K_FACTOR = 32
    INITIAL_RATING = 1200

    def calculate_expected_score(rating_a: int, rating_b: int) -> float:
        return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

    def calculate_actual_score(winner: bool, score_for: int, score_against: int) -> float:
        score_diff = score_for - score_against
        max_diff = 10
        margin_factor = score_diff / max_diff * 0.5
        return 0.5 + margin_factor

    def calculate_new_rating(old_rating: int, expected: float, actual: float) -> int:
        return round(old_rating + K_FACTOR * (actual - expected))

    # Allow access with admin key or authenticated user
    ADMIN_KEY = "foospulse-admin-recompute-2024"
    if not current_user and admin_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail=api_response(error=api_error("UNAUTHORIZED", "Authentication required")))

    # Get league
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "League not found")))

    # Delete all existing rating snapshots for this league
    await db.execute(
        delete(RatingSnapshot).where(RatingSnapshot.league_id == league.id)
    )

    # Get all valid matches ordered by played_at
    result = await db.execute(
        select(Match)
        .where(Match.league_id == league.id)
        .where(Match.status == MatchStatus.VALID)
        .order_by(Match.played_at.asc())
    )
    matches = result.scalars().all()

    # Track current ratings per player per mode
    current_ratings: dict[tuple, int] = {}
    snapshots_created = 0

    for match in matches:
        result = await db.execute(
            select(MatchPlayer).where(MatchPlayer.match_id == match.id)
        )
        match_players = result.scalars().all()

        if not match_players:
            continue

        mode = match.mode.value

        # Get current ratings
        player_ratings = {}
        for mp in match_players:
            key = (mp.player_id, mode)
            player_ratings[mp.player_id] = current_ratings.get(key, INITIAL_RATING)

        team_a_won = match.team_a_score > match.team_b_score
        team_a_players = [mp for mp in match_players if mp.team.value == "A"]
        team_b_players = [mp for mp in match_players if mp.team.value == "B"]

        if not team_a_players or not team_b_players:
            continue

        team_a_avg = sum(player_ratings[mp.player_id] for mp in team_a_players) / len(team_a_players)
        team_b_avg = sum(player_ratings[mp.player_id] for mp in team_b_players) / len(team_b_players)

        new_ratings = {}
        for mp in team_a_players:
            old_rating = player_ratings[mp.player_id]
            expected = calculate_expected_score(old_rating, team_b_avg)
            actual = calculate_actual_score(team_a_won, match.team_a_score, match.team_b_score)
            new_ratings[mp.player_id] = calculate_new_rating(old_rating, expected, actual)

        for mp in team_b_players:
            old_rating = player_ratings[mp.player_id]
            expected = calculate_expected_score(old_rating, team_a_avg)
            actual = calculate_actual_score(not team_a_won, match.team_b_score, match.team_a_score)
            new_ratings[mp.player_id] = calculate_new_rating(old_rating, expected, actual)

        for player_id, new_rating in new_ratings.items():
            snapshot = RatingSnapshot(
                league_id=match.league_id,
                season_id=match.season_id,
                player_id=player_id,
                mode=mode,
                rating=new_rating,
                as_of_match_id=match.id,
                computed_at=datetime.utcnow()
            )
            db.add(snapshot)
            snapshots_created += 1
            current_ratings[(player_id, mode)] = new_rating

    await db.commit()

    return api_response(data={
        "message": f"Recalculated ratings for {len(matches)} matches",
        "matches_processed": len(matches),
        "snapshots_created": snapshots_created
    })


@router.get("/{league_slug}/activity")
async def get_activity_feed(
    league_slug: str,
    limit: int = Query(20, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get recent activity feed for a league.

    Returns a combined feed of matches and achievements.
    """
    from app.models.match import Match, MatchPlayer, MatchStatus
    from app.models.achievement import PlayerAchievement, ACHIEVEMENT_INFO, AchievementType

    # Get league and verify membership
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

    # Get recent matches
    result = await db.execute(
        select(Match)
        .where(Match.league_id == league.id)
        .where(Match.status == MatchStatus.VALID)
        .order_by(Match.played_at.desc())
        .limit(limit)
    )
    matches = result.scalars().all()

    # Get player info for matches
    activity = []
    for match in matches:
        result = await db.execute(
            select(MatchPlayer, Player)
            .join(Player, Player.id == MatchPlayer.player_id)
            .where(MatchPlayer.match_id == match.id)
        )
        players_data = result.all()

        team_a = [{"id": str(mp.player_id), "nickname": p.nickname}
                  for mp, p in players_data if mp.team.value == "A"]
        team_b = [{"id": str(mp.player_id), "nickname": p.nickname}
                  for mp, p in players_data if mp.team.value == "B"]

        activity.append({
            "type": "match",
            "id": str(match.id),
            "timestamp": match.played_at.isoformat(),
            "data": {
                "team_a": team_a,
                "team_b": team_b,
                "score_a": match.team_a_score,
                "score_b": match.team_b_score,
                "mode": match.mode.value,
            }
        })

    # Get recent achievements
    result = await db.execute(
        select(PlayerAchievement, Player)
        .join(Player, Player.id == PlayerAchievement.player_id)
        .where(PlayerAchievement.league_id == league.id)
        .order_by(PlayerAchievement.unlocked_at.desc())
        .limit(limit)
    )
    achievements = result.all()

    for achievement, player in achievements:
        info = ACHIEVEMENT_INFO.get(AchievementType(achievement.achievement_type), {})
        activity.append({
            "type": "achievement",
            "id": str(achievement.id),
            "timestamp": achievement.unlocked_at.isoformat(),
            "data": {
                "player_id": str(player.id),
                "player_nickname": player.nickname,
                "achievement_type": achievement.achievement_type,
                "achievement_name": info.get("name", achievement.achievement_type),
                "achievement_icon": info.get("icon", "trophy"),
                "achievement_color": info.get("color", "yellow"),
            }
        })

    # Sort all activity by timestamp descending
    activity.sort(key=lambda x: x["timestamp"], reverse=True)

    return api_response(data={"activity": activity[:limit]})
