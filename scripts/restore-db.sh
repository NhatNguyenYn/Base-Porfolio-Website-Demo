#!/usr/bin/env bash
# Guarded PostgreSQL restore. Refuses to run unless the operator confirms.
#
# Usage:
#   CONFIRM_RESTORE=yes DATABASE_URL="postgresql://..." \
#     ./scripts/restore-db.sh ./backups/portfolio-20260101T000000Z.dump
#
# --clean --if-exists drops and recreates objects in the TARGET database only.
# Take a fresh backup of the target first; there is no undo for a restore.
set -euo pipefail

FILE="${1:?usage: restore-db.sh <path-to.dump>}"
: "${DATABASE_URL:?DATABASE_URL is required}"

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Refusing to restore: set CONFIRM_RESTORE=yes after verifying the target database." >&2
  exit 1
fi

command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore not found in PATH" >&2; exit 1; }
[ -f "$FILE" ] || { echo "dump not found: $FILE" >&2; exit 1; }

if [ -f "$FILE.sha256" ]; then
  # Verify the dump is the one that was taken, not a truncated copy.
  (cd "$(dirname "$FILE")" && sha256sum --check "$(basename "$FILE").sha256")
else
  echo "warning: no .sha256 file next to $FILE; integrity is unverified" >&2
fi

echo "restoring into the database in DATABASE_URL ..."
pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$FILE"
echo "restore finished"
echo "verify: npm run db:deploy (migrations) then GET /api/ready and open /vi"
