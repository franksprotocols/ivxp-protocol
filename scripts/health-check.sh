#!/bin/bash
# IVXP Demo Health Check Script
#
# Verifies that all demo components are running and responsive.
# Can check both local and deployed services.
#
# Usage: ./scripts/health-check.sh [--local] [--provider-url URL] [--hub-url URL]

set -euo pipefail

# Colors (disabled if not a terminal or TERM is dumb)
if [ -t 1 ] && [ "${TERM:-dumb}" != "dumb" ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Defaults (override via environment variables or CLI flags)
# DEMO_PROVIDER_URL - URL of the demo provider (default: http://localhost:3001)
# HUB_URL           - URL of the Hub application (default: http://localhost:3000)
PROVIDER_URL="${DEMO_PROVIDER_URL:-http://localhost:3001}"
HUB_URL="${HUB_URL:-http://localhost:3000}"
TIMEOUT=10
PASSED=0
FAILED=0
WARNINGS=0

for arg in "$@"; do
  case $arg in
    --local)
      PROVIDER_URL="http://localhost:3001"
      HUB_URL="http://localhost:3000"
      ;;
    --provider-url=*)
      PROVIDER_URL="${arg#*=}"
      ;;
    --hub-url=*)
      HUB_URL="${arg#*=}"
      ;;
    --help|-h)
      echo "Usage: ./scripts/health-check.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --local                Use localhost URLs"
      echo "  --provider-url=URL     Custom provider URL"
      echo "  --hub-url=URL          Custom hub URL"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
  esac
done

echo -e "${BLUE}IVXP Demo Health Check${NC}"
echo "======================"
echo ""
echo "Provider: ${PROVIDER_URL}"
echo "Hub:      ${HUB_URL}"
echo ""

# Helper: check an HTTP endpoint
check_endpoint() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "  ${GREEN}PASS${NC} $name ($url) -> HTTP $http_code"
    PASSED=$((PASSED + 1))
    return 0
  elif [ "$http_code" = "000" ]; then
    echo -e "  ${RED}FAIL${NC} $name ($url) -> Connection refused or timeout"
    FAILED=$((FAILED + 1))
    return 1
  else
    echo -e "  ${YELLOW}WARN${NC} $name ($url) -> HTTP $http_code (expected $expected_status)"
    WARNINGS=$((WARNINGS + 1))
    return 1
  fi
}

# Helper: check JSON response field (handles both JSON and plain text)
check_json_field() {
  local name="$1"
  local url="$2"
  local field="$3"
  local expected="$4"

  local response
  response=$(curl -s --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "")

  if [ -z "$response" ]; then
    echo -e "  ${RED}FAIL${NC} $name -> No response"
    FAILED=$((FAILED + 1))
    return 1
  fi

  # Check if node is available for JSON parsing
  if ! command -v node >/dev/null 2>&1; then
    echo -e "  ${YELLOW}WARN${NC} $name -> node not found, skipping JSON validation"
    WARNINGS=$((WARNINGS + 1))
    return 1
  fi

  # Use node for JSON parsing; handle plain text responses gracefully
  local actual
  actual=$(echo "$response" | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{const parsed=JSON.parse(d);console.log(parsed['$field']!==undefined?parsed['$field']:'FIELD_MISSING')}
      catch{console.log('PARSE_ERROR')}
    })
  " 2>/dev/null || echo "PARSE_ERROR")

  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} $name -> $field=$actual"
    PASSED=$((PASSED + 1))
    return 0
  elif [ "$actual" = "PARSE_ERROR" ]; then
    echo -e "  ${YELLOW}WARN${NC} $name -> Response is not JSON (got plain text)"
    WARNINGS=$((WARNINGS + 1))
    return 1
  elif [ "$actual" = "FIELD_MISSING" ]; then
    echo -e "  ${YELLOW}WARN${NC} $name -> JSON field '$field' not found in response"
    WARNINGS=$((WARNINGS + 1))
    return 1
  else
    echo -e "  ${RED}FAIL${NC} $name -> $field=$actual (expected $expected)"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# ------------------------------------------------------------------
# Check 1: Provider health endpoint
# ------------------------------------------------------------------
echo -e "${BLUE}[Provider]${NC}"
check_endpoint "Health endpoint" "${PROVIDER_URL}/health"
check_json_field "Health status" "${PROVIDER_URL}/health" "status" "ok"
echo ""

# ------------------------------------------------------------------
# Check 2: Provider catalog endpoint
# ------------------------------------------------------------------
echo -e "${BLUE}[Provider Catalog]${NC}"
check_endpoint "Catalog endpoint" "${PROVIDER_URL}/ivxp/catalog"

# Verify catalog has services
CATALOG_RESPONSE=$(curl -s --max-time "$TIMEOUT" "${PROVIDER_URL}/ivxp/catalog" 2>/dev/null || echo "")
if [ -n "$CATALOG_RESPONSE" ] && command -v node >/dev/null 2>&1; then
  SERVICE_COUNT=$(echo "$CATALOG_RESPONSE" | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const data=JSON.parse(d);
        const services=data.services||data.catalog||[];
        console.log(Array.isArray(services)?services.length:0)
      }catch{console.log(0)}
    })
  " 2>/dev/null || echo "0")

  if [ "$SERVICE_COUNT" -ge 2 ]; then
    echo -e "  ${GREEN}PASS${NC} Catalog has $SERVICE_COUNT services"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${YELLOW}WARN${NC} Catalog has $SERVICE_COUNT services (expected >= 2)"
    WARNINGS=$((WARNINGS + 1))
  fi
fi
echo ""

# ------------------------------------------------------------------
# Check 3: Hub accessibility
# ------------------------------------------------------------------
echo -e "${BLUE}[Hub]${NC}"
check_endpoint "Hub homepage" "${HUB_URL}"
check_endpoint "Playground page" "${HUB_URL}/playground"
check_endpoint "Marketplace page" "${HUB_URL}/marketplace"
echo ""

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
echo "======================"
TOTAL=$((PASSED + FAILED + WARNINGS))
echo -e "Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}, ${YELLOW}${WARNINGS} warnings${NC} (${TOTAL} total)"

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}Some checks failed. See above for details.${NC}"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}All critical checks passed with warnings.${NC}"
  exit 0
else
  echo -e "${GREEN}All checks passed. Demo is ready.${NC}"
  exit 0
fi
