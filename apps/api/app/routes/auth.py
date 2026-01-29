"""Authentication routes."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember
from app.models.player import Player
from app.models.live_match import LiveMatchSession, LiveMatchSessionPlayer, LiveMatchStatus
from app.schemas.auth import (
    UserCreate, UserLogin, UserResponse, TokenResponse, MeResponse, MembershipInfo
)
from app.security import (
    get_password_hash, verify_password, create_access_token, get_current_user, PasswordPolicy
)
from app.middleware.rate_limit import login_limiter, register_limiter
from app.config import settings

router = APIRouter()


def api_response(data=None, error=None):
    """Standard API response format."""
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    """Standard error format."""
    return {"code": code, "message": message, "details": details or {}}


@router.post("/register")
async def register(
    request: Request,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user."""
    # Rate limiting
    await register_limiter.check_rate_limit(request)

    # Validate password against policy
    is_valid, error_msg = PasswordPolicy.validate(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_response(
                error=api_error("VALIDATION_ERROR", error_msg, {
                    "field": "password",
                    "policy": PasswordPolicy.get_policy_description()
                })
            )
        )

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=api_response(
                error=api_error("CONFLICT", "Email already registered")
            )
        )

    # Create user
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        display_name=user_data.display_name
    )
    db.add(user)
    await db.flush()

    return api_response(data={"user_id": str(user.id)})


@router.post("/login")
async def login(
    request: Request,
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Login and get access token."""
    # Rate limiting - use email as additional identifier to prevent targeted attacks
    await login_limiter.check_rate_limit(request, identifier=credentials.email)

    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_response(
                error=api_error("UNAUTHORIZED", "Invalid email or password")
            )
        )

    # Create token with different expiration based on remember_me
    # Remember me: 30 days, otherwise: 24 hours
    if credentials.remember_me:
        expires_delta = timedelta(days=30)
    else:
        expires_delta = timedelta(hours=24)

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=expires_delta
    )

    return api_response(data={
        "token": access_token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
            "created_at": user.created_at.isoformat()
        }
    })


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile with memberships and active live match."""
    # Get user's league memberships
    result = await db.execute(
        select(LeagueMember, League)
        .join(League, LeagueMember.league_id == League.id)
        .where(LeagueMember.user_id == current_user.id)
        .where(LeagueMember.status == "active")
    )
    memberships = []
    for member, league in result.all():
        memberships.append({
            "league_id": str(league.id),
            "league_name": league.name,
            "league_slug": league.slug,
            "role": member.role.value if hasattr(member.role, 'value') else member.role
        })

    # Check for active live match where user's player is participating
    active_live_match = None

    # Get all player IDs for this user across all leagues
    player_result = await db.execute(
        select(Player.id).where(Player.user_id == current_user.id)
    )
    user_player_ids = [p for p in player_result.scalars().all()]

    if user_player_ids:
        # Find active live match sessions where user's player is participating
        active_statuses = [LiveMatchStatus.WAITING.value, LiveMatchStatus.ACTIVE.value, LiveMatchStatus.PAUSED.value]

        result = await db.execute(
            select(LiveMatchSession)
            .join(LiveMatchSessionPlayer, LiveMatchSession.id == LiveMatchSessionPlayer.session_id)
            .where(LiveMatchSessionPlayer.player_id.in_(user_player_ids))
            .where(LiveMatchSession.status.in_(active_statuses))
            .limit(1)
        )
        session = result.scalar_one_or_none()

        if session:
            active_live_match = {
                "share_token": session.share_token,
                "status": session.status,
                "mode": session.mode,
            }

    return api_response(data={
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "display_name": current_user.display_name,
            "created_at": current_user.created_at.isoformat()
        },
        "memberships": memberships,
        "active_live_match": active_live_match
    })


@router.get("/password-policy")
async def get_password_policy():
    """Get password policy requirements for client-side validation."""
    return api_response(data={"policy": PasswordPolicy.get_policy_description()})
