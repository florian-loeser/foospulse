"""Request context for logging."""
import contextvars
from typing import Optional
from uuid import uuid4

# Context variables for request tracking
_request_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_id", default=None
)
_league_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "league_id", default=None
)
_user_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "user_id", default=None
)


def get_request_id() -> Optional[str]:
    """Get current request ID."""
    return _request_id.get()


def get_league_id() -> Optional[str]:
    """Get current league ID."""
    return _league_id.get()


def get_user_id() -> Optional[str]:
    """Get current user ID."""
    return _user_id.get()


def set_request_context(
    request_id: Optional[str] = None,
    league_id: Optional[str] = None,
    user_id: Optional[str] = None,
):
    """Set request context variables."""
    if request_id is not None:
        _request_id.set(request_id)
    if league_id is not None:
        _league_id.set(league_id)
    if user_id is not None:
        _user_id.set(user_id)


def clear_request_context():
    """Clear all request context."""
    _request_id.set(None)
    _league_id.set(None)
    _user_id.set(None)


def generate_request_id() -> str:
    """Generate a new request ID."""
    return str(uuid4())


class request_context:
    """Context manager for request-scoped logging context."""

    def __init__(
        self,
        request_id: Optional[str] = None,
        league_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        self.request_id = request_id or generate_request_id()
        self.league_id = league_id
        self.user_id = user_id
        self._tokens = []

    def __enter__(self):
        self._tokens.append(_request_id.set(self.request_id))
        if self.league_id:
            self._tokens.append(_league_id.set(self.league_id))
        if self.user_id:
            self._tokens.append(_user_id.set(self.user_id))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        for token in self._tokens:
            try:
                token.var.reset(token)
            except ValueError:
                pass
        return False
