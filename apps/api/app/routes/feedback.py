"""
Feedback routes for collecting user suggestions.
"""
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.models.user import User
from app.security.auth import get_optional_user

router = APIRouter()

# Path to the feedback backlog file
FEEDBACK_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))),
    "USER_FEEDBACK.md"
)


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
):
    """
    Submit user feedback.

    Feedback is stored in USER_FEEDBACK.md for review and can be used
    to prioritize improvements to the platform.
    """
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    user_info = current_user.email if current_user else "Anonymous"

    # Format the feedback entry
    entry = f"""
## [{data.category.upper()}] {timestamp}

**From:** {user_info}
**Page:** {data.page or "Not specified"}

{data.message}

---
"""

    # Append to the feedback file
    try:
        # Create file with header if it doesn't exist
        if not os.path.exists(FEEDBACK_FILE):
            with open(FEEDBACK_FILE, "w") as f:
                f.write("""# FoosPulse User Feedback Backlog

This file is automatically populated with user feedback from the app.
Use this to prioritize improvements and new features.

To process feedback, you can ask Claude: "Update the app based on user feedback"

---

""")

        # Append the new feedback
        with open(FEEDBACK_FILE, "a") as f:
            f.write(entry)

        return api_response(data={
            "success": True,
            "message": "Thank you for your feedback!"
        })
    except Exception as e:
        return api_response(
            data=None,
            error={"code": "FEEDBACK_ERROR", "message": "Failed to save feedback", "details": str(e)}
        )
