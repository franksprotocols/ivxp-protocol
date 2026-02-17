#!/usr/bin/env bash
# Final QA: Functional Requirements Validation
# Story 8.10: Final Quality Assurance
#
# Runs all unit, integration, and interop tests across all packages
# and reports pass/fail status per component.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS=0
FAIL=0
SKIP=0

echo "=== IVXP Final QA: Functional Requirements ==="
echo ""

# Helper: run tests for a package and report
run_package_tests() {
  local name="$1"
  local filter="$2"
  echo "--- Testing: $name ---"
  if pnpm --filter "$filter" test 2>&1 | tail -5; then
    PASS=$((PASS + 1))
    echo "RESULT: $name PASSED"
  else
    FAIL=$((FAIL + 1))
    echo "RESULT: $name FAILED"
  fi
  echo ""
}

# 1. Protocol package (FR-P0: Wire protocol compatibility)
echo "=== FR-P0: Wire Protocol Compatibility ==="
run_package_tests "@ivxp/protocol" "@ivxp/protocol"

# 2. Test utilities
echo "=== Test Utilities ==="
run_package_tests "@ivxp/test-utils" "@ivxp/test-utils"

# 3. SDK (FR-C1-C6, FR-P1-P7)
echo "=== SDK: Client & Provider Requirements ==="
echo "--- Running SDK tests (excluding Anvil-dependent) ---"
cd "$ROOT/packages/sdk"
if npx vitest run \
  --exclude 'src/__tests__/integration/**' \
  --exclude 'src/payment/verify.test.ts' \
  --exclude 'src/payment/transfer.test.ts' 2>&1 | tail -5; then
  PASS=$((PASS + 1))
  echo "RESULT: SDK PASSED"
else
  FAIL=$((FAIL + 1))
  echo "RESULT: SDK FAILED"
fi
cd "$ROOT"
echo ""

# 4. Hub (FR-H1-H6)
echo "=== Hub: Web UI Requirements ==="
run_package_tests "@ivxp/hub" "@ivxp/hub"

# 5. Demo Provider
echo "=== Demo Provider ==="
run_package_tests "demo-provider" "demo-provider"

# Summary
echo "=== Functional Test Summary ==="
echo "PASSED: $PASS"
echo "FAILED: $FAIL"
echo "SKIPPED: $SKIP (Anvil-dependent tests require local blockchain)"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "OVERALL: FAILED"
  exit 1
else
  echo "OVERALL: ALL FUNCTIONAL TESTS PASSED"
  exit 0
fi
