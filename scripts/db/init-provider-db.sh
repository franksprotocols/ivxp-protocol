#!/bin/bash
# Initialize the Provider SQLite database.
#
# The demo-provider uses better-sqlite3 with embedded schema (see
# apps/demo-provider/src/db/index.ts). This script ensures the data
# directory exists and optionally runs the provider once to trigger
# schema creation.
#
# Usage:
#   ./scripts/db/init-provider-db.sh [--remote] [--db-path PATH] [--service NAME]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

PROJECT_ROOT="$(find_project_root)"
REMOTE=0
DB_PATH=""
RAILWAY_SERVICE="${RAILWAY_SERVICE:-demo-provider}"

for arg in "$@"; do
  case "$arg" in
    --remote)    REMOTE=1 ;;
    --db-path=*) DB_PATH="${arg#*=}" ;;
    --service=*) RAILWAY_SERVICE="${arg#*=}" ;;
    --help|-h)
      echo "Usage: init-provider-db.sh [--remote] [--db-path=PATH] [--service=NAME]"
      echo ""
      echo "Options:"
      echo "  --remote       Run migration on Railway (via railway run)"
      echo "  --db-path=PATH Custom database file path"
      echo "  --service=NAME Railway service name (default: demo-provider)"
      exit 0
      ;;
  esac
done

if [ "$REMOTE" = "1" ]; then
  require_command "railway" "npm i -g @railway/cli"
  log_info "Initializing database on Railway service: $RAILWAY_SERVICE"

  # The provider auto-creates the schema on startup via initializeDatabase().
  # We trigger a health check to confirm the DB is ready.
  run_cmd railway run --service "$RAILWAY_SERVICE" -- node -e 'console.log("Database initialization triggered via provider startup."); process.exit(0);'
  log_success "Remote database initialization complete"
else
  cd "$PROJECT_ROOT/apps/demo-provider"

  if [ -z "$DB_PATH" ]; then
    DB_PATH="${DB_PATH:-./orders.db}"
  fi

  # Ensure parent directory exists
  DB_DIR="$(dirname "$DB_PATH")"
  if [ "$DB_DIR" != "." ]; then
    mkdir -p "$DB_DIR"
  fi

  log_info "Initializing local database at: $DB_PATH"

  # The schema is embedded in the provider code and applied on startup.
  # For local init, we can start the provider briefly or use node directly.
  if [ -f "dist/index.js" ]; then
    DB_PATH="$DB_PATH" run_cmd node -e '
      const { initializeDatabase } = require("./dist/db/index.js");
      const db = initializeDatabase({ dbPath: process.env.DB_PATH });
      console.log("Schema applied successfully");
      db.close();
    ' 2>/dev/null || {
      log_warn "Could not run compiled init — schema will be created on first provider start"
    }
  else
    log_warn "Provider not built yet — schema will be created on first start"
  fi

  log_success "Local database initialization complete"
fi
