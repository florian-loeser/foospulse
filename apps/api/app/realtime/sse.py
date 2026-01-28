"""Server-Sent Events (SSE) streaming for live match updates."""
import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator

import redis.asyncio as redis

from app.config import settings
from app.realtime.pubsub import get_channel_name


async def event_generator(share_token: str) -> AsyncGenerator[str, None]:
    """
    Generate SSE events for a live match.

    Subscribes to the Redis pub/sub channel and yields events as they arrive.
    Sends heartbeat events every 30 seconds to keep the connection alive.
    """
    # Create a separate Redis connection for pub/sub
    pubsub_client = redis.from_url(settings.redis_url, decode_responses=True)
    pubsub = pubsub_client.pubsub()
    channel = get_channel_name(share_token)

    try:
        await pubsub.subscribe(channel)

        # Send initial connection event
        yield format_sse_event("connected", {"share_token": share_token})

        while True:
            try:
                # Wait for message with timeout for heartbeat
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=30.0
                )

                if message and message["type"] == "message":
                    # Forward the message as an SSE event
                    data = json.loads(message["data"])
                    yield format_sse_event(data["event"], data["data"])

            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                yield format_sse_event("heartbeat", {"timestamp": datetime.utcnow().isoformat()})

    except asyncio.CancelledError:
        # Client disconnected
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await pubsub_client.close()


def format_sse_event(event_type: str, data: dict) -> str:
    """Format data as an SSE event string."""
    json_data = json.dumps(data, default=str)
    return f"event: {event_type}\ndata: {json_data}\n\n"
