"""
Achievement computation and awarding service.
"""
from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.player import Player
from app.models.league import League
from app.models.season import Season
from app.models.match import Match, MatchPlayer, MatchEvent, MatchStatus, Team, EventType
from app.models.achievement import PlayerAchievement, AchievementType, ACHIEVEMENT_INFO
from app.models.stats import RatingSnapshot


async def get_player_achievements(
    db: AsyncSession,
    player_id: str,
    league_id: str
) -> List[dict]:
    """Get all achievements for a player in a league."""
    result = await db.execute(
        select(PlayerAchievement)
        .where(PlayerAchievement.player_id == player_id)
        .where(PlayerAchievement.league_id == league_id)
        .order_by(PlayerAchievement.unlocked_at.desc())
    )
    achievements = result.scalars().all()

    return [
        {
            "type": a.achievement_type,
            "unlocked_at": a.unlocked_at.isoformat(),
            **ACHIEVEMENT_INFO.get(AchievementType(a.achievement_type), {})
        }
        for a in achievements
    ]


async def check_and_award_achievements(
    db: AsyncSession,
    player: Player,
    league: League,
    match: Match,
    player_won: bool,
    current_streak: int,
    total_wins: int,
    total_matches: int,
    gamelles_delivered: int,
) -> List[str]:
    """
    Check if player earned new achievements after a match.
    Returns list of newly awarded achievement types.
    """
    new_achievements = []

    # Get existing achievements
    result = await db.execute(
        select(PlayerAchievement.achievement_type)
        .where(PlayerAchievement.player_id == player.id)
        .where(PlayerAchievement.league_id == league.id)
    )
    existing = {row[0] for row in result.all()}

    async def award(achievement_type: AchievementType, progress: int = None):
        if achievement_type.value not in existing:
            achievement = PlayerAchievement(
                player_id=player.id,
                league_id=league.id,
                achievement_type=achievement_type.value,
                trigger_match_id=match.id,
                progress_value=progress,
            )
            db.add(achievement)
            new_achievements.append(achievement_type.value)

    # First win
    if player_won and total_wins == 1:
        await award(AchievementType.FIRST_WIN)

    # Win milestones
    if player_won:
        if total_wins >= 10:
            await award(AchievementType.WINS_10, 10)
        if total_wins >= 50:
            await award(AchievementType.WINS_50, 50)
        if total_wins >= 100:
            await award(AchievementType.WINS_100, 100)

    # Match milestones
    if total_matches >= 10:
        await award(AchievementType.MATCHES_10, 10)
    if total_matches >= 50:
        await award(AchievementType.MATCHES_50, 50)
    if total_matches >= 100:
        await award(AchievementType.MATCHES_100, 100)

    # Win streaks
    if player_won:
        if current_streak >= 3:
            await award(AchievementType.WIN_STREAK_3, 3)
        if current_streak >= 5:
            await award(AchievementType.WIN_STREAK_5, 5)
        if current_streak >= 10:
            await award(AchievementType.WIN_STREAK_10, 10)

    # Gamelle achievements
    if gamelles_delivered >= 1 and AchievementType.FIRST_GAMELLE.value not in existing:
        await award(AchievementType.FIRST_GAMELLE)
    if gamelles_delivered >= 5:
        await award(AchievementType.GAMELLES_5, 5)
    if gamelles_delivered >= 10:
        await award(AchievementType.GAMELLES_10, 10)
    if gamelles_delivered >= 25:
        await award(AchievementType.GAMELLE_MASTER, 25)

    # Flawless victory (10-0)
    if player_won:
        player_team_score = match.team_a_score if match.team_a_score > match.team_b_score else match.team_b_score
        opponent_score = match.team_b_score if match.team_a_score > match.team_b_score else match.team_a_score
        if player_team_score == 10 and opponent_score == 0:
            await award(AchievementType.FLAWLESS)

    return new_achievements


def calculate_win_probability(team_a_elo: float, team_b_elo: float) -> float:
    """
    Calculate expected win probability for team A based on Elo ratings.
    Uses the standard Elo formula.
    """
    elo_diff = team_b_elo - team_a_elo
    expected = 1 / (1 + 10 ** (elo_diff / 400))
    return expected


async def get_match_prediction(
    db: AsyncSession,
    league_id: str,
    team_a_player_ids: List[str],
    team_b_player_ids: List[str],
) -> dict:
    """
    Calculate match prediction based on team Elo ratings.

    Returns predicted winner and win probabilities.
    """
    # Get current ratings for all players
    async def get_team_avg_elo(player_ids: List[str]) -> float:
        if not player_ids:
            return 1200

        ratings = []
        for pid in player_ids:
            result = await db.execute(
                select(RatingSnapshot.rating)
                .where(RatingSnapshot.player_id == pid)
                .where(RatingSnapshot.league_id == league_id)
                .order_by(RatingSnapshot.computed_at.desc())
                .limit(1)
            )
            rating = result.scalar_one_or_none()
            ratings.append(rating if rating else 1200)

        return sum(ratings) / len(ratings)

    team_a_elo = await get_team_avg_elo(team_a_player_ids)
    team_b_elo = await get_team_avg_elo(team_b_player_ids)

    team_a_prob = calculate_win_probability(team_a_elo, team_b_elo)
    team_b_prob = 1 - team_a_prob

    return {
        "team_a_elo": round(team_a_elo),
        "team_b_elo": round(team_b_elo),
        "team_a_win_probability": round(team_a_prob * 100, 1),
        "team_b_win_probability": round(team_b_prob * 100, 1),
        "predicted_winner": "A" if team_a_prob > 0.5 else "B",
        "is_close": abs(team_a_prob - 0.5) < 0.1,  # Within 10% of 50-50
    }
