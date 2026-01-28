# FoosPulse 🎯

**Office foosball league management with deterministic stats, fair analytics, and reproducible artifacts.**

FoosPulse is a Docker Compose monorepo application for tracking office foosball matches, computing Elo ratings, and generating downloadable reports.

## Features

- **Match Logging**: Fast 15-25 second match capture with roles (attack/defense) and gamelles tracking
- **Deterministic Stats**: Elo ratings, synergy matrices, rivalry stats, and role-based leaderboards
- **Reproducible Artifacts**: Downloadable reports (Markdown, CSV, JSON) with SHA256 checksums
- **Mobile-First UI**: Responsive design optimized for quick logging at the foosball table
- **Autopilot Delivery**: Built-in backlog management and Claude Code integration

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### 1. Clone and Configure

```bash
git clone <repo-url> foospulse
cd foospulse
cp .env.example .env
```

### 2. Start Services

```bash
docker compose up --build
```

This starts:
- **Web** (Next.js): http://localhost:3100
- **API** (FastAPI): http://localhost:8100
- **Worker** (Celery): Background task processing
- **Postgres**: Database on port 5450
- **Redis**: Message broker on port 6390

### 3. Run Migrations

```bash
docker compose exec api alembic upgrade head
```

### 4. Seed Demo Data (Optional)

```bash
docker compose exec api python -m app.cli seed_demo
```

This creates:
- Demo user: `demo@example.com` / `demo123`
- Demo league: "Office Champions" with 6 players
- 20 sample matches with gamelles

### 5. Verify Health

```bash
curl http://localhost:8100/api/health
```

Expected: `{"data":{"status":"ok",...}}`

## Port Configuration

All ports are configurable via environment variables:

| Service  | Default | Environment Variable |
|----------|---------|---------------------|
| Web      | 3100    | `WEB_PORT`          |
| API      | 8100    | `API_PORT`          |
| Postgres | 5450    | `POSTGRES_PORT`     |
| Redis    | 6390    | `REDIS_PORT`        |

## API Endpoints

### Health
- `GET /api/health` - Service health check

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT token
- `GET /api/auth/me` - Current user info

### Leagues
- `POST /api/leagues` - Create league
- `GET /api/leagues` - List user's leagues
- `GET /api/leagues/{slug}` - League details

### Players
- `POST /api/leagues/{slug}/players` - Add player
- `GET /api/leagues/{slug}/players` - List players

### Matches
- `POST /api/leagues/{slug}/matches` - Log match
- `GET /api/leagues/{slug}/matches` - List matches
- `POST /api/leagues/{slug}/matches/{id}/void` - Void match (admin)

### Stats
- `GET /api/leagues/{slug}/stats/leaderboards` - Elo and other rankings
- `GET /api/leagues/{slug}/stats/synergy` - Best/worst duo combinations
- `GET /api/leagues/{slug}/stats/matchups` - Head-to-head records

### Artifacts
- `POST /api/leagues/{slug}/artifacts/league-report` - Generate report
- `GET /api/leagues/{slug}/artifacts` - List artifacts
- `GET /api/leagues/{slug}/artifacts/{id}/download?file=...` - Download file

## Running Tests

```bash
# API tests
docker compose exec api pytest

# Worker tests
docker compose exec worker pytest
```

## Autopilot System

FoosPulse includes an autopilot delivery system for managing development:

```bash
# Show backlog status
./foospulse status

# Start next backlog item
./foospulse run-next

# Mark current item done
./foospulse mark-done

# Work on specific feature
./foospulse feature APP-0010

# Retry failed item
./foospulse retry
```

See `CLAUDE.md` for repo rules and Definition of Done.

## Architecture

```
foospulse/
├── apps/
│   ├── web/          # Next.js App Router (mobile-first)
│   ├── api/          # FastAPI + SQLAlchemy + Alembic
│   └── worker/       # Celery tasks (ratings, stats, artifacts)
├── data/
│   └── artifacts/    # Generated reports (mounted volume)
├── scripts/          # Autopilot automation scripts
├── tickets/          # Feature ticket templates
├── claude_prompts/   # Claude Code prompt templates
├── BACKLOG.yml       # Feature backlog
├── BACKLOG_STATE.json # Backlog progress tracking
└── docker-compose.yml
```

## Backup and Restore

### Database Backup

```bash
docker compose exec postgres pg_dump -U foospulse foospulse > backup.sql
```

### Database Restore

```bash
docker compose exec -T postgres psql -U foospulse foospulse < backup.sql
```

### Artifacts Backup

The `data/artifacts/` directory contains all generated reports. Back up this directory to preserve artifact history:

```bash
tar -czvf artifacts-backup.tar.gz data/artifacts/
```

## Troubleshooting

### Port Conflicts

If ports are in use, configure alternatives in `.env`:

```bash
WEB_PORT=3200
API_PORT=8200
POSTGRES_PORT=5460
REDIS_PORT=6400
```

### Database Connection Issues

1. Ensure Postgres is running: `docker compose ps`
2. Check logs: `docker compose logs postgres`
3. Verify connection: `docker compose exec postgres psql -U foospulse -c '\l'`

### Worker Not Processing Tasks

1. Check worker logs: `docker compose logs worker`
2. Verify Redis connection: `docker compose exec redis redis-cli ping`
3. Restart worker: `docker compose restart worker`

### Migration Errors

```bash
# Check current migration state
docker compose exec api alembic current

# Generate new migration after model changes
docker compose exec api alembic revision --autogenerate -m "description"

# Rollback one migration
docker compose exec api alembic downgrade -1
```

## License

MIT License - see LICENSE file for details.
