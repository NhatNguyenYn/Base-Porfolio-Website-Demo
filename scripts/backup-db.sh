#!/usr/bin/env bash
# PostgreSQL logical backup with a checksum and local retention.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/backup-db.sh
#
# This script only reads the database. It never restores or deletes data. Run it
# from cron/systemd-timer, then copy the files off the host (see
# docs/PRODUCTION_DEPLOYMENT.md).
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/portfolio-$STAMP.dump"

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump not found in PATH" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

# -Fc: compressed custom format, restorable with pg_restore.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$FILE"

# A dump without a checksum cannot be verified before a restore.
sha256sum "$FILE" > "$FILE.sha256"
echo "backup written: $FILE"

# Keep the newest $BACKUP_KEEP dumps, delete older pairs only inside BACKUP_DIR.
find "$BACKUP_DIR" -maxdepth 1 -name 'portfolio-*.dump' -type f -printf '%T@ %p\n' \
  | sort -nr \
  | tail -n +$((BACKUP_KEEP + 1)) \
  | cut -d' ' -f2- \
  | while read -r old; do
      rm -f "$old" "$old.sha256"
      echo "removed old backup: $old"
    done

echo "retention: keeping up to $BACKUP_KEEP dumps in $BACKUP_DIR"
echo "next step: copy the .dump and .sha256 files to off-site storage"
