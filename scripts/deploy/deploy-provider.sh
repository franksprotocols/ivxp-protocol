#!/bin/bash
# Deploy IVXP Demo Provider to Railway.
#
# Usage:
#   ./scripts/deploy/deploy-provider.sh [--skip-build] [--skip-migrate] [--service NAME] [--env-file PATH]
#
# Environment variables:
#   RAILWAY_TOKEN    - Railway API token (required)
#   RAILWAY_SERVICE  - Railway service name (default: demo-provider)
#   PROVIDER_ENV_FILE - Provider env file path for variable sync (optional)
#   DEPLOY_WAIT_TIME - Seconds to wait before health check (default: 30)
#   DRY_RUN          - Set to 1 for dry-run mode

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

PROJECT_ROOT="$(find_project_root)"

SKIP_BUILD=0
SKIP_MIGRATE=0
RAILWAY_SERVICE="${RAILWAY_SERVICE:-demo-provider}"
PROVIDER_ENV_FILE="${PROVIDER_ENV_FILE:-}"

for arg in "$@"; do
  case "$arg" in
    --skip-build)   SKIP_BUILD=1 ;;
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --service=*)    RAILWAY_SERVICE="${arg#*=}" ;;
    --env-file=*)   PROVIDER_ENV_FILE="${arg#*=}" ;;
    --help|-h)
      echo "Usage: deploy-provider.sh [--skip-build] [--skip-migrate] [--service=NAME] [--env-file=PATH]"
      echo ""
      echo "Options:"
      echo "  --skip-build    Skip local build verification"
      echo "  --skip-migrate  Skip database migration step"
      echo "  --service=NAME  Railway service name (default: demo-provider)"
      echo "  --env-file=PATH Sync provider variables from env file before deploy"
      echo ""
      echo "Required env vars: RAILWAY_TOKEN"
      echo "Optional env vars: RAILWAY_SERVICE, PROVIDER_ENV_FILE, DEPLOY_WAIT_TIME, PROVIDER_URL, DRY_RUN"
      exit 0
      ;;
  esac
done

log_info "Deploying IVXP Demo Provider to Railway"
log_info "Using Railway service: $RAILWAY_SERVICE"

# ── Prerequisites ───────────────────────────────────────────────────
require_command "railway" "npm i -g @railway/cli"
require_env_var "RAILWAY_TOKEN" "Railway API token"

cd "$PROJECT_ROOT"

# ── Optional env sync ───────────────────────────────────────────────
if [ -n "$PROVIDER_ENV_FILE" ]; then
  log_info "Syncing Railway variables from env file: $PROVIDER_ENV_FILE"
  run_cmd bash "$SCRIPT_DIR/sync-provider-env.sh" "--env-file=$PROVIDER_ENV_FILE" "--service=$RAILWAY_SERVICE"
fi

# ── Build verification ──────────────────────────────────────────────
if [ "$SKIP_BUILD" = "0" ]; then
  log_info "Running build verification..."
  bash "$SCRIPT_DIR/../utils/verify-build.sh" --target=provider
else
  log_warn "Skipping build verification (--skip-build)"
fi

# ── Deploy to Railway ───────────────────────────────────────────────
log_info "Deploying to Railway..."
if [ "$DRY_RUN" = "1" ]; then
  run_cmd railway up --service "$RAILWAY_SERVICE"
else
  set +e
  RAILWAY_DEPLOY_OUTPUT=$(railway up --service "$RAILWAY_SERVICE" 2>&1)
  RAILWAY_DEPLOY_STATUS=$?
  set -e

  echo "$RAILWAY_DEPLOY_OUTPUT"

  if [ "$RAILWAY_DEPLOY_STATUS" -ne 0 ]; then
    if echo "$RAILWAY_DEPLOY_OUTPUT" | grep -qi "Service not found"; then
      log_error "Railway service '$RAILWAY_SERVICE' was not found in the linked project."
      log_info "List services: railway service status"
      log_info "Link service: railway service link <service-name>"
      log_info "Retry with --service=<service-name> or RAILWAY_SERVICE=<service-name>"
    fi
    exit "$RAILWAY_DEPLOY_STATUS"
  fi
fi

# ── Database migration ──────────────────────────────────────────────
if [ "$SKIP_MIGRATE" = "0" ]; then
  log_info "Running database initialization..."
  run_cmd bash "$SCRIPT_DIR/../db/init-provider-db.sh" --remote "--service=$RAILWAY_SERVICE"
else
  log_warn "Skipping database migration (--skip-migrate)"
fi

# ── Post-deploy health check ───────────────────────────────────────
DEPLOY_WAIT_TIME="${DEPLOY_WAIT_TIME:-30}"
log_info "Waiting ${DEPLOY_WAIT_TIME}s for deployment to stabilize..."
sleep "$DEPLOY_WAIT_TIME"

PROVIDER_URL="${PROVIDER_URL:-}"
if [ -z "$PROVIDER_URL" ]; then
  log_info "Fetching provider URL from Railway..."
  RAILWAY_OUTPUT=$(railway status --service "$RAILWAY_SERVICE" 2>&1 || echo "")
  PROVIDER_URL=$(echo "$RAILWAY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.railway\.app' | head -1)
fi

if [ -n "$PROVIDER_URL" ]; then
  if wait_for_url "$PROVIDER_URL/health" 10 10; then
    log_success "Provider deployed successfully to $PROVIDER_URL"
  else
    log_error "Provider health check failed — consider rolling back"
    exit 1
  fi
else
  log_warn "Could not determine provider URL — run health check manually"
fi
