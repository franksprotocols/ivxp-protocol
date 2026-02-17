#!/bin/bash
# Deploy IVXP Hub to Vercel.
#
# Usage:
#   ./scripts/deploy/deploy-hub.sh [--prod|--preview] [--skip-build]
#
# Environment variables:
#   VERCEL_TOKEN       - Vercel API token (required)
#   VERCEL_ORG_ID      - Vercel organization ID (required)
#   VERCEL_PROJECT_ID  - Vercel project ID (required)
#   DEPLOY_WAIT_TIME   - Seconds to wait before health check (default: 15)
#   DRY_RUN            - Set to 1 to print commands without executing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

PROJECT_ROOT="$(find_project_root)"

# ── Parse arguments ─────────────────────────────────────────────────
ENVIRONMENT="production"
SKIP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --prod|--production) ENVIRONMENT="production" ;;
    --preview)           ENVIRONMENT="preview" ;;
    --skip-build)        SKIP_BUILD=1 ;;
    --help|-h)
      echo "Usage: deploy-hub.sh [--prod|--preview] [--skip-build]"
      echo ""
      echo "Options:"
      echo "  --prod       Deploy to production (default)"
      echo "  --preview    Deploy a preview build"
      echo "  --skip-build Skip local build verification"
      echo ""
      echo "Required env vars: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID"
      exit 0
      ;;
  esac
done

log_info "Deploying IVXP Hub to Vercel ($ENVIRONMENT)"

# ── Prerequisites ───────────────────────────────────────────────────
require_command "vercel" "npm i -g vercel"
require_command "pnpm" "npm i -g pnpm"
require_env_var "VERCEL_TOKEN" "Vercel API token"
require_env_var "VERCEL_ORG_ID" "Vercel organization ID"
require_env_var "VERCEL_PROJECT_ID" "Vercel project ID"

cd "$PROJECT_ROOT"

# ── Build verification ──────────────────────────────────────────────
if [ "$SKIP_BUILD" = "0" ]; then
  log_info "Running build verification..."
  bash "$SCRIPT_DIR/../utils/verify-build.sh" --target=hub
else
  log_warn "Skipping build verification (--skip-build)"
fi

# ── Deploy ──────────────────────────────────────────────────────────
VERCEL_ARGS=("--yes" "--token" "$VERCEL_TOKEN")

if [ "$ENVIRONMENT" = "production" ]; then
  VERCEL_ARGS+=("--prod")
fi

log_info "Deploying to Vercel..."
DEPLOY_OUTPUT=$(run_cmd vercel "${VERCEL_ARGS[@]}" 2>&1)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | tail -1 | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | head -1)

if [ "$DRY_RUN" = "1" ]; then
  DEPLOY_URL="https://dry-run.vercel.app"
fi

if [ -z "$DEPLOY_URL" ]; then
  log_error "Failed to extract deployment URL from Vercel output"
  exit 1
fi

log_info "Deploy URL: $DEPLOY_URL"

# ── Post-deploy health check ───────────────────────────────────────
DEPLOY_WAIT_TIME="${DEPLOY_WAIT_TIME:-15}"
log_info "Waiting ${DEPLOY_WAIT_TIME}s for deployment to propagate..."
sleep "$DEPLOY_WAIT_TIME"

if wait_for_url "$DEPLOY_URL" 10 10; then
  log_success "Hub deployed successfully to $DEPLOY_URL"
else
  log_error "Deployment health check failed — consider rolling back"
  exit 1
fi
