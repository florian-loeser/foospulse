"""Redis pub/sub for real-time live match updates."""
import json
from datetime import datetime
from typing import Any

from app.redis_client import redis_client


def get_channel_name(share_token: str) -> str:
    """Get the Redis pub/sub channel name for a live match."""
    return f"live_match:{share_token}"


async def publish_event(share_token: str, event_type: str, data: Any) -> None:
    """Publish an event to the live match channel."""
    channel = get_channel_name(share_token)
    payload = {
        "event": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await redis_client.publish(channel, json.dumps(payload, default=str))


async def publish_goal(
    share_token: str,
    team: str,
    by_player_id: str | None,
    by_player_nickname: str | None,
    new_score_a: int,
    new_score_b: int,
) -> None:
    """Publish a goal event."""
    await publish_event(share_token, "goal", {
        "team": team,
        "by_player_id": by_player_id,
        "by_player_nickname": by_player_nickname,
        "team_a_score": new_score_a,
        "team_b_score": new_score_b,
    })


async def publish_gamellized(
    share_token: str,
    team: str,
    new_score_a: int,
    new_score_b: int,
) -> None:
    """Publish a gamellized event (-1 for the team)."""
    await publish_event(share_token, "gamellized", {
        "team": team,
        "team_a_score": new_score_a,
        "team_b_score": new_score_b,
    })


async def publish_timeout(share_token: str, team: str) -> None:
    """Publish a timeout event."""
    await publish_event(share_token, "timeout", {"team": team})


async def publish_lobbed(
    share_token: str,
    team: str,
    new_score_a: int,
    new_score_b: int,
) -> None:
    """Publish a lobbed event (ball above bar, -3 for the team)."""
    await publish_event(share_token, "lobbed", {
        "team": team,
        "team_a_score": new_score_a,
        "team_b_score": new_score_b,
    })


async def publish_custom_event(
    share_token: str,
    custom_type: str,
    metadata: dict | None,
) -> None:
    """Publish a custom event."""
    await publish_event(share_token, "custom", {
        "custom_type": custom_type,
        "metadata": metadata,
    })


async def publish_score_update(
    share_token: str,
    team_a_score: int,
    team_b_score: int,
) -> None:
    """Publish a score update event."""
    await publish_event(share_token, "score_update", {
        "team_a_score": team_a_score,
        "team_b_score": team_b_score,
    })


async def publish_status_change(share_token: str, new_status: str) -> None:
    """Publish a status change event."""
    await publish_event(share_token, "status_change", {"status": new_status})


async def publish_undo(
    share_token: str,
    event_id: str,
    team_a_score: int,
    team_b_score: int,
) -> None:
    """Publish an undo event."""
    await publish_event(share_token, "undo", {
        "event_id": event_id,
        "team_a_score": team_a_score,
        "team_b_score": team_b_score,
    })
