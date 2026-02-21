#!/bin/bash
# Sync provider runtime variables from a local env file to Railway service variables.
#
# Usage:
#   ./scripts/deploy/sync-provider-env.sh [--env-file=PATH] [--service=NAME]
#
# Environment variables:
#   RAILWAY_SERVICE   - Railway service name (default: demo-provider)
#   PROVIDER_ENV_FILE - Provider env file path (default: apps/demo-provider/.env.production)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

PROJECT_ROOT="$(find_project_root)"
RAILWAY_SERVICE="${RAILWAY_SERVICE:-demo-provider}"
PROVIDER_ENV_FILE="${PROVIDER_ENV_FILE:-$PROJECT_ROOT/apps/demo-provider/.env.production}"

for arg in "$@"; do
  case "$arg" in
    --service=*) RAILWAY_SERVICE="${arg#*=}" ;;
    --env-file=*) PROVIDER_ENV_FILE="${arg#*=}" ;;
    --help|-h)
      echo "Usage: sync-provider-env.sh [--env-file=PATH] [--service=NAME]"
      echo ""
      echo "Options:"
      echo "  --env-file=PATH  Provider env file path (default: apps/demo-provider/.env.production)"
      echo "  --service=NAME   Railway service name (default: demo-provider)"
      exit 0
      ;;
  esac
done

require_command "railway" "npm i -g @railway/cli"
require_file "$PROVIDER_ENV_FILE" "Provider environment file"

log_info "Syncing provider environment to Railway service: $RAILWAY_SERVICE"
log_info "Reading env file: $PROVIDER_ENV_FILE"

# Parse dotenv-style file without sourcing shell code.
# Supports:
#   KEY=value
#   export KEY=value
#   KEY="value with spaces"
#   KEY='value with spaces'
load_env_file() {
  local env_file="$1"
  local line key value

  while IFS= read -r line || [ -n "$line" ]; do
    # Trim carriage return for CRLF files
    line="${line%$'\r'}"

    # Skip blank lines and comments
    case "$line" in
      "" | [[:space:]]*"#") continue ;;
    esac

    # Remove optional leading "export "
    line="${line#export }"

    # Must be KEY=VALUE
    if [[ "$line" != *=* ]]; then
      continue
    fi

    key="${line%%=*}"
    value="${line#*=}"

    # Trim whitespace around key
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"

    # Trim leading/trailing whitespace for value
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    # Strip matching surrounding quotes
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value#\"}"
      value="${value%\"}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value#\'}"
      value="${value%\'}"
    fi

    if [[ ! "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
      continue
    fi

    printf -v "$key" '%s' "$value"
  done < "$env_file"
}

load_env_file "$PROVIDER_ENV_FILE"

REQUIRED_VARS=(
  "PORT"
  "PROVIDER_PRIVATE_KEY"
  "NETWORK"
  "NODE_ENV"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    log_error "Missing required variable in env file: $var"
    exit 1
  fi
done

if ! echo "${PROVIDER_PRIVATE_KEY}" | grep -Eq '^0x[0-9a-fA-F]{64}$'; then
  log_error "PROVIDER_PRIVATE_KEY must be a 0x-prefixed 64-character hex string (32 bytes)"
  exit 1
fi

# Set secret via stdin to avoid exposing value in process args/history.
if [ "$DRY_RUN" = "1" ]; then
  log_info "[DRY RUN] railway variable set --service $RAILWAY_SERVICE --stdin PROVIDER_PRIVATE_KEY --skip-deploys"
else
  printf '%s' "$PROVIDER_PRIVATE_KEY" | railway variable set \
    --service "$RAILWAY_SERVICE" \
    --stdin \
    PROVIDER_PRIVATE_KEY \
    --skip-deploys
fi

VARIABLES_TO_SYNC=(
  "PORT"
  "NETWORK"
  "NODE_ENV"
  "PROVIDER_NAME"
  "CORS_ALLOWED_ORIGINS"
  "LOG_LEVEL"
  "RATE_LIMIT_MAX"
  "RATE_LIMIT_WINDOW_MS"
  "DB_PATH"
  "ORDER_TTL_SECONDS"
)

for key in "${VARIABLES_TO_SYNC[@]}"; do
  value="${!key:-}"
  if [ -n "$value" ]; then
    if [ "$DRY_RUN" = "1" ]; then
      log_info "[DRY RUN] railway variable set --service $RAILWAY_SERVICE ${key}=*** --skip-deploys"
    else
      railway variable set --service "$RAILWAY_SERVICE" "${key}=${value}" --skip-deploys
    fi
  fi
done

log_success "Railway variables synced from $PROVIDER_ENV_FILE"
