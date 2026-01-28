"""CSV export routes."""
import csv
import io
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberStatus
from app.models.season import Season, SeasonStatus
from app.models.player import Player
from app.models.match import Match, MatchPlayer, MatchStatus
from app.models.stats import StatsSnapshot
from app.security import get_current_user

router = APIRouter()


def api_response(data=None, error=None):
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    return {"code": code, "message": message, "details": details or {}}


async def get_league_and_check_membership(
    league_slug: str, current_user: User, db: AsyncSession
) -> League:
    """Get league and verify user is a member."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "League not found"))
        )

    result = await db.execute(
        select(LeagueMember)
        .where(LeagueMember.league_id == league.id)
        .where(LeagueMember.user_id == current_user.id)
        .where(LeagueMember.status == MemberStatus.ACTIVE)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Not a member"))
        )

    return league


@router.get("/{league_slug}/exports/matches.csv")
async def export_matches_csv(
    league_slug: str,
    season_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export matches as CSV."""
    league = await get_league_and_check_membership(league_slug, current_user, db)

    # Build query
    query = (
        select(Match)
        .where(Match.league_id == league.id)
        .where(Match.status == MatchStatus.VALID)
        .options(selectinload(Match.players))
        .order_by(Match.played_at.asc())
    )

    if season_id:
        try:
            query = query.where(Match.season_id == uuid.UUID(season_id))
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid season ID"))
            )

    result = await db.execute(query)
    matches = result.scalars().all()

    # Get player nicknames
    player_ids = {mp.player_id for m in matches for mp in m.players}
    result = await db.execute(select(Player).where(Player.id.in_(player_ids)))
    players = {p.id: p.nickname for p in result.scalars().all()}

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Stable header order
    writer.writerow([
        'match_id', 'played_at', 'mode', 'team_a_score', 'team_b_score',
        'team_a_attack', 'team_a_defense', 'team_b_attack', 'team_b_defense',
        'winner'
    ])

    for match in matches:
        # Get players by team/position
        team_a_attack = team_a_defense = team_b_attack = team_b_defense = ''
        for mp in match.players:
            nickname = players.get(mp.player_id, 'Unknown')
            if mp.team.value == 'A':
                if mp.position.value == 'attack':
                    team_a_attack = nickname
                else:
                    team_a_defense = nickname
            else:
                if mp.position.value == 'attack':
                    team_b_attack = nickname
                else:
                    team_b_defense = nickname

        winner = 'A' if match.team_a_score > match.team_b_score else 'B'

        writer.writerow([
            str(match.id),
            match.played_at.isoformat(),
            match.mode.value,
            match.team_a_score,
            match.team_b_score,
            team_a_attack,
            team_a_defense,
            team_b_attack,
            team_b_defense,
            winner
        ])

    output.seek(0)
    filename = f"{league_slug}_matches.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{league_slug}/exports/leaderboards.csv")
async def export_leaderboards_csv(
    league_slug: str,
    season_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export leaderboards as CSV."""
    league = await get_league_and_check_membership(league_slug, current_user, db)

    # Get season
    if season_id:
        try:
            season_uuid = uuid.UUID(season_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid season ID"))
            )
        result = await db.execute(
            select(Season).where(Season.id == season_uuid).where(Season.league_id == league.id)
        )
    else:
        result = await db.execute(
            select(Season)
            .where(Season.league_id == league.id)
            .where(Season.status == SeasonStatus.ACTIVE)
        )
    season = result.scalar_one_or_none()

    if not season:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Season not found"))
        )

    # Get leaderboards snapshot
    result = await db.execute(
        select(StatsSnapshot)
        .where(StatsSnapshot.league_id == league.id)
        .where(StatsSnapshot.season_id == season.id)
        .where(StatsSnapshot.snapshot_type == "leaderboards")
        .order_by(StatsSnapshot.computed_at.desc())
    )
    snapshot = result.scalar_one_or_none()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Stable header order
    writer.writerow([
        'board', 'rank', 'player_id', 'nickname', 'value', 'n_matches'
    ])

    if snapshot and snapshot.data_json:
        # Sort boards alphabetically for stable ordering
        for board_name in sorted(snapshot.data_json.keys()):
            board_data = snapshot.data_json[board_name]
            for entry in board_data.get('entries', []):
                writer.writerow([
                    board_name,
                    entry['rank'],
                    entry['player_id'],
                    entry['nickname'],
                    entry['value'],
                    entry['n_matches']
                ])

    output.seek(0)
    filename = f"{league_slug}_leaderboards.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{league_slug}/exports/players.csv")
async def export_players_csv(
    league_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export players as CSV."""
    league = await get_league_and_check_membership(league_slug, current_user, db)

    result = await db.execute(
        select(Player)
        .where(Player.league_id == league.id)
        .order_by(Player.nickname.asc())
    )
    players = result.scalars().all()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Stable header order
    writer.writerow(['player_id', 'nickname', 'is_guest', 'created_at'])

    for player in players:
        writer.writerow([
            str(player.id),
            player.nickname,
            player.is_guest,
            player.created_at.isoformat()
        ])

    output.seek(0)
    filename = f"{league_slug}_players.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
