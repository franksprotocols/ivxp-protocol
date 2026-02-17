#!/bin/bash
# Pre-deployment build verification.
#
# Runs lint, typecheck, tests, and build for the specified target.
# Usage: ./scripts/utils/verify-build.sh [--target hub|provider|all]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

PROJECT_ROOT="$(find_project_root)"
TARGET="${1:-all}"

# Strip --target= prefix if present
TARGET="${TARGET#--target=}"

# Handle --help
if [ "$TARGET" = "--help" ] || [ "$TARGET" = "-h" ]; then
  echo "Usage: verify-build.sh [--target=hub|provider|all]"
  echo ""
  echo "Options:"
  echo "  --target=TARGET  Target to verify (hub, provider, or all)"
  echo ""
  echo "Runs lint, typecheck, tests, and build for the specified target."
  exit 0
fi

log_info "Verifying build for target: $TARGET"
log_info "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# ── Step 1: Dependency check ────────────────────────────────────────
require_command "node" "https://nodejs.org"
require_command "pnpm" "npm install -g pnpm"

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  log_error "Node.js >= 20 required (found v$NODE_VERSION)"
  exit 1
fi
log_success "Node.js $(node -v)"

# ── Step 2: Validate project structure ─────────────────────────────
require_file "$PROJECT_ROOT/pnpm-workspace.yaml" "pnpm workspace config"
require_file "$PROJECT_ROOT/package.json" "root package.json"
require_file "$PROJECT_ROOT/tsconfig.base.json" "base TypeScript config"

case "$TARGET" in
  hub)
    require_file "$PROJECT_ROOT/apps/hub/package.json" "Hub package.json"
    require_file "$PROJECT_ROOT/apps/hub/tsconfig.json" "Hub tsconfig.json"
    ;;
  provider)
    require_file "$PROJECT_ROOT/apps/demo-provider/package.json" "Provider package.json"
    require_file "$PROJECT_ROOT/apps/demo-provider/tsconfig.json" "Provider tsconfig.json"
    ;;
  all)
    require_file "$PROJECT_ROOT/apps/hub/package.json" "Hub package.json"
    require_file "$PROJECT_ROOT/apps/demo-provider/package.json" "Provider package.json"
    ;;
esac

# ── Step 3: Install dependencies ────────────────────────────────────
log_info "Installing dependencies..."
run_cmd pnpm install --frozen-lockfile

# ── Step 4: Lint ────────────────────────────────────────────────────
log_info "Running linter..."
run_cmd pnpm lint || {
  log_warn "Lint warnings detected — review before deploying"
}

# ── Step 5: Type check ─────────────────────────────────────────────
log_info "Running type check..."
run_cmd pnpm typecheck

# ── Step 6: Tests ───────────────────────────────────────────────────
log_info "Running tests..."
case "$TARGET" in
  hub)
    run_cmd pnpm --filter @ivxp/hub test -- --run
    ;;
  provider)
    run_cmd pnpm --filter @ivxp/demo-provider test -- --run
    ;;
  all)
    run_cmd pnpm test -- --run
    ;;
  *)
    log_error "Unknown target: $TARGET (use hub, provider, or all)"
    exit 1
    ;;
esac

# ── Step 7: Build ───────────────────────────────────────────────────
log_info "Building packages..."
case "$TARGET" in
  hub)
    run_cmd pnpm --filter @ivxp/protocol build
    run_cmd pnpm --filter @ivxp/sdk build
    run_cmd pnpm --filter @ivxp/hub build
    ;;
  provider)
    run_cmd pnpm --filter @ivxp/protocol build
    run_cmd pnpm --filter @ivxp/sdk build
    run_cmd pnpm --filter @ivxp/demo-provider build
    ;;
  all)
    run_cmd pnpm build
    ;;
esac

log_success "Build verification passed for target: $TARGET"
