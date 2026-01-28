"""League member management routes."""
import uuid
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberRole, MemberStatus
from app.models.player import Player
from app.security import get_current_user

router = APIRouter()


def generate_invite_code() -> str:
    """Generate a random 8-character invite code."""
    return secrets.token_urlsafe(6)


def api_response(data=None, error=None):
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    return {"code": code, "message": message, "details": details or {}}


class RoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(admin|member)$")


async def get_league_and_check_owner(
    league_slug: str, current_user: User, db: AsyncSession
) -> tuple[League, LeagueMember]:
    """Get league and verify user is owner."""
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

    if member.role != MemberRole.OWNER:
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Owner role required"))
        )

    return league, member


@router.get("/{league_slug}/members")
async def list_members(
    league_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all members of a league."""
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

    # Get all members with user and player info
    result = await db.execute(
        select(LeagueMember, User, Player)
        .join(User, LeagueMember.user_id == User.id)
        .outerjoin(Player, LeagueMember.player_id == Player.id)
        .where(LeagueMember.league_id == league.id)
        .where(LeagueMember.status == MemberStatus.ACTIVE)
        .order_by(LeagueMember.role.asc(), User.display_name.asc())
    )
    members_data = result.all()

    members = []
    for member, user, player in members_data:
        members.append({
            "id": str(member.id),
            "user_id": str(user.id),
            "display_name": user.display_name,
            "email": user.email,
            "role": member.role.value,
            "player_id": str(player.id) if player else None,
            "player_nickname": player.nickname if player else None,
            "joined_at": member.created_at.isoformat()
        })

    return api_response(data={"members": members})


@router.patch("/{league_slug}/members/{member_id}/role")
async def update_member_role(
    league_slug: str,
    member_id: str,
    role_data: RoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a member's role. Only owner can do this."""
    league, current_member = await get_league_and_check_owner(league_slug, current_user, db)

    try:
        member_uuid = uuid.UUID(member_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid member ID"))
        )

    result = await db.execute(
        select(LeagueMember)
        .where(LeagueMember.id == member_uuid)
        .where(LeagueMember.league_id == league.id)
    )
    target_member = result.scalar_one_or_none()

    if not target_member:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Member not found"))
        )

    # Cannot change owner's role
    if target_member.role == MemberRole.OWNER:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Cannot change owner's role"))
        )

    # Cannot change your own role
    if target_member.user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Cannot change your own role"))
        )

    new_role = MemberRole(role_data.role)
    target_member.role = new_role

    return api_response(data={
        "member_id": str(target_member.id),
        "role": new_role.value
    })


@router.delete("/{league_slug}/members/{member_id}")
async def remove_member(
    league_slug: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a member from the league. Only owner can do this."""
    league, current_member = await get_league_and_check_owner(league_slug, current_user, db)

    try:
        member_uuid = uuid.UUID(member_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid member ID"))
        )

    result = await db.execute(
        select(LeagueMember)
        .where(LeagueMember.id == member_uuid)
        .where(LeagueMember.league_id == league.id)
    )
    target_member = result.scalar_one_or_none()

    if not target_member:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "Member not found"))
        )

    # Cannot remove owner
    if target_member.role == MemberRole.OWNER:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Cannot remove league owner"))
        )

    # Cannot remove yourself
    if target_member.user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail=api_response(error=api_error("VALIDATION_ERROR", "Cannot remove yourself"))
        )

    target_member.status = MemberStatus.REMOVED

    return api_response(data={"removed": True, "member_id": str(target_member.id)})


@router.get("/{league_slug}/invite")
async def get_invite_code(
    league_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the league's invite code. Only admins and owners can access."""
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()

    if not league:
        raise HTTPException(
            status_code=404,
            detail=api_response(error=api_error("NOT_FOUND", "League not found"))
        )

    # Check membership and role
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

    if member.role not in (MemberRole.OWNER, MemberRole.ADMIN):
        raise HTTPException(
            status_code=403,
            detail=api_response(error=api_error("FORBIDDEN", "Admin role required"))
        )

    # Generate invite code if it doesn't exist
    if not league.invite_code:
        league.invite_code = generate_invite_code()
        await db.commit()

    return api_response(data={
        "invite_code": league.invite_code,
        "league_name": league.name
    })


@router.post("/{league_slug}/invite/regenerate")
async def regenerate_invite_code(
    league_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Regenerate the league's invite code. Only owner can do this."""
    league, _ = await get_league_and_check_owner(league_slug, current_user, db)

    league.invite_code = generate_invite_code()
    await db.commit()

    return api_response(data={
        "invite_code": league.invite_code,
        "league_name": league.name
    })
