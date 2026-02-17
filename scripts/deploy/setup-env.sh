#!/bin/bash
# Set up environment files for Hub and Provider.
#
# Usage:
#   ./scripts/deploy/setup-env.sh [--env production|staging|development]
#   ./scripts/deploy/setup-env.sh --validate
#
# Creates .env files from .env.example templates, prompting for secrets.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

PROJECT_ROOT="$(find_project_root)"
ENVIRONMENT="production"
VALIDATE_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --env=*)       ENVIRONMENT="${arg#*=}" ;;
    --validate)    VALIDATE_ONLY=1 ;;
    --help|-h)
      echo "Usage: setup-env.sh [--env=production|staging|development] [--validate]"
      echo ""
      echo "Options:"
      echo "  --env=ENV    Target environment (default: production)"
      echo "  --validate   Only validate existing env files, don't create"
      exit 0
      ;;
  esac
done

# ── Required variables per component ────────────────────────────────
HUB_REQUIRED_VARS=(
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
  "NEXT_PUBLIC_DEMO_PROVIDER_URL"
)

PROVIDER_REQUIRED_VARS=(
  "PORT"
  "PROVIDER_PRIVATE_KEY"
  "NETWORK"
  "NODE_ENV"
)

# ── Validation mode ─────────────────────────────────────────────────
validate_env_file() {
  local file="$1"
  shift
  local required_vars=("$@")
  local missing=0

  if [ ! -f "$file" ]; then
    log_error "File not found: $file"
    return 1
  fi

  for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" "$file" 2>/dev/null; then
      log_error "Missing variable '$var' in $file"
      missing=$((missing + 1))
    else
      # Check if variable has a value (not empty)
      VALUE=$(grep "^${var}=" "$file" | cut -d= -f2- | tr -d '"' | tr -d "'")
      if [ -z "$VALUE" ]; then
        log_error "Variable '$var' is empty in $file"
        missing=$((missing + 1))
      fi
    fi
  done

  # Check for placeholder values (more comprehensive patterns)
  if grep -qE '=(your_|REPLACE_|CHANGE_|TODO|FIXME|xxx|example\.com)' "$file" 2>/dev/null; then
    log_warn "Placeholder values detected in $file — replace before deploying"
  fi

  # Check for obviously fake private keys (all zeros or sequential)
  if grep -qE '=0x0{40,}|=0x1{40,}|=0x123456' "$file" 2>/dev/null; then
    log_warn "Placeholder private key detected in $file — replace with real key"
  fi

  if [ "$missing" -gt 0 ]; then
    return 1
  fi
  log_success "All required variables present in $file"
  return 0
}

if [ "$VALIDATE_ONLY" = "1" ]; then
  log_info "Validating environment files..."
  ERRORS=0

  HUB_ENV="$PROJECT_ROOT/apps/hub/.env.local"
  if [ -f "$HUB_ENV" ]; then
    validate_env_file "$HUB_ENV" "${HUB_REQUIRED_VARS[@]}" || ERRORS=$((ERRORS + 1))
  else
    log_warn "Hub env file not found at $HUB_ENV"
    ERRORS=$((ERRORS + 1))
  fi

  PROVIDER_ENV="$PROJECT_ROOT/apps/demo-provider/.env"
  if [ -f "$PROVIDER_ENV" ]; then
    validate_env_file "$PROVIDER_ENV" "${PROVIDER_REQUIRED_VARS[@]}" || ERRORS=$((ERRORS + 1))
  else
    log_warn "Provider env file not found at $PROVIDER_ENV"
    ERRORS=$((ERRORS + 1))
  fi

  if [ "$ERRORS" -gt 0 ]; then
    log_error "Validation failed with $ERRORS error(s)"
    exit 1
  fi
  log_success "All environment files valid"
  exit 0
fi

# ── Interactive setup ───────────────────────────────────────────────
log_info "Setting up environment: $ENVIRONMENT"

# Hub env
HUB_EXAMPLE="$PROJECT_ROOT/apps/hub/.env.example"
HUB_TARGET="$PROJECT_ROOT/apps/hub/.env.local"

if [ -f "$HUB_TARGET" ]; then
  log_warn "Hub env file already exists at $HUB_TARGET"
  read -rp "Overwrite? [y/N] " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    log_info "Skipping Hub env setup"
  else
    cp "$HUB_EXAMPLE" "$HUB_TARGET"
    log_success "Hub env file created from template"
  fi
else
  require_file "$HUB_EXAMPLE" "Hub .env.example"
  cp "$HUB_EXAMPLE" "$HUB_TARGET"
  log_success "Hub env file created at $HUB_TARGET"
fi

# Provider env
PROVIDER_EXAMPLE="$PROJECT_ROOT/apps/demo-provider/.env.example"
PROVIDER_TARGET="$PROJECT_ROOT/apps/demo-provider/.env"

if [ -f "$PROVIDER_TARGET" ]; then
  log_warn "Provider env file already exists at $PROVIDER_TARGET"
  read -rp "Overwrite? [y/N] " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    log_info "Skipping Provider env setup"
  else
    cp "$PROVIDER_EXAMPLE" "$PROVIDER_TARGET"
    log_success "Provider env file created from template"
  fi
else
  require_file "$PROVIDER_EXAMPLE" "Provider .env.example"
  cp "$PROVIDER_EXAMPLE" "$PROVIDER_TARGET"
  log_success "Provider env file created at $PROVIDER_TARGET"
fi

echo ""
log_info "Edit the following files with your actual values:"
log_info "  Hub:      $HUB_TARGET"
log_info "  Provider: $PROVIDER_TARGET"
log_warn "Never commit real secrets to version control."
