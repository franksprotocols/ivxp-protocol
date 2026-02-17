#!/bin/bash
# Health check for the IVXP Hub (Vercel).
#
# Usage:
#   ./scripts/health/check-hub.sh [--url URL]
#
# Environment variables:
#   HUB_URL - Hub URL (default: http://localhost:3000)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

HUB_URL="${HUB_URL:-http://localhost:3000}"
PASSED=0
FAILED=0

for arg in "$@"; do
  case "$arg" in
    --url=*) HUB_URL="${arg#*=}" ;;
    --help|-h)
      echo "Usage: check-hub.sh [--url=URL]"
      exit 0
      ;;
  esac
done

log_info "Checking Hub health: $HUB_URL"
echo ""

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"
  local status
  status=$(http_status "$url")

  if [ "$status" = "$expected" ]; then
    log_success "$name -> HTTP $status"
    PASSED=$((PASSED + 1))
  else
    log_error "$name -> HTTP $status (expected $expected)"
    FAILED=$((FAILED + 1))
  fi
}

# ── Checks ──────────────────────────────────────────────────────────
check "Homepage"         "$HUB_URL"
check "Playground page"  "$HUB_URL/playground"
check "Marketplace page" "$HUB_URL/marketplace"

# Check that the page returns HTML
CONTENT_TYPE=$(curl -s -o /dev/null -w "%{content_type}" --max-time 10 "$HUB_URL" 2>/dev/null || echo "")
if echo "$CONTENT_TYPE" | grep -q "text/html"; then
  log_success "Content-Type is text/html"
  PASSED=$((PASSED + 1))
else
  log_error "Unexpected Content-Type: $CONTENT_TYPE"
  FAILED=$((FAILED + 1))
fi

# ── Summary ─────────────────────────────────────────────────────────
echo ""
TOTAL=$((PASSED + FAILED))
log_info "Results: $PASSED passed, $FAILED failed ($TOTAL total)"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
