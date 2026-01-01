#!/bin/bash
#
# IntervalCoach Deploy Script
# Deploys code to athlete-specific Apps Script projects while preserving their config.gs
#
# Usage:
#   ./deploy.sh eef      # Deploy to Eef's project
#   ./deploy.sh          # Deploy to default (your own) project
#

set -e

ATHLETE=${1:-""}
CLASP_BACKUP=".clasp.backup.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function to restore original .clasp.json
cleanup() {
    if [ -f "$CLASP_BACKUP" ]; then
        mv "$CLASP_BACKUP" .clasp.json
        log_info "Restored original .clasp.json"
    fi
}

# Set trap to cleanup on exit (success or failure)
trap cleanup EXIT

if [ -n "$ATHLETE" ]; then
    CLASP_FILE=".clasp.${ATHLETE}.json"

    if [ ! -f "$CLASP_FILE" ]; then
        log_error "Config file not found: $CLASP_FILE"
        echo "Available athlete configs:"
        ls -1 .clasp.*.json 2>/dev/null | grep -v backup || echo "  (none)"
        exit 1
    fi

    log_info "Deploying to: $ATHLETE"

    # Backup current .clasp.json
    if [ -f ".clasp.json" ]; then
        cp .clasp.json "$CLASP_BACKUP"
    fi

    # Switch to athlete's project
    cp "$CLASP_FILE" .clasp.json
else
    log_info "Deploying to: default project"
fi

# Pull to temp dir to check for config.gs
TEMP_DIR=$(mktemp -d)
log_info "Checking for existing config.gs..."

# Pull to temp directory
ORIGINAL_DIR=$(pwd)
cp .clasp.json "$TEMP_DIR/"
cd "$TEMP_DIR"
clasp pull 2>/dev/null || true

# Check if config.gs exists remotely (pulled as config.js)
if [ -f "config.js" ]; then
    log_info "Found existing config.gs - will be preserved"
    HAS_CONFIG=true
else
    log_warn "No config.gs found - athlete needs to create it"
    HAS_CONFIG=false
fi

cd "$ORIGINAL_DIR"
rm -rf "$TEMP_DIR"

# Push code (without --force to preserve remote-only files)
log_info "Pushing code..."
clasp push

if [ "$HAS_CONFIG" = false ]; then
    echo ""
    log_warn "ACTIE VEREIST: Maak config.gs aan in de Apps Script editor"
fi

log_info "Deploy complete!"

# Show project link
SCRIPT_ID=$(grep -o '"scriptId"[[:space:]]*:[[:space:]]*"[^"]*"' .clasp.json | cut -d'"' -f4)
echo ""
echo "Project URL: https://script.google.com/d/${SCRIPT_ID}/edit"
