#!/bin/bash
# IVXP Demo Setup Script
#
# Automates the build and verification of all IVXP components
# for running the E2E demo locally.
#
# Usage: ./scripts/setup-demo.sh [--skip-build] [--local]

set -euo pipefail

# Colors for output (disabled if not a terminal or TERM is dumb)
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

SKIP_BUILD=false
LOCAL_MODE=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --local) LOCAL_MODE=true ;;
    --help|-h)
      echo "Usage: ./scripts/setup-demo.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-build  Skip building packages"
      echo "  --local       Configure for local development"
      echo "  -h, --help    Show this help message"
      exit 0
      ;;
  esac
done

echo -e "${BLUE}IVXP Protocol Demo Setup${NC}"
echo "========================"
echo ""

# ------------------------------------------------------------------
# Step 1: Check prerequisites
# ------------------------------------------------------------------
echo -e "${BLUE}[1/5]${NC} Checking prerequisites..."

MISSING=()

if ! command -v node >/dev/null 2>&1; then
  MISSING+=("node (>= 20.0.0)")
else
  NODE_VERSION=$(node -v | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${RED}Node.js >= 20 required, found v${NODE_VERSION}${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}node${NC} v${NODE_VERSION}"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  MISSING+=("pnpm (>= 9.0.0)")
else
  PNPM_VERSION=$(pnpm -v)
  echo -e "  ${GREEN}pnpm${NC} v${PNPM_VERSION}"
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}Missing required tools:${NC}"
  for tool in "${MISSING[@]}"; do
    echo -e "  - $tool"
  done
  exit 1
fi

echo -e "  ${GREEN}All prerequisites OK${NC}"
echo ""

# ------------------------------------------------------------------
# Step 2: Install dependencies
# ------------------------------------------------------------------
echo -e "${BLUE}[2/5]${NC} Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo -e "  ${GREEN}Dependencies installed${NC}"
echo ""

# ------------------------------------------------------------------
# Step 3: Build packages
# ------------------------------------------------------------------
if [ "$SKIP_BUILD" = true ]; then
  echo -e "${YELLOW}[3/5] Skipping build (--skip-build)${NC}"
else
  echo -e "${BLUE}[3/5]${NC} Building packages..."

  echo "  Building @ivxp/protocol..."
  pnpm --filter @ivxp/protocol build

  echo "  Building @ivxp/sdk..."
  pnpm --filter @ivxp/sdk build

  echo "  Building @ivxp/test-utils..."
  pnpm --filter @ivxp/test-utils build

  echo "  Building demo-provider..."
  pnpm --filter @ivxp/demo-provider build

  echo "  Building hub..."
  pnpm --filter @ivxp/hub build

  echo -e "  ${GREEN}All packages built${NC}"
fi
echo ""

# ------------------------------------------------------------------
# Step 4: Validate environment
# ------------------------------------------------------------------
echo -e "${BLUE}[4/5]${NC} Validating environment..."

if [ "$LOCAL_MODE" = true ]; then
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      echo -e "  ${YELLOW}No .env found, copying from .env.example${NC}"
      cp .env.example .env
      echo -e "  ${YELLOW}Please edit .env and set PROVIDER_PRIVATE_KEY${NC}"
    else
      echo -e "  ${RED}No .env or .env.example found${NC}"
      exit 1
    fi
  else
    echo -e "  ${GREEN}.env file exists${NC}"
  fi
fi

echo -e "  ${GREEN}Environment OK${NC}"
echo ""

# ------------------------------------------------------------------
# Step 5: Run health checks
# ------------------------------------------------------------------
echo -e "${BLUE}[5/5]${NC} Running health checks..."

HEALTH_SCRIPT="$(dirname "$0")/health-check.sh"
if [ -x "$HEALTH_SCRIPT" ]; then
  bash "$HEALTH_SCRIPT"
else
  echo -e "  ${YELLOW}Health check script not found or not executable${NC}"
  echo -e "  ${YELLOW}Skipping health checks${NC}"
fi

echo ""
echo -e "${GREEN}Demo setup complete!${NC}"
echo ""
echo "Deployment options:"
echo "  1. Railway:  railway up (from apps/demo-provider/)"
echo "  2. Local:    pnpm --filter @ivxp/demo-provider start"
echo ""
echo "Start the Hub:"
echo "  Local dev:   pnpm --filter @ivxp/hub dev"
echo "  Production:  pnpm --filter @ivxp/hub start"
echo ""
echo "Follow the demo guide: docs/demo/README.md"
