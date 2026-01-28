"""CLI entry point."""
import asyncio
import sys

from app.cli.seed import seed_demo


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
        print("  check_db      - Check database connectivity and migration status")
        print("  validate      - Validate configuration for production")
        print("  seed_demo     - Seed demo data (development only)")
        print("  seed_demo --force  - Force seed demo data (dangerous!)")
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
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
