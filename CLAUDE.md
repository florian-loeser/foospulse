# CLAUDE.md - FoosPulse Repository Rules

## Overview

FoosPulse is a foosball league management system with deterministic statistics and reproducible artifacts. This document defines development guidelines and quality standards.

## Tech Stack

- **Frontend**: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Backend**: FastAPI, SQLAlchemy 2.0, Alembic migrations
- **Worker**: Celery with Redis broker
- **Database**: PostgreSQL 16
- **Container**: Docker Compose

## Code Style

### Python (API/Worker)

- Use type hints for all function parameters and returns
- Follow PEP 8 with 100-character line limit
- Use `async`/`await` for database operations
- Structured logging with `structlog`
- Tests with `pytest` and `pytest-asyncio`

### TypeScript (Web)

- Strict mode enabled
- Use `interface` for object types, `type` for unions/intersections
- Prefer named exports
- Server components by default, `"use client"` only when needed

### SQL/Migrations

- All table names lowercase, snake_case
- UUIDs for primary keys (except audit logs)
- `created_at` and `updated_at` on mutable tables
- Alembic for all schema changes

## Definition of Done

A backlog item is "Done" only when:

1. **Functionality**: Feature works end-to-end via Docker Compose
2. **Database**: Migrations applied and reversible (`alembic upgrade head` and `alembic downgrade -1` both work)
3. **API**: Request validation and meaningful error codes (4xx for client errors, 5xx for server errors)
4. **UI**: Functional route with loading states and error handling
5. **Tests**: Smoke tests updated and passing
6. **Health**: `/api/health` returns OK with all dependencies
7. **Worker**: No orphan tasks, idempotency preserved
8. **Docs**: README or CLAUDE.md updated if needed

## API Response Format

### Success
```json
{
  "data": { ... },
  "error": null
}
```

### Error
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

## Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request payload |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## File Organization

### API Routes

```
apps/api/app/
├── routes/           # FastAPI routers
│   ├── auth.py
│   ├── leagues.py
│   ├── players.py
│   ├── matches.py
│   ├── stats.py
│   └── artifacts.py
├── models/           # SQLAlchemy models
├── schemas/          # Pydantic schemas
├── services/         # Business logic
├── security/         # Auth utilities
└── tests/            # Pytest tests
```

### Web Routes

```
apps/web/app/
├── auth/
│   ├── login/
│   └── register/
├── leagues/
├── league/
│   └── [leagueSlug]/
│       ├── log/
│       ├── leaderboards/
│       ├── players/
│       ├── matches/
│       └── artifacts/
└── settings/
```

## Deterministic Computation Rules

All stats must be reproducible from match history:

1. **Elo Rating**: K-factor 32, initial rating 1200
2. **Stats Ordering**: Sort by rating DESC, then by player_id ASC
3. **Hash Computation**: SHA256 over sorted match IDs + timestamps
4. **Artifact Files**: Stable column ordering, sorted rows

## Worker Task Idempotency

Tasks must be safe to retry:

1. Check if work already done (e.g., snapshot exists)
2. Use database transactions for atomic updates
3. Store `source_hash` to detect unchanged data
4. Log task start/complete with unique identifiers

## Security Guidelines

1. **Auth**: JWT tokens in dev, configurable for prod
2. **RBAC**: Check membership before any league-scoped operation
3. **Downloads**: Only serve files listed in artifact manifest
4. **Input**: Validate and sanitize all user input
5. **Paths**: Prevent directory traversal in file operations

## Environment Variables

Required in `.env`:

```bash
# Database
DATABASE_URL=postgresql+psycopg://foospulse:foospulse@postgres:5432/foospulse

# Redis
REDIS_URL=redis://redis:6379/0

# Security
JWT_SECRET=<generate-random-32-chars>

# Artifacts
ARTIFACTS_DIR=/data/artifacts

# LLM (default off)
LLM_MODE=off
```

## Autopilot Scripts

Located in `scripts/`:

| Script | Purpose |
|--------|---------|
| `select-next.py` | Find next available backlog item |
| `render-prompt.py` | Generate ticket from backlog item |
| `mark-done.py` | Move item to done state |
| `run-next.sh` | Orchestrate select + render |

## Backlog State Format

`BACKLOG_STATE.json`:
```json
{
  "in_progress": ["APP-0001"],
  "done": []
}
```

## Git Workflow

1. Main branch is `main`
2. Feature branches: `feature/APP-XXXX-short-description`
3. Commit messages: `[APP-XXXX] Description`
4. Run tests before committing

## Common Commands

```bash
# Start all services
docker compose up --build

# Run migrations
docker compose exec api alembic upgrade head

# Run API tests
docker compose exec api pytest -v

# Seed demo data
docker compose exec api python -m app.cli seed_demo

# Generate artifact
curl -X POST http://localhost:8100/api/leagues/office-champions/artifacts/league-report \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"season_id": "<uuid>"}'

# Check backlog status
./foospulse status
```
