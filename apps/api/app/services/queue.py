"""Task queue service for background jobs."""
from celery import Celery
from app.config import settings

# Create Celery client for sending tasks
celery_app = Celery(
    "foospulse_api",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_routes={
        "tasks.ratings.*": {"queue": "ratings"},
        "tasks.stats.*": {"queue": "stats"},
        "tasks.artifacts.*": {"queue": "artifacts"},
    },
)


async def enqueue_rating_update(match_id: str) -> None:
    """Enqueue a rating update task for a match."""
    celery_app.send_task(
        "tasks.ratings.update_ratings_for_match",
        args=[match_id],
        queue="ratings",
    )


async def enqueue_stats_recompute(league_id: str, season_id: str) -> None:
    """Enqueue a stats recompute task."""
    celery_app.send_task(
        "tasks.stats.recompute_league_stats",
        args=[league_id, season_id],
        queue="stats",
    )


async def enqueue_artifact_generation(artifact_id: str) -> None:
    """Enqueue an artifact generation task."""
    celery_app.send_task(
        "tasks.artifacts.generate_league_report_artifacts",
        args=[artifact_id],
        queue="artifacts",
    )
