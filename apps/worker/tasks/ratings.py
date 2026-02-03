"""Rating update tasks."""
import uuid
from datetime import datetime
from typing import List, Set

from sqlalchemy import select, func, and_

from worker import app
from database import SessionLocal
from models import (
    Match, MatchPlayer, MatchEvent, RatingSnapshot, MatchStatus, Team, EventType,
    Player, League, PlayerAchievement, AchievementType
)


# Elo constants
K_FACTOR = 32
INITIAL_RATING = 1200


def check_and_award_achievements(
    db,
    player_id: uuid.UUID,
    league_id: uuid.UUID,
    match: Match,
    player_won: bool,
    current_streak: int,
    total_wins: int,
    total_matches: int,
    gamelles_delivered: int,
    opponent_avg_elo: int,
    player_elo: int,
) -> List[str]:
    """
    Check if player earned new achievements after a match.
    Returns list of newly awarded achievement types.
    """
    new_achievements = []

    # Get existing achievements
    result = db.execute(
        select(PlayerAchievement.achievement_type)
        .where(PlayerAchievement.player_id == player_id)
        .where(PlayerAchievement.league_id == league_id)
    )
    existing: Set[str] = {row[0] for row in result.all()}

    def award(achievement_type: AchievementType, progress: int = None):
        if achievement_type.value not in existing:
            achievement = PlayerAchievement(
                player_id=player_id,
                league_id=league_id,
                achievement_type=achievement_type.value,
                trigger_match_id=match.id,
                progress_value=progress,
            )
            db.add(achievement)
            new_achievements.append(achievement_type.value)

    # First win
    if player_won and total_wins == 1:
        award(AchievementType.FIRST_WIN)

    # Win milestones
    if player_won:
        if total_wins >= 10:
            award(AchievementType.WINS_10, 10)
        if total_wins >= 50:
            award(AchievementType.WINS_50, 50)
        if total_wins >= 100:
            award(AchievementType.WINS_100, 100)

    # Match milestones
    if total_matches >= 10:
        award(AchievementType.MATCHES_10, 10)
    if total_matches >= 50:
        award(AchievementType.MATCHES_50, 50)
    if total_matches >= 100:
        award(AchievementType.MATCHES_100, 100)

    # Win streaks
    if player_won:
        if current_streak >= 3:
            award(AchievementType.WIN_STREAK_3, 3)
        if current_streak >= 5:
            award(AchievementType.WIN_STREAK_5, 5)
        if current_streak >= 10:
            award(AchievementType.WIN_STREAK_10, 10)

    # Gamelle achievements
    if gamelles_delivered >= 1:
        award(AchievementType.FIRST_GAMELLE)
    if gamelles_delivered >= 5:
        award(AchievementType.GAMELLES_5, 5)
    if gamelles_delivered >= 10:
        award(AchievementType.GAMELLES_10, 10)
    if gamelles_delivered >= 25:
        award(AchievementType.GAMELLE_MASTER, 25)

    # Flawless victory (10-0)
    if player_won:
        player_team_score = match.team_a_score if match.team_a_score > match.team_b_score else match.team_b_score
        opponent_score = match.team_b_score if match.team_a_score > match.team_b_score else match.team_a_score
        if player_team_score == 10 and opponent_score == 0:
            award(AchievementType.FLAWLESS)

    # Giant slayer - beat someone 100+ Elo higher
    if player_won and opponent_avg_elo - player_elo >= 100:
        award(AchievementType.GIANT_SLAYER)

    return new_achievements


def compute_player_stats_for_achievement(
    db,
    player_id: uuid.UUID,
    league_id: uuid.UUID,
    season_id: uuid.UUID,
) -> dict:
    """Compute player stats needed for achievement checking."""
    # Get all matches for this player in the season
    result = db.execute(
        select(Match, MatchPlayer.team)
        .join(MatchPlayer, MatchPlayer.match_id == Match.id)
        .where(MatchPlayer.player_id == player_id)
        .where(Match.league_id == league_id)
        .where(Match.season_id == season_id)
        .where(Match.status == MatchStatus.VALID)
        .order_by(Match.played_at.asc())
    )
    matches = result.all()

    total_matches = len(matches)
    total_wins = 0
    current_streak = 0

    for match, team in matches:
        team_a_won = match.team_a_score > match.team_b_score
        player_won = (team == Team.A and team_a_won) or (team == Team.B and not team_a_won)

        if player_won:
            total_wins += 1
            current_streak += 1
        else:
            current_streak = 0

    # Get total gamelles delivered by this player
    result = db.execute(
        select(func.coalesce(func.sum(MatchEvent.count), 0))
        .join(Match, Match.id == MatchEvent.match_id)
        .where(MatchEvent.by_player_id == player_id)
        .where(MatchEvent.event_type == EventType.GAMELLE)
        .where(Match.league_id == league_id)
        .where(Match.season_id == season_id)
        .where(Match.status == MatchStatus.VALID)
    )
    gamelles_delivered = result.scalar() or 0

    return {
        "total_matches": total_matches,
        "total_wins": total_wins,
        "current_streak": current_streak,
        "gamelles_delivered": gamelles_delivered,
    }


def calculate_expected_score(rating_a: int, rating_b: int) -> float:
    """Calculate expected score for player A."""
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def calculate_actual_score(winner: bool, score_for: int, score_against: int) -> float:
    """
    Calculate actual score based on match result and margin.

    Instead of binary 1.0/0.0, scales based on score difference:
    - Win 10-0: 1.0 (dominant victory)
    - Win 10-9: 0.55 (narrow victory)
    - Loss 9-10: 0.45 (narrow loss)
    - Loss 0-10: 0.0 (dominant loss)

    Formula: 0.5 + (score_diff / max_possible_diff) * 0.5
    where max_possible_diff = 10 (winning score in foosball)
    """
    score_diff = score_for - score_against
    max_diff = 10  # Maximum possible margin (10-0)

    # Scale from -0.5 to +0.5, then shift to 0.0 to 1.0
    margin_factor = score_diff / max_diff * 0.5
    return 0.5 + margin_factor


def calculate_new_rating(old_rating: int, expected: float, actual: float) -> int:
    """Calculate new Elo rating."""
    return round(old_rating + K_FACTOR * (actual - expected))


@app.task(bind=True, queue="ratings", max_retries=5)
def update_ratings_for_match(self, match_id: str):
    """
    Compute Elo ratings for all players in a match.
    
    Idempotent: checks if snapshots already exist before creating.
    """
    try:
        with SessionLocal() as db:
            match_uuid = uuid.UUID(match_id)
            
            # Get match
            match = db.execute(
                select(Match).where(Match.id == match_uuid)
            ).scalar_one_or_none()
            
            if not match:
                return {"error": "Match not found"}
            
            if match.status != MatchStatus.VALID:
                return {"skipped": "Match is not valid"}
            
            # Get match players
            match_players = db.execute(
                select(MatchPlayer).where(MatchPlayer.match_id == match_uuid)
            ).scalars().all()
            
            if not match_players:
                return {"error": "No players in match"}
            
            mode = match.mode.value
            
            # Check if snapshots already exist (idempotency)
            existing = db.execute(
                select(RatingSnapshot)
                .where(RatingSnapshot.as_of_match_id == match_uuid)
                .where(RatingSnapshot.mode == mode)
            ).scalars().all()
            
            if existing:
                return {"skipped": "Ratings already computed for this match"}
            
            # Get current ratings for all players
            player_ratings = {}
            for mp in match_players:
                # Get latest rating for this player/mode
                latest = db.execute(
                    select(RatingSnapshot)
                    .where(RatingSnapshot.player_id == mp.player_id)
                    .where(RatingSnapshot.league_id == match.league_id)
                    .where(RatingSnapshot.mode == mode)
                    .order_by(RatingSnapshot.computed_at.desc())
                    .limit(1)
                ).scalar_one_or_none()
                
                player_ratings[mp.player_id] = latest.rating if latest else INITIAL_RATING
            
            # Determine winners/losers
            team_a_won = match.team_a_score > match.team_b_score
            
            team_a_players = [mp for mp in match_players if mp.team == Team.A]
            team_b_players = [mp for mp in match_players if mp.team == Team.B]
            
            # Calculate team average ratings
            team_a_avg = sum(player_ratings[mp.player_id] for mp in team_a_players) / len(team_a_players)
            team_b_avg = sum(player_ratings[mp.player_id] for mp in team_b_players) / len(team_b_players)
            
            # Calculate new ratings
            new_ratings = {}
            
            for mp in team_a_players:
                old_rating = player_ratings[mp.player_id]
                expected = calculate_expected_score(old_rating, team_b_avg)
                actual = calculate_actual_score(team_a_won, match.team_a_score, match.team_b_score)
                new_ratings[mp.player_id] = calculate_new_rating(old_rating, expected, actual)

            for mp in team_b_players:
                old_rating = player_ratings[mp.player_id]
                expected = calculate_expected_score(old_rating, team_a_avg)
                actual = calculate_actual_score(not team_a_won, match.team_b_score, match.team_a_score)
                new_ratings[mp.player_id] = calculate_new_rating(old_rating, expected, actual)
            
            # Create snapshots
            for player_id, new_rating in new_ratings.items():
                snapshot = RatingSnapshot(
                    league_id=match.league_id,
                    season_id=match.season_id,
                    player_id=player_id,
                    mode=mode,
                    rating=new_rating,
                    as_of_match_id=match_uuid,
                    computed_at=datetime.utcnow()
                )
                db.add(snapshot)

            # Check achievements for each player
            all_achievements = []
            for mp in match_players:
                # Determine if player won
                player_won = (mp.team == Team.A and team_a_won) or (mp.team == Team.B and not team_a_won)

                # Get opponent team's average elo
                if mp.team == Team.A:
                    opponent_avg_elo = int(team_b_avg)
                else:
                    opponent_avg_elo = int(team_a_avg)

                # Get player stats for achievement checking
                stats = compute_player_stats_for_achievement(
                    db, mp.player_id, match.league_id, match.season_id
                )

                # Check and award achievements
                awarded = check_and_award_achievements(
                    db=db,
                    player_id=mp.player_id,
                    league_id=match.league_id,
                    match=match,
                    player_won=player_won,
                    current_streak=stats["current_streak"],
                    total_wins=stats["total_wins"],
                    total_matches=stats["total_matches"],
                    gamelles_delivered=stats["gamelles_delivered"],
                    opponent_avg_elo=opponent_avg_elo,
                    player_elo=player_ratings[mp.player_id],
                )

                if awarded:
                    all_achievements.append({
                        "player_id": str(mp.player_id),
                        "achievements": awarded
                    })

            db.commit()

            return {
                "match_id": match_id,
                "mode": mode,
                "ratings_updated": len(new_ratings),
                "new_ratings": {str(k): v for k, v in new_ratings.items()},
                "achievements_awarded": all_achievements
            }
            
    except Exception as e:
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=2 ** self.request.retries)
