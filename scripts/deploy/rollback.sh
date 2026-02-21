#!/bin/bash
# Roll back a Vercel or Railway deployment.
#
# Usage:
#   ./scripts/deploy/rollback.sh --target hub|provider [--deployment-id ID] [--service NAME]
#
# For Vercel (Hub): promotes the previous production deployment.
# For Railway (Provider): redeploys the previous successful deployment.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

TARGET=""
DEPLOYMENT_ID=""
RAILWAY_SERVICE="${RAILWAY_SERVICE:-demo-provider}"

for arg in "$@"; do
  case "$arg" in
    --target=*)        TARGET="${arg#*=}" ;;
    --deployment-id=*) DEPLOYMENT_ID="${arg#*=}" ;;
    --service=*)       RAILWAY_SERVICE="${arg#*=}" ;;
    --help|-h)
      echo "Usage: rollback.sh --target=hub|provider [--deployment-id=ID] [--service=NAME]"
      echo ""
      echo "Options:"
      echo "  --target=TARGET          hub or provider (required)"
      echo "  --deployment-id=ID       Specific deployment to roll back to"
      echo "  --service=NAME           Railway service name for provider rollback (default: demo-provider)"
      exit 0
      ;;
  esac
done

if [ -z "$TARGET" ]; then
  log_error "Missing --target (hub or provider)"
  exit 1
fi

# Prefer global CLI; fall back to temporary CLI to avoid hard dependency.
VERCEL_CMD=("vercel")
resolve_vercel_cmd() {
  if command -v vercel >/dev/null 2>&1; then
    VERCEL_CMD=("vercel")
  else
    require_command "pnpm" "npm i -g pnpm"
    log_warn "'vercel' not found globally, using pnpm dlx vercel@latest (engine-strict disabled for this command)"
    VERCEL_CMD=("env" "npm_config_engine_strict=false" "pnpm" "dlx" "vercel@latest")
  fi
}

# ── Hub rollback (Vercel) ───────────────────────────────────────────
rollback_hub() {
  resolve_vercel_cmd
  require_env_var "VERCEL_TOKEN" "Vercel API token"

  log_info "Rolling back Hub deployment on Vercel..."

  if [ -n "$DEPLOYMENT_ID" ]; then
    log_info "Promoting deployment: $DEPLOYMENT_ID"
    run_cmd "${VERCEL_CMD[@]}" promote "$DEPLOYMENT_ID" --token "$VERCEL_TOKEN" --yes
  else
    log_info "Listing recent deployments..."
    if [ "$DRY_RUN" = "1" ]; then
      run_cmd "${VERCEL_CMD[@]}" ls --token "$VERCEL_TOKEN"
    else
      "${VERCEL_CMD[@]}" ls --token "$VERCEL_TOKEN" 2>&1 | head -10
    fi

    log_info "Rolling back to previous production deployment..."
    # For global CLI this resolves to: vercel rollback --token "$VERCEL_TOKEN" --yes
    run_cmd "${VERCEL_CMD[@]}" rollback --token "$VERCEL_TOKEN" --yes
  fi

  log_success "Hub rollback initiated"

  # Verify rollback
  if [ -n "${HUB_URL:-}" ]; then
    log_info "Waiting 15s for rollback to propagate..."
    sleep 15
    if bash "$SCRIPT_DIR/../health/check-hub.sh" --url="$HUB_URL"; then
      log_success "Hub rollback verified — health check passed"
    else
      log_error "Hub rollback verification failed — check deployment status"
      exit 1
    fi
  else
    log_warn "HUB_URL not set — skipping rollback verification"
  fi
}

# ── Provider rollback (Railway) ─────────────────────────────────────
rollback_provider() {
  require_command "railway" "npm i -g @railway/cli"

  log_info "Rolling back Provider deployment on Railway..."
  log_info "Using Railway service: $RAILWAY_SERVICE"

  if [ -n "$DEPLOYMENT_ID" ]; then
    log_info "Redeploying from: $DEPLOYMENT_ID"
    run_cmd railway redeploy --deployment "$DEPLOYMENT_ID" --service "$RAILWAY_SERVICE" --yes
  else
    log_info "Listing recent deployments..."
    railway status --service "$RAILWAY_SERVICE" 2>&1 || true

    log_info "Triggering redeploy of previous version..."
    run_cmd railway redeploy --service "$RAILWAY_SERVICE" --yes
  fi

  log_success "Provider rollback initiated"

  # Verify rollback
  if [ -n "${PROVIDER_URL:-}" ]; then
    log_info "Waiting 30s for rollback to stabilize..."
    sleep 30
    if bash "$SCRIPT_DIR/../health/check-provider.sh" --url="$PROVIDER_URL"; then
      log_success "Provider rollback verified — health check passed"
    else
      log_error "Provider rollback verification failed — check deployment status"
      exit 1
    fi
  else
    log_warn "PROVIDER_URL not set — skipping rollback verification"
  fi
}

# ── Dispatch ────────────────────────────────────────────────────────
case "$TARGET" in
  hub)      rollback_hub ;;
  provider) rollback_provider ;;
  *)
    log_error "Unknown target: $TARGET (use hub or provider)"
    exit 1
    ;;
esac
