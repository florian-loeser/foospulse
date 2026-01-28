"""Seed demo data for testing."""
import os
import random
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.user import User
from app.models.league import League, LeagueMember, MemberRole, MemberStatus, LeagueVisibility
from app.models.season import Season, SeasonStatus
from app.models.player import Player
from app.models.match import Match, MatchPlayer, MatchEvent, MatchMode, MatchStatus, Team, Position, EventType
from app.security import get_password_hash


async def seed_demo(force: bool = False):
    """Create demo league with players and matches.

    WARNING: This creates a demo user with a weak password.
    Do not run in production unless you understand the risks.
    """
    # Production safety check
    api_debug = os.environ.get("API_DEBUG", "true").lower()
    if api_debug == "false" and not force:
        print("ERROR: Cannot seed demo data in production mode (API_DEBUG=false)")
        print("This would create a demo user with a weak password.")
        print("If you really need demo data, set API_DEBUG=true or pass --force")
        return

    print("Seeding demo data...")
    
    async with async_session_maker() as db:
        # Check if demo user already exists
        result = await db.execute(select(User).where(User.email == "demo@example.com"))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print("Demo data already exists. Skipping...")
            return
        
        # Create demo user
        demo_user = User(
            email="demo@example.com",
            password_hash=get_password_hash("demo123"),
            display_name="Demo User"
        )
        db.add(demo_user)
        await db.flush()
        print(f"Created demo user: demo@example.com / demo123")
        
        # Create league
        league = League(
            name="Office Champions",
            slug="office-champions",
            timezone="Europe/Paris",
            visibility=LeagueVisibility.PRIVATE,
            created_by_user_id=demo_user.id
        )
        db.add(league)
        await db.flush()
        print(f"Created league: {league.name} ({league.slug})")
        
        # Create season
        season = Season(
            league_id=league.id,
            name="Season 1",
            status=SeasonStatus.ACTIVE,
            starts_at=date.today() - timedelta(days=30)
        )
        db.add(season)
        await db.flush()
        print(f"Created season: {season.name}")
        
        # Create players
        player_names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"]
        players = []
        
        for i, name in enumerate(player_names):
            player = Player(
                league_id=league.id,
                user_id=demo_user.id if i == 0 else None,
                nickname=name,
                is_guest=(i != 0)
            )
            db.add(player)
            players.append(player)
        await db.flush()
        print(f"Created {len(players)} players: {', '.join(player_names)}")
        
        # Add owner membership
        member = LeagueMember(
            league_id=league.id,
            user_id=demo_user.id,
            player_id=players[0].id,
            role=MemberRole.OWNER,
            status=MemberStatus.ACTIVE
        )
        db.add(member)
        
        # Create matches
        match_count = 20
        matches_created = 0
        
        for i in range(match_count):
            # Random mode
            mode = random.choice([MatchMode.ONE_V_ONE, MatchMode.TWO_V_TWO])
            
            if mode == MatchMode.ONE_V_ONE:
                # Pick 2 random players
                selected = random.sample(players, 2)
                team_a = [selected[0]]
                team_b = [selected[1]]
            else:
                # Pick 4 random players
                selected = random.sample(players, 4)
                team_a = selected[:2]
                team_b = selected[2:]
            
            # Random scores (one team must win)
            if random.random() > 0.5:
                team_a_score = 10
                team_b_score = random.randint(0, 9)
            else:
                team_a_score = random.randint(0, 9)
                team_b_score = 10
            
            # Random played_at in the last 30 days
            days_ago = random.randint(0, 30)
            played_at = datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 12))
            
            match = Match(
                league_id=league.id,
                season_id=season.id,
                mode=mode,
                team_a_score=team_a_score,
                team_b_score=team_b_score,
                played_at=played_at,
                created_by_player_id=players[0].id,
                status=MatchStatus.VALID
            )
            db.add(match)
            await db.flush()
            
            # Add match players
            positions = [Position.ATTACK, Position.DEFENSE]
            for j, p in enumerate(team_a):
                pos = positions[j % 2] if mode == MatchMode.TWO_V_TWO else Position.ATTACK
                mp = MatchPlayer(
                    match_id=match.id,
                    player_id=p.id,
                    team=Team.A,
                    position=pos,
                    is_captain=(j == 0)
                )
                db.add(mp)
            
            for j, p in enumerate(team_b):
                pos = positions[j % 2] if mode == MatchMode.TWO_V_TWO else Position.DEFENSE
                mp = MatchPlayer(
                    match_id=match.id,
                    player_id=p.id,
                    team=Team.B,
                    position=pos,
                    is_captain=(j == 0)
                )
                db.add(mp)
            
            # Random gamelles (20% chance)
            if random.random() < 0.2:
                all_match_players = team_a + team_b
                victim = random.choice(all_match_players)
                shooter = random.choice([p for p in all_match_players if p != victim])
                
                event = MatchEvent(
                    match_id=match.id,
                    event_type=EventType.GAMELLE,
                    against_player_id=victim.id,
                    by_player_id=shooter.id,
                    count=random.randint(1, 3)
                )
                db.add(event)
            
            matches_created += 1
        
        await db.commit()
        print(f"Created {matches_created} matches")
        print()
        print("Demo data seeded successfully!")
        print("Login with: demo@example.com / demo123")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_demo())
