#!/bin/bash
# Monitor deployment status for Hub and/or Provider.
#
# Runs health checks in a loop, reporting status at each interval.
# Usage:
#   ./scripts/utils/monitor-deployment.sh [--target hub|provider|all]
#                                         [--interval SECONDS]
#                                         [--count N]
#
# Environment variables:
#   HUB_URL            - Hub URL (default: http://localhost:3000)
#   DEMO_PROVIDER_URL  - Provider URL (default: http://localhost:3001)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

TARGET="all"
INTERVAL=30
COUNT=0  # 0 = infinite

for arg in "$@"; do
  case "$arg" in
    --target=*)   TARGET="${arg#*=}" ;;
    --interval=*) INTERVAL="${arg#*=}" ;;
    --count=*)    COUNT="${arg#*=}" ;;
    --help|-h)
      echo "Usage: monitor-deployment.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --target=TARGET     hub, provider, or all (default: all)"
      echo "  --interval=SECONDS  Check interval (default: 30)"
      echo "  --count=N           Number of checks, 0=infinite (default: 0)"
      exit 0
      ;;
  esac
done

HUB_URL="${HUB_URL:-http://localhost:3000}"
PROVIDER_URL="${DEMO_PROVIDER_URL:-http://localhost:3001}"

log_info "Monitoring deployments (target=$TARGET, interval=${INTERVAL}s)"
log_info "Hub: $HUB_URL | Provider: $PROVIDER_URL"
echo ""

iteration=0
while true; do
  iteration=$((iteration + 1))
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "--- Check #$iteration at $TIMESTAMP ---"

  if [ "$TARGET" = "hub" ] || [ "$TARGET" = "all" ]; then
    HUB_STATUS=$(http_status "$HUB_URL")
    if [ "$HUB_STATUS" = "200" ]; then
      log_success "Hub: HTTP $HUB_STATUS"
    else
      log_error "Hub: HTTP $HUB_STATUS"
    fi
  fi

  if [ "$TARGET" = "provider" ] || [ "$TARGET" = "all" ]; then
    PROV_STATUS=$(http_status "$PROVIDER_URL/health")
    if [ "$PROV_STATUS" = "200" ]; then
      log_success "Provider: HTTP $PROV_STATUS"
    else
      log_error "Provider: HTTP $PROV_STATUS"
    fi
  fi

  echo ""

  if [ "$COUNT" -gt 0 ] && [ "$iteration" -ge "$COUNT" ]; then
    log_info "Completed $COUNT check(s)"
    break
  fi

  sleep "$INTERVAL"
done
