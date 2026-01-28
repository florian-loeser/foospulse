"""Season management routes."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberRole, MemberStatus
from app.models.season import Season, SeasonStatus
from app.security import get_current_user

router = APIRouter()


def api_response(data=None, error=None):
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    return {"code": code, "message": message, "details": details or {}}


class SeasonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    starts_at: Optional[date] = None


class SeasonArchive(BaseModel):
    ends_at: Optional[date] = None


async def get_league_and_check_admin(
    league_slug: str, current_user: User, db: AsyncSession
) -> tuple[League, LeagueMember]:
    """Get league and verify user is admin/owner."""
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
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Not a member"))
        )

    if member.role not in [MemberRole.OWNER, MemberRole.ADMIN]:
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Admin role required"))
        )

    return league, member


@router.get("/{league_slug}/seasons")
async def list_seasons(
    league_slug: str,
    include_archived: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all seasons for a league."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "League not found"))
        )

    # Check membership
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

    query = select(Season).where(Season.league_id == league.id)
    if not include_archived:
        query = query.where(Season.status == SeasonStatus.ACTIVE)
    query = query.order_by(Season.starts_at.desc())

    result = await db.execute(query)
    seasons = result.scalars().all()

    return api_response(data={
        "seasons": [{
            "id": str(s.id),
            "name": s.name,
            "status": s.status.value,
            "starts_at": s.starts_at.isoformat(),
            "ends_at": s.ends_at.isoformat() if s.ends_at else None,
            "created_at": s.created_at.isoformat()
        } for s in seasons]
    })


@router.post("/{league_slug}/seasons")
async def create_season(
    league_slug: str,
    season_data: SeasonCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new season (archives current active season)."""
    league, _ = await get_league_and_check_admin(league_slug, current_user, db)

    # Get current active season
    result = await db.execute(
        select(Season)
        .where(Season.league_id == league.id)
        .where(Season.status == SeasonStatus.ACTIVE)
    )
    current_active = result.scalar_one_or_none()

    # Archive current active season
    if current_active:
        current_active.status = SeasonStatus.ARCHIVED
        current_active.ends_at = date.today()

    # Create new season
    new_season = Season(
        league_id=league.id,
        name=season_data.name,
        status=SeasonStatus.ACTIVE,
        starts_at=season_data.starts_at or date.today()
    )
    db.add(new_season)
    await db.flush()

    return api_response(data={
        "season": {
            "id": str(new_season.id),
            "name": new_season.name,
            "status": new_season.status.value,
            "starts_at": new_season.starts_at.isoformat(),
            "ends_at": None,
            "created_at": new_season.created_at.isoformat()
        },
        "archived_season_id": str(current_active.id) if current_active else None
    })


@router.post("/{league_slug}/seasons/{season_id}/archive")
async def archive_season(
    league_slug: str,
    season_id: str,
    archive_data: SeasonArchive,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Archive a specific season."""
    league, _ = await get_league_and_check_admin(league_slug, current_user, db)

    import uuid
    try:
        season_uuid = uuid.UUID(season_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid season ID"))
        )

    result = await db.execute(
        select(Season)
        .where(Season.id == season_uuid)
        .where(Season.league_id == league.id)
    )
    season = result.scalar_one_or_none()

    if not season:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Season not found"))
        )

    if season.status == SeasonStatus.ARCHIVED:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Season already archived"))
        )

    season.status = SeasonStatus.ARCHIVED
    season.ends_at = archive_data.ends_at or date.today()

    return api_response(data={
        "season": {
            "id": str(season.id),
            "name": season.name,
            "status": season.status.value,
            "starts_at": season.starts_at.isoformat(),
            "ends_at": season.ends_at.isoformat(),
            "created_at": season.created_at.isoformat()
        }
    })


@router.get("/{league_slug}/seasons/{season_id}")
async def get_season(
    league_slug: str,
    season_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific season's details."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "League not found"))
        )

    # Check membership
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

    import uuid
    try:
        season_uuid = uuid.UUID(season_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid season ID"))
        )

    result = await db.execute(
        select(Season)
        .where(Season.id == season_uuid)
        .where(Season.league_id == league.id)
    )
    season = result.scalar_one_or_none()

    if not season:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Season not found"))
        )

    return api_response(data={
        "season": {
            "id": str(season.id),
            "name": season.name,
            "status": season.status.value,
            "starts_at": season.starts_at.isoformat(),
            "ends_at": season.ends_at.isoformat() if season.ends_at else None,
            "created_at": season.created_at.isoformat()
        }
    })
