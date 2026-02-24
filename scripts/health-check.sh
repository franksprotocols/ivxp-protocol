#!/bin/bash
set -euo pipefail

PROVIDER_URL="http://localhost:3001"
HUB_URL="http://localhost:3000"
LOCAL_MODE=false

print_help() {
  cat <<EOF
Usage: scripts/health-check.sh [--local] [--provider-url URL] [--help]

Checks:
  - provider /health
  - provider /ivxp/catalog
  - hub endpoints

Options:
  --local              Use local defaults for provider and hub checks
  --provider-url URL   Override provider URL (default: http://localhost:3001)
  --help               Show this message and exit
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      LOCAL_MODE=true
      shift
      ;;
    --provider-url)
      if [[ $# -lt 2 ]]; then
        echo "Error: --provider-url requires a value."
        exit 1
      fi
      PROVIDER_URL="$2"
      shift 2
      ;;
    --help)
      print_help
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1"
      print_help
      exit 1
      ;;
  esac
done

if [[ "$LOCAL_MODE" == "true" ]]; then
  PROVIDER_URL="${PROVIDER_URL:-http://localhost:3001}"
  HUB_URL="http://localhost:3000"
fi

passed=0
failed=0

check_url() {
  local name="$1"
  local url="$2"
  if curl -fsS "$url" >/dev/null; then
    echo "PASS: $name -> $url"
    passed=$((passed + 1))
  else
    echo "FAIL: $name -> $url"
    failed=$((failed + 1))
  fi
}

echo "Running health checks..."
check_url "Provider health endpoint" "${PROVIDER_URL}/health"
check_url "Provider catalog endpoint" "${PROVIDER_URL}/ivxp/catalog"
check_url "Hub homepage endpoint" "${HUB_URL}/"
check_url "Hub marketplace endpoint" "${HUB_URL}/marketplace"

echo
echo "Health check summary: ${passed} passed, ${failed} failed"

if [[ "$failed" -gt 0 ]]; then
  echo "FAIL: one or more checks failed."
  exit 1
fi

echo "PASS: all checks passed."
