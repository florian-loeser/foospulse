# Deploying FoosPulse to Railway

This guide covers deploying FoosPulse to Railway with PostgreSQL and Redis.

## Prerequisites

- A Railway account (https://railway.app)
- The Railway CLI installed (`npm install -g @railway/cli`)

## Architecture

FoosPulse consists of 4 services:
- **web** - Next.js frontend
- **api** - FastAPI backend
- **worker** - Celery background worker
- **postgres** - PostgreSQL database
- **redis** - Redis for caching and Celery broker

## Step 1: Create Railway Project

```bash
railway login
railway init
```

## Step 2: Add PostgreSQL and Redis

In the Railway dashboard:
1. Click "New" → "Database" → "PostgreSQL"
2. Click "New" → "Database" → "Redis"

## Step 3: Deploy Services

### API Service

1. Create a new service from your GitHub repo
2. Set root directory: `apps/api`
3. Add environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (use Railway reference) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (use Railway reference) |
| `JWT_SECRET` | Generate with `openssl rand -base64 32` |
| `API_CORS_ORIGINS` | Your web service URL (e.g., `https://foospulse-web.up.railway.app`) |
| `API_DEBUG` | `false` |
| `JSON_LOGS` | `true` |

### Worker Service

1. Create a new service from your GitHub repo
2. Set root directory: `apps/worker`
3. Add environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `CELERY_BROKER_URL` | `${{Redis.REDIS_URL}}` |
| `CELERY_RESULT_BACKEND` | `${{Redis.REDIS_URL}}` |

### Web Service

1. Create a new service from your GitHub repo
2. Set root directory: `apps/web`
3. **Important**: Set build-time variable (not runtime):

| Variable | Value | Type |
|----------|-------|------|
| `NEXT_PUBLIC_API_URL` | Your API service URL (e.g., `https://foospulse-api.up.railway.app`) | **Build variable** |

> Note: `NEXT_PUBLIC_*` variables are baked in at build time in Next.js. Set this in Railway's "Variables" tab with the "Build" scope.

## Step 4: Run Database Migrations

After the API deploys, run migrations:

```bash
railway run -s api alembic upgrade head
```

Or use Railway's shell:
1. Go to API service → "Settings" → "Shell"
2. Run: `alembic upgrade head`

## Step 5: Validate Production Configuration

Before going live, validate your configuration:

```bash
railway run -s api python -m app.cli validate
```

This checks:
- JWT secret is properly set (not the default)
- Debug mode is disabled
- CORS origins are configured

You can also check database connectivity:
```bash
railway run -s api python -m app.cli check_db
```

## Step 5: Configure Custom Domain (Optional)

1. Go to each service → "Settings" → "Networking"
2. Add your custom domain
3. Update `API_CORS_ORIGINS` to include your custom domain

## Environment Variables Reference

### API Service
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=your-secure-secret-here
API_CORS_ORIGINS=https://your-web-domain.com
API_DEBUG=false
JSON_LOGS=true
LOG_LEVEL=INFO
ARTIFACTS_DIR=/data/artifacts
```

### Worker Service
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
CELERY_BROKER_URL=${{Redis.REDIS_URL}}
CELERY_RESULT_BACKEND=${{Redis.REDIS_URL}}
```

### Web Service (Build Variable)
```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

## Troubleshooting

### API returns CORS errors
Ensure `API_CORS_ORIGINS` includes your web frontend URL. Multiple origins can be comma-separated.

### "Failed to connect to server" in browser
1. Check that `NEXT_PUBLIC_API_URL` was set before the build
2. Redeploy the web service if you changed the variable after initial deploy

### Database connection errors
Ensure `DATABASE_URL` uses the Railway reference syntax `${{Postgres.DATABASE_URL}}` which auto-resolves to the internal connection string.

### Migrations not running
Railway doesn't auto-run migrations. Either:
- Use `railway run -s api alembic upgrade head`
- Add a startup script that runs migrations
- Run manually via Railway shell

## Persistent Storage

Railway provides ephemeral storage. For artifact storage:
1. Use Railway Volumes for persistent storage, or
2. Configure S3/Cloud Storage for artifacts

## Monitoring

- View logs: Railway dashboard → Service → "Logs"
- Health check: `https://your-api.up.railway.app/api/health`

## Security Notes

### Critical Environment Variables

| Variable | Requirement |
|----------|-------------|
| `JWT_SECRET` | **MUST** be a random 32+ character string. Generate with `openssl rand -base64 32` |
| `API_DEBUG` | **MUST** be `false` in production |
| `API_CORS_ORIGINS` | **MUST** match your production frontend URL |

### Demo Data

The `seed_demo` CLI command creates a demo user with a weak password. This is blocked in production mode (`API_DEBUG=false`) to prevent accidental security vulnerabilities.

If you need to test in production:
1. Create a real user account via the registration page
2. Or temporarily enable debug mode (not recommended)

### Authentication

- User passwords are hashed with bcrypt
- JWT tokens expire after 7 days
- Tokens are stored in browser localStorage

## CLI Commands

Available commands for the API service:

```bash
# Check database connection and migration status
python -m app.cli check_db

# Validate configuration for production
python -m app.cli validate

# Seed demo data (development only)
python -m app.cli seed_demo
```
