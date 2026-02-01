"""Authentication request/response schemas."""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str = Field(..., min_length=1, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str
    remember_me: bool = False


class UserResponse(BaseModel):
    """Schema for user data in responses."""
    id: UUID
    email: str
    display_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Schema for login response with token."""
    token: str
    user: UserResponse


class MembershipInfo(BaseModel):
    """Schema for league membership info."""
    league_id: UUID
    league_name: str
    league_slug: str
    role: str


class MeResponse(BaseModel):
    """Schema for /auth/me response."""
    user: UserResponse
    memberships: List[MembershipInfo] = []


class ForgotPasswordRequest(BaseModel):
    """Schema for password reset request."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema for setting new password."""
    token: str
    password: str = Field(..., min_length=8, max_length=128)


class UpdateProfileRequest(BaseModel):
    """Schema for updating user profile."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None


class ChangePasswordRequest(BaseModel):
    """Schema for changing password when logged in."""
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
