"""
Feedback routes for collecting user suggestions.
"""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.feedback import Feedback
from app.security.auth import get_optional_user

router = APIRouter()


def api_response(data=None, error=None):
    return {"data": data, "error": error}


class FeedbackRequest(BaseModel):
    """User feedback submission."""
    message: str = Field(..., min_length=10, max_length=2000, description="Feedback message")
    category: str = Field(
        default="suggestion",
        description="Feedback category: suggestion, bug, question, other"
    )
    page: Optional[str] = Field(None, description="Page where feedback was submitted from")


@router.post("/feedback")
async def submit_feedback(
    data: FeedbackRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit user feedback.

    Feedback is stored in the database for review.
    """
    feedback = Feedback(
        message=data.message,
        category=data.category,
        page=data.page,
        user_email=current_user.email if current_user else None,
    )
    db.add(feedback)
    await db.flush()

    return api_response(data={
        "success": True,
        "message": "Thank you for your feedback!"
    })


@router.get("/feedback")
async def list_feedback(
    db: AsyncSession = Depends(get_db),
):
    """
    List all feedback entries (for admin review).
    """
    result = await db.execute(
        select(Feedback).order_by(Feedback.created_at.desc())
    )
    entries = result.scalars().all()

    return api_response(data={
        "feedback": [
            {
                "id": str(f.id),
                "message": f.message,
                "category": f.category,
                "page": f.page,
                "user_email": f.user_email,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in entries
        ]
    })
