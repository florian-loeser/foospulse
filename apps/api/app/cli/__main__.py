"""CLI entry point."""
import asyncio
import sys

from app.cli.seed import seed_demo


async def recalculate_ratings():
    """Recalculate all Elo ratings from scratch using the current formula."""
    from sqlalchemy import select, delete
    from app.database import async_session_maker
    from app.models.match import Match, MatchPlayer, MatchStatus
    from app.models.stats import RatingSnapshot
    from app.models.player import Player
    from datetime import datetime

    # Elo constants
    K_FACTOR = 32
    INITIAL_RATING = 1200

    def calculate_expected_score(rating_a: int, rating_b: int) -> float:
        """Calculate expected score for player A."""
        return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

    def calculate_actual_score(winner: bool, score_for: int, score_against: int) -> float:
        """Calculate actual score based on match result and margin."""
        score_diff = score_for - score_against
        max_diff = 10
        margin_factor = score_diff / max_diff * 0.5
        return 0.5 + margin_factor

    def calculate_new_rating(old_rating: int, expected: float, actual: float) -> int:
        """Calculate new Elo rating."""
        return round(old_rating + K_FACTOR * (actual - expected))

    print("Recalculating all Elo ratings with margin-sensitive formula...")

    async with async_session_maker() as db:
        # Count existing snapshots
        result = await db.execute(select(RatingSnapshot))
        old_count = len(result.scalars().all())
        print(f"Deleting {old_count} existing rating snapshots...")

        # Delete all rating snapshots
        await db.execute(delete(RatingSnapshot))

        # Get all valid matches ordered by played_at
        result = await db.execute(
            select(Match)
            .where(Match.status == MatchStatus.VALID)
            .order_by(Match.played_at.asc())
        )
        matches = result.scalars().all()
        print(f"Processing {len(matches)} matches...")

        # Track current ratings per player per mode
        # Key: (player_id, mode) -> rating
        current_ratings: dict[tuple, int] = {}
        snapshots_created = 0

        for i, match in enumerate(matches):
            # Get match players
            result = await db.execute(
                select(MatchPlayer).where(MatchPlayer.match_id == match.id)
            )
            match_players = result.scalars().all()

            if not match_players:
                continue

            mode = match.mode.value

            # Get current ratings for all players
            player_ratings = {}
            for mp in match_players:
                key = (mp.player_id, mode)
                player_ratings[mp.player_id] = current_ratings.get(key, INITIAL_RATING)

            # Determine winners/losers
            team_a_won = match.team_a_score > match.team_b_score

            team_a_players = [mp for mp in match_players if mp.team.value == "A"]
            team_b_players = [mp for mp in match_players if mp.team.value == "B"]

            if not team_a_players or not team_b_players:
                continue

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

            # Create snapshots and update current ratings
            for player_id, new_rating in new_ratings.items():
                snapshot = RatingSnapshot(
                    league_id=match.league_id,
                    season_id=match.season_id,
                    player_id=player_id,
                    mode=mode,
                    rating=new_rating,
                    as_of_match_id=match.id,
                    computed_at=datetime.utcnow()
                )
                db.add(snapshot)
                snapshots_created += 1

                # Update current rating
                current_ratings[(player_id, mode)] = new_rating

            if (i + 1) % 100 == 0:
                print(f"  Processed {i + 1}/{len(matches)} matches...")

        await db.commit()
        print(f"Done! Created {snapshots_created} new rating snapshots.")

        # Print some stats
        print("\nFinal ratings (top 10 by mode):")
        for mode in ["1v1", "2v2"]:
            mode_ratings = [(pid, r) for (pid, m), r in current_ratings.items() if m == mode]
            mode_ratings.sort(key=lambda x: x[1], reverse=True)
            if mode_ratings:
                print(f"\n  {mode}:")
                for pid, rating in mode_ratings[:10]:
                    result = await db.execute(select(Player.nickname).where(Player.id == pid))
                    nickname = result.scalar_one_or_none() or "Unknown"
                    print(f"    {nickname}: {rating}")


async def check_db():
    """Check database connectivity and migration status."""
    from app.database import check_db_health
    from sqlalchemy import text
    from app.database import async_session_maker

    print("Checking database connection...")
    is_healthy = await check_db_health()

    if not is_healthy:
        print("ERROR: Cannot connect to database")
        return False

    print("Database connection: OK")

    # Check if migrations have been run
    async with async_session_maker() as db:
        try:
            result = await db.execute(text("SELECT version_num FROM alembic_version"))
            version = result.scalar_one_or_none()
            if version:
                print(f"Current migration: {version}")
            else:
                print("WARNING: No migrations found. Run 'alembic upgrade head'")
        except Exception:
            print("WARNING: alembic_version table not found. Run 'alembic upgrade head'")

    return True


async def validate_config():
    """Validate production configuration."""
    import os
    from app.config import settings

    print("Validating configuration...")
    errors = []
    warnings = []

    # Check JWT secret
    if settings.jwt_secret == "dev-secret-change-in-production-32chars":
        errors.append("JWT_SECRET is using default value - MUST be changed for production")
    elif len(settings.jwt_secret) < 32:
        warnings.append("JWT_SECRET should be at least 32 characters")

    # Check debug mode
    if settings.api_debug:
        warnings.append("API_DEBUG is enabled - disable for production")

    # Check CORS
    if "localhost" in settings.api_cors_origins:
        warnings.append("CORS allows localhost - ensure production domain is added")

    # Check database URL
    if "localhost" in settings.database_url or "postgres:5432" in settings.database_url:
        if os.environ.get("API_DEBUG", "true").lower() != "false":
            pass  # OK for development
        else:
            warnings.append("DATABASE_URL appears to be a local database")

    # Print results
    if errors:
        print("\nERRORS (must fix before production):")
        for err in errors:
            print(f"  - {err}")

    if warnings:
        print("\nWARNINGS (review before production):")
        for warn in warnings:
            print(f"  - {warn}")

    if not errors and not warnings:
        print("Configuration looks good for production!")

    return len(errors) == 0


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.cli <command>")
        print()
        print("Commands:")
        print("  check_db           - Check database connectivity and migration status")
        print("  validate           - Validate configuration for production")
        print("  seed_demo          - Seed demo data (development only)")
        print("  seed_demo --force  - Force seed demo data (dangerous!)")
        print("  recalc_ratings     - Recalculate all Elo ratings from match history")
        sys.exit(1)

    command = sys.argv[1]

    if command == "seed_demo":
        force = "--force" in sys.argv
        asyncio.run(seed_demo(force=force))
    elif command == "check_db":
        success = asyncio.run(check_db())
        sys.exit(0 if success else 1)
    elif command == "validate":
        success = asyncio.run(validate_config())
        sys.exit(0 if success else 1)
    elif command == "recalc_ratings":
        asyncio.run(recalculate_ratings())
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
