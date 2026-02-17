#!/usr/bin/env bash
#
# batch-story-dev.sh — Orchestrate sequential story development via Claude CLI
#
# Each story runs in an independent Claude session with full context window,
# calling /mw-story-dev-full internally (5-phase: develop → review → fix → commit → PR).
#
# Usage:
#   ./scripts/batch-story-dev.sh                        # Run all ready-for-dev stories
#   ./scripts/batch-story-dev.sh --epic 3               # Only epic 3
#   ./scripts/batch-story-dev.sh --start-from 3-7       # Start from specific story
#   ./scripts/batch-story-dev.sh --max-stories 3        # Stop after 3 stories
#   ./scripts/batch-story-dev.sh --dry-run              # List stories without executing
#   ./scripts/batch-story-dev.sh --resume 3-5 --phase 3 # Resume failed story at phase

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SPRINT_STATUS="$PROJECT_DIR/_bmad-output/implementation-artifacts/sprint-status.yaml"
LOG_DIR="$PROJECT_DIR/logs/batch-dev"
CHECKPOINT="$PROJECT_DIR/.claude/workflow-checkpoint.json"

MAX_BUDGET_PER_STORY=15
COOLDOWN_SECONDS=0
PERMISSION_MODE="bypassPermissions"

# ─── Defaults ────────────────────────────────────────────────────────────────
EPIC_FILTER=""
START_FROM=""
MAX_STORIES=0
DRY_RUN=false
RESUME_STORY=""
RESUME_PHASE=""
SKIP_ON_FAILURE=false
INTERACTIVE=false
VERBOSE=false

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Parse args ──────────────────────────────────────────────────────────────
usage() {
  cat <<'USAGE'
Usage: batch-story-dev.sh [OPTIONS]

Options:
  --epic N              Only run stories from epic N
  --start-from ID       Start from story ID (e.g., 3-7)
  --max-stories N       Stop after N stories (0 = unlimited)
  --max-budget N        Max USD per story (default: 15)
  --cooldown N          Seconds between stories (default: 0)
  --skip-on-failure     Skip failed stories instead of stopping
  --interactive         Require confirmation before starting (default: auto-start)
  --resume ID           Resume a specific failed story
  --phase N             Phase to resume from (use with --resume)
  --dry-run             List stories without executing
  --verbose             Show full Claude output
  -h, --help            Show this help
USAGE
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --epic)         EPIC_FILTER="$2"; shift 2 ;;
    --start-from)   START_FROM="$2"; shift 2 ;;
    --max-stories)  MAX_STORIES="$2"; shift 2 ;;
    --max-budget)   MAX_BUDGET_PER_STORY="$2"; shift 2 ;;
    --cooldown)     COOLDOWN_SECONDS="$2"; shift 2 ;;
    --skip-on-failure) SKIP_ON_FAILURE=true; shift ;;
    --interactive)  INTERACTIVE=true; shift ;;
    --resume)       RESUME_STORY="$2"; shift 2 ;;
    --phase)        RESUME_PHASE="$2"; shift 2 ;;
    --dry-run)      DRY_RUN=true; shift ;;
    --verbose)      VERBOSE=true; shift ;;
    -h|--help)      usage ;;
    *)              echo "Unknown option: $1"; usage ;;
  esac
done

# ─── Functions ───────────────────────────────────────────────────────────────

log() {
  local level="$1"; shift
  local timestamp
  timestamp="$(date '+%H:%M:%S')"
  case "$level" in
    INFO)  echo -e "${CYAN}[$timestamp]${NC} $*" ;;
    OK)    echo -e "${GREEN}[$timestamp] OK${NC} $*" ;;
    WARN)  echo -e "${YELLOW}[$timestamp] WARN${NC} $*" ;;
    ERROR) echo -e "${RED}[$timestamp] ERROR${NC} $*" ;;
    STEP)  echo -e "${BLUE}[$timestamp] >>>${NC} $*" ;;
  esac
}

# Extract ready-for-dev story IDs from sprint-status.yaml
get_stories() {
  if [[ ! -f "$SPRINT_STATUS" ]]; then
    log ERROR "Sprint status file not found: $SPRINT_STATUS"
    exit 1
  fi

  local stories=()
  local found_start=false

  # Parse YAML: lines matching "  story-id: ready-for-dev"
  while IFS= read -r line; do
    # Skip comments, empty lines, epic lines, retrospective lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ epic- ]] && continue
    [[ "$line" =~ retrospective ]] && continue

    # Match "  story-id: ready-for-dev"
    if [[ "$line" =~ ^[[:space:]]+([0-9]+-[0-9]+-[a-z0-9-]+):[[:space:]]+ready-for-dev ]]; then
      local story_id="${BASH_REMATCH[1]}"

      # Epic filter
      if [[ -n "$EPIC_FILTER" ]]; then
        local epic_num="${story_id%%-*}"
        [[ "$epic_num" != "$EPIC_FILTER" ]] && continue
      fi

      # Start-from filter
      if [[ -n "$START_FROM" && "$found_start" == false ]]; then
        if [[ "$story_id" == "$START_FROM"* ]]; then
          found_start=true
        else
          continue
        fi
      fi

      stories+=("$story_id")

      # Max stories limit
      if [[ "$MAX_STORIES" -gt 0 && "${#stories[@]}" -ge "$MAX_STORIES" ]]; then
        break
      fi
    fi
  done < "$SPRINT_STATUS"

  # If START_FROM was set but no match found, nothing to return
  if [[ -n "$START_FROM" && "$found_start" == false ]]; then
    log WARN "Story $START_FROM not found or not ready-for-dev"
  fi

  printf '%s\n' "${stories[@]}"
}

# Run a single story through Claude CLI
run_story() {
  local story_id="$1"
  local log_file="$LOG_DIR/${story_id}.log"
  local resume_arg=""

  if [[ -n "$RESUME_PHASE" ]]; then
    resume_arg=" --resume-from=$RESUME_PHASE"
  fi

  local prompt="/mw-story-dev-full --story-id=${story_id}${resume_arg}"

  log STEP "Executing: claude -p \"$prompt\""

  # Unset CLAUDECODE to allow nested invocation
  local exit_code=0
  if [[ "$VERBOSE" == true ]]; then
    env -u CLAUDECODE claude \
      -p "$prompt" \
      --model sonnet \
      --max-budget-usd "$MAX_BUDGET_PER_STORY" \
      --permission-mode "$PERMISSION_MODE" \
      2>&1 | tee "$log_file" || exit_code=$?
  else
    env -u CLAUDECODE claude \
      -p "$prompt" \
      --model sonnet \
      --max-budget-usd "$MAX_BUDGET_PER_STORY" \
      --permission-mode "$PERMISSION_MODE" \
      > "$log_file" 2>&1 || exit_code=$?
  fi

  return $exit_code
}

# Pull latest main after a story's PR branch is created
sync_main() {
  cd "$PROJECT_DIR"
  local current_branch
  current_branch="$(git branch --show-current)"

  if [[ "$current_branch" != "main" ]]; then
    log WARN "Not on main branch (on $current_branch), switching back"
    git checkout main 2>/dev/null || true
  fi
}

# Print summary table
print_summary() {
  local -n results_ref=$1
  local total="${#results_ref[@]}"
  local succeeded=0
  local failed=0
  local failed_list=()

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}              Batch Story Development Report           ${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
  printf "%-45s %s\n" "Story" "Status"
  echo "─────────────────────────────────────────────────────────"

  for entry in "${results_ref[@]}"; do
    local sid="${entry%%:*}"
    local status="${entry#*:}"
    if [[ "$status" == "OK" ]]; then
      printf "%-45s ${GREEN}%s${NC}\n" "$sid" "OK"
      ((succeeded++))
    else
      printf "%-45s ${RED}%s${NC}\n" "$sid" "FAILED"
      ((failed++))
      failed_list+=("$sid")
    fi
  done

  echo "─────────────────────────────────────────────────────────"
  echo -e "Total: $total | ${GREEN}Passed: $succeeded${NC} | ${RED}Failed: $failed${NC}"
  echo -e "Logs: ${CYAN}$LOG_DIR/${NC}"

  if [[ ${#failed_list[@]} -gt 0 ]]; then
    echo ""
    echo -e "${YELLOW}To resume failed stories:${NC}"
    for sid in "${failed_list[@]}"; do
      echo "  ./scripts/batch-story-dev.sh --resume $sid --phase 2"
    done
  fi

  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  echo -e "${BOLD}"
  echo "  ╔═══════════════════════════════════════════╗"
  echo "  ║     IVXP Batch Story Development          ║"
  echo "  ╚═══════════════════════════════════════════╝"
  echo -e "${NC}"

  # Handle single-story resume mode
  if [[ -n "$RESUME_STORY" ]]; then
    log INFO "Resuming story: $RESUME_STORY (phase: ${RESUME_PHASE:-2})"
    mkdir -p "$LOG_DIR"

    if run_story "$RESUME_STORY"; then
      log OK "Story $RESUME_STORY completed successfully"
      sync_main
    else
      log ERROR "Story $RESUME_STORY failed. Check: $LOG_DIR/${RESUME_STORY}.log"
      exit 1
    fi
    return
  fi

  # Collect stories
  local stories=()
  while IFS= read -r s; do
    [[ -n "$s" ]] && stories+=("$s")
  done < <(get_stories)

  if [[ ${#stories[@]} -eq 0 ]]; then
    log WARN "No ready-for-dev stories found"
    [[ -n "$EPIC_FILTER" ]] && log INFO "Epic filter: $EPIC_FILTER"
    [[ -n "$START_FROM" ]] && log INFO "Start from: $START_FROM"
    exit 0
  fi

  log INFO "Found ${#stories[@]} stories to develop"
  [[ -n "$EPIC_FILTER" ]] && log INFO "Epic filter: $EPIC_FILTER"
  [[ "$MAX_STORIES" -gt 0 ]] && log INFO "Max stories: $MAX_STORIES"
  log INFO "Budget per story: \$$MAX_BUDGET_PER_STORY"
  echo ""

  # List stories
  for i in "${!stories[@]}"; do
    echo -e "  $((i+1)). ${stories[$i]}"
  done
  echo ""

  # Dry run exits here
  if [[ "$DRY_RUN" == true ]]; then
    log INFO "Dry run complete. Use without --dry-run to execute."
    exit 0
  fi

  # Confirm (only in interactive mode)
  if [[ "$INTERACTIVE" == true ]]; then
    echo -en "${YELLOW}Start batch development of ${#stories[@]} stories? [y/N] ${NC}"
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      log INFO "Aborted."
      exit 0
    fi
  else
    log INFO "Auto-starting (use --interactive to confirm first)"
  fi

  # Setup
  mkdir -p "$LOG_DIR"
  local results=()
  local start_time
  start_time="$(date +%s)"

  # Execute stories sequentially
  for i in "${!stories[@]}"; do
    local story_id="${stories[$i]}"
    local story_num=$((i+1))
    local total=${#stories[@]}

    echo ""
    echo -e "${BOLD}━━━ Story $story_num/$total: $story_id ━━━${NC}"
    log INFO "Starting story: $story_id"

    # Clean checkpoint from previous story
    rm -f "$CHECKPOINT"

    # Ensure we're on main
    sync_main

    local story_start
    story_start="$(date +%s)"

    if run_story "$story_id"; then
      local story_duration=$(( $(date +%s) - story_start ))
      log OK "$story_id completed in ${story_duration}s"
      results+=("${story_id}:OK")
    else
      local story_duration=$(( $(date +%s) - story_start ))
      log ERROR "$story_id failed after ${story_duration}s"
      log ERROR "Log: $LOG_DIR/${story_id}.log"
      results+=("${story_id}:FAILED")

      if [[ "$SKIP_ON_FAILURE" == true ]]; then
        log WARN "Skipping to next story (--skip-on-failure)"
      else
        log ERROR "Stopping batch. Resume with:"
        log ERROR "  ./scripts/batch-story-dev.sh --resume $story_id --phase 2"
        log ERROR "  ./scripts/batch-story-dev.sh --start-from $story_id"
        print_summary results
        exit 1
      fi
    fi

    # Cooldown between stories
    if [[ $story_num -lt $total && "$COOLDOWN_SECONDS" -gt 0 ]]; then
      log INFO "Cooldown ${COOLDOWN_SECONDS}s..."
      sleep "$COOLDOWN_SECONDS"
    fi
  done

  local total_duration=$(( $(date +%s) - start_time ))
  local minutes=$(( total_duration / 60 ))
  local seconds=$(( total_duration % 60 ))

  echo ""
  log INFO "Total time: ${minutes}m ${seconds}s"
  print_summary results
}

main "$@"
