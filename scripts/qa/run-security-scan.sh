#!/usr/bin/env bash
# Security scan script for IVXP Protocol
# Story 8.8: Security Audit & Review
#
# Checks:
# 1. No hardcoded secrets in source code
# 2. .env files are gitignored
# 3. npm audit for dependency vulnerabilities
# 4. HTTPS enforcement in schemas

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ERRORS=0

echo "=== IVXP Security Scan ==="
echo ""

# 1. Check for potential hardcoded secrets
echo "--- Checking for hardcoded secrets ---"

# Private keys (0x + 64 hex chars) in non-test source files
SECRETS=$(grep -rn --include="*.ts" -E "0x[a-fA-F0-9]{64}" "$ROOT/packages" "$ROOT/apps" \
  | grep -v node_modules \
  | grep -v dist \
  | grep -v ".test." \
  | grep -v ".spec." \
  | grep -v "__tests__" \
  | grep -v "REGEX" \
  | grep -v "ERC20_TRANSFER_EVENT_TOPIC" \
  | grep -v "USDC_CONTRACT_ADDRESSES" \
  | grep -v "ddf252ad1be2c89b69c2b068fc378daa" \
  || true)

if [ -n "$SECRETS" ]; then
  echo "WARNING: Potential hardcoded secrets found:"
  echo "$SECRETS"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: No hardcoded secrets found in source files"
fi

echo ""

# 2. Check .env files are gitignored
echo "--- Checking .env gitignore ---"
if grep -q "^\.env$" "$ROOT/.gitignore" && grep -q "^\.env\.\*$" "$ROOT/.gitignore"; then
  echo "OK: .env files are in .gitignore"
else
  echo "FAIL: .env files are NOT properly gitignored"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 3. Check for tracked .env files
echo "--- Checking for tracked .env files ---"
TRACKED_ENV=$(git -C "$ROOT" ls-files -- '*.env' '.env.*' '**/.env' '**/.env.*' \
  | grep -v ".env.example" || true)

if [ -n "$TRACKED_ENV" ]; then
  echo "FAIL: .env files tracked in git:"
  echo "$TRACKED_ENV"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: No .env files tracked in git"
fi

echo ""

# 4. Check HTTPS enforcement in schemas
echo "--- Checking HTTPS enforcement ---"
if grep -q 'startsWith("https://"' "$ROOT/apps/hub/src/lib/registry/schemas.ts"; then
  echo "OK: HTTPS enforced for provider endpoint URLs"
else
  echo "FAIL: HTTPS not enforced for provider endpoint URLs"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 5. Check security headers
echo "--- Checking security headers ---"
if grep -q "Strict-Transport-Security" "$ROOT/apps/hub/src/middleware.ts"; then
  echo "OK: HSTS header configured"
else
  echo "FAIL: HSTS header not configured"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "X-Content-Type-Options" "$ROOT/apps/hub/src/middleware.ts"; then
  echo "OK: X-Content-Type-Options header configured"
else
  echo "FAIL: X-Content-Type-Options header not configured"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "Content-Security-Policy" "$ROOT/apps/hub/src/middleware.ts"; then
  echo "OK: CSP header configured"
else
  echo "FAIL: CSP header not configured"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 6. Check rate limiting
echo "--- Checking rate limiting ---"
if grep -q "rateLimit" "$ROOT/apps/demo-provider/src/server.ts"; then
  echo "OK: Rate limiting configured on demo-provider"
else
  echo "FAIL: Rate limiting not configured on demo-provider"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "$ROOT/apps/hub/src/middleware.ts" ] && grep -q "rateLimiter" "$ROOT/apps/hub/src/middleware.ts"; then
  echo "OK: Rate limiting configured on Hub middleware"
else
  echo "FAIL: Rate limiting not configured on Hub middleware"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# Summary
echo "=== Security Scan Complete ==="
if [ "$ERRORS" -gt 0 ]; then
  echo "RESULT: $ERRORS issue(s) found"
  exit 1
else
  echo "RESULT: All checks passed"
  exit 0
fi
