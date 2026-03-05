#!/usr/bin/env bash
# Overnight backfill script for all 25 NBA seasons (2000-01 through 2025-26).
# Runs Regular Season first, then Playoffs. Safe to re-run — already-ingested
# games are skipped automatically.
#
# Usage:
#   ./scripts/backfill-all.sh              # full backfill
#   ./scripts/backfill-all.sh --dry-run    # preview what would be ingested
#
# Logs are written to logs/backfill-<timestamp>.log
# The script exits 0 if both phases succeed, 1 if either fails.

set -euo pipefail

cd "$(dirname "$0")/.."

# --- Config ---
DELAY=500
MIN_DELAY=200
MAX_DELAY=10000
EXTRA_ARGS="${*:-}"

# --- Logging setup ---
mkdir -p logs
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGFILE="logs/backfill-${TIMESTAMP}.log"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOGFILE"
}

# --- Preflight checks ---
if [ -z "${MOTHERDUCK_TOKEN:-}" ]; then
  echo "Error: MOTHERDUCK_TOKEN environment variable is required"
  exit 1
fi

command -v tsx >/dev/null 2>&1 || { echo "Error: tsx not found. Run 'npm install' first."; exit 1; }

log "=== NBA Historical Backfill Started ==="
log "Log file: $LOGFILE"
log "Extra args: ${EXTRA_ARGS:-none}"

# --- Show current status ---
log "--- Pre-backfill status ---"
npx tsx scripts/ingest/status.ts 2>&1 | tee -a "$LOGFILE"

# --- Phase 1: Regular Season ---
log ""
log "=========================================="
log "PHASE 1: Regular Season (all seasons)"
log "=========================================="

PHASE1_EXIT=0
npx tsx scripts/ingest/index.ts \
  --all \
  --season-type "Regular Season" \
  --delay "$DELAY" \
  --min-delay "$MIN_DELAY" \
  --max-delay "$MAX_DELAY" \
  $EXTRA_ARGS \
  2>&1 | tee -a "$LOGFILE" || PHASE1_EXIT=$?

if [ "$PHASE1_EXIT" -ne 0 ]; then
  log "WARNING: Regular Season phase exited with code $PHASE1_EXIT (some games may have failed)"
fi

# --- Phase 2: Playoffs ---
log ""
log "=========================================="
log "PHASE 2: Playoffs (all seasons)"
log "=========================================="

PHASE2_EXIT=0
npx tsx scripts/ingest/index.ts \
  --all \
  --season-type "Playoffs" \
  --delay "$DELAY" \
  --min-delay "$MIN_DELAY" \
  --max-delay "$MAX_DELAY" \
  $EXTRA_ARGS \
  2>&1 | tee -a "$LOGFILE" || PHASE2_EXIT=$?

if [ "$PHASE2_EXIT" -ne 0 ]; then
  log "WARNING: Playoffs phase exited with code $PHASE2_EXIT (some games may have failed)"
fi

# --- Post-backfill status ---
log ""
log "--- Post-backfill status ---"
npx tsx scripts/ingest/status.ts 2>&1 | tee -a "$LOGFILE"

# --- Summary ---
log ""
log "=== Backfill Complete ==="
log "Regular Season exit code: $PHASE1_EXIT"
log "Playoffs exit code: $PHASE2_EXIT"
log "Full log: $LOGFILE"

if [ "$PHASE1_EXIT" -ne 0 ] || [ "$PHASE2_EXIT" -ne 0 ]; then
  log "Some games failed. Re-run this script to retry — successful games will be skipped."
  exit 1
fi

log "All phases completed successfully!"
exit 0
