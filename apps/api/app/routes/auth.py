"""Authentication routes."""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember
from app.models.player import Player
from app.models.live_match import LiveMatchSession, LiveMatchSessionPlayer, LiveMatchStatus
from app.schemas.auth import (
    UserCreate, UserLogin, UserResponse, TokenResponse, MeResponse, MembershipInfo,
    ForgotPasswordRequest, ResetPasswordRequest
)
from app.security import (
    get_password_hash, verify_password, create_access_token, get_current_user, PasswordPolicy
)
from app.middleware.rate_limit import login_limiter, register_limiter
from app.integrations.sendgrid import sendgrid
from app.config import settings
from app.logging import get_logger

logger = get_logger("routes.auth")

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


@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Request a password reset email.

    Always returns success to prevent email enumeration attacks.
    """
    # Rate limiting to prevent abuse
    await login_limiter.check_rate_limit(request, identifier=data.email)

    # Look up user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user:
        # Generate secure token
        raw_token = secrets.token_urlsafe(32)
        hashed_token = get_password_hash(raw_token)

        # Set expiry
        expiry = datetime.utcnow() + timedelta(hours=settings.password_reset_expire_hours)

        # Store hashed token and expiry
        user.password_reset_token = hashed_token
        user.password_reset_expiry = expiry
        await db.flush()

        # Build reset link
        # Use first CORS origin as base URL for the frontend
        frontend_url = settings.cors_origins[0] if settings.cors_origins else "http://localhost:3001"
        reset_link = f"{frontend_url}/auth/reset-password/{raw_token}"

        # Send email (async, non-blocking failure)
        try:
            await sendgrid.send_password_reset_email(user.email, reset_link)
            logger.info("password_reset_email_sent", email=user.email)
        except Exception as e:
            logger.error("password_reset_email_failed", email=user.email, error=str(e))

    # Always return success to prevent email enumeration
    return api_response(data={
        "message": "If an account with that email exists, a password reset link has been sent."
    })


@router.get("/reset-password/{token}")
async def validate_reset_token(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Validate a password reset token.

    Returns success if token is valid and not expired.
    """
    # Find users with unexpired reset tokens
    now = datetime.utcnow()
    result = await db.execute(
        select(User).where(
            User.password_reset_token.isnot(None),
            User.password_reset_expiry > now
        )
    )
    users_with_tokens = result.scalars().all()

    # Check token against all users with valid tokens
    valid_user = None
    for user in users_with_tokens:
        if verify_password(token, user.password_reset_token):
            valid_user = user
            break

    if not valid_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_response(
                error=api_error("INVALID_TOKEN", "This reset link is invalid or has expired.")
            )
        )

    return api_response(data={"valid": True})


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using a valid token.
    """
    # Validate password against policy
    is_valid, error_msg = PasswordPolicy.validate(data.password)
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

    # Find users with unexpired reset tokens
    now = datetime.utcnow()
    result = await db.execute(
        select(User).where(
            User.password_reset_token.isnot(None),
            User.password_reset_expiry > now
        )
    )
    users_with_tokens = result.scalars().all()

    # Check token against all users with valid tokens
    valid_user = None
    for user in users_with_tokens:
        if verify_password(data.token, user.password_reset_token):
            valid_user = user
            break

    if not valid_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_response(
                error=api_error("INVALID_TOKEN", "This reset link is invalid or has expired.")
            )
        )

    # Update password and clear reset token
    valid_user.password_hash = get_password_hash(data.password)
    valid_user.password_reset_token = None
    valid_user.password_reset_expiry = None
    await db.flush()

    logger.info("password_reset_completed", user_id=str(valid_user.id))

    return api_response(data={"message": "Your password has been reset successfully."})
