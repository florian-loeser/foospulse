"""
Redis client for caching and task queue.
"""
import redis.asyncio as redis

from app.config import settings


redis_client = redis.from_url(settings.redis_url, decode_responses=True)


async def check_redis_health() -> bool:
    """Check if Redis is reachable."""
    try:
        await redis_client.ping()
        return True
    except Exception:
        return False


async def enqueue_task(queue: str, task_data: dict) -> str:
    """Enqueue a task for the worker."""
    import json
    import ulid
    
    task_id = str(ulid.new())
    task_payload = {
        "task_id": task_id,
        **task_data
    }
    await redis_client.lpush(f"celery:{queue}", json.dumps(task_payload))
    return task_id
