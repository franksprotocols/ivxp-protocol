#!/bin/bash
# Shared utilities for IVXP deployment scripts.
#
# Source this file from other scripts:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/../utils/common.sh"

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────
if [ -t 1 ] && [ "${TERM:-dumb}" != "dumb" ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

# ── Logging helpers ─────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Prerequisite checks ────────────────────────────────────────────
require_command() {
  local cmd="$1"
  local install_hint="${2:-}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "'$cmd' is not installed."
    [ -n "$install_hint" ] && log_error "Install: $install_hint"
    exit 1
  fi
}

require_file() {
  local path="$1"
  local description="${2:-$path}"
  if [ ! -f "$path" ]; then
    log_error "Required file not found: $description ($path)"
    exit 1
  fi
}

require_env_var() {
  local var_name="$1"
  local description="${2:-$var_name}"
  if [ -z "${!var_name:-}" ]; then
    log_error "Required environment variable not set: $description ($var_name)"
    exit 1
  fi
}

# ── HTTP helpers ────────────────────────────────────────────────────
# Returns HTTP status code; "000" on connection failure.
http_status() {
  local url="$1"
  local timeout="${2:-10}"
  curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000"
}

# Retry an HTTP GET until 200 or max retries exhausted.
# Usage: wait_for_url URL [MAX_RETRIES] [DELAY_SECONDS]
wait_for_url() {
  local url="$1"
  local max_retries="${2:-10}"
  local delay="${3:-10}"

  for i in $(seq 1 "$max_retries"); do
    local status
    status=$(http_status "$url")
    if [ "$status" = "200" ]; then
      log_success "Health check passed (attempt $i/$max_retries)"
      return 0
    fi
    log_warn "Attempt $i/$max_retries: HTTP $status — retrying in ${delay}s..."
    sleep "$delay"
  done

  log_error "Health check failed after $max_retries attempts"
  return 1
}

# ── Project root detection ──────────────────────────────────────────
find_project_root() {
  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/pnpm-workspace.yaml" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  log_error "Could not find project root (no pnpm-workspace.yaml found)"
  exit 1
}

# ── Dry-run support ─────────────────────────────────────────────────
# Set DRY_RUN=1 to print commands instead of executing them.
DRY_RUN="${DRY_RUN:-0}"

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    log_info "[DRY RUN] $*"
  else
    "$@"
  fi
}
