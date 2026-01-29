FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (supports both local and monorepo builds)
COPY apps/api/requirements.txt* requirements.txt* ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (supports both local and monorepo builds)
COPY apps/api/app* apps/api/alembic* apps/api/alembic.ini* ./
COPY app* alembic* alembic.ini* ./
RUN rm -f requirements.txt

# Create artifacts directory
RUN mkdir -p /data/artifacts

EXPOSE 8000

# Use PORT env var from Railway, default to 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
