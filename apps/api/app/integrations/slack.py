"""
Slack Integration Module.

Provides webhook-based integration with Slack for posting
notifications about match results, weekly digests, and other events.

When no webhook URL is configured, all operations are no-ops.
"""
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
import httpx

from app.config import settings
from app.logging import get_logger

logger = get_logger("integrations.slack")


@dataclass
class SlackMessage:
    """Represents a Slack message to be sent."""

    text: str
    blocks: List[Dict[str, Any]] = field(default_factory=list)
    attachments: List[Dict[str, Any]] = field(default_factory=list)
    thread_ts: Optional[str] = None
    unfurl_links: bool = False
    unfurl_media: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to Slack API payload format."""
        payload = {"text": self.text}

        if self.blocks:
            payload["blocks"] = self.blocks
        if self.attachments:
            payload["attachments"] = self.attachments
        if self.thread_ts:
            payload["thread_ts"] = self.thread_ts

        payload["unfurl_links"] = self.unfurl_links
        payload["unfurl_media"] = self.unfurl_media

        return payload


class SlackPayloadBuilder:
    """
    Builder for creating deterministic Slack message payloads.

    All payloads are JSON-serializable and stable (sorted keys).
    """

    @staticmethod
    def match_logged(
        league_name: str,
        mode: str,
        team_a_players: List[str],
        team_b_players: List[str],
        team_a_score: int,
        team_b_score: int,
        logged_by: str,
    ) -> SlackMessage:
        """
        Create payload for match logged notification.

        Args:
            league_name: Name of the league
            mode: Match mode (1v1 or 2v2)
            team_a_players: List of player nicknames on Blue team
            team_b_players: List of player nicknames on Red team
            team_a_score: Blue team's score
            team_b_score: Red team's score
            logged_by: Nickname of the player who logged the match

        Returns:
            SlackMessage ready to send
        """
        winner = "Blue" if team_a_score > team_b_score else "Red"
        winner_players = team_a_players if team_a_score > team_b_score else team_b_players
        loser_players = team_b_players if team_a_score > team_b_score else team_a_players
        winner_score = max(team_a_score, team_b_score)
        loser_score = min(team_a_score, team_b_score)

        text = (
            f":soccer: *{league_name}* - New {mode} Match!\n"
            f"{', '.join(winner_players)} beat {', '.join(loser_players)} "
            f"*{winner_score}-{loser_score}*"
        )

        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": text,
                },
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Logged by {logged_by} at {datetime.utcnow().strftime('%H:%M UTC')}",
                    }
                ],
            },
        ]

        return SlackMessage(text=text, blocks=blocks)

    @staticmethod
    def weekly_digest(
        league_name: str,
        season_name: str,
        period: str,
        n_matches: int,
        top_player: str,
        top_player_elo: int,
        biggest_mover: str,
        elo_change: int,
        summary: str,
    ) -> SlackMessage:
        """
        Create payload for weekly digest notification.

        Args:
            league_name: Name of the league
            season_name: Name of the season
            period: Period description (e.g., "Jan 20-27")
            n_matches: Number of matches played
            top_player: Nickname of the Elo leader
            top_player_elo: Current Elo of the leader
            biggest_mover: Player with biggest Elo change
            elo_change: The Elo change amount (positive or negative)
            summary: Brief summary text

        Returns:
            SlackMessage ready to send
        """
        change_emoji = ":chart_with_upwards_trend:" if elo_change > 0 else ":chart_with_downwards_trend:"
        change_sign = "+" if elo_change > 0 else ""

        text = f":trophy: *{league_name}* Weekly Digest - {period}"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f":trophy: {league_name} - Weekly Digest",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{season_name}* | {period}",
                },
            },
            {"type": "divider"},
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Matches Played:*\n{n_matches}"},
                    {"type": "mrkdwn", "text": f"*Elo Leader:*\n{top_player} ({top_player_elo})"},
                    {"type": "mrkdwn", "text": f"*Biggest Mover:*\n{biggest_mover} ({change_sign}{elo_change})"},
                ],
            },
            {"type": "divider"},
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": summary,
                },
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "_Generated by FoosPulse_",
                    }
                ],
            },
        ]

        return SlackMessage(text=text, blocks=blocks)

    @staticmethod
    def artifact_ready(
        league_name: str,
        artifact_type: str,
        season_name: str,
        download_url: Optional[str] = None,
    ) -> SlackMessage:
        """
        Create payload for artifact ready notification.

        Args:
            league_name: Name of the league
            artifact_type: Type of artifact (e.g., "League Report")
            season_name: Name of the season
            download_url: Optional URL to download the artifact

        Returns:
            SlackMessage ready to send
        """
        text = f":page_facing_up: *{league_name}* - {artifact_type} Ready for {season_name}"

        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": text,
                },
            },
        ]

        if download_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Download Report",
                            "emoji": True,
                        },
                        "url": download_url,
                        "action_id": "download_artifact",
                    }
                ],
            })

        return SlackMessage(text=text, blocks=blocks)


class SlackIntegration:
    """
    Slack integration for sending webhook notifications.

    When webhook_url is not configured, all operations are no-ops.
    """

    def __init__(self, webhook_url: Optional[str] = None):
        """
        Initialize Slack integration.

        Args:
            webhook_url: Slack webhook URL. If None, uses settings.
        """
        self.webhook_url = webhook_url or getattr(settings, "slack_webhook_url", None)
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """Check if Slack integration is configured."""
        return bool(self.webhook_url)

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def send(self, message: SlackMessage) -> bool:
        """
        Send a message to Slack.

        Args:
            message: SlackMessage to send

        Returns:
            True if sent successfully, False otherwise.
            Returns True (no-op) if not configured.
        """
        if not self.is_configured:
            logger.debug("slack_not_configured", action="send_skipped")
            return True  # No-op success

        try:
            client = await self._get_client()
            payload = message.to_dict()

            logger.info(
                "slack_sending",
                payload_size=len(json.dumps(payload)),
            )

            response = await client.post(
                self.webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                logger.info("slack_sent", status="success")
                return True
            else:
                logger.warning(
                    "slack_send_failed",
                    status_code=response.status_code,
                    response=response.text[:200],
                )
                return False

        except Exception as e:
            logger.error("slack_send_error", error=str(e))
            return False

    async def notify_match_logged(
        self,
        league_name: str,
        mode: str,
        team_a_players: List[str],
        team_b_players: List[str],
        team_a_score: int,
        team_b_score: int,
        logged_by: str,
    ) -> bool:
        """Send match logged notification."""
        message = SlackPayloadBuilder.match_logged(
            league_name=league_name,
            mode=mode,
            team_a_players=team_a_players,
            team_b_players=team_b_players,
            team_a_score=team_a_score,
            team_b_score=team_b_score,
            logged_by=logged_by,
        )
        return await self.send(message)

    async def notify_weekly_digest(
        self,
        league_name: str,
        season_name: str,
        period: str,
        n_matches: int,
        top_player: str,
        top_player_elo: int,
        biggest_mover: str,
        elo_change: int,
        summary: str,
    ) -> bool:
        """Send weekly digest notification."""
        message = SlackPayloadBuilder.weekly_digest(
            league_name=league_name,
            season_name=season_name,
            period=period,
            n_matches=n_matches,
            top_player=top_player,
            top_player_elo=top_player_elo,
            biggest_mover=biggest_mover,
            elo_change=elo_change,
            summary=summary,
        )
        return await self.send(message)

    async def notify_artifact_ready(
        self,
        league_name: str,
        artifact_type: str,
        season_name: str,
        download_url: Optional[str] = None,
    ) -> bool:
        """Send artifact ready notification."""
        message = SlackPayloadBuilder.artifact_ready(
            league_name=league_name,
            artifact_type=artifact_type,
            season_name=season_name,
            download_url=download_url,
        )
        return await self.send(message)


# Global instance for convenience
slack = SlackIntegration()
