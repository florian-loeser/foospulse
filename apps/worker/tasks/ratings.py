"""Rating update tasks."""
import uuid
from datetime import datetime

from sqlalchemy import select

from worker import app
from database import SessionLocal
from models import Match, MatchPlayer, RatingSnapshot, MatchStatus, Team


# Elo constants
K_FACTOR = 32
INITIAL_RATING = 1200


def calculate_expected_score(rating_a: int, rating_b: int) -> float:
    """Calculate expected score for player A."""
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


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
                actual = 1.0 if team_a_won else 0.0
                new_ratings[mp.player_id] = calculate_new_rating(old_rating, expected, actual)
            
            for mp in team_b_players:
                old_rating = player_ratings[mp.player_id]
                expected = calculate_expected_score(old_rating, team_a_avg)
                actual = 0.0 if team_a_won else 1.0
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
            
            db.commit()
            
            return {
                "match_id": match_id,
                "mode": mode,
                "ratings_updated": len(new_ratings),
                "new_ratings": {str(k): v for k, v in new_ratings.items()}
            }
            
    except Exception as e:
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=2 ** self.request.retries)
