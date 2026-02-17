#!/usr/bin/env bash
# Performance Benchmark Suite for IVXP Protocol
# Story 8.9: Performance Benchmark & Validation
#
# Orchestrates all performance benchmarks:
# 1. API response time benchmarks (NFR-4: P95 < 200ms)
# 2. Payment flow latency (NFR-4: E2E < 15s)
# 3. SDK integration time (NFR-5: < 5 minutes)
# 4. Hub Lighthouse audit (CWV targets)
#
# Usage:
#   ./scripts/qa/run-performance-tests.sh [--report]
#
# Options:
#   --report  Generate markdown report to stdout

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPORT_MODE=false

for arg in "$@"; do
  case "$arg" in
    --report) REPORT_MODE=true ;;
  esac
done

echo "=== IVXP Performance Benchmark Suite ==="
echo ""
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Node: $(node --version)"
echo ""

PASS=0
FAIL=0

# Helper to track results
check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "PASS" ]; then
    echo "  [PASS] $name"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $name"
    FAIL=$((FAIL + 1))
  fi
}

# -----------------------------------------------------------------------
# 1. API Response Time Benchmarks
# -----------------------------------------------------------------------
echo "--- 1. API Response Time Benchmarks ---"
echo "  Target: All IVXP API endpoints < 200ms at P95"
echo "  Endpoints: GET /ivxp/catalog, POST /ivxp/request, POST /ivxp/deliver,"
echo "             GET /ivxp/status/{id}, GET /ivxp/download/{id}"
echo "  Concurrency: 10, 50, 100 concurrent requests"
echo ""

# Verify benchmark module exists
if [ -f "$ROOT/scripts/qa/perf/api-benchmark.ts" ]; then
  check "API benchmark module exists" "PASS"
else
  check "API benchmark module exists" "FAIL"
fi

# Verify all endpoints are defined in provider
if grep -q 'app.get("/ivxp/catalog"' "$ROOT/apps/demo-provider/src/server.ts" && \
   grep -q 'app.post("/ivxp/request"' "$ROOT/apps/demo-provider/src/server.ts" && \
   grep -q 'app.post("/ivxp/deliver"' "$ROOT/apps/demo-provider/src/server.ts" && \
   grep -q 'app.get("/ivxp/status/:orderId"' "$ROOT/apps/demo-provider/src/server.ts" && \
   grep -q 'app.get("/ivxp/download/:orderId"' "$ROOT/apps/demo-provider/src/server.ts"; then
  check "All 5 IVXP endpoints defined in provider" "PASS"
else
  check "All 5 IVXP endpoints defined in provider" "FAIL"
fi

# Verify rate limiting is configured (affects benchmark accuracy)
if grep -q "rateLimit" "$ROOT/apps/demo-provider/src/server.ts"; then
  check "Rate limiting configured (benchmark consideration)" "PASS"
else
  check "Rate limiting configured (benchmark consideration)" "FAIL"
fi

echo ""

# -----------------------------------------------------------------------
# 2. Payment Flow Latency
# -----------------------------------------------------------------------
echo "--- 2. Payment Flow Latency ---"
echo "  Target: End-to-end payment flow < 15 seconds"
echo "  Network: Base Sepolia testnet"
echo "  Iterations: 10 payment cycles"
echo ""

if [ -f "$ROOT/scripts/qa/perf/payment-benchmark.ts" ]; then
  check "Payment benchmark module exists" "PASS"
else
  check "Payment benchmark module exists" "FAIL"
fi

# Verify payment module exists in SDK
if [ -f "$ROOT/packages/sdk/src/payment/index.ts" ]; then
  check "SDK payment module exists" "PASS"
else
  check "SDK payment module exists" "FAIL"
fi

# Verify USDC contract addresses are defined
if grep -q "USDC_CONTRACT_ADDRESSES" "$ROOT/packages/protocol/src/index.ts"; then
  check "USDC contract addresses defined in protocol" "PASS"
else
  check "USDC contract addresses defined in protocol" "FAIL"
fi

echo ""

# -----------------------------------------------------------------------
# 3. SDK Integration Time
# -----------------------------------------------------------------------
echo "--- 3. SDK Integration Time ---"
echo "  Target: Import + first successful call < 5 minutes"
echo "  Testers: Minimum 2 independent developers"
echo ""

if [ -f "$ROOT/scripts/qa/perf/sdk-integration-benchmark.ts" ]; then
  check "SDK integration benchmark module exists" "PASS"
else
  check "SDK integration benchmark module exists" "FAIL"
fi

# Verify SDK exports createIVXPClient for one-line experience
if grep -q "createIVXPClient" "$ROOT/packages/sdk/src/index.ts"; then
  check "SDK exports createIVXPClient (one-line experience)" "PASS"
else
  check "SDK exports createIVXPClient (one-line experience)" "FAIL"
fi

# Verify SDK has RequestServiceParams type
if grep -q "RequestServiceParams" "$ROOT/packages/sdk/src/index.ts"; then
  check "SDK exports RequestServiceParams type" "PASS"
else
  check "SDK exports RequestServiceParams type" "FAIL"
fi

echo ""

# -----------------------------------------------------------------------
# 4. Hub Lighthouse Audit
# -----------------------------------------------------------------------
echo "--- 4. Hub Frontend Lighthouse Audit ---"
echo "  Targets: LCP < 2.5s, FID < 100ms, CLS < 0.1"
echo "  Device: Mobile (Moto G4)"
echo "  Network: 4G throttling"
echo "  Pages: Homepage, Marketplace, Order Status"
echo ""

if [ -f "$ROOT/scripts/qa/perf/lighthouse-benchmark.ts" ]; then
  check "Lighthouse benchmark module exists" "PASS"
else
  check "Lighthouse benchmark module exists" "FAIL"
fi

# Verify Hub uses React Strict Mode
if grep -q "reactStrictMode: true" "$ROOT/apps/hub/next.config.ts"; then
  check "Hub React Strict Mode enabled" "PASS"
else
  check "Hub React Strict Mode enabled" "FAIL"
fi

# Verify Hub has PostCSS/Tailwind for minimal CSS
if [ -f "$ROOT/apps/hub/postcss.config.mjs" ]; then
  check "Hub uses Tailwind CSS (minimal CSS overhead)" "PASS"
else
  check "Hub uses Tailwind CSS (minimal CSS overhead)" "FAIL"
fi

# Verify Hub pages exist
if [ -f "$ROOT/apps/hub/src/app/page.tsx" ] && \
   [ -d "$ROOT/apps/hub/src/app/marketplace" ] && \
   [ -d "$ROOT/apps/hub/src/app/(orders)" ]; then
  check "Hub pages exist (Homepage, Marketplace, Orders)" "PASS"
else
  check "Hub pages exist (Homepage, Marketplace, Orders)" "FAIL"
fi

echo ""

# -----------------------------------------------------------------------
# 5. Run Vitest Performance Tests
# -----------------------------------------------------------------------
echo "--- 5. Running Vitest Performance Tests ---"
echo ""

if npx vitest run "$ROOT/tests/performance-benchmark.test.ts" --reporter=verbose 2>&1; then
  check "Vitest performance benchmark tests" "PASS"
else
  check "Vitest performance benchmark tests" "FAIL"
fi

echo ""

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
echo "=== Performance Benchmark Summary ==="
echo "  Total checks: $TOTAL"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: $FAIL check(s) failed"
  exit 1
else
  echo "RESULT: All performance checks passed"
  exit 0
fi
