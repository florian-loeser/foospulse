"""Request ID middleware for request tracking."""
import time
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.logging.context import (
    generate_request_id,
    set_request_context,
    clear_request_context,
)
from app.logging import get_logger

logger = get_logger("api.middleware")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds request ID to every request.

    - Reads X-Request-Id from incoming request if present
    - Generates new ID if not present
    - Adds X-Request-Id to response headers
    - Sets request context for logging
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Get or generate request ID
        request_id = request.headers.get("X-Request-Id")
        if not request_id:
            request_id = generate_request_id()

        # Extract league_id from path if present
        league_id = None
        path_parts = request.url.path.split("/")
        if "leagues" in path_parts:
            try:
                leagues_idx = path_parts.index("leagues")
                if leagues_idx + 1 < len(path_parts):
                    league_id = path_parts[leagues_idx + 1]
            except (ValueError, IndexError):
                pass

        # Set request context for logging
        set_request_context(request_id=request_id, league_id=league_id)

        # Log request start
        start_time = time.time()
        logger.info(
            "request_started",
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host if request.client else None,
        )

        try:
            # Process request
            response = await call_next(request)

            # Add request ID to response
            response.headers["X-Request-Id"] = request_id

            # Log request completion
            duration_ms = (time.time() - start_time) * 1000
            logger.info(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )

            return response

        except Exception as e:
            # Log exception
            duration_ms = (time.time() - start_time) * 1000
            logger.error(
                "request_failed",
                method=request.method,
                path=request.url.path,
                error=str(e),
                duration_ms=round(duration_ms, 2),
            )
            raise

        finally:
            # Clear context
            clear_request_context()
