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

    # Compute best partner (teammate with highest win rate, min 2 matches)
    best_partner_id = None
    best_partner_nickname = None
    partner_stats = {}  # partner_id -> {"wins": 0, "total": 0, "nickname": ""}

    for match, mp in rows:
        if match.mode != "2v2":
            continue
        player_team = mp.team
        player_won = (player_team == Team.A and match.team_a_score > match.team_b_score) or \
                     (player_team == Team.B and match.team_b_score > match.team_a_score)

        # Find teammate in this match
        teammate_result = await db.execute(
            select(MatchPlayer, Player)
            .join(Player, MatchPlayer.player_id == Player.id)
            .where(MatchPlayer.match_id == match.id)
            .where(MatchPlayer.team == player_team)
            .where(MatchPlayer.player_id != player.id)
        )
        teammate_row = teammate_result.first()
        if teammate_row:
            teammate_mp, teammate_player = teammate_row
            pid = str(teammate_player.id)
            if pid not in partner_stats:
                partner_stats[pid] = {"wins": 0, "total": 0, "nickname": teammate_player.nickname}
            partner_stats[pid]["total"] += 1
            if player_won:
                partner_stats[pid]["wins"] += 1

    # Find best partner (min 2 matches, highest win rate)
    best_partner_rate = -1
    for pid, stats in partner_stats.items():
        if stats["total"] >= 2:
            rate = stats["wins"] / stats["total"]
            if rate > best_partner_rate:
                best_partner_rate = rate
                best_partner_id = pid
                best_partner_nickname = stats["nickname"]

    # Compute worst matchup (opponent with lowest win rate against, min 2 matches)
    worst_matchup_id = None
    worst_matchup_nickname = None
    opponent_stats = {}  # opponent_id -> {"wins": 0, "total": 0, "nickname": ""}

    for match, mp in rows:
        player_team = mp.team
        opponent_team = Team.B if player_team == Team.A else Team.A
        player_won = (player_team == Team.A and match.team_a_score > match.team_b_score) or \
                     (player_team == Team.B and match.team_b_score > match.team_a_score)

        # Find opponents in this match
        opponents_result = await db.execute(
            select(MatchPlayer, Player)
            .join(Player, MatchPlayer.player_id == Player.id)
            .where(MatchPlayer.match_id == match.id)
            .where(MatchPlayer.team == opponent_team)
        )
        for opp_mp, opp_player in opponents_result.all():
            pid = str(opp_player.id)
            if pid not in opponent_stats:
                opponent_stats[pid] = {"wins": 0, "total": 0, "nickname": opp_player.nickname}
            opponent_stats[pid]["total"] += 1
            if player_won:
                opponent_stats[pid]["wins"] += 1

    # Find worst matchup (min 2 matches, lowest win rate)
    worst_matchup_rate = 2  # Start above 100%
    for pid, stats in opponent_stats.items():
        if stats["total"] >= 2:
            rate = stats["wins"] / stats["total"]
            if rate < worst_matchup_rate:
                worst_matchup_rate = rate
                worst_matchup_id = pid
                worst_matchup_nickname = stats["nickname"]

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
        "best_partner_id": best_partner_id,
        "best_partner_nickname": best_partner_nickname,
        "worst_matchup_id": worst_matchup_id,
        "worst_matchup_nickname": worst_matchup_nickname,
        "current_streak": streak,
        "streak_type": streak_type,
        "recent_form": compute_recent_form(rows)
    }


def compute_recent_form(rows: list) -> list[str]:
    """
    Compute recent form (last 5 matches).
    Returns list of 'W' or 'L' for each match, most recent first.
    """
    form = []
    for match, mp in rows[:5]:
        player_team = mp.team
        player_won = (player_team == Team.A and match.team_a_score > match.team_b_score) or \
                     (player_team == Team.B and match.team_b_score > match.team_a_score)
        form.append("W" if player_won else "L")
    return form


async def compute_head_to_head(
    db: AsyncSession,
    player1: Player,
    player2: Player,
    league: League,
    season: Season
) -> dict:
    """Compute head-to-head stats between two players."""
    from sqlalchemy.orm import aliased

    MP1 = aliased(MatchPlayer)
    MP2 = aliased(MatchPlayer)

    # Find all matches where both players participated
    result = await db.execute(
        select(Match, MP1, MP2)
        .join(MP1, MP1.match_id == Match.id)
        .join(MP2, MP2.match_id == Match.id)
        .where(Match.league_id == league.id)
        .where(Match.season_id == season.id)
        .where(Match.status == MatchStatus.VALID)
        .where(MP1.player_id == player1.id)
        .where(MP2.player_id == player2.id)
        .order_by(Match.played_at.desc())
    )
    rows = result.all()

    if not rows:
        return {
            "player1_id": str(player1.id),
            "player1_nickname": player1.nickname,
            "player2_id": str(player2.id),
            "player2_nickname": player2.nickname,
            "total_matches": 0,
            "same_team": {"total": 0, "wins": 0, "losses": 0},
            "opposing": {
                "total": 0,
                "player1_wins": 0,
                "player2_wins": 0
            },
            "matches": []
        }

    same_team_total = 0
    same_team_wins = 0
    opposing_total = 0
    player1_wins_vs_player2 = 0
    matches_list = []

    for match, mp1, mp2 in rows:
        same_team = mp1.team == mp2.team

        p1_won = (mp1.team == Team.A and match.team_a_score > match.team_b_score) or \
                 (mp1.team == Team.B and match.team_b_score > match.team_a_score)

        match_info = {
            "match_id": str(match.id),
            "played_at": match.played_at.isoformat(),
            "mode": match.mode,
            "score": f"{match.team_a_score}-{match.team_b_score}",
            "same_team": same_team,
            "player1_team": mp1.team.value,
            "player2_team": mp2.team.value,
            "player1_won": p1_won
        }
        matches_list.append(match_info)

        if same_team:
            same_team_total += 1
            if p1_won:
                same_team_wins += 1
        else:
            opposing_total += 1
            if p1_won:
                player1_wins_vs_player2 += 1

    return {
        "player1_id": str(player1.id),
        "player1_nickname": player1.nickname,
        "player2_id": str(player2.id),
        "player2_nickname": player2.nickname,
        "total_matches": len(rows),
        "same_team": {
            "total": same_team_total,
            "wins": same_team_wins,
            "losses": same_team_total - same_team_wins
        },
        "opposing": {
            "total": opposing_total,
            "player1_wins": player1_wins_vs_player2,
            "player2_wins": opposing_total - player1_wins_vs_player2
        },
        "matches": matches_list[:10]  # Last 10 matches
    }
