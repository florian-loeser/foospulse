"""Rate limiting middleware using Redis."""
import os
import time
from typing import Optional

from fastapi import HTTPException, Request, status

from app.redis_client import redis_client

# Disable rate limiting in test environment
RATE_LIMITING_ENABLED = os.environ.get("DISABLE_RATE_LIMITING", "").lower() != "true"


class RateLimiter:
    """
    Redis-based rate limiter using sliding window algorithm.

    Rate limiting is applied per IP address for unauthenticated endpoints
    and can be configured per-route.
    """

    def __init__(
        self,
        max_requests: int = 10,
        window_seconds: int = 60,
        key_prefix: str = "rate_limit"
    ):
        """
        Initialize rate limiter.

        Args:
            max_requests: Maximum requests allowed in the window
            window_seconds: Time window in seconds
            key_prefix: Redis key prefix for this limiter
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request, handling proxies."""
        # Check X-Forwarded-For header first (for proxy setups)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()

        # Fall back to direct client IP
        if request.client:
            return request.client.host
        return "unknown"

    async def check_rate_limit(self, request: Request, identifier: Optional[str] = None) -> dict:
        """
        Check if request is within rate limits.

        Args:
            request: FastAPI request object
            identifier: Optional custom identifier (defaults to IP)

        Returns:
            Dict with limit info: {allowed, remaining, reset_at}

        Raises:
            HTTPException 429 if rate limit exceeded
        """
        # Skip rate limiting if disabled (e.g., in tests)
        if not RATE_LIMITING_ENABLED:
            return {
                "allowed": True,
                "remaining": self.max_requests,
                "reset_at": int(time.time() + self.window_seconds)
            }

        # Use provided identifier or fall back to IP
        client_id = identifier or self._get_client_ip(request)
        key = f"{self.key_prefix}:{client_id}"

        now = time.time()
        window_start = now - self.window_seconds

        # Use Redis pipeline for atomic operations
        pipe = redis_client.pipeline()

        # Remove old entries outside the window
        pipe.zremrangebyscore(key, 0, window_start)

        # Count current requests in window
        pipe.zcard(key)

        # Add current request with timestamp as score
        pipe.zadd(key, {str(now): now})

        # Set expiry on the key
        pipe.expire(key, self.window_seconds)

        try:
            results = await pipe.execute()
            request_count = results[1]
        except Exception:
            # If Redis fails, allow the request (fail open)
            return {
                "allowed": True,
                "remaining": self.max_requests,
                "reset_at": int(now + self.window_seconds)
            }

        remaining = max(0, self.max_requests - request_count - 1)
        reset_at = int(now + self.window_seconds)

        if request_count >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "data": None,
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": f"Too many requests. Please try again in {self.window_seconds} seconds.",
                        "details": {
                            "retry_after": self.window_seconds,
                            "limit": self.max_requests,
                            "window_seconds": self.window_seconds
                        }
                    }
                },
                headers={
                    "Retry-After": str(self.window_seconds),
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_at)
                }
            )

        return {
            "allowed": True,
            "remaining": remaining,
            "reset_at": reset_at
        }


# Pre-configured rate limiters for common use cases
login_limiter = RateLimiter(
    max_requests=5,
    window_seconds=60,
    key_prefix="rate_limit:login"
)

register_limiter = RateLimiter(
    max_requests=3,
    window_seconds=300,  # 5 minutes
    key_prefix="rate_limit:register"
)

write_limiter = RateLimiter(
    max_requests=30,
    window_seconds=60,
    key_prefix="rate_limit:write"
)


async def rate_limit_dependency(
    request: Request,
    limiter: RateLimiter = login_limiter
) -> dict:
    """
    FastAPI dependency for rate limiting.

    Usage:
        @router.post("/login")
        async def login(
            ...,
            rate_info: dict = Depends(lambda r: rate_limit_dependency(r, login_limiter))
        ):
            ...
    """
    return await limiter.check_rate_limit(request)
