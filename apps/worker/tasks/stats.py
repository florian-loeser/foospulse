"""Stats computation tasks."""
import uuid
import hashlib
from datetime import datetime
from collections import defaultdict

from sqlalchemy import select

from worker import app
from database import SessionLocal
from models import (
    Match, MatchPlayer, MatchEvent, Player, RatingSnapshot, StatsSnapshot,
    MatchStatus, Team, Position, EventType
)


def compute_source_hash(matches: list) -> str:
    """Compute deterministic hash of match data."""
    sorted_matches = sorted(matches, key=lambda m: str(m.id))
    hash_input = "|".join(f"{m.id}:{m.created_at.isoformat()}" for m in sorted_matches)
    return hashlib.sha256(hash_input.encode()).hexdigest()


@app.task(bind=True, queue="stats", max_retries=5)
def recompute_league_stats(self, league_id: str, season_id: str):
    """Recompute all stats for a league/season. Idempotent: skips if source_hash unchanged."""
    try:
        with SessionLocal() as db:
            league_uuid = uuid.UUID(league_id)
            season_uuid = uuid.UUID(season_id)
            
            matches = db.execute(
                select(Match).where(Match.league_id == league_uuid)
                .where(Match.season_id == season_uuid).where(Match.status == MatchStatus.VALID)
                .order_by(Match.played_at)
            ).scalars().all()
            
            if not matches:
                return {"skipped": "No matches"}
            
            source_hash = compute_source_hash(matches)
            
            existing = db.execute(
                select(StatsSnapshot).where(StatsSnapshot.league_id == league_uuid)
                .where(StatsSnapshot.season_id == season_uuid).where(StatsSnapshot.source_hash == source_hash).limit(1)
            ).scalar_one_or_none()
            
            if existing:
                return {"skipped": "Stats unchanged", "source_hash": source_hash}
            
            players = db.execute(select(Player).where(Player.league_id == league_uuid)).scalars().all()
            player_map = {p.id: p.nickname for p in players}
            
            match_ids = [m.id for m in matches]
            match_players = db.execute(select(MatchPlayer).where(MatchPlayer.match_id.in_(match_ids))).scalars().all()
            
            mp_by_match = defaultdict(list)
            for mp in match_players:
                mp_by_match[mp.match_id].append(mp)
            
            leaderboards = compute_leaderboards(db, league_uuid, season_uuid, matches, mp_by_match, player_map)
            synergy = compute_synergy(matches, mp_by_match, player_map)
            matchups = compute_matchups(matches, mp_by_match, player_map)
            
            for snapshot_type in ["leaderboards", "synergy", "matchups"]:
                db.execute(
                    StatsSnapshot.__table__.delete().where(StatsSnapshot.league_id == league_uuid)
                    .where(StatsSnapshot.season_id == season_uuid).where(StatsSnapshot.snapshot_type == snapshot_type)
                )
            
            now = datetime.utcnow()
            for st, data in [("leaderboards", leaderboards), ("synergy", synergy), ("matchups", matchups)]:
                db.add(StatsSnapshot(
                    league_id=league_uuid, season_id=season_uuid, snapshot_type=st,
                    data_json=data, computed_at=now, source_hash=source_hash
                ))
            
            db.commit()
            return {"league_id": league_id, "season_id": season_id, "matches_processed": len(matches), "source_hash": source_hash}
    except Exception as e:
        raise self.retry(exc=e, countdown=2 ** self.request.retries)


def compute_leaderboards(db, league_id, season_id, matches, mp_by_match, player_map):
    """Compute various leaderboards."""
    player_stats = defaultdict(lambda: {
        "wins": 0, "losses": 0, "matches": 0, "attack_wins": 0, "attack_matches": 0,
        "defense_wins": 0, "defense_matches": 0, "gamelles_received": 0, "gamelles_delivered": 0,
        "current_streak": 0, "streak_type": "none", "max_win_streak": 0
    })
    recent_results = defaultdict(list)
    
    for match in matches:
        team_a_won = match.team_a_score > match.team_b_score
        for mp in mp_by_match[match.id]:
            stats = player_stats[mp.player_id]
            stats["matches"] += 1
            player_won = (mp.team == Team.A and team_a_won) or (mp.team == Team.B and not team_a_won)
            if player_won:
                stats["wins"] += 1
            else:
                stats["losses"] += 1
            if mp.position == Position.ATTACK:
                stats["attack_matches"] += 1
                if player_won:
                    stats["attack_wins"] += 1
            else:
                stats["defense_matches"] += 1
                if player_won:
                    stats["defense_wins"] += 1
            recent_results[mp.player_id].append(player_won)
    
    match_ids = [m.id for m in matches]
    events = db.execute(select(MatchEvent).where(MatchEvent.match_id.in_(match_ids))).scalars().all()
    for event in events:
        if event.event_type == EventType.GAMELLE:
            player_stats[event.against_player_id]["gamelles_received"] += event.count
            if event.by_player_id:
                player_stats[event.by_player_id]["gamelles_delivered"] += event.count
        elif event.event_type == EventType.LOB:
            # Lobs count as 3x gamelles
            player_stats[event.against_player_id]["gamelles_received"] += event.count * 3
            if event.by_player_id:
                player_stats[event.by_player_id]["gamelles_delivered"] += event.count * 3
    
    for player_id, results in recent_results.items():
        if results:
            stats = player_stats[player_id]
            current_type = results[-1]
            streak = sum(1 for r in reversed(results) if r == current_type)
            stats["current_streak"] = streak
            stats["streak_type"] = "win" if current_type else "loss"
            max_streak = current_streak = 0
            for r in results:
                if r:
                    current_streak += 1
                    max_streak = max(max_streak, current_streak)
                else:
                    current_streak = 0
            stats["max_win_streak"] = max_streak
    
    ratings = {}
    for player_id in player_stats.keys():
        latest = db.execute(
            select(RatingSnapshot).where(RatingSnapshot.player_id == player_id)
            .where(RatingSnapshot.league_id == league_id).where(RatingSnapshot.season_id == season_id)
            .order_by(RatingSnapshot.computed_at.desc()).limit(1)
        ).scalar_one_or_none()
        ratings[player_id] = latest.rating if latest else 1200
    
    def build_board(key_func, name, reverse=True):
        entries = []
        for player_id, stats in player_stats.items():
            if stats["matches"] == 0:
                continue
            value = key_func(stats, ratings.get(player_id, 1200))
            entries.append({
                "player_id": str(player_id), "nickname": player_map.get(player_id, "Unknown"),
                "value": round(value, 3) if isinstance(value, float) else value, "n_matches": stats["matches"]
            })
        entries.sort(key=lambda x: (x["value"], str(x["player_id"])), reverse=reverse)
        for i, e in enumerate(entries):
            e["rank"] = i + 1
        return {"name": name, "entries": entries}
    
    return {
        "elo": build_board(lambda s, r: r, "Elo Rating"),
        "win_rate": build_board(lambda s, r: s["wins"] / s["matches"] if s["matches"] else 0, "Win Rate"),
        "attack_win_rate": build_board(lambda s, r: s["attack_wins"] / s["attack_matches"] if s["attack_matches"] else 0, "Attack Win Rate"),
        "defense_win_rate": build_board(lambda s, r: s["defense_wins"] / s["defense_matches"] if s["defense_matches"] else 0, "Defense Win Rate"),
        "gamelles_delivered": build_board(lambda s, r: s["gamelles_delivered"], "Gamelles Delivered"),
        "gamelles_received": build_board(lambda s, r: s["gamelles_received"], "Gamelles Received", reverse=False),
        "current_streak": build_board(lambda s, r: s["current_streak"] if s["streak_type"] == "win" else -s["current_streak"], "Current Streak"),
    }


def compute_synergy(matches, mp_by_match, player_map):
    """Compute synergy between player pairs (2v2 only)."""
    pair_stats = defaultdict(lambda: {"wins": 0, "losses": 0})
    for match in matches:
        if match.mode.value != "2v2":
            continue
        team_a_won = match.team_a_score > match.team_b_score
        match_pls = mp_by_match[match.id]
        team_a = sorted([mp.player_id for mp in match_pls if mp.team == Team.A])
        team_b = sorted([mp.player_id for mp in match_pls if mp.team == Team.B])
        if len(team_a) == 2:
            key = (team_a[0], team_a[1])
            pair_stats[key]["wins" if team_a_won else "losses"] += 1
        if len(team_b) == 2:
            key = (team_b[0], team_b[1])
            pair_stats[key]["wins" if not team_a_won else "losses"] += 1
    
    pairs = []
    for (p1, p2), stats in pair_stats.items():
        total = stats["wins"] + stats["losses"]
        if total >= 2:
            pairs.append({
                "player1_id": str(p1), "player1_nickname": player_map.get(p1, "Unknown"),
                "player2_id": str(p2), "player2_nickname": player_map.get(p2, "Unknown"),
                "wins": stats["wins"], "losses": stats["losses"], "win_rate": stats["wins"] / total, "n_matches": total
            })
    pairs.sort(key=lambda x: (-x["win_rate"], -x["n_matches"]))
    return {"best_duos": pairs[:10], "worst_duos": sorted(pairs, key=lambda x: (x["win_rate"], -x["n_matches"]))[:10]}


def compute_matchups(matches, mp_by_match, player_map):
    """Compute head-to-head records (1v1 only)."""
    h2h = defaultdict(lambda: {"p1_wins": 0, "p2_wins": 0})
    for match in matches:
        if match.mode.value != "1v1":
            continue
        match_pls = mp_by_match[match.id]
        if len(match_pls) != 2:
            continue
        team_a_won = match.team_a_score > match.team_b_score
        p1 = p2 = None
        for mp in match_pls:
            if mp.team == Team.A:
                p1 = mp.player_id
            else:
                p2 = mp.player_id
        if not p1 or not p2:
            continue
        if str(p1) > str(p2):
            p1, p2 = p2, p1
            team_a_won = not team_a_won
        key = (p1, p2)
        h2h[key]["p1_wins" if team_a_won else "p2_wins"] += 1
    
    matchups = []
    for (p1, p2), stats in h2h.items():
        total = stats["p1_wins"] + stats["p2_wins"]
        if total >= 2:
            matchups.append({
                "player1_id": str(p1), "player1_nickname": player_map.get(p1, "Unknown"),
                "player2_id": str(p2), "player2_nickname": player_map.get(p2, "Unknown"),
                "player1_wins": stats["p1_wins"], "player2_wins": stats["p2_wins"], "n_matches": total
            })
    matchups.sort(key=lambda x: -x["n_matches"])
    return matchups[:50]
