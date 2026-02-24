#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_help() {
  cat <<EOF
Usage: scripts/setup-demo.sh [--help]

Prepare the IVXP demo environment:
  1) Check local prerequisites
  2) Install dependencies
  3) Build required packages/apps
  4) Run health-check helper

Options:
  --help    Show this message and exit
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  print_help
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required but not found in PATH."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required but not found in PATH."
  exit 1
fi

cd "$ROOT_DIR"

echo "[setup-demo] Installing dependencies..."
pnpm install

echo "[setup-demo] Building protocol package..."
pnpm --filter @ivxp/protocol build

echo "[setup-demo] Building sdk package..."
pnpm --filter @ivxp/sdk build

echo "[setup-demo] Building demo-provider app..."
pnpm --filter @ivxp/demo-provider build

echo "[setup-demo] Building hub app..."
pnpm --filter @ivxp/hub build

echo "[setup-demo] Running health-check helper..."
if [[ -x "$ROOT_DIR/scripts/health-check.sh" ]]; then
  "$ROOT_DIR/scripts/health-check.sh" --local || true
else
  echo "[setup-demo] Skipped health-check: scripts/health-check.sh is missing or not executable."
fi

echo "[setup-demo] Completed."
