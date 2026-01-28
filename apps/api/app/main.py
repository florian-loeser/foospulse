"""
FoosPulse API - FastAPI Application
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.routes import auth, leagues, players, matches, stats, artifacts, seasons, exports, members, live_matches
from app.logging import configure_logging, get_logger
from app.middleware import RequestIDMiddleware

# Configure structured logging
configure_logging(json_logs=settings.json_logs, log_level=settings.log_level)
logger = get_logger("api")


def _validate_production_config():
    """Validate configuration on startup."""
    warnings = []

    # Check JWT secret
    if settings.jwt_secret == "dev-secret-change-in-production-32chars":
        warnings.append("JWT_SECRET is using default value - MUST be changed for production")

    # Check debug mode in production
    if not settings.api_debug:
        # We're in production mode, do stricter checks
        if settings.jwt_secret == "dev-secret-change-in-production-32chars":
            logger.error("SECURITY: Using default JWT secret in production mode!")

    return warnings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("api_starting", version="1.0.0")

    # Validate configuration
    config_warnings = _validate_production_config()
    for warning in config_warnings:
        logger.warning("config_warning", message=warning)

    yield
    # Shutdown
    logger.info("api_shutting_down")
    await engine.dispose()


OPENAPI_TAGS = [
    {
        "name": "health",
        "description": "Health check and status endpoints.",
    },
    {
        "name": "auth",
        "description": "Authentication endpoints for user registration, login, and token management.",
    },
    {
        "name": "leagues",
        "description": "League management - create, list, and configure leagues.",
    },
    {
        "name": "players",
        "description": "Player management within leagues - add players and view profiles.",
    },
    {
        "name": "matches",
        "description": "Match logging and history - record game results and view match details.",
    },
    {
        "name": "stats",
        "description": "Statistics endpoints - leaderboards, synergy analysis, and player stats.",
    },
    {
        "name": "artifacts",
        "description": "Report generation - create and download league reports and exports.",
    },
    {
        "name": "seasons",
        "description": "Season management - archive seasons and create new ones.",
    },
    {
        "name": "exports",
        "description": "CSV export endpoints for data portability.",
    },
    {
        "name": "members",
        "description": "League membership management - roles and member administration.",
    },
    {
        "name": "live-matches",
        "description": "Real-time live match sessions with SSE streaming for spectators.",
    },
]

app = FastAPI(
    title="FoosPulse API",
    description="""
## Office Foosball League Management

FoosPulse provides a complete API for managing office foosball leagues with:

- **Deterministic Statistics**: All stats are reproducible from match history
- **Elo Ratings**: Track player skill over time
- **Team Synergy**: Analyze which player combinations work best
- **Artifact Generation**: Export reports and data

### Authentication

Most endpoints require Bearer token authentication. Obtain a token via `/api/auth/login`.

### Response Format

All responses follow a standard format:
```json
{
  "data": { ... },
  "error": null
}
```

On error:
```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```
    """,
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
    contact={
        "name": "FoosPulse",
        "url": "https://github.com/foospulse/foospulse",
    },
    license_info={
        "name": "MIT",
    },
)

# Request ID middleware (must be first to capture all requests)
app.add_middleware(RequestIDMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(leagues.router, prefix="/api/leagues", tags=["leagues"])
app.include_router(players.router, prefix="/api/leagues", tags=["players"])
app.include_router(matches.router, prefix="/api/leagues", tags=["matches"])
app.include_router(stats.router, prefix="/api/leagues", tags=["stats"])
app.include_router(artifacts.router, prefix="/api/leagues", tags=["artifacts"])
app.include_router(seasons.router, prefix="/api/leagues", tags=["seasons"])
app.include_router(exports.router, prefix="/api/leagues", tags=["exports"])
app.include_router(members.router, prefix="/api/leagues", tags=["members"])
app.include_router(live_matches.router, prefix="/api/leagues", tags=["live-matches"])
app.include_router(live_matches.public_router, prefix="/api", tags=["live-matches"])


@app.get(
    "/api/health",
    tags=["health"],
    summary="Check API health",
    description="Returns the health status of the API and its dependencies (PostgreSQL, Redis).",
    response_description="Health status with dependency checks",
    responses={
        200: {
            "description": "API is healthy",
            "content": {
                "application/json": {
                    "example": {
                        "data": {
                            "status": "ok",
                            "api_version": "1.0",
                            "dependencies": {
                                "postgres": "ok",
                                "redis": "ok"
                            }
                        },
                        "error": None
                    }
                }
            }
        }
    }
)
async def health_check():
    """
    Health check endpoint with dependency status.

    Returns:
        - **status**: "ok" if all dependencies are healthy, "degraded" otherwise
        - **api_version**: Current API version
        - **dependencies**: Status of each dependency (postgres, redis)
    """
    from app.database import check_db_health
    from app.redis_client import check_redis_health

    postgres_ok = await check_db_health()
    redis_ok = await check_redis_health()

    all_ok = postgres_ok and redis_ok

    return {
        "data": {
            "status": "ok" if all_ok else "degraded",
            "api_version": "1.0",
            "dependencies": {
                "postgres": "ok" if postgres_ok else "error",
                "redis": "ok" if redis_ok else "error",
            }
        },
        "error": None
    }
