"""Authentication routes."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember
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

    # Create token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.jwt_expire_minutes)
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
    """Get current user profile with memberships."""
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
    
    return api_response(data={
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "display_name": current_user.display_name,
            "created_at": current_user.created_at.isoformat()
        },
        "memberships": memberships
    })


@router.get("/password-policy")
async def get_password_policy():
    """Get password policy requirements for client-side validation."""
    return api_response(data={"policy": PasswordPolicy.get_policy_description()})
