#!/bin/bash
# Back up the Provider SQLite database.
#
# Usage:
#   ./scripts/db/backup-db.sh [--db-path PATH] [--output-dir DIR]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

PROJECT_ROOT="$(find_project_root)"
DB_PATH="$PROJECT_ROOT/apps/demo-provider/orders.db"
OUTPUT_DIR="$PROJECT_ROOT/backups"

for arg in "$@"; do
  case "$arg" in
    --db-path=*)    DB_PATH="${arg#*=}" ;;
    --output-dir=*) OUTPUT_DIR="${arg#*=}" ;;
    --help|-h)
      echo "Usage: backup-db.sh [--db-path=PATH] [--output-dir=DIR]"
      exit 0
      ;;
  esac
done

require_file "$DB_PATH" "Provider database"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$OUTPUT_DIR/orders_backup_${TIMESTAMP}.db"

mkdir -p "$OUTPUT_DIR"

log_info "Backing up database..."
log_info "  Source: $DB_PATH"
log_info "  Target: $BACKUP_FILE"

# Use SQLite backup API via sqlite3 CLI if available
if command -v sqlite3 >/dev/null 2>&1; then
  run_cmd sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
# Try using node with better-sqlite3 for proper backup
elif command -v node >/dev/null 2>&1 && [ -f "$PROJECT_ROOT/apps/demo-provider/dist/db/index.js" ]; then
  log_info "Using node with better-sqlite3 for backup..."
  DB_PATH="$DB_PATH" BACKUP_FILE="$BACKUP_FILE" run_cmd node -e '
    const Database = require("better-sqlite3");
    const db = new Database(process.env.DB_PATH, { readonly: true });
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.backup(process.env.BACKUP_FILE).then(() => {
      console.log("Backup complete");
      db.close();
    }).catch(err => {
      console.error("Backup failed:", err);
      process.exit(1);
    });
  ' 2>/dev/null || {
    log_warn "Node backup failed, falling back to file copy"
    # Checkpoint WAL before copying
    if [ -f "${DB_PATH}-wal" ]; then
      log_warn "WAL file exists — backup may be inconsistent without proper checkpointing"
    fi
    run_cmd cp "$DB_PATH" "$BACKUP_FILE"
    [ -f "${DB_PATH}-wal" ] && run_cmd cp "${DB_PATH}-wal" "${BACKUP_FILE}-wal"
    [ -f "${DB_PATH}-shm" ] && run_cmd cp "${DB_PATH}-shm" "${BACKUP_FILE}-shm"
  }
else
  # Last resort: direct file copy with warning
  log_warn "Neither sqlite3 CLI nor node available — using direct file copy"
  if [ -f "${DB_PATH}-wal" ]; then
    log_warn "WAL file exists — backup may be inconsistent without proper checkpointing"
  fi
  run_cmd cp "$DB_PATH" "$BACKUP_FILE"
  [ -f "${DB_PATH}-wal" ] && run_cmd cp "${DB_PATH}-wal" "${BACKUP_FILE}-wal"
  [ -f "${DB_PATH}-shm" ] && run_cmd cp "${DB_PATH}-shm" "${BACKUP_FILE}-shm"
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1)
log_success "Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Clean up old backups (keep last 10)
BACKUP_COUNT=$(ls -1 "$OUTPUT_DIR"/orders_backup_*.db 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt 10 ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - 10))
  log_info "Removing $REMOVE_COUNT old backup(s)..."
  ls -1t "$OUTPUT_DIR"/orders_backup_*.db | tail -n "$REMOVE_COUNT" | while read -r old; do
    rm -f "$old" "${old}-wal" "${old}-shm"
  done
fi
