"""League management routes."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberRole, MemberStatus, LeagueVisibility, DEFAULT_LEAGUE_SETTINGS
from app.models.season import Season, SeasonStatus
from app.models.player import Player
from app.schemas.league import LeagueCreate, LeagueResponse
from app.security import get_current_user, get_optional_user

router = APIRouter()


class LeagueSettingsUpdate(BaseModel):
    """Schema for updating league settings."""
    show_gamelles_board: Optional[bool] = None
    show_shame_stats: Optional[bool] = None


def api_response(data=None, error=None):
    """Standard API response format."""
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    """Standard error format."""
    return {"code": code, "message": message, "details": details or {}}


@router.post("")
async def create_league(
    league_data: LeagueCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new league."""
    # Check if slug already exists
    result = await db.execute(select(League).where(League.slug == league_data.slug))
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=api_response(
                error=api_error("CONFLICT", "League slug already exists")
            )
        )
    
    # Create league
    league = League(
        name=league_data.name,
        slug=league_data.slug,
        timezone=league_data.timezone,
        visibility=LeagueVisibility(league_data.visibility),
        created_by_user_id=current_user.id
    )
    db.add(league)
    await db.flush()
    
    # Create default season
    season = Season(
        league_id=league.id,
        name="Season 1",
        status=SeasonStatus.ACTIVE,
        starts_at=date.today()
    )
    db.add(season)
    await db.flush()
    
    # Create player for owner
    player = Player(
        league_id=league.id,
        user_id=current_user.id,
        nickname=current_user.display_name,
        is_guest=False
    )
    db.add(player)
    await db.flush()
    
    # Add owner as member
    member = LeagueMember(
        league_id=league.id,
        user_id=current_user.id,
        player_id=player.id,
        role=MemberRole.OWNER,
        status=MemberStatus.ACTIVE
    )
    db.add(member)
    
    return api_response(data={
        "league": {
            "id": str(league.id),
            "name": league.name,
            "slug": league.slug,
            "timezone": league.timezone,
            "visibility": league.visibility.value,
            "created_at": league.created_at.isoformat(),
            "active_season": {
                "id": str(season.id),
                "name": season.name,
                "status": season.status.value,
                "starts_at": season.starts_at.isoformat()
            }
        }
    })


@router.get("")
async def list_leagues(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List leagues the user is a member of."""
    result = await db.execute(
        select(League, Season)
        .join(LeagueMember, LeagueMember.league_id == League.id)
        .outerjoin(Season, (Season.league_id == League.id) & (Season.status == SeasonStatus.ACTIVE))
        .where(LeagueMember.user_id == current_user.id)
        .where(LeagueMember.status == MemberStatus.ACTIVE)
    )
    
    leagues = []
    for league, season in result.all():
        league_data = {
            "id": str(league.id),
            "name": league.name,
            "slug": league.slug,
            "timezone": league.timezone,
            "visibility": league.visibility.value,
            "created_at": league.created_at.isoformat(),
            "active_season": None
        }
        if season:
            league_data["active_season"] = {
                "id": str(season.id),
                "name": season.name,
                "status": season.status.value,
                "starts_at": season.starts_at.isoformat()
            }
        leagues.append(league_data)
    
    return api_response(data={"leagues": leagues})


@router.get("/{league_slug}")
async def get_league(
    league_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get league details."""
    # Get league
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()
    
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_response(
                error=api_error("NOT_FOUND", "League not found")
            )
        )
    
    # Check membership
    result = await db.execute(
        select(LeagueMember)
        .where(LeagueMember.league_id == league.id)
        .where(LeagueMember.user_id == current_user.id)
        .where(LeagueMember.status == MemberStatus.ACTIVE)
    )
    member = result.scalar_one_or_none()
    
    if not member and league.visibility == LeagueVisibility.PRIVATE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_response(
                error=api_error("FORBIDDEN", "Not a member of this league")
            )
        )
    
    # Get active season
    result = await db.execute(
        select(Season)
        .where(Season.league_id == league.id)
        .where(Season.status == SeasonStatus.ACTIVE)
    )
    season = result.scalar_one_or_none()
    
    league_data = {
        "id": str(league.id),
        "name": league.name,
        "slug": league.slug,
        "timezone": league.timezone,
        "visibility": league.visibility.value,
        "created_at": league.created_at.isoformat(),
        "active_season": None
    }
    if season:
        league_data["active_season"] = {
            "id": str(season.id),
            "name": season.name,
            "status": season.status.value,
            "starts_at": season.starts_at.isoformat()
        }
    
    return api_response(data={"league": league_data})


@router.get("/{league_slug}/settings")
async def get_league_settings(
    league_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get league settings."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_response(error=api_error("NOT_FOUND", "League not found"))
        )

    # Check membership
    result = await db.execute(
        select(LeagueMember)
        .where(LeagueMember.league_id == league.id)
        .where(LeagueMember.user_id == current_user.id)
        .where(LeagueMember.status == MemberStatus.ACTIVE)
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_response(error=api_error("FORBIDDEN", "Not a member"))
        )

    # Merge stored settings with defaults
    settings = {**DEFAULT_LEAGUE_SETTINGS, **(league.settings or {})}

    return api_response(data={"settings": settings})


@router.patch("/{league_slug}/settings")
async def update_league_settings(
    league_slug: str,
    settings_data: LeagueSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update league settings. Only owner can do this."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_response(error=api_error("NOT_FOUND", "League not found"))
        )

    # Check ownership
    result = await db.execute(
        select(LeagueMember)
        .where(LeagueMember.league_id == league.id)
        .where(LeagueMember.user_id == current_user.id)
        .where(LeagueMember.status == MemberStatus.ACTIVE)
    )
    member = result.scalar_one_or_none()

    if not member or member.role != MemberRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_response(error=api_error("FORBIDDEN", "Owner role required"))
        )

    # Update settings (merge with existing)
    current_settings = {**DEFAULT_LEAGUE_SETTINGS, **(league.settings or {})}

    if settings_data.show_gamelles_board is not None:
        current_settings["show_gamelles_board"] = settings_data.show_gamelles_board
    if settings_data.show_shame_stats is not None:
        current_settings["show_shame_stats"] = settings_data.show_shame_stats

    league.settings = current_settings

    return api_response(data={"settings": current_settings})


@router.get("/join/{invite_code}")
async def get_league_by_invite(
    invite_code: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Get league info by invite code (for preview before joining)."""
    result = await db.execute(select(League).where(League.invite_code == invite_code))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_response(error=api_error("NOT_FOUND", "Invalid invite code"))
        )

    # Check if already a member (only if logged in)
    already_member = False
    if current_user:
        result = await db.execute(
            select(LeagueMember)
            .where(LeagueMember.league_id == league.id)
            .where(LeagueMember.user_id == current_user.id)
            .where(LeagueMember.status == MemberStatus.ACTIVE)
        )
        existing_member = result.scalar_one_or_none()
        already_member = existing_member is not None

    return api_response(data={
        "league": {
            "id": str(league.id),
            "name": league.name,
            "slug": league.slug
        },
        "already_member": already_member,
        "logged_in": current_user is not None
    })


@router.post("/join/{invite_code}")
async def join_league(
    invite_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Join a league using an invite code."""
    result = await db.execute(select(League).where(League.invite_code == invite_code))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_response(error=api_error("NOT_FOUND", "Invalid invite code"))
        )

    # Check if already a member
    result = await db.execute(
        select(LeagueMember)
        .where(LeagueMember.league_id == league.id)
        .where(LeagueMember.user_id == current_user.id)
    )
    existing_member = result.scalar_one_or_none()

    if existing_member:
        if existing_member.status == MemberStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=api_response(error=api_error("CONFLICT", "Already a member of this league"))
            )
        elif existing_member.status == MemberStatus.REMOVED:
            # Re-activate removed member
            existing_member.status = MemberStatus.ACTIVE
            existing_member.role = MemberRole.MEMBER
            await db.commit()
            return api_response(data={
                "joined": True,
                "league": {
                    "id": str(league.id),
                    "name": league.name,
                    "slug": league.slug
                }
            })

    # Create player for the new member
    player = Player(
        league_id=league.id,
        user_id=current_user.id,
        nickname=current_user.display_name,
        is_guest=False
    )
    db.add(player)
    await db.flush()

    # Create membership
    member = LeagueMember(
        league_id=league.id,
        user_id=current_user.id,
        player_id=player.id,
        role=MemberRole.MEMBER,
        status=MemberStatus.ACTIVE
    )
    db.add(member)
    await db.commit()

    return api_response(data={
        "joined": True,
        "league": {
            "id": str(league.id),
            "name": league.name,
            "slug": league.slug
        }
    })
