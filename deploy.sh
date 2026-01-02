#!/bin/bash
#
# IntervalCoach Deploy Script
# Deploys code to all athlete Apps Script projects with their own config.gs
#
# Usage:
#   ./deploy.sh          # Deploy to all athletes (martijn + eef)
#   ./deploy.sh martijn  # Deploy to Martijn only
#   ./deploy.sh eef      # Deploy to Eef only
#

set -e

ATHLETE=${1:-"all"}

echo "=== IntervalCoach Deploy ==="
echo ""

deploy_athlete() {
    local name=$1
    local clasp_file=".clasp.${name}.json"
    local config_file="config.${name}.gs"

    if [ ! -f "$clasp_file" ]; then
        echo "ERROR: $clasp_file not found"
        return 1
    fi

    if [ ! -f "$config_file" ]; then
        echo "ERROR: $config_file not found"
        return 1
    fi

    echo "Deploying to: $name"

    # Swap clasp config
    cp .clasp.json .clasp.backup.json 2>/dev/null || true
    cp "$clasp_file" .clasp.json

    # Swap app config (temporarily remove from .claspignore)
    cp "$config_file" config.gs
    sed -i.bak '/^config\.gs$/d' .claspignore

    # Push
    clasp push --force

    # Restore
    mv .claspignore.bak .claspignore
    rm -f config.gs
    mv .clasp.backup.json .clasp.json 2>/dev/null || true

    echo "Done: $name"
    echo ""
}

if [ "$ATHLETE" = "all" ]; then
    deploy_athlete "martijn"
    deploy_athlete "eef"
elif [ "$ATHLETE" = "martijn" ] || [ "$ATHLETE" = "eef" ]; then
    deploy_athlete "$ATHLETE"
else
    echo "Unknown athlete: $ATHLETE"
    echo "Usage: ./deploy.sh [martijn|eef|all]"
    exit 1
fi

echo "=== Deploy complete! ==="
