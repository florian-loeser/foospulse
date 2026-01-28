"""Player management routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberRole, MemberStatus
from app.models.player import Player
from app.schemas.player import PlayerCreate
from app.security import get_current_user

router = APIRouter()


def api_response(data=None, error=None):
    """Standard API response format."""
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    """Standard error format."""
    return {"code": code, "message": message, "details": details or {}}


async def get_league_and_check_membership(
    league_slug: str,
    current_user: User,
    db: AsyncSession,
    require_admin: bool = False
) -> tuple[League, LeagueMember]:
    """Get league and verify user membership."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()
    
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_response(error=api_error("FORBIDDEN", "Not a member of this league"))
        )
    
    if require_admin and member.role not in [MemberRole.OWNER, MemberRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_response(error=api_error("FORBIDDEN", "Admin role required"))
        )
    
    return league, member


@router.post("/{league_slug}/players")
async def create_player(
    league_slug: str,
    player_data: PlayerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a player to the league."""
    league, _ = await get_league_and_check_membership(league_slug, current_user, db)
    
    # Check if nickname already exists in league
    result = await db.execute(
        select(Player)
        .where(Player.league_id == league.id)
        .where(Player.nickname == player_data.nickname)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=api_response(
                error=api_error("CONFLICT", "Player nickname already exists in this league")
            )
        )
    
    # If user_email provided, find or create user association
    user_id = None
    if player_data.user_email:
        result = await db.execute(
            select(User).where(User.email == player_data.user_email)
        )
        user = result.scalar_one_or_none()
        if user:
            user_id = user.id
    
    # Create player
    player = Player(
        league_id=league.id,
        user_id=user_id,
        nickname=player_data.nickname,
        is_guest=player_data.is_guest or (user_id is None)
    )
    db.add(player)
    await db.flush()
    
    # If user exists, add as member
    if user_id:
        result = await db.execute(
            select(LeagueMember)
            .where(LeagueMember.league_id == league.id)
            .where(LeagueMember.user_id == user_id)
        )
        existing_member = result.scalar_one_or_none()
        
        if not existing_member:
            member = LeagueMember(
                league_id=league.id,
                user_id=user_id,
                player_id=player.id,
                role=MemberRole.MEMBER,
                status=MemberStatus.ACTIVE
            )
            db.add(member)
    
    return api_response(data={
        "player": {
            "id": str(player.id),
            "nickname": player.nickname,
            "avatar_url": player.avatar_url,
            "is_guest": player.is_guest,
            "user_id": str(player.user_id) if player.user_id else None,
            "created_at": player.created_at.isoformat()
        }
    })


@router.get("/{league_slug}/players")
async def list_players(
    league_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all players in the league."""
    league, _ = await get_league_and_check_membership(league_slug, current_user, db)
    
    result = await db.execute(
        select(Player)
        .where(Player.league_id == league.id)
        .order_by(Player.nickname)
    )
    players = result.scalars().all()
    
    return api_response(data={
        "players": [
            {
                "id": str(p.id),
                "nickname": p.nickname,
                "avatar_url": p.avatar_url,
                "is_guest": p.is_guest,
                "user_id": str(p.user_id) if p.user_id else None,
                "created_at": p.created_at.isoformat()
            }
            for p in players
        ]
    })


@router.get("/{league_slug}/players/{player_id}")
async def get_player(
    league_slug: str,
    player_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get player details."""
    import uuid
    
    league, _ = await get_league_and_check_membership(league_slug, current_user, db)
    
    try:
        player_uuid = uuid.UUID(player_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid player ID format"))
        )
    
    result = await db.execute(
        select(Player)
        .where(Player.id == player_uuid)
        .where(Player.league_id == league.id)
    )
    player = result.scalar_one_or_none()
    
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_response(error=api_error("NOT_FOUND", "Player not found"))
        )
    
    return api_response(data={
        "player": {
            "id": str(player.id),
            "nickname": player.nickname,
            "avatar_url": player.avatar_url,
            "is_guest": player.is_guest,
            "user_id": str(player.user_id) if player.user_id else None,
            "created_at": player.created_at.isoformat()
        }
    })
