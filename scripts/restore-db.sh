#!/bin/bash
# FoosPulse Database Restore Script
# Usage: ./scripts/restore-db.sh <backup_file>

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/foospulse_*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will REPLACE all data in the database!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Stopping API and worker..."
docker compose stop api worker

echo "Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U foospulse -d foospulse

echo "Restarting services..."
docker compose start api worker

echo "Restore complete!"
