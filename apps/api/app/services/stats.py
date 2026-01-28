"""Stats computation service."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match, MatchPlayer, MatchEvent, MatchStatus, Team, Position, EventType
from app.models.stats import RatingSnapshot
from app.models.player import Player
from app.models.league import League
from app.models.season import Season


async def compute_player_stats(db: AsyncSession, player: Player, league: League, season: Season) -> dict:
    """Compute stats for a single player."""
    # Get all valid matches involving the player
    result = await db.execute(
        select(Match, MatchPlayer)
        .join(MatchPlayer, MatchPlayer.match_id == Match.id)
        .where(Match.league_id == league.id)
        .where(Match.season_id == season.id)
        .where(Match.status == MatchStatus.VALID)
        .where(MatchPlayer.player_id == player.id)
        .order_by(Match.played_at.desc())
    )
    rows = result.all()
    
    if not rows:
        return {
            "player_id": str(player.id),
            "nickname": player.nickname,
            "rating": 1200,
            "rating_trend": "stable",
            "n_matches": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0.0,
            "attack_matches": 0,
            "defense_matches": 0,
            "attack_win_rate": 0.0,
            "defense_win_rate": 0.0,
            "gamelles_received": 0,
            "gamelles_delivered": 0,
            "best_partner_id": None,
            "best_partner_nickname": None,
            "worst_matchup_id": None,
            "worst_matchup_nickname": None,
            "current_streak": 0,
            "streak_type": "none"
        }
    
    # Calculate basic stats
    wins = 0
    losses = 0
    attack_wins = 0
    attack_matches = 0
    defense_wins = 0
    defense_matches = 0
    streak = 0
    streak_type = "none"
    
    for match, mp in rows:
        player_team = mp.team
        player_won = (player_team == Team.A and match.team_a_score > match.team_b_score) or \
                     (player_team == Team.B and match.team_b_score > match.team_a_score)
        
        if player_won:
            wins += 1
        else:
            losses += 1
        
        if mp.position == Position.ATTACK:
            attack_matches += 1
            if player_won:
                attack_wins += 1
        else:
            defense_matches += 1
            if player_won:
                defense_wins += 1
    
    # Calculate streak from most recent matches
    for i, (match, mp) in enumerate(rows):
        player_team = mp.team
        player_won = (player_team == Team.A and match.team_a_score > match.team_b_score) or \
                     (player_team == Team.B and match.team_b_score > match.team_a_score)
        
        if i == 0:
            streak_type = "win" if player_won else "loss"
            streak = 1
        elif (streak_type == "win" and player_won) or (streak_type == "loss" and not player_won):
            streak += 1
        else:
            break
    
    # Get gamelles
    result = await db.execute(
        select(func.sum(MatchEvent.count))
        .join(Match, MatchEvent.match_id == Match.id)
        .where(Match.league_id == league.id)
        .where(Match.season_id == season.id)
        .where(Match.status == MatchStatus.VALID)
        .where(MatchEvent.against_player_id == player.id)
        .where(MatchEvent.event_type == EventType.GAMELLE)
    )
    gamelles_received = result.scalar() or 0
    
    result = await db.execute(
        select(func.sum(MatchEvent.count))
        .join(Match, MatchEvent.match_id == Match.id)
        .where(Match.league_id == league.id)
        .where(Match.season_id == season.id)
        .where(Match.status == MatchStatus.VALID)
        .where(MatchEvent.by_player_id == player.id)
        .where(MatchEvent.event_type == EventType.GAMELLE)
    )
    gamelles_delivered = result.scalar() or 0
    
    # Get latest rating
    result = await db.execute(
        select(RatingSnapshot)
        .where(RatingSnapshot.player_id == player.id)
        .where(RatingSnapshot.league_id == league.id)
        .where(RatingSnapshot.season_id == season.id)
        .order_by(RatingSnapshot.computed_at.desc())
        .limit(2)
    )
    rating_snapshots = result.scalars().all()
    
    current_rating = rating_snapshots[0].rating if rating_snapshots else 1200
    if len(rating_snapshots) >= 2:
        prev_rating = rating_snapshots[1].rating
        if current_rating > prev_rating:
            rating_trend = "up"
        elif current_rating < prev_rating:
            rating_trend = "down"
        else:
            rating_trend = "stable"
    else:
        rating_trend = "stable"
    
    n_matches = wins + losses
    win_rate = wins / n_matches if n_matches > 0 else 0.0
    attack_win_rate = attack_wins / attack_matches if attack_matches > 0 else 0.0
    defense_win_rate = defense_wins / defense_matches if defense_matches > 0 else 0.0
    
    return {
        "player_id": str(player.id),
        "nickname": player.nickname,
        "rating": current_rating,
        "rating_trend": rating_trend,
        "n_matches": n_matches,
        "wins": wins,
        "losses": losses,
        "win_rate": round(win_rate, 3),
        "attack_matches": attack_matches,
        "defense_matches": defense_matches,
        "attack_win_rate": round(attack_win_rate, 3),
        "defense_win_rate": round(defense_win_rate, 3),
        "gamelles_received": gamelles_received,
        "gamelles_delivered": gamelles_delivered,
        "best_partner_id": None,  # TODO: compute
        "best_partner_nickname": None,
        "worst_matchup_id": None,  # TODO: compute
        "worst_matchup_nickname": None,
        "current_streak": streak,
        "streak_type": streak_type
    }
