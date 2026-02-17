#!/bin/bash
# Health check for the IVXP Demo Provider.
#
# Usage:
#   ./scripts/health/check-provider.sh [--url URL]
#
# Environment variables:
#   DEMO_PROVIDER_URL - Provider URL (default: http://localhost:3001)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/common.sh"

PROVIDER_URL="${DEMO_PROVIDER_URL:-http://localhost:3001}"
PASSED=0
FAILED=0
WARNINGS=0

for arg in "$@"; do
  case "$arg" in
    --url=*) PROVIDER_URL="${arg#*=}" ;;
    --help|-h)
      echo "Usage: check-provider.sh [--url=URL]"
      exit 0
      ;;
  esac
done

log_info "Checking Provider health: $PROVIDER_URL"
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

# ── Endpoint checks ────────────────────────────────────────────────
check "Health endpoint"  "$PROVIDER_URL/health"
check "Catalog endpoint" "$PROVIDER_URL/ivxp/catalog"

# ── Health response validation ──────────────────────────────────────
HEALTH_BODY=$(curl -s --max-time 10 "$PROVIDER_URL/health" 2>/dev/null || echo "")
if [ -n "$HEALTH_BODY" ]; then
  if ! command -v node >/dev/null 2>&1; then
    log_warn "node not found — skipping JSON validation"
    WARNINGS=$((WARNINGS + 1))
  else
    STATUS_FIELD=$(echo "$HEALTH_BODY" | node -e '
      let d = "";
      process.stdin.on("data", c => d += c);
      process.stdin.on("end", () => {
        try {
          const parsed = JSON.parse(d);
          console.log(parsed.status || "MISSING");
        } catch (err) {
          console.log("PARSE_ERROR");
        }
      });
    ' 2>/dev/null || echo "NODE_ERROR")

    if [ "$STATUS_FIELD" = "ok" ]; then
      log_success "Health status field: ok"
      PASSED=$((PASSED + 1))
    elif [ "$STATUS_FIELD" = "NODE_ERROR" ]; then
      log_warn "Node execution failed — skipping JSON validation"
      WARNINGS=$((WARNINGS + 1))
    else
      log_error "Health status field: $STATUS_FIELD (expected ok)"
      FAILED=$((FAILED + 1))
    fi
  fi
fi

# ── Catalog validation ──────────────────────────────────────────────
CATALOG_BODY=$(curl -s --max-time 10 "$PROVIDER_URL/ivxp/catalog" 2>/dev/null || echo "")
if [ -n "$CATALOG_BODY" ]; then
  if ! command -v node >/dev/null 2>&1; then
    log_warn "node not found — skipping catalog validation"
    WARNINGS=$((WARNINGS + 1))
  else
    SVC_COUNT=$(echo "$CATALOG_BODY" | node -e '
      let d = "";
      process.stdin.on("data", c => d += c);
      process.stdin.on("end", () => {
        try {
          const data = JSON.parse(d);
          const svcs = data.services || data.catalog || [];
          console.log(Array.isArray(svcs) ? svcs.length : 0);
        } catch (err) {
          console.log("0");
        }
      });
    ' 2>/dev/null || echo "0")

    if [ "$SVC_COUNT" -ge 1 ]; then
      log_success "Catalog has $SVC_COUNT service(s)"
      PASSED=$((PASSED + 1))
    else
      log_warn "Catalog has $SVC_COUNT services (expected >= 1)"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
fi

# ── Summary ─────────────────────────────────────────────────────────
echo ""
TOTAL=$((PASSED + FAILED + WARNINGS))
log_info "Results: $PASSED passed, $FAILED failed, $WARNINGS warnings ($TOTAL total)"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
