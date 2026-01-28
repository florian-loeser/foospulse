#!/bin/bash
# FoosPulse Database Backup Script
# Usage: ./scripts/backup-db.sh [backup_dir]

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/foospulse_$TIMESTAMP.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_FILE"

# Dump database from Docker container
docker compose exec -T postgres pg_dump -U foospulse foospulse | gzip > "$BACKUP_FILE"

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo "Backup created successfully: $BACKUP_FILE ($SIZE)"

    # Keep only last 10 backups
    cd "$BACKUP_DIR"
    ls -t foospulse_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm --
    echo "Cleanup complete. Keeping last 10 backups."
else
    echo "ERROR: Backup failed!"
    exit 1
fi
